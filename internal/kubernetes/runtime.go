package kubernetes

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"

	"volaticloud/internal/enum"
	"volaticloud/internal/runner"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/transport"
)

// safeInt32 safely converts an int to int32, clamping to valid port range
func safeInt32(v int) int32 {
	if v < 0 {
		return 0
	}
	if v > math.MaxInt32 {
		return math.MaxInt32
	}
	return int32(v) // #nosec G115 -- bounds checked above
}

// Compile-time interface compliance check
var _ runner.Runtime = (*Runtime)(nil)

// Labels used for identifying VolatiCloud resources
const (
	LabelManaged   = "volaticloud.io/managed"
	LabelBotID     = "volaticloud.io/bot-id"
	LabelBotName   = "volaticloud.io/bot-name"
	LabelComponent = "volaticloud.io/component"

	ComponentBot = "bot"
)

// Runtime implements runner.Runtime for Kubernetes
type Runtime struct {
	config           *Config
	clientset        kubernetes.Interface
	prometheusClient *PrometheusClient

	// API server proxy for external access
	apiProxyClient *http.Client
	apiServerURL   string

	mu sync.RWMutex
}

// NewRuntime creates a new Kubernetes runtime
func NewRuntime(ctx context.Context, config *Config) (*Runtime, error) {
	restConfig, err := buildRestConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to build REST config: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kubernetes client: %w", err)
	}

	// Initialize Prometheus client if URL is configured
	// Pass restConfig for API server proxy fallback when running outside the cluster
	// Prometheus is used for all container metrics (CPU, memory, network, disk I/O)
	prometheusClient := NewPrometheusClient(config.PrometheusURL, restConfig)
	if prometheusClient == nil && config.PrometheusURL == "" {
		log.Printf("Warning: Prometheus URL not configured - container metrics will not be collected")
	}

	// Initialize API proxy client for external access to services
	var apiProxyClient *http.Client
	var apiServerURL string
	if restConfig != nil {
		transportConfig, err := restConfig.TransportConfig()
		if err == nil {
			rt, err := transport.New(transportConfig)
			if err == nil {
				apiProxyClient = &http.Client{
					Transport: rt,
					Timeout:   30 * time.Second,
				}
				apiServerURL = strings.TrimSuffix(restConfig.Host, "/")
			}
		}
	}

	return &Runtime{
		config:           config,
		clientset:        clientset,
		prometheusClient: prometheusClient,
		apiProxyClient:   apiProxyClient,
		apiServerURL:     apiServerURL,
	}, nil
}

// buildRestConfig creates a Kubernetes REST config from the Config
func buildRestConfig(config *Config) (*rest.Config, error) {
	if config.Kubeconfig == "" {
		// Try in-cluster config
		restConfig, err := rest.InClusterConfig()
		if err != nil {
			return nil, fmt.Errorf("failed to get in-cluster config (not running in K8s?): %w", err)
		}
		return restConfig, nil
	}

	// Parse kubeconfig YAML content directly
	clientConfig, err := clientcmd.NewClientConfigFromBytes([]byte(config.Kubeconfig))
	if err != nil {
		return nil, fmt.Errorf("failed to parse kubeconfig: %w", err)
	}

	// Apply context override if specified
	if config.Context != "" {
		rawConfig, err := clientConfig.RawConfig()
		if err != nil {
			return nil, fmt.Errorf("failed to get raw config: %w", err)
		}
		rawConfig.CurrentContext = config.Context
		clientConfig = clientcmd.NewDefaultClientConfig(rawConfig, &clientcmd.ConfigOverrides{})
	}

	return clientConfig.ClientConfig()
}

// Type returns the runtime type
func (r *Runtime) Type() string {
	return "kubernetes"
}

// HealthCheck verifies connectivity to the Kubernetes API server
func (r *Runtime) HealthCheck(ctx context.Context) error {
	_, err := r.clientset.CoreV1().Namespaces().Get(ctx, r.config.Namespace, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return fmt.Errorf("namespace %q not found", r.config.Namespace)
		}
		return fmt.Errorf("failed to connect to Kubernetes API: %w", err)
	}
	return nil
}

// Close releases any resources held by the runtime
func (r *Runtime) Close() error {
	// Kubernetes client doesn't require explicit cleanup
	return nil
}

// CreateBot creates a new bot deployment in Kubernetes
func (r *Runtime) CreateBot(ctx context.Context, spec runner.BotSpec) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Create ConfigMap for bot configs
	configCM, err := r.createBotConfigMap(ctx, spec)
	if err != nil {
		return fmt.Errorf("failed to create config ConfigMap: %w", err)
	}

	// Create ConfigMap for strategy code
	strategyCM, err := r.createStrategyConfigMap(ctx, spec)
	if err != nil {
		_ = r.cleanupBotResources(ctx, spec.ID)
		return fmt.Errorf("failed to create strategy ConfigMap: %w", err)
	}

	// Create Secret for exchange credentials
	secret, err := r.createBotSecret(ctx, spec)
	if err != nil {
		_ = r.cleanupBotResources(ctx, spec.ID)
		return fmt.Errorf("failed to create Secret: %w", err)
	}

	// Create Deployment
	_, err = r.createBotDeployment(ctx, spec, configCM.Name, strategyCM.Name, secret.Name)
	if err != nil {
		_ = r.cleanupBotResources(ctx, spec.ID)
		return fmt.Errorf("failed to create Deployment: %w", err)
	}

	// Create Service for API access
	_, err = r.createBotService(ctx, spec)
	if err != nil {
		_ = r.cleanupBotResources(ctx, spec.ID)
		return fmt.Errorf("failed to create Service: %w", err)
	}

	// Create Ingress if ingressHost is configured
	if r.config.IngressHost != "" {
		_, err = r.createBotIngress(ctx, spec)
		if err != nil {
			_ = r.cleanupBotResources(ctx, spec.ID)
			return fmt.Errorf("failed to create Ingress: %w", err)
		}
	}

	return nil
}

// DeleteBot removes a bot and all its resources
func (r *Runtime) DeleteBot(ctx context.Context, botID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	return r.cleanupBotResources(ctx, botID)
}

// StartBot starts a stopped bot by scaling the deployment to 1
// Also deletes any existing failed pods to force recreation
func (r *Runtime) StartBot(ctx context.Context, botID string) error {
	// Delete any existing pods to force recreation (handles failed/error states)
	pods, err := r.clientset.CoreV1().Pods(r.config.Namespace).List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("%s=%s", LabelBotID, botID),
	})
	if err == nil {
		for _, pod := range pods.Items {
			// Delete pod to force recreation with fresh init container
			_ = r.clientset.CoreV1().Pods(r.config.Namespace).Delete(ctx, pod.Name, metav1.DeleteOptions{})
		}
	}

	deploymentName := r.getDeploymentName(botID)
	return r.scaleDeployment(ctx, deploymentName, 1)
}

// StopBot stops a running bot by scaling the deployment to 0
func (r *Runtime) StopBot(ctx context.Context, botID string) error {
	deploymentName := r.getDeploymentName(botID)
	return r.scaleDeployment(ctx, deploymentName, 0)
}

// RestartBot restarts a bot by deleting its pod (deployment will recreate it)
func (r *Runtime) RestartBot(ctx context.Context, botID string) error {
	// Find and delete the pod - deployment will recreate it
	pods, err := r.clientset.CoreV1().Pods(r.config.Namespace).List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("%s=%s", LabelBotID, botID),
	})
	if err != nil {
		return fmt.Errorf("failed to list pods: %w", err)
	}

	for _, pod := range pods.Items {
		err := r.clientset.CoreV1().Pods(r.config.Namespace).Delete(ctx, pod.Name, metav1.DeleteOptions{})
		if err != nil && !errors.IsNotFound(err) {
			return fmt.Errorf("failed to delete pod %s: %w", pod.Name, err)
		}
	}

	return nil
}

// GetBotStatus returns the current status of a bot
func (r *Runtime) GetBotStatus(ctx context.Context, botID string) (*runner.BotStatus, error) {
	deploymentName := r.getDeploymentName(botID)

	// Get Deployment
	deployment, err := r.clientset.AppsV1().Deployments(r.config.Namespace).Get(ctx, deploymentName, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return nil, runner.ErrBotNotFound
		}
		return nil, fmt.Errorf("failed to get deployment: %w", err)
	}

	status := &runner.BotStatus{
		BotID: botID,
	}

	// Determine status from deployment
	if deployment.Status.ReadyReplicas > 0 {
		status.Status = enum.BotStatusRunning
		status.Healthy = true
	} else if *deployment.Spec.Replicas == 0 {
		status.Status = enum.BotStatusStopped
	} else if deployment.Status.UnavailableReplicas > 0 {
		status.Status = enum.BotStatusCreating
	} else {
		status.Status = enum.BotStatusError
	}

	// Get Pod for IP and detailed status
	pods, err := r.clientset.CoreV1().Pods(r.config.Namespace).List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("%s=%s", LabelBotID, botID),
	})
	if err == nil && len(pods.Items) > 0 {
		pod := pods.Items[0]
		status.IPAddress = pod.Status.PodIP

		// Check pod conditions for more detailed status
		for _, cond := range pod.Status.Conditions {
			if cond.Type == corev1.PodReady && cond.Status == corev1.ConditionFalse {
				status.Healthy = false
				status.ErrorMessage = cond.Message
			}
		}

		// Get container status
		for _, cs := range pod.Status.ContainerStatuses {
			if cs.Name == "freqtrade" {
				if cs.State.Waiting != nil {
					status.Status = enum.BotStatusCreating
					status.ErrorMessage = cs.State.Waiting.Message
				} else if cs.State.Terminated != nil {
					status.Status = enum.BotStatusError
					status.ErrorMessage = cs.State.Terminated.Message
				}
			}
		}

		// Get metrics if available (from Metrics Server and/or Prometheus)
		r.populatePodMetrics(ctx, &pod, status)
	}

	// Get Service for host port
	serviceName := r.getServiceName(botID)
	service, err := r.clientset.CoreV1().Services(r.config.Namespace).Get(ctx, serviceName, metav1.GetOptions{})
	if err == nil && len(service.Spec.Ports) > 0 {
		status.HostPort = int(service.Spec.Ports[0].Port)
	}

	return status, nil
}

// GetContainerIP returns the Service ClusterIP for stable access
// Takes botID directly - service name is derived from botID
func (r *Runtime) GetContainerIP(ctx context.Context, botID string) (string, error) {
	serviceName := r.getServiceName(botID)
	service, err := r.clientset.CoreV1().Services(r.config.Namespace).Get(ctx, serviceName, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return "", runner.ErrBotNotFound
		}
		return "", fmt.Errorf("failed to get service: %w", err)
	}

	return service.Spec.ClusterIP, nil
}

// GetBotAPIURL returns the full URL to access the bot's Freqtrade API
// For Kubernetes:
//   - Inside cluster: http://<service-name>.<namespace>.svc.cluster.local:<port>
//   - Outside cluster: http(s)://<ingressHost>/bot/<botID>/ (requires ingressHost config)
func (r *Runtime) GetBotAPIURL(ctx context.Context, botID string) (string, error) {
	serviceName := r.getServiceName(botID)
	service, err := r.clientset.CoreV1().Services(r.config.Namespace).Get(ctx, serviceName, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return "", runner.ErrBotNotFound
		}
		return "", fmt.Errorf("failed to get service: %w", err)
	}

	// Get the service port (default to 8080 if not found)
	port := int32(8080)
	if len(service.Spec.Ports) > 0 {
		port = service.Spec.Ports[0].Port
	}

	// If running inside K8s cluster, use internal DNS
	if r.isRunningInCluster() {
		return fmt.Sprintf("http://%s.%s.svc.cluster.local:%d", serviceName, r.config.Namespace, port), nil
	}

	// Running outside K8s cluster - use Ingress URL
	if r.config.IngressHost != "" {
		scheme := "http"
		if r.config.IngressTLS {
			scheme = "https"
		}
		return fmt.Sprintf("%s://%s/bot/%s/", scheme, r.config.IngressHost, botID), nil
	}

	// No ingressHost configured - cannot access from outside cluster
	return "", fmt.Errorf("ingressHost is required for external bot access; configure it in the runner settings")
}

// GetBotHTTPClient returns an HTTP client and base URL for accessing the bot's API
// Fallback order:
// 1. Direct Service DNS (in-cluster) - fastest
// 2. Ingress URL (if configured) - external access
// 3. K8s API Server Proxy (using kubeconfig) - works from anywhere
func (r *Runtime) GetBotHTTPClient(ctx context.Context, botID string) (*http.Client, string, error) {
	serviceName := r.getServiceName(botID)
	service, err := r.clientset.CoreV1().Services(r.config.Namespace).Get(ctx, serviceName, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return nil, "", runner.ErrBotNotFound
		}
		return nil, "", fmt.Errorf("failed to get service: %w", err)
	}

	// Get the service port (default to 8080 if not found)
	port := int32(8080)
	if len(service.Spec.Ports) > 0 {
		port = service.Spec.Ports[0].Port
	}

	defaultClient := &http.Client{Timeout: 30 * time.Second}

	// 1. If running inside K8s cluster, use internal DNS (fastest)
	if r.isRunningInCluster() {
		url := fmt.Sprintf("http://%s.%s.svc.cluster.local:%d", serviceName, r.config.Namespace, port)
		return defaultClient, url, nil
	}

	// 2. If Ingress is configured, use it
	if r.config.IngressHost != "" {
		scheme := "http"
		if r.config.IngressTLS {
			scheme = "https"
		}
		url := fmt.Sprintf("%s://%s/bot/%s", scheme, r.config.IngressHost, botID)
		return defaultClient, url, nil
	}

	// 3. Use K8s API Server Proxy as fallback
	// This allows accessing the service through the API server using kubeconfig auth
	if r.apiProxyClient != nil {
		url := fmt.Sprintf("%s/api/v1/namespaces/%s/services/%s:%d/proxy",
			r.apiServerURL, r.config.Namespace, serviceName, port)
		return r.apiProxyClient, url, nil
	}

	return nil, "", fmt.Errorf("no accessible endpoint: ingressHost not configured and API proxy not available")
}

// isRunningInCluster checks if the backend is running inside a K8s cluster
func (r *Runtime) isRunningInCluster() bool {
	_, err := rest.InClusterConfig()
	return err == nil
}

// GetBotLogs returns logs from the bot pod
func (r *Runtime) GetBotLogs(ctx context.Context, botID string, opts runner.LogOptions) (*runner.LogReader, error) {
	// Find the pod
	pods, err := r.clientset.CoreV1().Pods(r.config.Namespace).List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("%s=%s", LabelBotID, botID),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods: %w", err)
	}
	if len(pods.Items) == 0 {
		return nil, runner.ErrBotNotFound
	}

	pod := pods.Items[0]
	podLogOpts := &corev1.PodLogOptions{
		Container:  "freqtrade",
		Follow:     opts.Follow,
		Timestamps: opts.Timestamps,
	}

	if opts.Tail > 0 {
		tailLines := int64(opts.Tail)
		podLogOpts.TailLines = &tailLines
	}

	if !opts.Since.IsZero() {
		sinceTime := metav1.NewTime(opts.Since)
		podLogOpts.SinceTime = &sinceTime
	}

	req := r.clientset.CoreV1().Pods(r.config.Namespace).GetLogs(pod.Name, podLogOpts)
	stream, err := req.Stream(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get logs stream: %w", err)
	}

	return &runner.LogReader{ReadCloser: stream}, nil
}

// UpdateBot updates a bot's configuration
func (r *Runtime) UpdateBot(ctx context.Context, botID string, spec runner.UpdateBotSpec) error {
	// For now, we only support resource limit updates
	if spec.ResourceLimits != nil {
		deploymentName := r.getDeploymentName(botID)
		deployment, err := r.clientset.AppsV1().Deployments(r.config.Namespace).Get(ctx, deploymentName, metav1.GetOptions{})
		if err != nil {
			if errors.IsNotFound(err) {
				return runner.ErrBotNotFound
			}
			return fmt.Errorf("failed to get deployment: %w", err)
		}

		// Update resource limits
		for i := range deployment.Spec.Template.Spec.Containers {
			if deployment.Spec.Template.Spec.Containers[i].Name == "freqtrade" {
				// Update limits here if needed
				break
			}
		}

		_, err = r.clientset.AppsV1().Deployments(r.config.Namespace).Update(ctx, deployment, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("failed to update deployment: %w", err)
		}
	}

	return nil
}

// ListBots returns all bots managed by this runtime
func (r *Runtime) ListBots(ctx context.Context) ([]runner.BotStatus, error) {
	deployments, err := r.clientset.AppsV1().Deployments(r.config.Namespace).List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("%s=true,%s=%s", LabelManaged, LabelComponent, ComponentBot),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list deployments: %w", err)
	}

	var statuses []runner.BotStatus
	for _, dep := range deployments.Items {
		botID := dep.Labels[LabelBotID]
		if botID == "" {
			continue
		}

		status, err := r.GetBotStatus(ctx, botID)
		if err != nil {
			continue
		}
		statuses = append(statuses, *status)
	}

	return statuses, nil
}

// Helper methods

func (r *Runtime) getDeploymentName(botID string) string {
	return fmt.Sprintf("volaticloud-bot-%s", botID)
}

func (r *Runtime) getServiceName(botID string) string {
	return fmt.Sprintf("volaticloud-bot-%s-svc", botID)
}

func (r *Runtime) getConfigMapName(botID string) string {
	return fmt.Sprintf("bot-%s-config", botID)
}

func (r *Runtime) getStrategyConfigMapName(botID string) string {
	return fmt.Sprintf("bot-%s-strategy", botID)
}

func (r *Runtime) getSecretName(botID string) string {
	return fmt.Sprintf("bot-%s-secrets", botID)
}

func (r *Runtime) getIngressName(botID string) string {
	return fmt.Sprintf("volaticloud-bot-%s-ingress", botID)
}

func (r *Runtime) scaleDeployment(ctx context.Context, name string, replicas int32) error {
	deployment, err := r.clientset.AppsV1().Deployments(r.config.Namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return runner.ErrBotNotFound
		}
		return fmt.Errorf("failed to get deployment: %w", err)
	}

	deployment.Spec.Replicas = &replicas
	_, err = r.clientset.AppsV1().Deployments(r.config.Namespace).Update(ctx, deployment, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to scale deployment: %w", err)
	}

	return nil
}

func (r *Runtime) cleanupBotResources(ctx context.Context, botID string) error {
	var errs []error

	// Delete Deployment
	deploymentName := r.getDeploymentName(botID)
	err := r.clientset.AppsV1().Deployments(r.config.Namespace).Delete(ctx, deploymentName, metav1.DeleteOptions{})
	if err != nil && !errors.IsNotFound(err) {
		errs = append(errs, fmt.Errorf("failed to delete deployment: %w", err))
	}

	// Delete Service
	serviceName := r.getServiceName(botID)
	err = r.clientset.CoreV1().Services(r.config.Namespace).Delete(ctx, serviceName, metav1.DeleteOptions{})
	if err != nil && !errors.IsNotFound(err) {
		errs = append(errs, fmt.Errorf("failed to delete service: %w", err))
	}

	// Delete ConfigMap (config)
	configMapName := r.getConfigMapName(botID)
	err = r.clientset.CoreV1().ConfigMaps(r.config.Namespace).Delete(ctx, configMapName, metav1.DeleteOptions{})
	if err != nil && !errors.IsNotFound(err) {
		errs = append(errs, fmt.Errorf("failed to delete config configmap: %w", err))
	}

	// Delete ConfigMap (strategy)
	strategyConfigMapName := r.getStrategyConfigMapName(botID)
	err = r.clientset.CoreV1().ConfigMaps(r.config.Namespace).Delete(ctx, strategyConfigMapName, metav1.DeleteOptions{})
	if err != nil && !errors.IsNotFound(err) {
		errs = append(errs, fmt.Errorf("failed to delete strategy configmap: %w", err))
	}

	// Delete Secret
	secretName := r.getSecretName(botID)
	err = r.clientset.CoreV1().Secrets(r.config.Namespace).Delete(ctx, secretName, metav1.DeleteOptions{})
	if err != nil && !errors.IsNotFound(err) {
		errs = append(errs, fmt.Errorf("failed to delete secret: %w", err))
	}

	// Delete Ingress (if exists)
	ingressName := r.getIngressName(botID)
	err = r.clientset.NetworkingV1().Ingresses(r.config.Namespace).Delete(ctx, ingressName, metav1.DeleteOptions{})
	if err != nil && !errors.IsNotFound(err) {
		errs = append(errs, fmt.Errorf("failed to delete ingress: %w", err))
	}

	if len(errs) > 0 {
		return fmt.Errorf("cleanup errors: %v", errs)
	}

	return nil
}

func (r *Runtime) populatePodMetrics(ctx context.Context, pod *corev1.Pod, status *runner.BotStatus) {
	// Get all metrics from Prometheus (CPU, memory, network, disk I/O via cAdvisor)
	if r.prometheusClient != nil {
		metrics, err := r.prometheusClient.GetContainerMetrics(ctx, r.config.Namespace, pod.Name, "freqtrade")
		if err == nil && metrics != nil {
			status.CPUUsage = metrics.CPUPercent
			status.MemoryUsage = metrics.MemoryBytes
			status.NetworkRxBytes = metrics.NetworkRxBytes
			status.NetworkTxBytes = metrics.NetworkTxBytes
			status.BlockReadBytes = metrics.DiskReadBytes
			status.BlockWriteBytes = metrics.DiskWriteBytes
		}
		// Prometheus errors are already logged in the PrometheusClient
	}
}

// createBotConfigMap creates a ConfigMap with bot configuration
func (r *Runtime) createBotConfigMap(ctx context.Context, spec runner.BotSpec) (*corev1.ConfigMap, error) {
	configMap := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      r.getConfigMapName(spec.ID),
			Namespace: r.config.Namespace,
			Labels: map[string]string{
				LabelManaged:   "true",
				LabelBotID:     spec.ID,
				LabelComponent: ComponentBot,
			},
		},
		Data: make(map[string]string),
	}

	// Add strategy config if provided
	if spec.StrategyConfig != nil {
		strategyConfigJSON, err := json.Marshal(spec.StrategyConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal strategy config: %w", err)
		}
		configMap.Data["config.strategy.json"] = string(strategyConfigJSON)
	}

	// Add bot config
	if spec.Config != nil {
		botConfigJSON, err := json.Marshal(spec.Config)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal bot config: %w", err)
		}
		configMap.Data["config.bot.json"] = string(botConfigJSON)
	}

	return r.clientset.CoreV1().ConfigMaps(r.config.Namespace).Create(ctx, configMap, metav1.CreateOptions{})
}

// createStrategyConfigMap creates a ConfigMap with strategy code
func (r *Runtime) createStrategyConfigMap(ctx context.Context, spec runner.BotSpec) (*corev1.ConfigMap, error) {
	// Sanitize strategy name to be a valid K8s ConfigMap key and Python filename
	// ConfigMap keys must match [-._a-zA-Z0-9]+ (no spaces allowed)
	sanitizedName := runner.SanitizeStrategyFilename(spec.StrategyName)
	configMap := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      r.getStrategyConfigMapName(spec.ID),
			Namespace: r.config.Namespace,
			Labels: map[string]string{
				LabelManaged:   "true",
				LabelBotID:     spec.ID,
				LabelComponent: ComponentBot,
			},
		},
		Data: map[string]string{
			fmt.Sprintf("%s.py", sanitizedName): spec.StrategyCode,
		},
	}

	return r.clientset.CoreV1().ConfigMaps(r.config.Namespace).Create(ctx, configMap, metav1.CreateOptions{})
}

// createBotSecret creates a Secret with exchange credentials
func (r *Runtime) createBotSecret(ctx context.Context, spec runner.BotSpec) (*corev1.Secret, error) {
	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      r.getSecretName(spec.ID),
			Namespace: r.config.Namespace,
			Labels: map[string]string{
				LabelManaged:   "true",
				LabelBotID:     spec.ID,
				LabelComponent: ComponentBot,
			},
		},
		StringData: make(map[string]string),
	}

	// Add exchange config (sensitive)
	if spec.ExchangeConfig != nil {
		exchangeConfigJSON, err := json.Marshal(spec.ExchangeConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal exchange config: %w", err)
		}
		secret.StringData["config.exchange.json"] = string(exchangeConfigJSON)
	}

	// Add secure config (system-forced settings)
	if spec.SecureConfig != nil {
		secureConfigJSON, err := json.Marshal(spec.SecureConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal secure config: %w", err)
		}
		secret.StringData["config.secure.json"] = string(secureConfigJSON)
	}

	return r.clientset.CoreV1().Secrets(r.config.Namespace).Create(ctx, secret, metav1.CreateOptions{})
}

// createBotDeployment creates the bot Deployment
func (r *Runtime) createBotDeployment(ctx context.Context, spec runner.BotSpec, configCM, strategyCM, secretName string) (*appsv1.Deployment, error) {
	replicas := int32(1)
	apiPort := spec.APIPort
	if apiPort == 0 {
		apiPort = 8080
	}

	userDataPath := fmt.Sprintf("/freqtrade/user_data/%s", spec.ID)

	// Build command with config layering
	// Use sanitized strategy name to match the class name in the strategy file
	sanitizedStrategyName := runner.SanitizeStrategyFilename(spec.StrategyName)
	cmd := []string{
		"freqtrade", "trade",
		"--strategy", sanitizedStrategyName,
		"--userdir", userDataPath,
	}

	// Add config files in order of precedence
	cmd = append(cmd, "--config", fmt.Sprintf("%s/config.exchange.json", userDataPath))
	cmd = append(cmd, "--config", fmt.Sprintf("%s/config.strategy.json", userDataPath))
	cmd = append(cmd, "--config", fmt.Sprintf("%s/config.bot.json", userDataPath))
	cmd = append(cmd, "--config", fmt.Sprintf("%s/config.secure.json", userDataPath))

	// Define volumes:
	// - userdata: writable emptyDir for the entire user_data directory
	// - config-source: ConfigMap with config files (mounted in init container)
	// - strategy-source: ConfigMap with strategy file (mounted in init container)
	// - secrets-source: Secret with exchange/secure configs (mounted in init container)
	volumes := []corev1.Volume{
		{
			// Writable user_data directory
			Name: "userdata",
			VolumeSource: corev1.VolumeSource{
				EmptyDir: &corev1.EmptyDirVolumeSource{},
			},
		},
		{
			// Source ConfigMap for bot/strategy configs
			Name: "config-source",
			VolumeSource: corev1.VolumeSource{
				ConfigMap: &corev1.ConfigMapVolumeSource{
					LocalObjectReference: corev1.LocalObjectReference{
						Name: configCM,
					},
				},
			},
		},
		{
			// Source ConfigMap for strategy code
			Name: "strategy-source",
			VolumeSource: corev1.VolumeSource{
				ConfigMap: &corev1.ConfigMapVolumeSource{
					LocalObjectReference: corev1.LocalObjectReference{
						Name: strategyCM,
					},
				},
			},
		},
		{
			// Source Secret for exchange/secure configs
			Name: "secrets-source",
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: secretName,
				},
			},
		},
	}

	// Define volume mounts for main container - only needs the writable userdata
	volumeMounts := []corev1.VolumeMount{
		{
			Name:      "userdata",
			MountPath: userDataPath,
		},
	}

	// Build init container script to setup user_data directory
	// 1. Create directory structure
	// 2. Copy configs from ConfigMap
	// 3. Copy strategy from ConfigMap
	// 4. Copy secrets (exchange/secure config)
	// 5. Download data from S3 if URL provided
	// Use sanitized strategy name for file path (matches ConfigMap key)
	// Note: sanitizedStrategyName was already set earlier for the --strategy flag
	setupScript := fmt.Sprintf(`set -e
echo "Setting up user_data directory..."
mkdir -p /userdata/strategies /userdata/data

echo "Copying configs..."
cp /config-source/config.strategy.json /userdata/ 2>/dev/null || echo "No strategy config"
cp /config-source/config.bot.json /userdata/ 2>/dev/null || echo "No bot config"

echo "Copying secrets..."
cp /secrets-source/config.exchange.json /userdata/ 2>/dev/null || echo "No exchange config"
cp /secrets-source/config.secure.json /userdata/ 2>/dev/null || echo "No secure config"

echo "Copying strategy..."
cp /strategy-source/%s.py /userdata/strategies/
`, sanitizedStrategyName)

	if spec.DataDownloadURL != "" {
		// Check if data already exists to handle pod restarts
		// NOTE: emptyDir persists only across container restarts, NOT pod restarts
		// On pod restart, data will be empty and download may fail if presigned URL expired
		// This is non-fatal - bot will start and Freqtrade will download fresh data from exchange
		setupScript += `
if [ -z "$(ls -A /userdata/data 2>/dev/null)" ]; then
    echo "Downloading data from S3..."
    if wget -q -O /tmp/data.tar.gz "$DATA_DOWNLOAD_URL" 2>/dev/null; then
        echo "Extracting data..."
        tar -xzf /tmp/data.tar.gz -C /userdata/data
        rm /tmp/data.tar.gz
        echo "Data download successful"
    else
        echo "WARNING: Data download failed (possibly expired URL). Bot will start without cached data."
        echo "Freqtrade will download fresh data from exchange on startup."
    fi
else
    echo "Data already exists, skipping download"
    ls -la /userdata/data/
fi
`
	}

	setupScript += `echo "Setup complete"
ls -la /userdata/
ls -la /userdata/strategies/`

	initContainers := []corev1.Container{
		{
			Name:    "setup-userdata",
			Image:   "busybox:1.36",
			Command: []string{"sh", "-c"},
			Args:    []string{setupScript},
			Env: []corev1.EnvVar{
				{
					Name:  "DATA_DOWNLOAD_URL",
					Value: spec.DataDownloadURL,
				},
			},
			VolumeMounts: []corev1.VolumeMount{
				{
					Name:      "userdata",
					MountPath: "/userdata",
				},
				{
					Name:      "config-source",
					MountPath: "/config-source",
				},
				{
					Name:      "strategy-source",
					MountPath: "/strategy-source",
				},
				{
					Name:      "secrets-source",
					MountPath: "/secrets-source",
				},
			},
		},
	}

	deployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      r.getDeploymentName(spec.ID),
			Namespace: r.config.Namespace,
			Labels: map[string]string{
				LabelManaged:   "true",
				LabelBotID:     spec.ID,
				LabelBotName:   spec.Name,
				LabelComponent: ComponentBot,
			},
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: &replicas,
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{
					LabelBotID: spec.ID,
				},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{
						LabelManaged:   "true",
						LabelBotID:     spec.ID,
						LabelBotName:   spec.Name,
						LabelComponent: ComponentBot,
					},
				},
				Spec: corev1.PodSpec{
					InitContainers: initContainers,
					Containers: []corev1.Container{
						{
							Name:    "freqtrade",
							Image:   r.config.GetFreqtradeImage(spec.FreqtradeVersion),
							Command: cmd,
							Ports: []corev1.ContainerPort{
								{
									Name:          "api",
									ContainerPort: safeInt32(apiPort),
									Protocol:      corev1.ProtocolTCP,
								},
							},
							VolumeMounts: volumeMounts,
						},
					},
					Volumes:       volumes,
					RestartPolicy: corev1.RestartPolicyAlways,
				},
			},
		},
	}

	return r.clientset.AppsV1().Deployments(r.config.Namespace).Create(ctx, deployment, metav1.CreateOptions{})
}

// createBotService creates a ClusterIP Service for internal API access
// External access is provided via Ingress when ingressHost is configured
func (r *Runtime) createBotService(ctx context.Context, spec runner.BotSpec) (*corev1.Service, error) {
	apiPort := spec.APIPort
	if apiPort == 0 {
		apiPort = 8080
	}

	service := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      r.getServiceName(spec.ID),
			Namespace: r.config.Namespace,
			Labels: map[string]string{
				LabelManaged:   "true",
				LabelBotID:     spec.ID,
				LabelComponent: ComponentBot,
			},
		},
		Spec: corev1.ServiceSpec{
			Selector: map[string]string{
				LabelBotID: spec.ID,
			},
			Ports: []corev1.ServicePort{
				{
					Name:     "api",
					Port:     safeInt32(apiPort),
					Protocol: corev1.ProtocolTCP,
				},
			},
			Type: corev1.ServiceTypeClusterIP,
		},
	}

	return r.clientset.CoreV1().Services(r.config.Namespace).Create(ctx, service, metav1.CreateOptions{})
}

// createBotIngress creates an Ingress for external bot API access
// Uses path-based routing: http(s)://<ingressHost>/bot/<botID>/
func (r *Runtime) createBotIngress(ctx context.Context, spec runner.BotSpec) (*networkingv1.Ingress, error) {
	apiPort := spec.APIPort
	if apiPort == 0 {
		apiPort = 8080
	}

	pathType := networkingv1.PathTypeImplementationSpecific
	serviceName := r.getServiceName(spec.ID)

	ingress := &networkingv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{
			Name:      r.getIngressName(spec.ID),
			Namespace: r.config.Namespace,
			Labels: map[string]string{
				LabelManaged:   "true",
				LabelBotID:     spec.ID,
				LabelComponent: ComponentBot,
			},
			Annotations: map[string]string{
				// nginx ingress annotations for regex path matching
				"nginx.ingress.kubernetes.io/use-regex":      "true",
				"nginx.ingress.kubernetes.io/rewrite-target": "/$2",
				// preserve host header for Freqtrade API
				"nginx.ingress.kubernetes.io/proxy-body-size": "50m",
			},
		},
		Spec: networkingv1.IngressSpec{
			Rules: []networkingv1.IngressRule{
				{
					Host: r.config.IngressHost,
					IngressRuleValue: networkingv1.IngressRuleValue{
						HTTP: &networkingv1.HTTPIngressRuleValue{
							Paths: []networkingv1.HTTPIngressPath{
								{
									// Match /bot/<botID>/ and /bot/<botID>/<anything>
									// Capture group for rewrite: /bot/<botID>(/|$)(.*)
									Path:     fmt.Sprintf("/bot/%s(/|$)(.*)", spec.ID),
									PathType: &pathType,
									Backend: networkingv1.IngressBackend{
										Service: &networkingv1.IngressServiceBackend{
											Name: serviceName,
											Port: networkingv1.ServiceBackendPort{
												Number: safeInt32(apiPort),
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}

	// Set ingress class if configured
	if r.config.IngressClass != "" {
		ingress.Spec.IngressClassName = &r.config.IngressClass
	}

	// Configure TLS if enabled
	if r.config.IngressTLS {
		ingress.Spec.TLS = []networkingv1.IngressTLS{
			{
				Hosts:      []string{r.config.IngressHost},
				SecretName: fmt.Sprintf("%s-tls", r.config.IngressHost),
			},
		}
		// Add cert-manager annotation for automatic certificate
		ingress.Annotations["cert-manager.io/cluster-issuer"] = "letsencrypt-prod"
	}

	return r.clientset.NetworkingV1().Ingresses(r.config.Namespace).Create(ctx, ingress, metav1.CreateOptions{})
}

// Ensure LogReader implements io.ReadCloser
var _ io.ReadCloser = (*runner.LogReader)(nil)
