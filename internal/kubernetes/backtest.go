package kubernetes

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"strings"
	"sync"

	"volaticloud/internal/enum"
	"volaticloud/internal/freqtrade"
	"volaticloud/internal/runner"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// Compile-time interface compliance check
var _ runner.BacktestRunner = (*BacktestRunner)(nil)

// Labels for backtest resources
const (
	LabelBacktestID   = "volaticloud.io/backtest-id"
	LabelHyperOptID   = "volaticloud.io/hyperopt-id"
	LabelTaskType     = "volaticloud.io/task-type"
	ComponentBacktest = "backtest"
	ComponentHyperOpt = "hyperopt"
)

// BacktestRunner implements runner.BacktestRunner for Kubernetes
type BacktestRunner struct {
	config           *Config
	clientset        kubernetes.Interface
	prometheusClient *PrometheusClient
	mu               sync.RWMutex
}

// NewBacktestRunner creates a new Kubernetes backtest runner
func NewBacktestRunner(ctx context.Context, config *Config) (*BacktestRunner, error) {
	log.Printf("NewBacktestRunner: creating for namespace=%s, prometheusUrl=%s", config.Namespace, config.PrometheusURL)

	restConfig, err := buildRestConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to build REST config: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kubernetes client: %w", err)
	}

	// Create Prometheus client for metrics (same as bot Runtime)
	var prometheusClient *PrometheusClient
	if config.PrometheusURL != "" {
		prometheusClient = NewPrometheusClient(config.PrometheusURL, restConfig)
		log.Printf("NewBacktestRunner: created PrometheusClient for %s, client=%v", config.PrometheusURL, prometheusClient != nil)
	} else {
		log.Printf("NewBacktestRunner: no PrometheusURL configured, metrics will not be collected")
	}

	return &BacktestRunner{
		config:           config,
		clientset:        clientset,
		prometheusClient: prometheusClient,
	}, nil
}

// Type returns the runner type
func (r *BacktestRunner) Type() string {
	return "kubernetes"
}

// HealthCheck verifies connectivity to the Kubernetes API server
func (r *BacktestRunner) HealthCheck(ctx context.Context) error {
	_, err := r.clientset.CoreV1().Namespaces().Get(ctx, r.config.Namespace, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return fmt.Errorf("namespace %q not found", r.config.Namespace)
		}
		return fmt.Errorf("failed to connect to Kubernetes API: %w", err)
	}
	return nil
}

// Close releases any resources held by the runner
func (r *BacktestRunner) Close() error {
	return nil
}

// ==================== Backtest Operations ====================

// RunBacktest starts a new backtest job
func (r *BacktestRunner) RunBacktest(ctx context.Context, spec runner.BacktestSpec) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Create ConfigMap for config
	configCM, err := r.createBacktestConfigMap(ctx, spec)
	if err != nil {
		return fmt.Errorf("failed to create config ConfigMap: %w", err)
	}

	// Create ConfigMap for strategy
	strategyCM, err := r.createBacktestStrategyConfigMap(ctx, spec)
	if err != nil {
		_ = r.cleanupBacktestResources(ctx, spec.ID)
		return fmt.Errorf("failed to create strategy ConfigMap: %w", err)
	}

	// Create Job
	_, err = r.createBacktestJob(ctx, spec, configCM.Name, strategyCM.Name)
	if err != nil {
		_ = r.cleanupBacktestResources(ctx, spec.ID)
		return fmt.Errorf("failed to create Job: %w", err)
	}

	return nil
}

// GetBacktestStatus returns the current status of a backtest
func (r *BacktestRunner) GetBacktestStatus(ctx context.Context, backtestID string) (*runner.BacktestStatus, error) {
	jobName := r.getBacktestJobName(backtestID)

	job, err := r.clientset.BatchV1().Jobs(r.config.Namespace).Get(ctx, jobName, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return nil, runner.ErrBacktestNotFound
		}
		return nil, fmt.Errorf("failed to get job: %w", err)
	}

	status := &runner.BacktestStatus{
		BacktestID:  backtestID,
		ContainerID: job.Name,
		CreatedAt:   job.CreationTimestamp.Time,
	}

	// Determine status from Job conditions
	if job.Status.Succeeded > 0 {
		status.Status = enum.TaskStatusCompleted
		status.Progress = 100
		if job.Status.CompletionTime != nil {
			completedAt := job.Status.CompletionTime.Time
			status.CompletedAt = &completedAt
		}
	} else if job.Status.Failed > 0 {
		status.Status = enum.TaskStatusFailed
		for _, cond := range job.Status.Conditions {
			if cond.Type == batchv1.JobFailed {
				status.ErrorMessage = cond.Message
			}
		}
	} else if job.Status.Active > 0 {
		status.Status = enum.TaskStatusRunning
		if job.Status.StartTime != nil {
			startedAt := job.Status.StartTime.Time
			status.StartedAt = &startedAt
		}
	} else {
		status.Status = enum.TaskStatusPending
	}

	// Get Pod for metrics
	pods, err := r.clientset.CoreV1().Pods(r.config.Namespace).List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("%s=%s", LabelBacktestID, backtestID),
	})
	if err != nil {
		log.Printf("Backtest %s: failed to list pods: %v", backtestID, err)
	} else if len(pods.Items) == 0 {
		log.Printf("Backtest %s: no pods found", backtestID)
	} else {
		pod := pods.Items[0]
		log.Printf("Backtest %s: found pod %s, prometheusClient=%v", backtestID, pod.Name, r.prometheusClient != nil)
		r.populateBacktestPodMetrics(ctx, &pod, status)

		// Get exit code if completed
		for _, cs := range pod.Status.ContainerStatuses {
			if cs.Name == "freqtrade" && cs.State.Terminated != nil {
				status.ExitCode = int(cs.State.Terminated.ExitCode)
			}
		}
	}

	return status, nil
}

// GetBacktestResult returns the results of a completed backtest
func (r *BacktestRunner) GetBacktestResult(ctx context.Context, backtestID string) (*runner.BacktestResult, error) {
	status, err := r.GetBacktestStatus(ctx, backtestID)
	if err != nil {
		return nil, err
	}

	if status.Status != enum.TaskStatusCompleted && status.Status != enum.TaskStatusFailed {
		return nil, fmt.Errorf("backtest not completed, current status: %s", status.Status)
	}

	result := &runner.BacktestResult{
		BacktestID:   backtestID,
		Status:       status.Status,
		ContainerID:  status.ContainerID,
		ExitCode:     status.ExitCode,
		StartedAt:    status.StartedAt,
		CompletedAt:  status.CompletedAt,
		ErrorMessage: status.ErrorMessage,
	}

	if status.StartedAt != nil && status.CompletedAt != nil {
		result.Duration = status.CompletedAt.Sub(*status.StartedAt)
	}

	// Get logs from the pod
	logs, err := r.getFullLogs(ctx, backtestID, LabelBacktestID)
	if err == nil {
		// Parse results from logs first (needs raw logs with markers)
		if status.Status == enum.TaskStatusCompleted {
			r.parseBacktestResults(logs, result)
		}
		// Store clean logs without JSON markers for display
		result.Logs = freqtrade.CleanLogs(logs)
	}

	return result, nil
}

// GetBacktestLogs returns logs from a backtest
func (r *BacktestRunner) GetBacktestLogs(ctx context.Context, backtestID string, opts runner.LogOptions) (*runner.LogReader, error) {
	pods, err := r.clientset.CoreV1().Pods(r.config.Namespace).List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("%s=%s", LabelBacktestID, backtestID),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods: %w", err)
	}
	if len(pods.Items) == 0 {
		return nil, runner.ErrBacktestNotFound
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

// StopBacktest stops a running backtest by deleting the job
func (r *BacktestRunner) StopBacktest(ctx context.Context, backtestID string) error {
	jobName := r.getBacktestJobName(backtestID)

	propagationPolicy := metav1.DeletePropagationForeground
	err := r.clientset.BatchV1().Jobs(r.config.Namespace).Delete(ctx, jobName, metav1.DeleteOptions{
		PropagationPolicy: &propagationPolicy,
	})
	if err != nil && !errors.IsNotFound(err) {
		return fmt.Errorf("failed to delete job: %w", err)
	}

	return nil
}

// DeleteBacktest removes a backtest and all its resources
func (r *BacktestRunner) DeleteBacktest(ctx context.Context, backtestID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	return r.cleanupBacktestResources(ctx, backtestID)
}

// ListBacktests returns all backtests managed by this runner
func (r *BacktestRunner) ListBacktests(ctx context.Context) ([]runner.BacktestStatus, error) {
	jobs, err := r.clientset.BatchV1().Jobs(r.config.Namespace).List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("%s=true,%s=%s", LabelManaged, LabelTaskType, ComponentBacktest),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list jobs: %w", err)
	}

	var statuses []runner.BacktestStatus
	for _, job := range jobs.Items {
		backtestID := job.Labels[LabelBacktestID]
		if backtestID == "" {
			continue
		}

		status, err := r.GetBacktestStatus(ctx, backtestID)
		if err != nil {
			continue
		}
		statuses = append(statuses, *status)
	}

	return statuses, nil
}

// ==================== HyperOpt Operations ====================

// RunHyperOpt starts a new hyperopt job
func (r *BacktestRunner) RunHyperOpt(ctx context.Context, spec runner.HyperOptSpec) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Create ConfigMap for config
	configCM, err := r.createHyperOptConfigMap(ctx, spec)
	if err != nil {
		return "", fmt.Errorf("failed to create config ConfigMap: %w", err)
	}

	// Create ConfigMap for strategy
	strategyCM, err := r.createHyperOptStrategyConfigMap(ctx, spec)
	if err != nil {
		_ = r.cleanupHyperOptResources(ctx, spec.ID)
		return "", fmt.Errorf("failed to create strategy ConfigMap: %w", err)
	}

	// Create Job
	job, err := r.createHyperOptJob(ctx, spec, configCM.Name, strategyCM.Name)
	if err != nil {
		_ = r.cleanupHyperOptResources(ctx, spec.ID)
		return "", fmt.Errorf("failed to create Job: %w", err)
	}

	return job.Name, nil
}

// GetHyperOptStatus returns the current status of a hyperopt
func (r *BacktestRunner) GetHyperOptStatus(ctx context.Context, hyperOptID string) (*runner.HyperOptStatus, error) {
	jobName := r.getHyperOptJobName(hyperOptID)

	job, err := r.clientset.BatchV1().Jobs(r.config.Namespace).Get(ctx, jobName, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return nil, runner.ErrHyperOptNotFound
		}
		return nil, fmt.Errorf("failed to get job: %w", err)
	}

	status := &runner.HyperOptStatus{
		HyperOptID:  hyperOptID,
		ContainerID: job.Name,
		CreatedAt:   job.CreationTimestamp.Time,
	}

	// Determine status from Job conditions
	if job.Status.Succeeded > 0 {
		status.Status = enum.TaskStatusCompleted
		status.Progress = 100
		if job.Status.CompletionTime != nil {
			completedAt := job.Status.CompletionTime.Time
			status.CompletedAt = &completedAt
		}
	} else if job.Status.Failed > 0 {
		status.Status = enum.TaskStatusFailed
		for _, cond := range job.Status.Conditions {
			if cond.Type == batchv1.JobFailed {
				status.ErrorMessage = cond.Message
			}
		}
	} else if job.Status.Active > 0 {
		status.Status = enum.TaskStatusRunning
		if job.Status.StartTime != nil {
			startedAt := job.Status.StartTime.Time
			status.StartedAt = &startedAt
		}
	} else {
		status.Status = enum.TaskStatusPending
	}

	// Get Pod for metrics
	pods, err := r.clientset.CoreV1().Pods(r.config.Namespace).List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("%s=%s", LabelHyperOptID, hyperOptID),
	})
	if err == nil && len(pods.Items) > 0 {
		pod := pods.Items[0]
		r.populateHyperOptPodMetrics(ctx, &pod, status)

		for _, cs := range pod.Status.ContainerStatuses {
			if cs.Name == "freqtrade" && cs.State.Terminated != nil {
				status.ExitCode = int(cs.State.Terminated.ExitCode)
			}
		}
	}

	return status, nil
}

// GetHyperOptResult returns the results of a completed hyperopt
func (r *BacktestRunner) GetHyperOptResult(ctx context.Context, hyperOptID string) (*runner.HyperOptResult, error) {
	status, err := r.GetHyperOptStatus(ctx, hyperOptID)
	if err != nil {
		return nil, err
	}

	if status.Status != enum.TaskStatusCompleted {
		return nil, fmt.Errorf("hyperopt not completed, current status: %s", status.Status)
	}

	result := &runner.HyperOptResult{
		HyperOptID:  hyperOptID,
		Status:      status.Status,
		ContainerID: status.ContainerID,
		StartedAt:   status.StartedAt,
		CompletedAt: status.CompletedAt,
	}

	// TODO: Parse results from pod logs or copied files
	result.Logs = "Results parsing not yet implemented for Kubernetes"

	return result, nil
}

// GetHyperOptLogs returns logs from a hyperopt
func (r *BacktestRunner) GetHyperOptLogs(ctx context.Context, hyperOptID string, opts runner.LogOptions) (*runner.LogReader, error) {
	pods, err := r.clientset.CoreV1().Pods(r.config.Namespace).List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("%s=%s", LabelHyperOptID, hyperOptID),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods: %w", err)
	}
	if len(pods.Items) == 0 {
		return nil, runner.ErrHyperOptNotFound
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

// StopHyperOpt stops a running hyperopt
func (r *BacktestRunner) StopHyperOpt(ctx context.Context, hyperOptID string) error {
	jobName := r.getHyperOptJobName(hyperOptID)

	propagationPolicy := metav1.DeletePropagationForeground
	err := r.clientset.BatchV1().Jobs(r.config.Namespace).Delete(ctx, jobName, metav1.DeleteOptions{
		PropagationPolicy: &propagationPolicy,
	})
	if err != nil && !errors.IsNotFound(err) {
		return fmt.Errorf("failed to delete job: %w", err)
	}

	return nil
}

// DeleteHyperOpt removes a hyperopt and all its resources
func (r *BacktestRunner) DeleteHyperOpt(ctx context.Context, hyperOptID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	return r.cleanupHyperOptResources(ctx, hyperOptID)
}

// ListHyperOpts returns all hyperopts managed by this runner
func (r *BacktestRunner) ListHyperOpts(ctx context.Context) ([]runner.HyperOptStatus, error) {
	jobs, err := r.clientset.BatchV1().Jobs(r.config.Namespace).List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("%s=true,%s=%s", LabelManaged, LabelTaskType, ComponentHyperOpt),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list jobs: %w", err)
	}

	var statuses []runner.HyperOptStatus
	for _, job := range jobs.Items {
		hyperOptID := job.Labels[LabelHyperOptID]
		if hyperOptID == "" {
			continue
		}

		status, err := r.GetHyperOptStatus(ctx, hyperOptID)
		if err != nil {
			continue
		}
		statuses = append(statuses, *status)
	}

	return statuses, nil
}

// ==================== Helper Methods ====================

func (r *BacktestRunner) getBacktestJobName(backtestID string) string {
	return fmt.Sprintf("volaticloud-backtest-%s", backtestID)
}

func (r *BacktestRunner) getBacktestConfigMapName(backtestID string) string {
	return fmt.Sprintf("backtest-%s-config", backtestID)
}

func (r *BacktestRunner) getBacktestStrategyConfigMapName(backtestID string) string {
	return fmt.Sprintf("backtest-%s-strategy", backtestID)
}

func (r *BacktestRunner) getHyperOptJobName(hyperOptID string) string {
	return fmt.Sprintf("volaticloud-hyperopt-%s", hyperOptID)
}

func (r *BacktestRunner) getHyperOptConfigMapName(hyperOptID string) string {
	return fmt.Sprintf("hyperopt-%s-config", hyperOptID)
}

func (r *BacktestRunner) getHyperOptStrategyConfigMapName(hyperOptID string) string {
	return fmt.Sprintf("hyperopt-%s-strategy", hyperOptID)
}

func (r *BacktestRunner) cleanupBacktestResources(ctx context.Context, backtestID string) error {
	var errs []error

	// Delete Job
	jobName := r.getBacktestJobName(backtestID)
	propagationPolicy := metav1.DeletePropagationForeground
	err := r.clientset.BatchV1().Jobs(r.config.Namespace).Delete(ctx, jobName, metav1.DeleteOptions{
		PropagationPolicy: &propagationPolicy,
	})
	if err != nil && !errors.IsNotFound(err) {
		errs = append(errs, fmt.Errorf("failed to delete job: %w", err))
	}

	// Delete ConfigMaps
	configMapName := r.getBacktestConfigMapName(backtestID)
	err = r.clientset.CoreV1().ConfigMaps(r.config.Namespace).Delete(ctx, configMapName, metav1.DeleteOptions{})
	if err != nil && !errors.IsNotFound(err) {
		errs = append(errs, fmt.Errorf("failed to delete config configmap: %w", err))
	}

	strategyConfigMapName := r.getBacktestStrategyConfigMapName(backtestID)
	err = r.clientset.CoreV1().ConfigMaps(r.config.Namespace).Delete(ctx, strategyConfigMapName, metav1.DeleteOptions{})
	if err != nil && !errors.IsNotFound(err) {
		errs = append(errs, fmt.Errorf("failed to delete strategy configmap: %w", err))
	}

	if len(errs) > 0 {
		return fmt.Errorf("cleanup errors: %v", errs)
	}

	return nil
}

func (r *BacktestRunner) cleanupHyperOptResources(ctx context.Context, hyperOptID string) error {
	var errs []error

	// Delete Job
	jobName := r.getHyperOptJobName(hyperOptID)
	propagationPolicy := metav1.DeletePropagationForeground
	err := r.clientset.BatchV1().Jobs(r.config.Namespace).Delete(ctx, jobName, metav1.DeleteOptions{
		PropagationPolicy: &propagationPolicy,
	})
	if err != nil && !errors.IsNotFound(err) {
		errs = append(errs, fmt.Errorf("failed to delete job: %w", err))
	}

	// Delete ConfigMaps
	configMapName := r.getHyperOptConfigMapName(hyperOptID)
	err = r.clientset.CoreV1().ConfigMaps(r.config.Namespace).Delete(ctx, configMapName, metav1.DeleteOptions{})
	if err != nil && !errors.IsNotFound(err) {
		errs = append(errs, fmt.Errorf("failed to delete config configmap: %w", err))
	}

	strategyConfigMapName := r.getHyperOptStrategyConfigMapName(hyperOptID)
	err = r.clientset.CoreV1().ConfigMaps(r.config.Namespace).Delete(ctx, strategyConfigMapName, metav1.DeleteOptions{})
	if err != nil && !errors.IsNotFound(err) {
		errs = append(errs, fmt.Errorf("failed to delete strategy configmap: %w", err))
	}

	if len(errs) > 0 {
		return fmt.Errorf("cleanup errors: %v", errs)
	}

	return nil
}

// populateBacktestPodMetrics fetches metrics from Prometheus for a backtest pod
func (r *BacktestRunner) populateBacktestPodMetrics(ctx context.Context, pod *corev1.Pod, status *runner.BacktestStatus) {
	if r.prometheusClient == nil {
		log.Printf("Backtest pod %s: prometheusClient is nil, using minimum values", pod.Name)
		// Apply minimum values when no metrics client is available
		status.CPUUsage = MinimumCPUPercent
		status.MemoryUsage = MinimumMemoryBytes
		log.Printf("Backtest pod %s: applied minimums CPU=%.2f%%, Memory=%d bytes", pod.Name, status.CPUUsage, status.MemoryUsage)
		return
	}

	log.Printf("Backtest pod %s: fetching metrics from Prometheus...", pod.Name)
	metrics, err := r.prometheusClient.GetContainerMetrics(ctx, r.config.Namespace, pod.Name, "freqtrade")
	if err != nil {
		log.Printf("Failed to get backtest pod %s metrics from Prometheus: %v", pod.Name, err)
		// Apply minimum values on error
		status.CPUUsage = MinimumCPUPercent
		status.MemoryUsage = MinimumMemoryBytes
		log.Printf("Backtest pod %s: applied minimums on error CPU=%.2f%%, Memory=%d bytes", pod.Name, status.CPUUsage, status.MemoryUsage)
		return
	}

	if metrics != nil {
		log.Printf("Backtest pod %s: raw metrics CPU=%.2f%%, Memory=%d bytes", pod.Name, metrics.CPUPercent, metrics.MemoryBytes)

		// Apply minimum thresholds for billing (short-lived pods may not have scraped metrics)
		if applied := ApplyMinimums(metrics); applied {
			log.Printf("Backtest pod %s: applied minimums, now CPU=%.2f%%, Memory=%d bytes", pod.Name, metrics.CPUPercent, metrics.MemoryBytes)
		}

		status.CPUUsage = metrics.CPUPercent
		status.MemoryUsage = metrics.MemoryBytes
		status.NetworkRxBytes = metrics.NetworkRxBytes
		status.NetworkTxBytes = metrics.NetworkTxBytes
		status.BlockReadBytes = metrics.DiskReadBytes
		status.BlockWriteBytes = metrics.DiskWriteBytes
	} else {
		log.Printf("Backtest pod %s: metrics returned nil, using minimums", pod.Name)
		status.CPUUsage = MinimumCPUPercent
		status.MemoryUsage = MinimumMemoryBytes
	}
}

// populateHyperOptPodMetrics fetches metrics from Prometheus for a hyperopt pod
func (r *BacktestRunner) populateHyperOptPodMetrics(ctx context.Context, pod *corev1.Pod, status *runner.HyperOptStatus) {
	if r.prometheusClient == nil {
		// Apply minimum values when no metrics client is available
		status.CPUUsage = MinimumCPUPercent
		status.MemoryUsage = MinimumMemoryBytes
		return
	}

	metrics, err := r.prometheusClient.GetContainerMetrics(ctx, r.config.Namespace, pod.Name, "freqtrade")
	if err != nil {
		log.Printf("Failed to get hyperopt pod metrics from Prometheus: %v", err)
		// Apply minimum values on error
		status.CPUUsage = MinimumCPUPercent
		status.MemoryUsage = MinimumMemoryBytes
		return
	}

	if metrics != nil {
		// Apply minimum thresholds for billing
		ApplyMinimums(metrics)

		status.CPUUsage = metrics.CPUPercent
		status.MemoryUsage = metrics.MemoryBytes
		status.NetworkRxBytes = metrics.NetworkRxBytes
		status.NetworkTxBytes = metrics.NetworkTxBytes
		status.BlockReadBytes = metrics.DiskReadBytes
		status.BlockWriteBytes = metrics.DiskWriteBytes
	} else {
		// Apply minimum values when metrics are nil
		status.CPUUsage = MinimumCPUPercent
		status.MemoryUsage = MinimumMemoryBytes
	}
}

// ==================== Resource Creation ====================

func (r *BacktestRunner) createBacktestConfigMap(ctx context.Context, spec runner.BacktestSpec) (*corev1.ConfigMap, error) {
	configJSON, err := json.Marshal(spec.Config)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}

	configMap := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      r.getBacktestConfigMapName(spec.ID),
			Namespace: r.config.Namespace,
			Labels: map[string]string{
				LabelManaged:    "true",
				LabelBacktestID: spec.ID,
				LabelTaskType:   ComponentBacktest,
			},
		},
		Data: map[string]string{
			"config.json": string(configJSON),
		},
	}

	return r.clientset.CoreV1().ConfigMaps(r.config.Namespace).Create(ctx, configMap, metav1.CreateOptions{})
}

func (r *BacktestRunner) createBacktestStrategyConfigMap(ctx context.Context, spec runner.BacktestSpec) (*corev1.ConfigMap, error) {
	configMap := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      r.getBacktestStrategyConfigMapName(spec.ID),
			Namespace: r.config.Namespace,
			Labels: map[string]string{
				LabelManaged:    "true",
				LabelBacktestID: spec.ID,
				LabelTaskType:   ComponentBacktest,
			},
		},
		Data: map[string]string{
			fmt.Sprintf("%s.py", spec.StrategyName): spec.StrategyCode,
		},
	}

	return r.clientset.CoreV1().ConfigMaps(r.config.Namespace).Create(ctx, configMap, metav1.CreateOptions{})
}

func (r *BacktestRunner) createBacktestJob(ctx context.Context, spec runner.BacktestSpec, configCM, strategyCM string) (*batchv1.Job, error) {
	backoffLimit := int32(0)
	ttlSeconds := int32(3600) // 1 hour cleanup after completion

	userDataPath := fmt.Sprintf("/freqtrade/user_data/%s", spec.ID)

	// Build command that runs freqtrade and then outputs JSON results
	// This allows us to capture the actual JSON result from the logs
	// Uses Python's zipfile module since unzip is not available in freqtrade image
	backtestResultsDir := fmt.Sprintf("%s/backtest_results", userDataPath)
	freqtradeCmd := fmt.Sprintf(`freqtrade backtesting --strategy %s --userdir %s --config %s/config.json --data-format-ohlcv json && \
echo "===BACKTEST_RESULT_JSON_START===" && \
cat %s/.last_result.json && \
echo "" && \
python3 -c "
import json, zipfile, sys
with open('%s/.last_result.json') as f:
    data = json.load(f)
zf = data.get('latest_backtest', '')
if zf:
    print('===BACKTEST_FULL_RESULT_START===')
    with zipfile.ZipFile('%s/' + zf) as z:
        jf = zf.replace('.zip', '.json')
        print(z.read(jf).decode())
    print('===BACKTEST_FULL_RESULT_END===')
"`,
		spec.StrategyName,
		userDataPath,
		userDataPath,
		backtestResultsDir,
		backtestResultsDir,
		backtestResultsDir,
	)

	// Define volumes:
	// - userdata: writable emptyDir for the entire user_data directory
	// - config-source: ConfigMap with config.json (mounted in init container)
	// - strategy-source: ConfigMap with strategy file (mounted in init container)
	volumes := []corev1.Volume{
		{
			// Writable user_data directory - freqtrade needs to create subdirectories
			Name: "userdata",
			VolumeSource: corev1.VolumeSource{
				EmptyDir: &corev1.EmptyDirVolumeSource{},
			},
		},
		{
			// Source ConfigMap for config.json - used by init container
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
			// Source ConfigMap for strategy - used by init container
			Name: "strategy-source",
			VolumeSource: corev1.VolumeSource{
				ConfigMap: &corev1.ConfigMapVolumeSource{
					LocalObjectReference: corev1.LocalObjectReference{
						Name: strategyCM,
					},
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
	// 1. Copy config.json from ConfigMap
	// 2. Copy strategy from ConfigMap
	// 3. Download and extract data from S3 (if URL provided)
	setupScript := fmt.Sprintf(`set -e
echo "Setting up user_data directory..."
mkdir -p /userdata/strategies /userdata/data /userdata/backtest_results /userdata/hyperopts

echo "Copying config..."
cp /config-source/config.json /userdata/

echo "Copying strategy..."
cp /strategy-source/%s.py /userdata/strategies/
`, spec.StrategyName)

	if spec.DataDownloadURL != "" {
		setupScript += `
echo "Downloading data from S3..."
wget -q -O /tmp/data.zip "$DATA_DOWNLOAD_URL"
echo "Extracting data..."
unzip -q -o /tmp/data.zip -d /userdata/data
rm /tmp/data.zip
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
			},
		},
	}

	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      r.getBacktestJobName(spec.ID),
			Namespace: r.config.Namespace,
			Labels: map[string]string{
				LabelManaged:    "true",
				LabelBacktestID: spec.ID,
				LabelTaskType:   ComponentBacktest,
			},
		},
		Spec: batchv1.JobSpec{
			BackoffLimit:            &backoffLimit,
			TTLSecondsAfterFinished: &ttlSeconds,
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{
						LabelManaged:    "true",
						LabelBacktestID: spec.ID,
						LabelTaskType:   ComponentBacktest,
					},
				},
				Spec: corev1.PodSpec{
					RestartPolicy:  corev1.RestartPolicyNever,
					InitContainers: initContainers,
					Containers: []corev1.Container{
						{
							Name:         "freqtrade",
							Image:        r.config.GetFreqtradeImage(spec.FreqtradeVersion),
							Command:      []string{"/bin/sh", "-c"},
							Args:         []string{freqtradeCmd},
							VolumeMounts: volumeMounts,
						},
					},
					Volumes: volumes,
				},
			},
		},
	}

	return r.clientset.BatchV1().Jobs(r.config.Namespace).Create(ctx, job, metav1.CreateOptions{})
}

func (r *BacktestRunner) createHyperOptConfigMap(ctx context.Context, spec runner.HyperOptSpec) (*corev1.ConfigMap, error) {
	configJSON, err := json.Marshal(spec.Config)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}

	configMap := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      r.getHyperOptConfigMapName(spec.ID),
			Namespace: r.config.Namespace,
			Labels: map[string]string{
				LabelManaged:    "true",
				LabelHyperOptID: spec.ID,
				LabelTaskType:   ComponentHyperOpt,
			},
		},
		Data: map[string]string{
			"config.json": string(configJSON),
		},
	}

	return r.clientset.CoreV1().ConfigMaps(r.config.Namespace).Create(ctx, configMap, metav1.CreateOptions{})
}

func (r *BacktestRunner) createHyperOptStrategyConfigMap(ctx context.Context, spec runner.HyperOptSpec) (*corev1.ConfigMap, error) {
	configMap := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      r.getHyperOptStrategyConfigMapName(spec.ID),
			Namespace: r.config.Namespace,
			Labels: map[string]string{
				LabelManaged:    "true",
				LabelHyperOptID: spec.ID,
				LabelTaskType:   ComponentHyperOpt,
			},
		},
		Data: map[string]string{
			fmt.Sprintf("%s.py", spec.StrategyName): spec.StrategyCode,
		},
	}

	return r.clientset.CoreV1().ConfigMaps(r.config.Namespace).Create(ctx, configMap, metav1.CreateOptions{})
}

func (r *BacktestRunner) createHyperOptJob(ctx context.Context, spec runner.HyperOptSpec, configCM, strategyCM string) (*batchv1.Job, error) {
	backoffLimit := int32(0)
	ttlSeconds := int32(3600)

	userDataPath := fmt.Sprintf("/freqtrade/user_data/%s", spec.ID)

	// Build freqtrade arguments (image entrypoint is "freqtrade")
	args := []string{
		"hyperopt",
		"--strategy", spec.StrategyName,
		"--userdir", userDataPath,
		"--config", fmt.Sprintf("%s/config.json", userDataPath),
		"--epochs", fmt.Sprintf("%d", spec.Epochs),
		"--data-format-ohlcv", "json",
	}

	// Add spaces to optimize
	if len(spec.Spaces) > 0 {
		args = append(args, "--spaces", strings.Join(spec.Spaces, " "))
	}

	// Add loss function
	if spec.LossFunction != "" {
		args = append(args, "--hyperopt-loss", spec.LossFunction)
	}

	// Define volumes:
	// - userdata: writable emptyDir for the entire user_data directory
	// - config-source: ConfigMap with config.json (mounted in init container)
	// - strategy-source: ConfigMap with strategy file (mounted in init container)
	volumes := []corev1.Volume{
		{
			// Writable user_data directory - freqtrade needs to create subdirectories
			Name: "userdata",
			VolumeSource: corev1.VolumeSource{
				EmptyDir: &corev1.EmptyDirVolumeSource{},
			},
		},
		{
			// Source ConfigMap for config.json - used by init container
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
			// Source ConfigMap for strategy - used by init container
			Name: "strategy-source",
			VolumeSource: corev1.VolumeSource{
				ConfigMap: &corev1.ConfigMapVolumeSource{
					LocalObjectReference: corev1.LocalObjectReference{
						Name: strategyCM,
					},
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
	// 1. Copy config.json from ConfigMap
	// 2. Copy strategy from ConfigMap
	// 3. Download and extract data from S3 (if URL provided)
	setupScript := fmt.Sprintf(`set -e
echo "Setting up user_data directory..."
mkdir -p /userdata/strategies /userdata/data /userdata/backtest_results /userdata/hyperopts /userdata/hyperopt_results

echo "Copying config..."
cp /config-source/config.json /userdata/

echo "Copying strategy..."
cp /strategy-source/%s.py /userdata/strategies/
`, spec.StrategyName)

	if spec.DataDownloadURL != "" {
		setupScript += `
echo "Downloading data from S3..."
wget -q -O /tmp/data.zip "$DATA_DOWNLOAD_URL"
echo "Extracting data..."
unzip -q -o /tmp/data.zip -d /userdata/data
rm /tmp/data.zip
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
			},
		},
	}

	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      r.getHyperOptJobName(spec.ID),
			Namespace: r.config.Namespace,
			Labels: map[string]string{
				LabelManaged:    "true",
				LabelHyperOptID: spec.ID,
				LabelTaskType:   ComponentHyperOpt,
			},
		},
		Spec: batchv1.JobSpec{
			BackoffLimit:            &backoffLimit,
			TTLSecondsAfterFinished: &ttlSeconds,
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{
						LabelManaged:    "true",
						LabelHyperOptID: spec.ID,
						LabelTaskType:   ComponentHyperOpt,
					},
				},
				Spec: corev1.PodSpec{
					RestartPolicy:  corev1.RestartPolicyNever,
					InitContainers: initContainers,
					Containers: []corev1.Container{
						{
							Name:         "freqtrade",
							Image:        r.config.GetFreqtradeImage(spec.FreqtradeVersion),
							Args:         args, // Use Args to preserve image entrypoint
							VolumeMounts: volumeMounts,
						},
					},
					Volumes: volumes,
				},
			},
		},
	}

	return r.clientset.BatchV1().Jobs(r.config.Namespace).Create(ctx, job, metav1.CreateOptions{})
}

// ==================== Log and Result Parsing ====================

// getFullLogs retrieves complete logs from a pod by label selector
func (r *BacktestRunner) getFullLogs(ctx context.Context, taskID string, labelKey string) (string, error) {
	pods, err := r.clientset.CoreV1().Pods(r.config.Namespace).List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("%s=%s", labelKey, taskID),
	})
	if err != nil {
		return "", fmt.Errorf("failed to list pods: %w", err)
	}
	if len(pods.Items) == 0 {
		return "", fmt.Errorf("no pods found for task %s", taskID)
	}

	pod := pods.Items[0]

	// Get logs from the freqtrade container
	podLogOpts := &corev1.PodLogOptions{
		Container: "freqtrade",
	}

	req := r.clientset.CoreV1().Pods(r.config.Namespace).GetLogs(pod.Name, podLogOpts)
	stream, err := req.Stream(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get logs stream: %w", err)
	}
	defer stream.Close()

	var buf bytes.Buffer
	if _, err := io.Copy(&buf, stream); err != nil {
		return "", fmt.Errorf("failed to read logs: %w", err)
	}

	return buf.String(), nil
}

// parseBacktestResults extracts structured backtest results from raw logs using the shared freqtrade parser
func (r *BacktestRunner) parseBacktestResults(rawLogs string, result *runner.BacktestResult) {
	if rawLogs == "" {
		result.RawResult = map[string]interface{}{
			"error": "no logs available",
		}
		return
	}

	// Check if logs contain result markers
	if !freqtrade.ContainsBacktestMarkers(rawLogs) {
		result.RawResult = map[string]interface{}{
			"error": "no backtest result markers found in logs",
		}
		return
	}

	// Parse results from logs using the shared freqtrade parser
	parsed, err := freqtrade.ParseResultFromLogs(rawLogs)
	if err != nil {
		result.RawResult = map[string]interface{}{
			"error": fmt.Sprintf("failed to parse backtest results: %v", err),
		}
		return
	}

	if parsed.Error != "" {
		result.RawResult = map[string]interface{}{
			"error": parsed.Error,
		}
		return
	}

	result.RawResult = parsed.RawResult
}
