package kubernetes

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/transport"
	metricsv "k8s.io/metrics/pkg/client/clientset/versioned"
)

// PrometheusClient queries Prometheus for container metrics with Metrics Server fallback
type PrometheusClient struct {
	baseURL    string
	httpClient *http.Client

	// For K8s API server proxy fallback
	apiProxyAvailable bool
	apiProxyClient    *http.Client
	apiServerURL      string
	serviceNS         string
	serviceName       string
	servicePort       string

	// Metrics Server fallback for real-time metrics (useful for short-lived pods)
	metricsClient metricsv.Interface

	// Track which method works
	mu           sync.RWMutex
	useAPIProxy  bool
	proxyTested  bool
	directTested bool
	directWorks  bool
}

// ContainerMetrics holds all container metrics from Prometheus
type ContainerMetrics struct {
	// Resource metrics
	CPUPercent  float64 // CPU usage as percentage (0-100+)
	MemoryBytes int64   // Memory usage in bytes

	// I/O metrics
	NetworkRxBytes int64
	NetworkTxBytes int64
	DiskReadBytes  int64
	DiskWriteBytes int64
}

// prometheusResponse represents the Prometheus API response structure
type prometheusResponse struct {
	Status string `json:"status"`
	Data   struct {
		ResultType string `json:"resultType"`
		Result     []struct {
			Metric map[string]string `json:"metric"`
			Value  []interface{}     `json:"value"` // [timestamp, value]
		} `json:"result"`
	} `json:"data"`
}

// clusterServiceRegex matches K8s cluster-internal service URLs
// Format: http(s)://{service}.{namespace}.svc.cluster.local:{port}
var clusterServiceRegex = regexp.MustCompile(`^https?://([^.]+)\.([^.]+)\.svc\.cluster\.local(?::(\d+))?(.*)$`)

// Minimum resource values for billing when actual metrics cannot be collected.
// These are conservative estimates for a Python/Freqtrade process.
const (
	// MinimumCPUPercent is the minimum CPU usage (5%) for a running Python process.
	// This accounts for interpreter overhead and basic computation.
	MinimumCPUPercent = 5.0

	// MinimumMemoryBytes is the minimum memory usage (50MB) for a Python process.
	// This covers the Python interpreter, loaded libraries, and basic data structures.
	MinimumMemoryBytes = 50 * 1024 * 1024 // 50 MB
)

// NewPrometheusClient creates a new Prometheus client with Metrics Server fallback
// If restConfig is provided and the URL is a cluster-internal service, it will
// set up API server proxy as a fallback for when direct connection fails.
// It also creates a Metrics Server client for real-time metrics of short-lived pods.
func NewPrometheusClient(prometheusURL string, restConfig *rest.Config) *PrometheusClient {
	if prometheusURL == "" {
		return nil
	}

	client := &PrometheusClient{
		baseURL: prometheusURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}

	// Check if this is a cluster-internal service URL and we have a restConfig
	// Set up API proxy as fallback option
	if restConfig != nil {
		if matches := clusterServiceRegex.FindStringSubmatch(prometheusURL); matches != nil {
			serviceName := matches[1]
			namespace := matches[2]
			port := matches[3]
			if port == "" {
				port = "80"
			}

			// Create an HTTP client using the K8s rest config transport (includes auth)
			transportConfig, err := restConfig.TransportConfig()
			if err == nil {
				rt, err := transport.New(transportConfig)
				if err == nil {
					client.apiProxyClient = &http.Client{
						Transport: rt,
						Timeout:   10 * time.Second,
					}
					client.apiProxyAvailable = true
					client.apiServerURL = strings.TrimSuffix(restConfig.Host, "/")
					client.serviceNS = namespace
					client.serviceName = serviceName
					client.servicePort = port
				}
			}
		}

		// Create Metrics Server client for real-time metrics fallback
		// This is useful for short-lived pods that may not be scraped by Prometheus
		metricsClient, err := metricsv.NewForConfig(restConfig)
		if err == nil {
			client.metricsClient = metricsClient
		}
	}

	return client
}

// buildDirectURL constructs the direct Prometheus URL
func (c *PrometheusClient) buildDirectURL(path string) string {
	return fmt.Sprintf("%s%s", c.baseURL, path)
}

// buildAPIProxyURL constructs the API server proxy URL for a given path
func (c *PrometheusClient) buildAPIProxyURL(path string) string {
	// Use K8s API server proxy: /api/v1/namespaces/{ns}/services/{svc}:{port}/proxy/{path}
	return fmt.Sprintf("%s/api/v1/namespaces/%s/services/%s:%s/proxy%s",
		c.apiServerURL, c.serviceNS, c.serviceName, c.servicePort, path)
}

// doRequest makes an HTTP request, trying direct connection first, then API proxy fallback
func (c *PrometheusClient) doRequest(ctx context.Context, path string) ([]byte, error) {
	c.mu.RLock()
	useProxy := c.useAPIProxy
	directTested := c.directTested
	directWorks := c.directWorks
	c.mu.RUnlock()

	// If we've already determined direct works, use it
	if directTested && directWorks {
		return c.doDirectRequest(ctx, path)
	}

	// If we've already determined we need proxy, use it
	if useProxy {
		return c.doAPIProxyRequest(ctx, path)
	}

	// Try direct connection first
	body, err := c.doDirectRequest(ctx, path)
	if err == nil {
		c.mu.Lock()
		c.directTested = true
		c.directWorks = true
		c.mu.Unlock()
		return body, nil
	}

	// Direct failed, mark it
	c.mu.Lock()
	c.directTested = true
	c.directWorks = false
	c.mu.Unlock()

	// Try API proxy fallback if available
	if c.apiProxyAvailable {
		log.Printf("Prometheus direct connection failed, falling back to API server proxy: %v", err)
		body, proxyErr := c.doAPIProxyRequest(ctx, path)
		if proxyErr == nil {
			c.mu.Lock()
			c.useAPIProxy = true
			c.proxyTested = true
			c.mu.Unlock()
			log.Printf("Prometheus API server proxy fallback successful")
			return body, nil
		}
		return nil, fmt.Errorf("both direct (%v) and API proxy (%v) failed", err, proxyErr)
	}

	return nil, err
}

// doDirectRequest makes a direct HTTP request to Prometheus
func (c *PrometheusClient) doDirectRequest(ctx context.Context, path string) ([]byte, error) {
	reqURL := c.buildDirectURL(path)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("request failed: %s - %s", resp.Status, string(body))
	}

	return io.ReadAll(resp.Body)
}

// doAPIProxyRequest makes a request through the K8s API server proxy
func (c *PrometheusClient) doAPIProxyRequest(ctx context.Context, path string) ([]byte, error) {
	if !c.apiProxyAvailable {
		return nil, fmt.Errorf("API proxy not available")
	}

	reqURL := c.buildAPIProxyURL(path)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.apiProxyClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("request failed: %s - %s", resp.Status, string(body))
	}

	return io.ReadAll(resp.Body)
}

// GetContainerMetrics queries Prometheus for all container metrics (CPU, memory, network, disk)
// It uses cAdvisor metrics exposed by kubelet and scraped by Prometheus.
// If Prometheus returns empty results for CPU/Memory, it falls back to Metrics Server
// for real-time metrics (useful for short-lived pods like backtests).
func (c *PrometheusClient) GetContainerMetrics(ctx context.Context, namespace, podName, containerName string) (*ContainerMetrics, error) {
	if c == nil {
		return nil, nil
	}

	metrics := &ContainerMetrics{}

	// Query CPU usage rate (percentage over last 1 minute)
	// rate() calculates per-second average, multiply by 100 for percentage
	cpuQuery := fmt.Sprintf(`rate(container_cpu_usage_seconds_total{namespace="%s",pod="%s",container="%s"}[1m]) * 100`, namespace, podName, containerName)
	cpuRate, err := c.queryMetricFloat(ctx, cpuQuery)
	if err != nil {
		log.Printf("Prometheus CPU query failed for %s/%s: %v", podName, containerName, err)
	} else {
		metrics.CPUPercent = cpuRate
	}

	// Query memory usage in bytes
	memQuery := fmt.Sprintf(`container_memory_usage_bytes{namespace="%s",pod="%s",container="%s"}`, namespace, podName, containerName)
	memBytes, err := c.queryMetric(ctx, memQuery)
	if err != nil {
		log.Printf("Prometheus memory query failed for %s/%s: %v", podName, containerName, err)
	} else {
		metrics.MemoryBytes = memBytes
	}

	// Fall back to Metrics Server for any missing metrics (CPU or Memory)
	// This is useful for short-lived pods (like backtests) where:
	// - CPU rate() needs 2+ data points from Prometheus (takes ~1 min)
	// - Memory might not be scraped yet
	if (metrics.CPUPercent == 0 || metrics.MemoryBytes == 0) && c.metricsClient != nil {
		msMetrics, err := c.getMetricsServerMetrics(ctx, namespace, podName, containerName)
		if err == nil && msMetrics != nil {
			if metrics.CPUPercent == 0 && msMetrics.CPUPercent > 0 {
				metrics.CPUPercent = msMetrics.CPUPercent
				log.Printf("Metrics Server fallback: got CPU=%.2f%% for %s/%s", msMetrics.CPUPercent, podName, containerName)
			}
			if metrics.MemoryBytes == 0 && msMetrics.MemoryBytes > 0 {
				metrics.MemoryBytes = msMetrics.MemoryBytes
				log.Printf("Metrics Server fallback: got Memory=%d bytes for %s/%s", msMetrics.MemoryBytes, podName, containerName)
			}
		} else if err != nil {
			log.Printf("Metrics Server fallback failed for %s/%s: %v", podName, containerName, err)
		}
	}

	// Query network receive bytes
	networkRx, err := c.queryMetric(ctx,
		fmt.Sprintf(`container_network_receive_bytes_total{namespace="%s",pod="%s"}`, namespace, podName))
	if err == nil && networkRx > 0 {
		metrics.NetworkRxBytes = networkRx
	}

	// Query network transmit bytes
	networkTx, err := c.queryMetric(ctx,
		fmt.Sprintf(`container_network_transmit_bytes_total{namespace="%s",pod="%s"}`, namespace, podName))
	if err == nil && networkTx > 0 {
		metrics.NetworkTxBytes = networkTx
	}

	// Query disk read bytes
	diskRead, err := c.queryMetric(ctx,
		fmt.Sprintf(`container_fs_reads_bytes_total{namespace="%s",pod="%s",container="%s"}`, namespace, podName, containerName))
	if err == nil && diskRead > 0 {
		metrics.DiskReadBytes = diskRead
	}

	// Query disk write bytes
	diskWrite, err := c.queryMetric(ctx,
		fmt.Sprintf(`container_fs_writes_bytes_total{namespace="%s",pod="%s",container="%s"}`, namespace, podName, containerName))
	if err == nil && diskWrite > 0 {
		metrics.DiskWriteBytes = diskWrite
	}

	return metrics, nil
}

// getMetricsServerMetrics gets real-time CPU and Memory metrics from Kubernetes Metrics Server
// This is used as a fallback when Prometheus doesn't have data for short-lived pods
func (c *PrometheusClient) getMetricsServerMetrics(ctx context.Context, namespace, podName, containerName string) (*ContainerMetrics, error) {
	if c.metricsClient == nil {
		return nil, fmt.Errorf("metrics server client not available")
	}

	podMetrics, err := c.metricsClient.MetricsV1beta1().PodMetricses(namespace).Get(ctx, podName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get pod metrics: %w", err)
	}

	metrics := &ContainerMetrics{}

	// Find the specific container's metrics
	for _, container := range podMetrics.Containers {
		if container.Name == containerName {
			// CPU is in nanocores, convert to percentage (1 core = 1000m = 100%)
			// MilliValue() returns millicores, so divide by 10 to get percentage
			cpuMillicores := container.Usage.Cpu().MilliValue()
			metrics.CPUPercent = float64(cpuMillicores) / 10.0 // 1000m = 100%

			// Memory is in bytes
			metrics.MemoryBytes = container.Usage.Memory().Value()
			break
		}
	}

	return metrics, nil
}

// queryMetric executes a single PromQL query and returns the value as int64
func (c *PrometheusClient) queryMetric(ctx context.Context, query string) (int64, error) {
	value, err := c.queryMetricFloat(ctx, query)
	if err != nil {
		return 0, err
	}
	return int64(value), nil
}

// queryMetricFloat executes a single PromQL query and returns the value as float64
func (c *PrometheusClient) queryMetricFloat(ctx context.Context, query string) (float64, error) {
	params := url.Values{}
	params.Set("query", query)
	path := "/api/v1/query?" + params.Encode()

	body, err := c.doRequest(ctx, path)
	if err != nil {
		return 0, fmt.Errorf("failed to query prometheus: %w", err)
	}

	var promResp prometheusResponse
	if err := json.Unmarshal(body, &promResp); err != nil {
		return 0, fmt.Errorf("failed to parse response: %w", err)
	}

	if promResp.Status != "success" {
		return 0, fmt.Errorf("prometheus query status: %s", promResp.Status)
	}

	// Get the first result value (we expect only one result for specific pod/container queries)
	if len(promResp.Data.Result) == 0 {
		// Log query for debugging empty results
		log.Printf("Prometheus query returned empty result set for: %s", query)
		return 0, nil // No data available
	}

	// Sum all values if multiple results (e.g., multiple CPU cores)
	var total float64
	for _, result := range promResp.Data.Result {
		if len(result.Value) >= 2 {
			valueStr, ok := result.Value[1].(string)
			if ok {
				value, err := strconv.ParseFloat(valueStr, 64)
				if err == nil {
					total += value
				}
			}
		}
	}

	return total, nil
}

// TestConnection verifies the Prometheus server is reachable
func (c *PrometheusClient) TestConnection(ctx context.Context) error {
	if c == nil {
		return fmt.Errorf("prometheus client not configured")
	}

	_, err := c.doRequest(ctx, "/-/healthy")
	return err
}

// IsUsingAPIProxy returns true if the client is using K8s API server proxy
func (c *PrometheusClient) IsUsingAPIProxy() bool {
	if c == nil {
		return false
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.useAPIProxy
}

// ApplyMinimumCPU returns the greater of the actual CPU value or the minimum.
// This ensures billing captures a reasonable CPU estimate when metrics cannot be collected
// for short-lived pods (backtests that complete before Prometheus scrapes them).
func ApplyMinimumCPU(cpuPercent float64) float64 {
	if cpuPercent < MinimumCPUPercent {
		return MinimumCPUPercent
	}
	return cpuPercent
}

// ApplyMinimumMemory returns the greater of the actual memory value or the minimum.
// This ensures billing captures a reasonable memory estimate when metrics cannot be collected
// for short-lived pods (backtests that complete before Prometheus scrapes them).
func ApplyMinimumMemory(memoryBytes int64) int64 {
	if memoryBytes < MinimumMemoryBytes {
		return MinimumMemoryBytes
	}
	return memoryBytes
}

// ApplyMinimums applies minimum thresholds to CPU and memory metrics.
// Returns the metrics with minimums applied and a boolean indicating if minimums were used.
func ApplyMinimums(metrics *ContainerMetrics) (applied bool) {
	if metrics == nil {
		return false
	}

	if metrics.CPUPercent < MinimumCPUPercent {
		metrics.CPUPercent = MinimumCPUPercent
		applied = true
	}

	if metrics.MemoryBytes < MinimumMemoryBytes {
		metrics.MemoryBytes = MinimumMemoryBytes
		applied = true
	}

	return applied
}
