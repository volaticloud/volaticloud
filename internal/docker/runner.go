package docker

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/registry"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"

	"volaticloud/internal/enum"
	"volaticloud/internal/runner"
)

const (
	// Container naming
	containerNamePrefix = "volaticloud-bot-"

	// Labels
	labelBotID   = "volaticloud.bot.id"
	labelBotName = "volaticloud.bot.name"
	labelManaged = "volaticloud.managed"

	// Default network
	defaultNetwork = "volaticloud-network"

	// Default timeouts
	defaultStopTimeout = 30 * time.Second
)

// Runtime implements runner.Runtime for Docker environments
type Runtime struct {
	client       *client.Client
	config       *Config
	volumeHelper *VolumeHelper
}

// NewRuntime creates a new Docker runtime instance
func NewRuntime(ctx context.Context, config *Config) (*Runtime, error) {
	if config == nil {
		return nil, fmt.Errorf("docker config cannot be nil")
	}

	// Build client options
	opts := []client.Opt{
		client.WithHost(config.Host),
	}

	// Add API version if specified
	if config.APIVersion != "" {
		opts = append(opts, client.WithAPIVersionNegotiation())
		opts = append(opts, client.WithVersion(config.APIVersion))
	} else {
		opts = append(opts, client.WithAPIVersionNegotiation())
	}

	// Configure TLS if enabled
	if config.TLSVerify {
		tlsConfig, err := loadTLSConfig(config)
		if err != nil {
			return nil, fmt.Errorf("failed to load TLS config: %w", err)
		}

		httpClient := &http.Client{
			Transport: &http.Transport{
				TLSClientConfig: tlsConfig,
			},
		}
		opts = append(opts, client.WithHTTPClient(httpClient))
	}

	// Create Docker client
	cli, err := client.NewClientWithOpts(opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create Docker client: %w", err)
	}

	return &Runtime{
		client:       cli,
		config:       config,
		volumeHelper: NewVolumeHelper(cli),
	}, nil
}

// Ensure Runtime implements runner.Runtime interface
var _ runner.Runtime = (*Runtime)(nil)

// CreateBot deploys a new bot container
// Container name is derived from spec.ID (the bot UUID)
func (d *Runtime) CreateBot(ctx context.Context, spec runner.BotSpec) error {
	// Ensure network exists
	if err := d.ensureNetwork(ctx); err != nil {
		return runner.NewRunnerError("CreateBot", spec.ID, err, true)
	}

	// Pull image if needed
	if err := d.pullImage(ctx, spec.Image); err != nil {
		return runner.NewRunnerError("CreateBot", spec.ID, err, true)
	}

	// Create temporary config files
	configPaths, err := d.createConfigFiles(spec)
	if err != nil {
		return runner.NewRunnerError("CreateBot", spec.ID, err, true)
	}

	// Build container configuration with config file paths
	containerConfig := d.buildContainerConfig(spec, configPaths)
	hostConfig := d.buildHostConfig(spec, configPaths)
	networkConfig := d.buildNetworkConfig(spec)

	// Create container
	containerName := getContainerName(spec.ID)
	resp, err := d.client.ContainerCreate(
		ctx,
		containerConfig,
		hostConfig,
		networkConfig,
		nil, // platform
		containerName,
	)
	if err != nil {
		// Clean up config files if container creation fails
		d.cleanupConfigFiles(spec.ID)
		return runner.NewRunnerError("CreateBot", spec.ID, err, true)
	}

	// Start container
	if err := d.client.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		// Clean up container and config files if start fails
		d.client.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})
		d.cleanupConfigFiles(spec.ID)
		return runner.NewRunnerError("CreateBot", spec.ID, err, true)
	}

	return nil
}

// DeleteBot removes a bot container
func (d *Runtime) DeleteBot(ctx context.Context, botID string) error {
	containerID, err := d.findContainer(ctx, botID)
	if err != nil {
		return runner.NewRunnerError("DeleteBot", botID, err, false)
	}

	// Remove container (force=true to remove even if running)
	err = d.client.ContainerRemove(ctx, containerID, container.RemoveOptions{
		Force:         true,
		RemoveVolumes: true,
	})
	if err != nil {
		return runner.NewRunnerError("DeleteBot", botID, err, true)
	}

	// Clean up config files
	d.cleanupConfigFiles(botID)

	return nil
}

// StartBot starts a stopped container
func (d *Runtime) StartBot(ctx context.Context, botID string) error {
	containerID, err := d.findContainer(ctx, botID)
	if err != nil {
		return runner.NewRunnerError("StartBot", botID, err, false)
	}

	err = d.client.ContainerStart(ctx, containerID, container.StartOptions{})
	if err != nil {
		return runner.NewRunnerError("StartBot", botID, err, true)
	}

	return nil
}

// StopBot stops a running container
func (d *Runtime) StopBot(ctx context.Context, botID string) error {
	containerID, err := d.findContainer(ctx, botID)
	if err != nil {
		return runner.NewRunnerError("StopBot", botID, err, false)
	}

	timeout := int(defaultStopTimeout.Seconds())
	err = d.client.ContainerStop(ctx, containerID, container.StopOptions{Timeout: &timeout})
	if err != nil {
		return runner.NewRunnerError("StopBot", botID, err, true)
	}

	return nil
}

// RestartBot restarts a container
func (d *Runtime) RestartBot(ctx context.Context, botID string) error {
	containerID, err := d.findContainer(ctx, botID)
	if err != nil {
		return runner.NewRunnerError("RestartBot", botID, err, false)
	}

	timeout := int(defaultStopTimeout.Seconds())
	err = d.client.ContainerRestart(ctx, containerID, container.StopOptions{Timeout: &timeout})
	if err != nil {
		return runner.NewRunnerError("RestartBot", botID, err, true)
	}

	return nil
}

// GetBotStatus retrieves the status of a bot
func (d *Runtime) GetBotStatus(ctx context.Context, botID string) (*runner.BotStatus, error) {
	containerID, err := d.findContainer(ctx, botID)
	if err != nil {
		return nil, runner.NewRunnerError("GetBotStatus", botID, err, false)
	}

	// Inspect container
	inspect, err := d.client.ContainerInspect(ctx, containerID)
	if err != nil {
		return nil, runner.NewRunnerError("GetBotStatus", botID, err, true)
	}

	// Get container stats for resource usage
	stats, err := d.getContainerStats(ctx, containerID)
	if err != nil {
		// Log but don't fail - stats are optional
		stats = &container.StatsResponse{}
	}

	// Check if container is healthy
	healthy := inspect.State.Running && (inspect.State.Health == nil || inspect.State.Health.Status == "healthy")

	// Build status
	status := &runner.BotStatus{
		BotID:   botID,
		Status:  d.mapDockerState(inspect.State, healthy),
		Healthy: healthy,
	}

	// Set timestamps
	if inspect.Created != "" {
		if createdAt, err := time.Parse(time.RFC3339Nano, inspect.Created); err == nil {
			status.CreatedAt = createdAt
		}
	}
	if inspect.State.StartedAt != "" {
		if startedAt, err := time.Parse(time.RFC3339Nano, inspect.State.StartedAt); err == nil {
			status.StartedAt = &startedAt
			status.LastSeenAt = &startedAt
		}
	}
	if inspect.State.FinishedAt != "" && inspect.State.FinishedAt != "0001-01-01T00:00:00Z" {
		if finishedAt, err := time.Parse(time.RFC3339Nano, inspect.State.FinishedAt); err == nil {
			status.StoppedAt = &finishedAt
		}
	}

	// Set error message if container exited with error
	if inspect.State.ExitCode != 0 && inspect.State.Error != "" {
		status.ErrorMessage = inspect.State.Error
	}

	// Extract network info
	if len(inspect.NetworkSettings.Networks) > 0 {
		for _, network := range inspect.NetworkSettings.Networks {
			status.IPAddress = network.IPAddress
			break
		}
	}

	// Extract host port mapping
	if inspect.NetworkSettings.Ports != nil {
		for _, bindings := range inspect.NetworkSettings.Ports {
			if len(bindings) > 0 {
				// Use first binding
				if port, err := nat.ParsePort(bindings[0].HostPort); err == nil {
					status.HostPort = port
					break
				}
			}
		}
	}

	// Set resource usage from stats
	if stats.MemoryStats.Usage > 0 {
		status.MemoryUsage = int64(stats.MemoryStats.Usage)
	}
	if stats.CPUStats.CPUUsage.TotalUsage > 0 && stats.PreCPUStats.CPUUsage.TotalUsage > 0 {
		cpuDelta := float64(stats.CPUStats.CPUUsage.TotalUsage - stats.PreCPUStats.CPUUsage.TotalUsage)
		systemDelta := float64(stats.CPUStats.SystemUsage - stats.PreCPUStats.SystemUsage)
		if systemDelta > 0 {
			// Use PercpuUsage length for cgroups v1, OnlineCPUs for cgroups v2
			numCPUs := len(stats.CPUStats.CPUUsage.PercpuUsage)
			if numCPUs == 0 {
				numCPUs = int(stats.CPUStats.OnlineCPUs)
			}
			if numCPUs == 0 {
				numCPUs = 1 // fallback to 1 CPU
			}
			status.CPUUsage = (cpuDelta / systemDelta) * float64(numCPUs) * 100.0
		}
	}

	// Extract network I/O stats (cumulative bytes across all interfaces)
	for _, netStats := range stats.Networks {
		status.NetworkRxBytes += int64(netStats.RxBytes)
		status.NetworkTxBytes += int64(netStats.TxBytes)
	}

	// Extract disk I/O stats from blkio
	for _, entry := range stats.BlkioStats.IoServiceBytesRecursive {
		switch entry.Op {
		case "read", "Read":
			status.BlockReadBytes += int64(entry.Value)
		case "write", "Write":
			status.BlockWriteBytes += int64(entry.Value)
		}
	}

	return status, nil
}

// GetContainerIP retrieves the container's IP address
// Container name is derived from botID
func (d *Runtime) GetContainerIP(ctx context.Context, botID string) (string, error) {
	// Find container by botID
	containerID, err := d.findContainer(ctx, botID)
	if err != nil {
		return "", runner.NewRunnerError("GetContainerIP", botID, err, false)
	}

	// Inspect container
	inspect, err := d.client.ContainerInspect(ctx, containerID)
	if err != nil {
		return "", runner.NewRunnerError("GetContainerIP", botID, err, true)
	}

	// Extract IP address from network settings
	if len(inspect.NetworkSettings.Networks) > 0 {
		for _, network := range inspect.NetworkSettings.Networks {
			if network.IPAddress != "" {
				return network.IPAddress, nil
			}
		}
	}

	// No IP address found
	return "", runner.NewRunnerError("GetContainerIP", botID,
		fmt.Errorf("container has no network IP address"), false)
}

// GetBotAPIURL returns the full URL to access the bot's Freqtrade API
// For Docker, this is http://<docker-host>:<mapped-port>
func (d *Runtime) GetBotAPIURL(ctx context.Context, botID string) (string, error) {
	// Find container by botID
	containerID, err := d.findContainer(ctx, botID)
	if err != nil {
		return "", runner.NewRunnerError("GetBotAPIURL", botID, err, false)
	}

	// Inspect container to get port mappings
	inspect, err := d.client.ContainerInspect(ctx, containerID)
	if err != nil {
		return "", runner.NewRunnerError("GetBotAPIURL", botID, err, true)
	}

	// Find the mapped host port for the API (usually 8080)
	var hostPort string
	for portKey, bindings := range inspect.NetworkSettings.Ports {
		// Look for the API port (typically 8080/tcp)
		if strings.HasPrefix(string(portKey), "8080") && len(bindings) > 0 {
			hostPort = bindings[0].HostPort
			break
		}
	}

	if hostPort == "" {
		return "", runner.NewRunnerError("GetBotAPIURL", botID,
			fmt.Errorf("no host port mapping found for API port"), false)
	}

	// Determine the host to use
	// For unix:// sockets, use localhost
	// For tcp:// URLs, extract the hostname
	apiHost := "localhost"
	if strings.HasPrefix(d.config.Host, "tcp://") {
		// Parse tcp://192.168.1.x:2375 -> 192.168.1.x
		hostURL := strings.TrimPrefix(d.config.Host, "tcp://")
		if idx := strings.Index(hostURL, ":"); idx > 0 {
			apiHost = hostURL[:idx]
		} else {
			apiHost = hostURL
		}
	}

	return fmt.Sprintf("http://%s:%s", apiHost, hostPort), nil
}

// GetBotHTTPClient returns an HTTP client and base URL for accessing the bot's API
// For Docker, this returns a standard HTTP client and uses the same URL logic as GetBotAPIURL
func (d *Runtime) GetBotHTTPClient(ctx context.Context, botID string) (*http.Client, string, error) {
	url, err := d.GetBotAPIURL(ctx, botID)
	if err != nil {
		return nil, "", err
	}

	// Docker uses a standard HTTP client with reasonable timeouts
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	return client, url, nil
}

// GetBotLogs retrieves logs from a bot container
func (d *Runtime) GetBotLogs(ctx context.Context, botID string, opts runner.LogOptions) (*runner.LogReader, error) {
	containerID, err := d.findContainer(ctx, botID)
	if err != nil {
		return nil, runner.NewRunnerError("GetBotLogs", botID, err, false)
	}

	// Build log options
	logOpts := container.LogsOptions{
		ShowStdout: opts.Stream == "" || opts.Stream == "stdout",
		ShowStderr: opts.Stream == "" || opts.Stream == "stderr",
		Follow:     opts.Follow,
		Timestamps: opts.Timestamps,
	}

	if opts.Tail > 0 {
		tail := fmt.Sprintf("%d", opts.Tail)
		logOpts.Tail = tail
	}

	if !opts.Since.IsZero() {
		logOpts.Since = opts.Since.Format(time.RFC3339Nano)
	}

	if !opts.Until.IsZero() {
		logOpts.Until = opts.Until.Format(time.RFC3339Nano)
	}

	// Get logs
	logs, err := d.client.ContainerLogs(ctx, containerID, logOpts)
	if err != nil {
		return nil, runner.NewRunnerError("GetBotLogs", botID, err, true)
	}

	return &runner.LogReader{
		ReadCloser: logs,
	}, nil
}

// UpdateBot updates a bot container (limited support - mainly for resource limits)
func (d *Runtime) UpdateBot(ctx context.Context, botID string, spec runner.UpdateBotSpec) error {
	containerID, err := d.findContainer(ctx, botID)
	if err != nil {
		return runner.NewRunnerError("UpdateBot", botID, err, false)
	}

	// Build update config
	updateConfig := container.UpdateConfig{}

	if spec.ResourceLimits != nil {
		if spec.ResourceLimits.MemoryBytes > 0 {
			updateConfig.Memory = spec.ResourceLimits.MemoryBytes
		}
		if spec.ResourceLimits.CPUQuota > 0 {
			period := spec.ResourceLimits.CPUPeriod
			if period == 0 {
				period = 100000 // Default 100ms
			}
			updateConfig.CPUPeriod = period
			updateConfig.CPUQuota = int64(float64(period) * spec.ResourceLimits.CPUQuota)
		}
	}

	// Update container
	_, err = d.client.ContainerUpdate(ctx, containerID, updateConfig)
	if err != nil {
		return runner.NewRunnerError("UpdateBot", botID, err, true)
	}

	// Note: Image updates require recreation - not supported here
	if spec.Image != nil {
		return runner.NewRunnerError("UpdateBot", botID,
			fmt.Errorf("image updates not supported - please recreate the bot"), false)
	}

	return nil
}

// ListBots returns all managed bot containers
func (d *Runtime) ListBots(ctx context.Context) ([]runner.BotStatus, error) {
	// Filter for managed containers
	filterArgs := filters.NewArgs()
	filterArgs.Add("label", labelManaged+"=true")

	containers, err := d.client.ContainerList(ctx, container.ListOptions{
		All:     true,
		Filters: filterArgs,
	})
	if err != nil {
		return nil, runner.NewRunnerError("ListBots", "", err, true)
	}

	// Convert to BotStatus
	statuses := make([]runner.BotStatus, 0, len(containers))
	for _, c := range containers {
		botID, ok := c.Labels[labelBotID]
		if !ok {
			continue
		}

		status, err := d.GetBotStatus(ctx, botID)
		if err != nil {
			// Skip containers we can't inspect
			continue
		}
		statuses = append(statuses, *status)
	}

	return statuses, nil
}

// HealthCheck verifies Docker daemon is accessible
func (d *Runtime) HealthCheck(ctx context.Context) error {
	_, err := d.client.Ping(ctx)
	if err != nil {
		return runner.NewRunnerError("HealthCheck", "", err, true)
	}
	return nil
}

// GetClient returns the Docker client for direct API access
func (d *Runtime) GetClient() *client.Client {
	return d.client
}

// Close closes the Docker client
func (d *Runtime) Close() error {
	if d.client != nil {
		return d.client.Close()
	}
	return nil
}

// Type returns the runtime type
func (d *Runtime) Type() string {
	return "docker"
}

// Helper methods

func (d *Runtime) buildContainerConfig(spec runner.BotSpec, configPaths *configFilePaths) *container.Config {
	// Build environment variables (minimal - only metadata)
	env := []string{
		"FREQTRADE_VERSION=" + spec.FreqtradeVersion,
		"STRATEGY_NAME=" + spec.StrategyName,
	}

	// Add S3 data download URL as environment variable
	if spec.DataDownloadURL != "" {
		env = append(env, "DATA_DOWNLOAD_URL="+spec.DataDownloadURL)
	}

	// Add custom environment variables
	for key, value := range spec.Environment {
		env = append(env, key+"="+value)
	}

	// Expose API port
	exposedPorts := nat.PortSet{}
	apiPort := spec.APIPort
	if apiPort == 0 {
		apiPort = 8080
	}
	exposedPorts[nat.Port(fmt.Sprintf("%d/tcp", apiPort))] = struct{}{}

	// Build freqtrade command arguments
	// Config files are layered - later configs override earlier ones
	// Secure config is LAST to ensure it has highest priority
	freqtradeArgs := []string{}

	// Add config file arguments in order: exchange -> strategy -> bot -> secure
	if configPaths.hasExchangeConfig {
		freqtradeArgs = append(freqtradeArgs, "--config", configPaths.exchangeConfigContainer)
	}
	if configPaths.hasStrategyConfig {
		freqtradeArgs = append(freqtradeArgs, "--config", configPaths.strategyConfigContainer)
	}
	if configPaths.hasBotConfig {
		freqtradeArgs = append(freqtradeArgs, "--config", configPaths.botConfigContainer)
	}
	if configPaths.hasSecureConfig {
		freqtradeArgs = append(freqtradeArgs, "--config", configPaths.secureConfigContainer)
	}

	// Add strategy name and userdir for strategy file lookup
	if spec.StrategyName != "" {
		freqtradeArgs = append(freqtradeArgs, "--strategy", spec.StrategyName)
		// Set userdir so freqtrade can find the strategy file
		freqtradeArgs = append(freqtradeArgs, "--userdir", fmt.Sprintf("/freqtrade/user_data/%s", configPaths.botID))
	}

	// Build entrypoint and command
	// If DataDownloadURL is provided, use shell entrypoint to download data first
	var entrypoint []string
	var cmd []string

	if spec.DataDownloadURL != "" {
		// Build shell script that downloads data and starts freqtrade
		dataDir := fmt.Sprintf("/freqtrade/user_data/%s/data", configPaths.botID)
		shellScript := fmt.Sprintf(
			`set -e; mkdir -p %s; wget -q -O /tmp/data.zip "$DATA_DOWNLOAD_URL"; unzip -q -o /tmp/data.zip -d %s; rm /tmp/data.zip; exec freqtrade trade %s`,
			dataDir, dataDir, strings.Join(freqtradeArgs, " "),
		)
		entrypoint = []string{"/bin/sh", "-c"}
		cmd = []string{shellScript}
	} else {
		// Standard mode without data download
		cmd = append([]string{"trade"}, freqtradeArgs...)
	}

	config := &container.Config{
		Image:        spec.Image,
		Cmd:          cmd,
		Env:          env,
		ExposedPorts: exposedPorts,
		Labels: map[string]string{
			labelBotID:   spec.ID,
			labelBotName: spec.Name,
			labelManaged: "true",
		},
	}

	if len(entrypoint) > 0 {
		config.Entrypoint = entrypoint
	}

	return config
}

func (d *Runtime) buildHostConfig(spec runner.BotSpec, configPaths *configFilePaths) *container.HostConfig {
	hostConfig := &container.HostConfig{
		RestartPolicy: container.RestartPolicy{
			Name: "unless-stopped",
		},
		Mounts: []mount.Mount{
			// Mount the shared bot config volume
			// Each bot's files are in a subdirectory named by bot ID
			{
				Type:     mount.TypeVolume,
				Source:   configPaths.volumeName,
				Target:   "/freqtrade/user_data",
				ReadOnly: false, // Must be writable for bot data
			},
		},
	}

	// Add resource limits if specified
	if spec.ResourceLimits != nil {
		if spec.ResourceLimits.MemoryBytes > 0 {
			hostConfig.Memory = spec.ResourceLimits.MemoryBytes
		}
		if spec.ResourceLimits.CPUQuota > 0 {
			period := spec.ResourceLimits.CPUPeriod
			if period == 0 {
				period = 100000 // Default 100ms
			}
			hostConfig.CPUPeriod = period
			hostConfig.CPUQuota = int64(float64(period) * spec.ResourceLimits.CPUQuota)
		}
	}

	// Port bindings
	apiPort := spec.APIPort
	if apiPort == 0 {
		apiPort = 8080
	}
	hostConfig.PortBindings = nat.PortMap{
		nat.Port(fmt.Sprintf("%d/tcp", apiPort)): []nat.PortBinding{
			{HostIP: "0.0.0.0", HostPort: "0"}, // Random port
		},
	}

	return hostConfig
}

func (d *Runtime) buildNetworkConfig(spec runner.BotSpec) *network.NetworkingConfig {
	networkMode := spec.NetworkMode
	if networkMode == "" {
		networkMode = defaultNetwork
	}

	return &network.NetworkingConfig{
		EndpointsConfig: map[string]*network.EndpointSettings{
			networkMode: {},
		},
	}
}

func (d *Runtime) ensureNetwork(ctx context.Context) error {
	networkName := d.config.Network
	if networkName == "" {
		networkName = defaultNetwork
	}

	// Check if network exists
	networks, err := d.client.NetworkList(ctx, network.ListOptions{})
	if err != nil {
		return err
	}

	for _, n := range networks {
		if n.Name == networkName {
			return nil
		}
	}

	// Create network
	_, err = d.client.NetworkCreate(ctx, networkName, network.CreateOptions{
		Driver: "bridge",
		Labels: map[string]string{
			labelManaged: "true",
		},
	})
	return err
}

func (d *Runtime) pullImage(ctx context.Context, imageName string) error {
	// Build auth config if registry auth is configured
	var authStr string
	if d.config.RegistryAuth != nil {
		authConfig := registry.AuthConfig{
			Username:      d.config.RegistryAuth.Username,
			Password:      d.config.RegistryAuth.Password,
			ServerAddress: d.config.RegistryAuth.ServerAddress,
		}
		authJSON, err := json.Marshal(authConfig)
		if err != nil {
			return err
		}
		authStr = base64.URLEncoding.EncodeToString(authJSON)
	}

	// Pull image
	out, err := d.client.ImagePull(ctx, imageName, image.PullOptions{
		RegistryAuth: authStr,
	})
	if err != nil {
		return err
	}
	defer out.Close()

	// Consume output (required for pull to complete)
	_, err = io.Copy(io.Discard, out)
	return err
}

func (d *Runtime) findContainer(ctx context.Context, botID string) (string, error) {
	// Try by name first (most efficient)
	containerName := getContainerName(botID)
	inspect, err := d.client.ContainerInspect(ctx, containerName)
	if err == nil {
		return inspect.ID, nil
	}

	// Try as direct container ID (in case botID is actually a container ID)
	inspect, err = d.client.ContainerInspect(ctx, botID)
	if err == nil {
		return inspect.ID, nil
	}

	// Fall back to label search
	filterArgs := filters.NewArgs()
	filterArgs.Add("label", labelBotID+"="+botID)

	containers, err := d.client.ContainerList(ctx, container.ListOptions{
		All:     true,
		Filters: filterArgs,
	})
	if err != nil {
		return "", err
	}

	if len(containers) == 0 {
		return "", runner.ErrBotNotFound
	}

	return containers[0].ID, nil
}

func (d *Runtime) getContainerStats(ctx context.Context, containerID string) (*container.StatsResponse, error) {
	stats, err := d.client.ContainerStats(ctx, containerID, false)
	if err != nil {
		return nil, err
	}
	defer stats.Body.Close()

	var v container.StatsResponse
	if err := json.NewDecoder(stats.Body).Decode(&v); err != nil {
		return nil, err
	}

	return &v, nil
}

func (d *Runtime) mapDockerState(state *container.State, healthy bool) enum.BotStatus {
	if state == nil {
		return enum.BotStatusError
	}

	if state.Running {
		// Distinguish between healthy and unhealthy running containers
		if healthy {
			return enum.BotStatusRunning
		}
		return enum.BotStatusUnhealthy
	}

	if state.Restarting {
		return enum.BotStatusCreating
	}

	if state.Paused {
		return enum.BotStatusStopped
	}

	if state.Dead || state.OOMKilled {
		return enum.BotStatusError
	}

	// Default to stopped
	return enum.BotStatusStopped
}

func getContainerName(botID string) string {
	return containerNamePrefix + botID
}

func loadTLSConfig(config *Config) (*tls.Config, error) {
	tlsConfig := &tls.Config{}

	// Load client certificate from PEM-encoded strings
	cert, err := tls.X509KeyPair([]byte(config.CertPEM), []byte(config.KeyPEM))
	if err != nil {
		return nil, fmt.Errorf("failed to load client certificate from PEM: %w", err)
	}
	tlsConfig.Certificates = []tls.Certificate{cert}

	// Load CA certificate from PEM-encoded string
	caCertPool := x509.NewCertPool()
	if !caCertPool.AppendCertsFromPEM([]byte(config.CAPEM)) {
		return nil, fmt.Errorf("failed to append CA certificate from PEM")
	}
	tlsConfig.RootCAs = caCertPool

	// Extract server name from host
	host := config.Host
	if strings.HasPrefix(host, "tcp://") {
		host = strings.TrimPrefix(host, "tcp://")
		if colonIdx := strings.Index(host, ":"); colonIdx > 0 {
			host = host[:colonIdx]
		}
		tlsConfig.ServerName = host
	}

	return tlsConfig, nil
}

// configFilePaths holds the paths to config files for a bot
// Uses Docker volumes for remote Docker daemon compatibility
type configFilePaths struct {
	volumeName              string // Docker volume name for bot configs
	botID                   string // Bot ID used as subdirectory in volume
	exchangeConfigContainer string // Container path to exchange config file
	strategyConfigContainer string // Container path to strategy config file
	botConfigContainer      string // Container path to bot config file
	secureConfigContainer   string // Container path to secure config file
	strategyFileContainer   string // Container path to strategy Python file
	hasExchangeConfig       bool   // Whether exchange config exists
	hasStrategyConfig       bool   // Whether strategy config exists
	hasBotConfig            bool   // Whether bot config exists
	hasSecureConfig         bool   // Whether secure config exists
	hasStrategyFile         bool   // Whether strategy file exists
}

// createConfigFiles creates config files in Docker volume for the bot
// Uses Docker volumes instead of bind mounts for remote Docker daemon compatibility
func (d *Runtime) createConfigFiles(spec runner.BotSpec) (*configFilePaths, error) {
	ctx := context.Background()

	paths := &configFilePaths{
		volumeName:              BotConfigVolume,
		botID:                   spec.ID,
		exchangeConfigContainer: fmt.Sprintf("/freqtrade/user_data/%s/config.exchange.json", spec.ID),
		strategyConfigContainer: fmt.Sprintf("/freqtrade/user_data/%s/config.strategy.json", spec.ID),
		botConfigContainer:      fmt.Sprintf("/freqtrade/user_data/%s/config.bot.json", spec.ID),
		secureConfigContainer:   fmt.Sprintf("/freqtrade/user_data/%s/config.secure.json", spec.ID),
	}

	// Write exchange config file to Docker volume
	if len(spec.ExchangeConfig) > 0 {
		exchangeConfigJSON, err := json.MarshalIndent(spec.ExchangeConfig, "", "  ")
		if err != nil {
			d.cleanupConfigFiles(spec.ID)
			return nil, fmt.Errorf("failed to marshal exchange config: %w", err)
		}
		volumePath := filepath.Join(spec.ID, "config.exchange.json")
		if err := d.volumeHelper.WriteFile(ctx, BotConfigVolume, volumePath, exchangeConfigJSON); err != nil {
			d.cleanupConfigFiles(spec.ID)
			return nil, fmt.Errorf("failed to write exchange config to volume: %w", err)
		}
		paths.hasExchangeConfig = true
	}

	// Write strategy config file to Docker volume
	if len(spec.StrategyConfig) > 0 {
		strategyConfigJSON, err := json.MarshalIndent(spec.StrategyConfig, "", "  ")
		if err != nil {
			d.cleanupConfigFiles(spec.ID)
			return nil, fmt.Errorf("failed to marshal strategy config: %w", err)
		}
		volumePath := filepath.Join(spec.ID, "config.strategy.json")
		if err := d.volumeHelper.WriteFile(ctx, BotConfigVolume, volumePath, strategyConfigJSON); err != nil {
			d.cleanupConfigFiles(spec.ID)
			return nil, fmt.Errorf("failed to write strategy config to volume: %w", err)
		}
		paths.hasStrategyConfig = true
	}

	// Write bot config file to Docker volume
	if len(spec.Config) > 0 {
		botConfigJSON, err := json.MarshalIndent(spec.Config, "", "  ")
		if err != nil {
			d.cleanupConfigFiles(spec.ID)
			return nil, fmt.Errorf("failed to marshal bot config: %w", err)
		}
		volumePath := filepath.Join(spec.ID, "config.bot.json")
		if err := d.volumeHelper.WriteFile(ctx, BotConfigVolume, volumePath, botConfigJSON); err != nil {
			d.cleanupConfigFiles(spec.ID)
			return nil, fmt.Errorf("failed to write bot config to volume: %w", err)
		}
		paths.hasBotConfig = true
	}

	// Write secure config file to Docker volume
	if len(spec.SecureConfig) > 0 {
		secureConfigJSON, err := json.MarshalIndent(spec.SecureConfig, "", "  ")
		if err != nil {
			d.cleanupConfigFiles(spec.ID)
			return nil, fmt.Errorf("failed to marshal secure config: %w", err)
		}
		volumePath := filepath.Join(spec.ID, "config.secure.json")
		if err := d.volumeHelper.WriteFile(ctx, BotConfigVolume, volumePath, secureConfigJSON); err != nil {
			d.cleanupConfigFiles(spec.ID)
			return nil, fmt.Errorf("failed to write secure config to volume: %w", err)
		}
		paths.hasSecureConfig = true
	}

	// Write strategy Python file to Docker volume
	if spec.StrategyCode != "" && spec.StrategyName != "" {
		strategyFileName := spec.StrategyName + ".py"
		volumePath := filepath.Join(spec.ID, "strategies", strategyFileName)
		if err := d.volumeHelper.WriteFile(ctx, BotConfigVolume, volumePath, []byte(spec.StrategyCode)); err != nil {
			d.cleanupConfigFiles(spec.ID)
			return nil, fmt.Errorf("failed to write strategy file to volume: %w", err)
		}
		paths.strategyFileContainer = fmt.Sprintf("/freqtrade/user_data/%s/strategies/%s", spec.ID, strategyFileName)
		paths.hasStrategyFile = true
	}

	return paths, nil
}

// cleanupConfigFiles removes the config files for a bot from Docker volume
func (d *Runtime) cleanupConfigFiles(botID string) {
	ctx := context.Background()
	// Remove bot's directory from the shared volume
	if err := d.volumeHelper.RemoveDirectory(ctx, BotConfigVolume, botID); err != nil {
		// Log but don't fail - cleanup is best effort
		fmt.Printf("Warning: failed to cleanup bot config files for %s: %v\n", botID, err)
	}
}
