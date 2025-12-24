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

	"k8s.io/client-go/rest"
	"k8s.io/client-go/transport"
)

// PrometheusClient queries Prometheus for container metrics
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

	// Track which method works
	mu              sync.RWMutex
	useAPIProxy     bool
	proxyTested     bool
	directTested    bool
	directWorks     bool
}

// ContainerIOMetrics holds network and disk I/O metrics for a container
type ContainerIOMetrics struct {
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

// NewPrometheusClient creates a new Prometheus client
// If restConfig is provided and the URL is a cluster-internal service, it will
// set up API server proxy as a fallback for when direct connection fails
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

// GetContainerIOMetrics queries Prometheus for network and disk I/O metrics
// It uses cAdvisor metrics exposed by kubelet and scraped by Prometheus
func (c *PrometheusClient) GetContainerIOMetrics(ctx context.Context, namespace, podName, containerName string) (*ContainerIOMetrics, error) {
	if c == nil {
		return nil, nil
	}

	metrics := &ContainerIOMetrics{}

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

// queryMetric executes a single PromQL query and returns the value
func (c *PrometheusClient) queryMetric(ctx context.Context, query string) (int64, error) {
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
		return 0, nil // No data available
	}

	// Sum all values if multiple interfaces/devices
	var total int64
	for _, result := range promResp.Data.Result {
		if len(result.Value) >= 2 {
			valueStr, ok := result.Value[1].(string)
			if ok {
				value, err := strconv.ParseFloat(valueStr, 64)
				if err == nil {
					total += int64(value)
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