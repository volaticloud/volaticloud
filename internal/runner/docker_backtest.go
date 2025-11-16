package runner

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"

	"volaticloud/internal/enum"
)

const (
	// Docker labels for backtest containers
	labelBacktestID  = "volaticloud.backtest.id"
	labelTaskType    = "volaticloud.task.type"
	taskTypeBacktest = "backtest"
	taskTypeHyperOpt = "hyperopt"

	// Default freqtrade image
	defaultFreqtradeImage = "freqtradeorg/freqtrade:stable"
)

// DockerBacktestRunner implements BacktestRunner for Docker environments
type DockerBacktestRunner struct {
	client  *client.Client
	config  DockerConfig
	network string
}

// NewDockerBacktestRunner creates a new Docker backtest runner
func NewDockerBacktestRunner(ctx context.Context, config DockerConfig) (*DockerBacktestRunner, error) {
	opts := []client.Opt{
		client.FromEnv,
		client.WithHost(config.Host),
	}

	if config.APIVersion != "" {
		opts = append(opts, client.WithVersion(config.APIVersion))
	}

	if config.TLSVerify {
		// TODO: Implement TLS configuration
		return nil, fmt.Errorf("TLS is not yet implemented")
	}

	cli, err := client.NewClientWithOpts(opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create Docker client: %w", err)
	}

	// Verify connection
	if _, err := cli.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping Docker daemon: %w", err)
	}

	network := config.Network
	if network == "" {
		network = "bridge"
	}

	return &DockerBacktestRunner{
		client:  cli,
		config:  config,
		network: network,
	}, nil
}

// RunBacktest starts a new backtest task
func (d *DockerBacktestRunner) RunBacktest(ctx context.Context, spec BacktestSpec) (string, error) {
	imageName := d.getImageName(spec.FreqtradeVersion)

	// Pull image if needed
	if err := d.ensureImage(ctx, imageName); err != nil {
		return "", fmt.Errorf("failed to ensure image: %w", err)
	}

	// Create config files
	configPaths, err := d.createBacktestConfigFiles(spec)
	if err != nil {
		return "", fmt.Errorf("failed to create config files: %w", err)
	}

	// Build freqtrade command
	cmd := d.buildBacktestCommand(spec)

	// Prepare container config
	containerConfig := &container.Config{
		Image: imageName,
		Cmd:   cmd,
		Env:   d.buildEnvironment(spec.Environment),
		Labels: map[string]string{
			labelBacktestID: spec.ID,
			labelTaskType:   taskTypeBacktest,
		},
	}

	hostConfig := &container.HostConfig{
		NetworkMode: container.NetworkMode(d.network),
		AutoRemove:  false, // Keep container for result retrieval
		Mounts: []mount.Mount{
			{
				Type:     mount.TypeBind,
				Source:   configPaths.configFileHost,
				Target:   configPaths.configFileContainer,
				ReadOnly: true,
			},
			{
				Type:     mount.TypeBind,
				Source:   configPaths.strategyFileHost,
				Target:   configPaths.strategyFileContainer,
				ReadOnly: true,
			},
			{
				Type:   mount.TypeVolume,
				Source: "volaticloud-freqtrade-data",
				Target: "/freqtrade/user_data/data",
			},
			{
				Type:   mount.TypeVolume,
				Source: "volaticloud-backtest-results",
				Target: "/freqtrade/user_data/backtest_results",
			},
		},
	}

	// Apply resource limits
	if spec.ResourceLimits != nil {
		d.applyResourceLimits(hostConfig, spec.ResourceLimits)
	}

	containerName := getBacktestContainerName(spec.ID)

	// Create container
	resp, err := d.client.ContainerCreate(ctx, containerConfig, hostConfig, nil, nil, containerName)
	if err != nil {
		d.cleanupBacktestConfigFiles(spec.ID)
		return "", fmt.Errorf("failed to create backtest container: %w", err)
	}

	// Start container
	if err := d.client.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		d.client.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})
		d.cleanupBacktestConfigFiles(spec.ID)
		return "", fmt.Errorf("failed to start backtest container: %w", err)
	}

	return resp.ID, nil
}

// GetBacktestStatus retrieves the current status of a backtest
func (d *DockerBacktestRunner) GetBacktestStatus(ctx context.Context, backtestID string) (*BacktestStatus, error) {
	containerID, err := d.findContainer(ctx, backtestID, taskTypeBacktest)
	if err != nil {
		return nil, err
	}

	inspect, err := d.client.ContainerInspect(ctx, containerID)
	if err != nil {
		return nil, fmt.Errorf("failed to inspect container: %w", err)
	}

	status := &BacktestStatus{
		BacktestID:  backtestID,
		ContainerID: containerID,
	}

	// Parse created timestamp
	if createdTime, err := time.Parse(time.RFC3339Nano, inspect.Created); err == nil {
		status.CreatedAt = createdTime
	}

	// Determine task status
	if inspect.State.Running {
		status.Status = enum.TaskStatusRunning
		if inspect.State.StartedAt != "" {
			if t, err := time.Parse(time.RFC3339Nano, inspect.State.StartedAt); err == nil {
				status.StartedAt = &t
			}
		}
	} else if inspect.State.ExitCode == 0 {
		status.Status = enum.TaskStatusCompleted
		if inspect.State.FinishedAt != "" {
			if t, err := time.Parse(time.RFC3339Nano, inspect.State.FinishedAt); err == nil {
				status.CompletedAt = &t
			}
		}
	} else {
		status.Status = enum.TaskStatusFailed
		status.ExitCode = inspect.State.ExitCode
		status.ErrorMessage = inspect.State.Error
	}

	// Get resource usage if running
	if inspect.State.Running {
		stats, err := d.client.ContainerStats(ctx, containerID, false)
		if err == nil {
			defer stats.Body.Close()
			var statsData container.StatsResponse
			if err := json.NewDecoder(stats.Body).Decode(&statsData); err == nil {
				// Calculate CPU percentage
				if statsData.CPUStats.CPUUsage.TotalUsage > 0 && statsData.PreCPUStats.CPUUsage.TotalUsage > 0 {
					cpuDelta := float64(statsData.CPUStats.CPUUsage.TotalUsage - statsData.PreCPUStats.CPUUsage.TotalUsage)
					systemDelta := float64(statsData.CPUStats.SystemUsage - statsData.PreCPUStats.SystemUsage)
					if systemDelta > 0 {
						status.CPUUsage = (cpuDelta / systemDelta) * float64(len(statsData.CPUStats.CPUUsage.PercpuUsage)) * 100.0
					}
				}
				status.MemoryUsage = int64(statsData.MemoryStats.Usage)
			}
		}
	}

	return status, nil
}

// GetBacktestResult retrieves the final results of a completed backtest
func (d *DockerBacktestRunner) GetBacktestResult(ctx context.Context, backtestID string) (*BacktestResult, error) {
	status, err := d.GetBacktestStatus(ctx, backtestID)
	if err != nil {
		return nil, err
	}

	if status.Status != enum.TaskStatusCompleted && status.Status != enum.TaskStatusFailed {
		return nil, fmt.Errorf("backtest is not completed (status: %s)", status.Status)
	}

	result := &BacktestResult{
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

	// Get logs
	logs, err := d.getContainerLogs(ctx, status.ContainerID)
	if err == nil {
		result.Logs = logs
	}

	// Parse results from logs if successful
	if status.Status == enum.TaskStatusCompleted {
		d.parseBacktestResults(result)
	}

	return result, nil
}

// GetBacktestLogs retrieves logs from a backtest
func (d *DockerBacktestRunner) GetBacktestLogs(ctx context.Context, backtestID string, opts LogOptions) (*LogReader, error) {
	containerID, err := d.findContainer(ctx, backtestID, taskTypeBacktest)
	if err != nil {
		return nil, err
	}

	return d.getLogsReader(ctx, containerID, opts)
}

// StopBacktest stops a running backtest
func (d *DockerBacktestRunner) StopBacktest(ctx context.Context, backtestID string) error {
	containerID, err := d.findContainer(ctx, backtestID, taskTypeBacktest)
	if err != nil {
		return err
	}

	timeout := 30
	return d.client.ContainerStop(ctx, containerID, container.StopOptions{Timeout: &timeout})
}

// DeleteBacktest removes a backtest task and cleans up resources
func (d *DockerBacktestRunner) DeleteBacktest(ctx context.Context, backtestID string) error {
	containerID, err := d.findContainer(ctx, backtestID, taskTypeBacktest)
	if err != nil {
		if err == ErrBacktestNotFound {
			// Still cleanup config files if they exist
			d.cleanupBacktestConfigFiles(backtestID)
			return nil // Already deleted
		}
		return err
	}

	err = d.client.ContainerRemove(ctx, containerID, container.RemoveOptions{
		Force:         true,
		RemoveVolumes: true,
	})

	// Cleanup config files regardless of container removal result
	d.cleanupBacktestConfigFiles(backtestID)

	return err
}

// ListBacktests returns all backtest tasks
func (d *DockerBacktestRunner) ListBacktests(ctx context.Context) ([]BacktestStatus, error) {
	return d.listTasks(ctx, taskTypeBacktest)
}

// RunHyperOpt starts a new hyperparameter optimization task
func (d *DockerBacktestRunner) RunHyperOpt(ctx context.Context, spec HyperOptSpec) (string, error) {
	imageName := d.getImageName(spec.FreqtradeVersion)

	if err := d.ensureImage(ctx, imageName); err != nil {
		return "", fmt.Errorf("failed to ensure image: %w", err)
	}

	cmd := d.buildHyperOptCommand(spec)

	containerConfig := &container.Config{
		Image: imageName,
		Cmd:   cmd,
		Env:   d.buildEnvironment(spec.Environment),
		Labels: map[string]string{
			labelBacktestID: spec.ID,
			labelTaskType:   taskTypeHyperOpt,
		},
	}

	hostConfig := &container.HostConfig{
		NetworkMode: container.NetworkMode(d.network),
		AutoRemove:  false,
	}

	if spec.ResourceLimits != nil {
		d.applyResourceLimits(hostConfig, spec.ResourceLimits)
	}

	containerName := getHyperOptContainerName(spec.ID)

	resp, err := d.client.ContainerCreate(ctx, containerConfig, hostConfig, nil, nil, containerName)
	if err != nil {
		return "", fmt.Errorf("failed to create hyperopt container: %w", err)
	}

	if err := d.client.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return "", fmt.Errorf("failed to start hyperopt container: %w", err)
	}

	return resp.ID, nil
}

// GetHyperOptStatus retrieves the current status of a hyperopt
func (d *DockerBacktestRunner) GetHyperOptStatus(ctx context.Context, hyperOptID string) (*HyperOptStatus, error) {
	containerID, err := d.findContainer(ctx, hyperOptID, taskTypeHyperOpt)
	if err != nil {
		return nil, err
	}

	inspect, err := d.client.ContainerInspect(ctx, containerID)
	if err != nil {
		return nil, fmt.Errorf("failed to inspect container: %w", err)
	}

	status := &HyperOptStatus{
		HyperOptID:  hyperOptID,
		ContainerID: containerID,
	}

	// Parse created timestamp
	if createdTime, err := time.Parse(time.RFC3339Nano, inspect.Created); err == nil {
		status.CreatedAt = createdTime
	}

	if inspect.State.Running {
		status.Status = enum.TaskStatusRunning
		if inspect.State.StartedAt != "" {
			if t, err := time.Parse(time.RFC3339Nano, inspect.State.StartedAt); err == nil {
				status.StartedAt = &t
			}
		}
	} else if inspect.State.ExitCode == 0 {
		status.Status = enum.TaskStatusCompleted
		if inspect.State.FinishedAt != "" {
			if t, err := time.Parse(time.RFC3339Nano, inspect.State.FinishedAt); err == nil {
				status.CompletedAt = &t
			}
		}
	} else {
		status.Status = enum.TaskStatusFailed
		status.ExitCode = inspect.State.ExitCode
		status.ErrorMessage = inspect.State.Error
	}

	return status, nil
}

// GetHyperOptResult retrieves the final results of a completed hyperopt
func (d *DockerBacktestRunner) GetHyperOptResult(ctx context.Context, hyperOptID string) (*HyperOptResult, error) {
	status, err := d.GetHyperOptStatus(ctx, hyperOptID)
	if err != nil {
		return nil, err
	}

	if status.Status != enum.TaskStatusCompleted && status.Status != enum.TaskStatusFailed {
		return nil, fmt.Errorf("hyperopt is not completed (status: %s)", status.Status)
	}

	result := &HyperOptResult{
		HyperOptID:   hyperOptID,
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

	logs, err := d.getContainerLogs(ctx, status.ContainerID)
	if err == nil {
		result.Logs = logs
	}

	if status.Status == enum.TaskStatusCompleted {
		d.parseHyperOptResults(result)
	}

	return result, nil
}

// GetHyperOptLogs retrieves logs from a hyperopt
func (d *DockerBacktestRunner) GetHyperOptLogs(ctx context.Context, hyperOptID string, opts LogOptions) (*LogReader, error) {
	containerID, err := d.findContainer(ctx, hyperOptID, taskTypeHyperOpt)
	if err != nil {
		return nil, err
	}

	return d.getLogsReader(ctx, containerID, opts)
}

// StopHyperOpt stops a running hyperopt
func (d *DockerBacktestRunner) StopHyperOpt(ctx context.Context, hyperOptID string) error {
	containerID, err := d.findContainer(ctx, hyperOptID, taskTypeHyperOpt)
	if err != nil {
		return err
	}

	timeout := 30
	return d.client.ContainerStop(ctx, containerID, container.StopOptions{Timeout: &timeout})
}

// DeleteHyperOpt removes a hyperopt task
func (d *DockerBacktestRunner) DeleteHyperOpt(ctx context.Context, hyperOptID string) error {
	containerID, err := d.findContainer(ctx, hyperOptID, taskTypeHyperOpt)
	if err != nil {
		if err == ErrHyperOptNotFound {
			return nil
		}
		return err
	}

	return d.client.ContainerRemove(ctx, containerID, container.RemoveOptions{
		Force:         true,
		RemoveVolumes: true,
	})
}

// ListHyperOpts returns all hyperopt tasks
func (d *DockerBacktestRunner) ListHyperOpts(ctx context.Context) ([]HyperOptStatus, error) {
	return d.listHyperOptTasks(ctx, taskTypeHyperOpt)
}

// HealthCheck verifies Docker daemon is accessible
func (d *DockerBacktestRunner) HealthCheck(ctx context.Context) error {
	_, err := d.client.Ping(ctx)
	return err
}

// Close cleans up Docker client
func (d *DockerBacktestRunner) Close() error {
	return d.client.Close()
}

// Type returns "docker"
func (d *DockerBacktestRunner) Type() string {
	return "docker"
}

// Helper functions

func (d *DockerBacktestRunner) getImageName(version string) string {
	if version == "" {
		return defaultFreqtradeImage
	}
	return fmt.Sprintf("freqtradeorg/freqtrade:%s", version)
}

func (d *DockerBacktestRunner) ensureImage(ctx context.Context, imageName string) error {
	// Check if image exists locally
	_, err := d.client.ImageInspect(ctx, imageName)
	if err == nil {
		return nil // Image exists
	}

	// Pull image
	reader, err := d.client.ImagePull(ctx, imageName, image.PullOptions{})
	if err != nil {
		return fmt.Errorf("failed to pull image: %w", err)
	}
	defer reader.Close()

	// Wait for pull to complete
	_, err = io.Copy(io.Discard, reader)
	return err
}

func (d *DockerBacktestRunner) buildBacktestCommand(spec BacktestSpec) []string {
	// Backtests use JSON config only (like bots), no command-line parameters
	// Only pass strategy name as it's required
	cmd := []string{"backtesting"}

	if spec.StrategyName != "" {
		cmd = append(cmd, "--strategy", spec.StrategyName)
	}

	// All other configuration (timeframe, pairs, timerange, trading_mode, etc.) is in config.json
	// Freqtrade will automatically use the trading_mode from config to look in the correct subdirectory
	return cmd
}

func (d *DockerBacktestRunner) buildHyperOptCommand(spec HyperOptSpec) []string {
	cmd := []string{"hyperopt"}

	if spec.StrategyName != "" {
		cmd = append(cmd, "--strategy", spec.StrategyName)
	}

	if spec.Epochs > 0 {
		cmd = append(cmd, "--epochs", fmt.Sprintf("%d", spec.Epochs))
	}

	if len(spec.Spaces) > 0 {
		cmd = append(cmd, "--spaces", strings.Join(spec.Spaces, " "))
	}

	if spec.LossFunction != "" {
		cmd = append(cmd, "--hyperopt-loss", spec.LossFunction)
	}

	return cmd
}

func (d *DockerBacktestRunner) buildEnvironment(env map[string]string) []string {
	result := make([]string, 0, len(env))
	for k, v := range env {
		result = append(result, fmt.Sprintf("%s=%s", k, v))
	}
	return result
}

func (d *DockerBacktestRunner) applyResourceLimits(hostConfig *container.HostConfig, limits *ResourceLimits) {
	if limits.CPUQuota > 0 {
		hostConfig.NanoCPUs = int64(limits.CPUQuota * 1e9)
	}
	if limits.MemoryBytes > 0 {
		hostConfig.Memory = limits.MemoryBytes
	}
}

func (d *DockerBacktestRunner) findContainer(ctx context.Context, taskID string, taskType string) (string, error) {
	// Try by name first
	var containerName string
	if taskType == taskTypeBacktest {
		containerName = getBacktestContainerName(taskID)
	} else {
		containerName = getHyperOptContainerName(taskID)
	}

	inspect, err := d.client.ContainerInspect(ctx, containerName)
	if err == nil {
		return inspect.ID, nil
	}

	// Try as direct container ID
	inspect, err = d.client.ContainerInspect(ctx, taskID)
	if err == nil {
		return inspect.ID, nil
	}

	// Fall back to label search
	filterArgs := filters.NewArgs()
	filterArgs.Add("label", labelBacktestID+"="+taskID)
	filterArgs.Add("label", labelTaskType+"="+taskType)

	containers, err := d.client.ContainerList(ctx, container.ListOptions{
		All:     true,
		Filters: filterArgs,
	})
	if err != nil {
		return "", err
	}

	if len(containers) == 0 {
		if taskType == taskTypeBacktest {
			return "", ErrBacktestNotFound
		}
		return "", ErrHyperOptNotFound
	}

	return containers[0].ID, nil
}

func (d *DockerBacktestRunner) getContainerLogs(ctx context.Context, containerID string) (string, error) {
	reader, err := d.client.ContainerLogs(ctx, containerID, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
	})
	if err != nil {
		return "", err
	}
	defer reader.Close()

	// Docker logs are multiplexed - need to demultiplex them using stdcopy
	var stdout bytes.Buffer
	var stderr bytes.Buffer

	_, err = stdcopy.StdCopy(&stdout, &stderr, reader)
	if err != nil {
		return "", err
	}

	// Combine stdout and stderr
	combinedLogs := stdout.String()
	if stderr.Len() > 0 {
		if stdout.Len() > 0 {
			combinedLogs += "\n"
		}
		combinedLogs += stderr.String()
	}

	return combinedLogs, nil
}

func (d *DockerBacktestRunner) getLogsReader(ctx context.Context, containerID string, opts LogOptions) (*LogReader, error) {
	// Convert Tail to string
	tail := "all"
	if opts.Tail > 0 {
		tail = fmt.Sprintf("%d", opts.Tail)
	}

	// Convert Since to string (RFC3339 format)
	since := ""
	if !opts.Since.IsZero() {
		since = opts.Since.Format(time.RFC3339)
	}

	reader, err := d.client.ContainerLogs(ctx, containerID, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     opts.Follow,
		Tail:       tail,
		Since:      since,
	})
	if err != nil {
		return nil, err
	}

	return &LogReader{
		ReadCloser: reader,
	}, nil
}

func (d *DockerBacktestRunner) listTasks(ctx context.Context, taskType string) ([]BacktestStatus, error) {
	filterArgs := filters.NewArgs()
	filterArgs.Add("label", labelTaskType+"="+taskType)

	containers, err := d.client.ContainerList(ctx, container.ListOptions{
		All:     true,
		Filters: filterArgs,
	})
	if err != nil {
		return nil, err
	}

	results := make([]BacktestStatus, 0, len(containers))
	for _, c := range containers {
		backtestID := c.Labels[labelBacktestID]
		status, err := d.GetBacktestStatus(ctx, backtestID)
		if err == nil {
			results = append(results, *status)
		}
	}

	return results, nil
}

func (d *DockerBacktestRunner) listHyperOptTasks(ctx context.Context, taskType string) ([]HyperOptStatus, error) {
	filterArgs := filters.NewArgs()
	filterArgs.Add("label", labelTaskType+"="+taskType)

	containers, err := d.client.ContainerList(ctx, container.ListOptions{
		All:     true,
		Filters: filterArgs,
	})
	if err != nil {
		return nil, err
	}

	results := make([]HyperOptStatus, 0, len(containers))
	for _, c := range containers {
		hyperOptID := c.Labels[labelBacktestID]
		status, err := d.GetHyperOptStatus(ctx, hyperOptID)
		if err == nil {
			results = append(results, *status)
		}
	}

	return results, nil
}

func (d *DockerBacktestRunner) parseBacktestResults(result *BacktestResult) {
	// Read backtest results from the Docker volume
	// With the volume mount, results persist even after container stops
	ctx := context.Background()

	// Step 1: Read .last_result.json from the volume to get the actual results filename
	lastResultJSON, err := d.readFileFromVolume(ctx, "volaticloud-backtest-results", ".last_result.json")
	if err != nil {
		// If we can't read the results file, store logs as fallback
		result.RawResult = map[string]interface{}{
			"error": fmt.Sprintf("Failed to read .last_result.json from volume: %v", err),
			"logs":  result.Logs,
		}
		return
	}

	// Parse .last_result.json to get the filename
	var lastResult map[string]interface{}
	if err := json.Unmarshal(lastResultJSON, &lastResult); err != nil {
		result.RawResult = map[string]interface{}{
			"error":       fmt.Sprintf("Failed to parse .last_result.json: %v", err),
			"raw_results": string(lastResultJSON),
			"logs":        result.Logs,
		}
		return
	}

	// Step 2: Get the actual results filename (replace .zip with .json)
	latestBacktest, ok := lastResult["latest_backtest"].(string)
	if !ok || latestBacktest == "" {
		result.RawResult = map[string]interface{}{
			"error": "No latest_backtest found in .last_result.json",
			"logs":  result.Logs,
		}
		return
	}

	// Step 3: Extract and read the JSON file from the zip archive
	zipFilename := latestBacktest
	jsonFilename := strings.Replace(latestBacktest, ".zip", ".json", 1)

	resultsJSON, err := d.readFileFromZipInVolume(ctx, "volaticloud-backtest-results", zipFilename, jsonFilename)
	if err != nil {
		result.RawResult = map[string]interface{}{
			"error": fmt.Sprintf("Failed to read results from zip %s: %v", zipFilename, err),
			"logs":  result.Logs,
		}
		return
	}

	// Parse the actual results
	var backtestData map[string]interface{}
	if err := json.Unmarshal(resultsJSON, &backtestData); err != nil {
		result.RawResult = map[string]interface{}{
			"error":       fmt.Sprintf("Failed to parse results JSON: %v", err),
			"raw_results": string(resultsJSON),
			"logs":        result.Logs,
		}
		return
	}

	// Store the parsed results
	result.RawResult = backtestData
}

func (d *DockerBacktestRunner) parseHyperOptResults(result *HyperOptResult) {
	// TODO: Parse freqtrade hyperopt JSON output from logs
	result.RawResult = map[string]interface{}{
		"logs": result.Logs,
	}
}

func getBacktestContainerName(backtestID string) string {
	return fmt.Sprintf("volaticloud-backtest-%s", backtestID)
}

func getHyperOptContainerName(hyperOptID string) string {
	return fmt.Sprintf("volaticloud-hyperopt-%s", hyperOptID)
}

// backtestConfigPaths holds the paths to config files for a backtest
type backtestConfigPaths struct {
	configFileHost        string // Host path to main config file
	configFileContainer   string // Container path to main config file
	strategyFileHost      string // Host path to strategy Python file
	strategyFileContainer string // Container path to strategy Python file
}

// createBacktestConfigFiles creates temporary config files for the backtest
func (d *DockerBacktestRunner) createBacktestConfigFiles(spec BacktestSpec) (*backtestConfigPaths, error) {
	// Create config directory for this backtest
	configDir := filepath.Join("/tmp", "volaticloud-backtest-configs", spec.ID)
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create config directory: %w", err)
	}

	paths := &backtestConfigPaths{
		configFileContainer:   "/freqtrade/user_data/config.json",
		strategyFileContainer: fmt.Sprintf("/freqtrade/user_data/strategies/%s.py", spec.StrategyName),
	}

	// Use spec.Config directly (like bots do) - just write it as-is
	// No hardcoding! Validation should be done before calling this function
	if spec.Config == nil {
		return nil, fmt.Errorf("backtest config is nil - validation should have caught this")
	}

	// Create a copy to avoid mutating the original
	config := make(map[string]interface{})
	for k, v := range spec.Config {
		config[k] = v
	}

	// Only inject dry_run field for backtests (always true)
	config["dry_run"] = true

	// Write config file
	configPath := filepath.Join(configDir, "config.json")
	configJSON, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		d.cleanupBacktestConfigFiles(spec.ID)
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}
	if err := os.WriteFile(configPath, configJSON, 0644); err != nil {
		d.cleanupBacktestConfigFiles(spec.ID)
		return nil, fmt.Errorf("failed to write config file: %w", err)
	}
	paths.configFileHost = configPath

	// Write strategy Python file
	if spec.StrategyCode != "" && spec.StrategyName != "" {
		strategyPath := filepath.Join(configDir, spec.StrategyName+".py")
		if err := os.WriteFile(strategyPath, []byte(spec.StrategyCode), 0644); err != nil {
			d.cleanupBacktestConfigFiles(spec.ID)
			return nil, fmt.Errorf("failed to write strategy file: %w", err)
		}
		paths.strategyFileHost = strategyPath
	}

	return paths, nil
}

// cleanupBacktestConfigFiles removes temporary config files for a backtest
func (d *DockerBacktestRunner) cleanupBacktestConfigFiles(backtestID string) {
	configDir := filepath.Join("/tmp", "volaticloud-backtest-configs", backtestID)
	os.RemoveAll(configDir) // Best effort cleanup
}

// readFileFromVolume reads a file from a Docker volume using a temporary container
func (d *DockerBacktestRunner) readFileFromVolume(ctx context.Context, volumeName string, filePath string) ([]byte, error) {
	// Create a temporary alpine container to read from the volume
	containerConfig := &container.Config{
		Image: "alpine:latest",
		Cmd:   []string{"cat", filepath.Join("/data", filePath)},
	}

	hostConfig := &container.HostConfig{
		AutoRemove: false, // Don't auto-remove so we can read logs
		Mounts: []mount.Mount{
			{
				Type:     mount.TypeVolume,
				Source:   volumeName,
				Target:   "/data",
				ReadOnly: true,
			},
		},
	}

	// Create container
	resp, err := d.client.ContainerCreate(ctx, containerConfig, hostConfig, nil, nil, "")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp container: %w", err)
	}

	// Ensure cleanup
	defer d.client.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})

	// Start container
	if err := d.client.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return nil, fmt.Errorf("failed to start temp container: %w", err)
	}

	// Wait for container to finish
	statusCh, errCh := d.client.ContainerWait(ctx, resp.ID, container.WaitConditionNotRunning)
	select {
	case err := <-errCh:
		if err != nil {
			return nil, fmt.Errorf("error waiting for container: %w", err)
		}
	case status := <-statusCh:
		if status.StatusCode != 0 {
			// Get logs to see error (with Docker framing removed)
			logs := d.getRawContainerOutput(ctx, resp.ID)
			return nil, fmt.Errorf("container exited with code %d: %s", status.StatusCode, logs)
		}
	}

	// Get file content (stripped of Docker log framing)
	fileContent := d.getRawContainerOutput(ctx, resp.ID)
	if fileContent == "" {
		return nil, fmt.Errorf("no file content returned")
	}

	return []byte(fileContent), nil
}

// getRawContainerOutput reads container stdout/stderr and strips Docker log framing
func (d *DockerBacktestRunner) getRawContainerOutput(ctx context.Context, containerID string) string {
	reader, err := d.client.ContainerLogs(ctx, containerID, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
	})
	if err != nil {
		return ""
	}
	defer reader.Close()

	// Use stdcopy to demultiplex Docker log streams and remove framing bytes
	var stdout, stderr bytes.Buffer
	_, err = stdcopy.StdCopy(&stdout, &stderr, reader)
	if err != nil {
		return ""
	}

	// Return stdout content (file content from cat command)
	return stdout.String()
}

// readFileFromZipInVolume reads a specific file from a zip archive in a Docker volume
func (d *DockerBacktestRunner) readFileFromZipInVolume(ctx context.Context, volumeName string, zipPath string, fileInZip string) ([]byte, error) {
	// Create a temporary alpine container with unzip to extract the file
	containerConfig := &container.Config{
		Image: "alpine:latest",
		Cmd:   []string{"sh", "-c", fmt.Sprintf("unzip -p /data/%s %s", zipPath, fileInZip)},
	}

	hostConfig := &container.HostConfig{
		AutoRemove: false,
		Mounts: []mount.Mount{
			{
				Type:     mount.TypeVolume,
				Source:   volumeName,
				Target:   "/data",
				ReadOnly: true,
			},
		},
	}

	// Create container
	resp, err := d.client.ContainerCreate(ctx, containerConfig, hostConfig, nil, nil, "")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp container: %w", err)
	}

	// Ensure cleanup
	defer d.client.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})

	// Start container
	if err := d.client.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return nil, fmt.Errorf("failed to start temp container: %w", err)
	}

	// Wait for container to finish
	statusCh, errCh := d.client.ContainerWait(ctx, resp.ID, container.WaitConditionNotRunning)
	select {
	case err := <-errCh:
		if err != nil {
			return nil, fmt.Errorf("error waiting for container: %w", err)
		}
	case status := <-statusCh:
		if status.StatusCode != 0 {
			// Get logs to see error
			logs := d.getRawContainerOutput(ctx, resp.ID)
			return nil, fmt.Errorf("container exited with code %d: %s", status.StatusCode, logs)
		}
	}

	// Get file content (stripped of Docker log framing)
	fileContent := d.getRawContainerOutput(ctx, resp.ID)
	if fileContent == "" {
		return nil, fmt.Errorf("no file content returned")
	}

	return []byte(fileContent), nil
}
