package runner

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
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

	"anytrade/internal/enum"
)

const (
	// Container naming
	containerNamePrefix = "anytrade-bot-"

	// Labels
	labelBotID   = "anytrade.bot.id"
	labelBotName = "anytrade.bot.name"
	labelManaged = "anytrade.managed"

	// Default network
	defaultNetwork = "anytrade-network"

	// Default timeouts
	defaultStopTimeout = 30 * time.Second
)

// DockerRuntime implements Runtime for Docker environments
type DockerRuntime struct {
	client *client.Client
	config *DockerConfig
}

// NewDockerRuntime creates a new Docker runtime instance
func NewDockerRuntime(ctx context.Context, config *DockerConfig) (*DockerRuntime, error) {
	if config == nil {
		return nil, fmt.Errorf("Docker config cannot be nil")
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

	return &DockerRuntime{
		client: cli,
		config: config,
	}, nil
}

// Ensure DockerRuntime implements Runtime interface
var _ Runtime = (*DockerRuntime)(nil)

// CreateBot deploys a new bot container
func (d *DockerRuntime) CreateBot(ctx context.Context, spec BotSpec) (string, error) {
	// Ensure network exists
	if err := d.ensureNetwork(ctx); err != nil {
		return "", NewRunnerError("CreateBot", spec.ID, err, true)
	}

	// Pull image if needed
	if err := d.pullImage(ctx, spec.Image); err != nil {
		return "", NewRunnerError("CreateBot", spec.ID, err, true)
	}

	// Create temporary config files
	configPaths, err := d.createConfigFiles(spec)
	if err != nil {
		return "", NewRunnerError("CreateBot", spec.ID, err, true)
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
		return "", NewRunnerError("CreateBot", spec.ID, err, true)
	}

	// Start container
	if err := d.client.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		// Clean up container and config files if start fails
		d.client.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})
		d.cleanupConfigFiles(spec.ID)
		return "", NewRunnerError("CreateBot", spec.ID, err, true)
	}

	return resp.ID, nil
}

// DeleteBot removes a bot container
func (d *DockerRuntime) DeleteBot(ctx context.Context, botID string) error {
	containerID, err := d.findContainer(ctx, botID)
	if err != nil {
		return NewRunnerError("DeleteBot", botID, err, false)
	}

	// Remove container (force=true to remove even if running)
	err = d.client.ContainerRemove(ctx, containerID, container.RemoveOptions{
		Force:         true,
		RemoveVolumes: true,
	})
	if err != nil {
		return NewRunnerError("DeleteBot", botID, err, true)
	}

	// Clean up config files
	d.cleanupConfigFiles(botID)

	return nil
}

// StartBot starts a stopped container
func (d *DockerRuntime) StartBot(ctx context.Context, botID string) error {
	containerID, err := d.findContainer(ctx, botID)
	if err != nil {
		return NewRunnerError("StartBot", botID, err, false)
	}

	err = d.client.ContainerStart(ctx, containerID, container.StartOptions{})
	if err != nil {
		return NewRunnerError("StartBot", botID, err, true)
	}

	return nil
}

// StopBot stops a running container
func (d *DockerRuntime) StopBot(ctx context.Context, botID string) error {
	containerID, err := d.findContainer(ctx, botID)
	if err != nil {
		return NewRunnerError("StopBot", botID, err, false)
	}

	timeout := int(defaultStopTimeout.Seconds())
	err = d.client.ContainerStop(ctx, containerID, container.StopOptions{Timeout: &timeout})
	if err != nil {
		return NewRunnerError("StopBot", botID, err, true)
	}

	return nil
}

// RestartBot restarts a container
func (d *DockerRuntime) RestartBot(ctx context.Context, botID string) error {
	containerID, err := d.findContainer(ctx, botID)
	if err != nil {
		return NewRunnerError("RestartBot", botID, err, false)
	}

	timeout := int(defaultStopTimeout.Seconds())
	err = d.client.ContainerRestart(ctx, containerID, container.StopOptions{Timeout: &timeout})
	if err != nil {
		return NewRunnerError("RestartBot", botID, err, true)
	}

	return nil
}

// GetBotStatus retrieves the status of a bot
func (d *DockerRuntime) GetBotStatus(ctx context.Context, botID string) (*BotStatus, error) {
	containerID, err := d.findContainer(ctx, botID)
	if err != nil {
		return nil, NewRunnerError("GetBotStatus", botID, err, false)
	}

	// Inspect container
	inspect, err := d.client.ContainerInspect(ctx, containerID)
	if err != nil {
		return nil, NewRunnerError("GetBotStatus", botID, err, true)
	}

	// Get container stats for resource usage
	stats, err := d.getContainerStats(ctx, containerID)
	if err != nil {
		// Log but don't fail - stats are optional
		stats = &container.StatsResponse{}
	}

	// Build status
	status := &BotStatus{
		BotID:       botID,
		ContainerID: containerID,
		Status:      d.mapDockerState(inspect.State),
		Healthy:     inspect.State.Running && (inspect.State.Health == nil || inspect.State.Health.Status == "healthy"),
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
			status.CPUUsage = (cpuDelta / systemDelta) * float64(len(stats.CPUStats.CPUUsage.PercpuUsage)) * 100.0
		}
	}

	return status, nil
}

// GetBotLogs retrieves logs from a bot container
func (d *DockerRuntime) GetBotLogs(ctx context.Context, botID string, opts LogOptions) (*LogReader, error) {
	containerID, err := d.findContainer(ctx, botID)
	if err != nil {
		return nil, NewRunnerError("GetBotLogs", botID, err, false)
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
		return nil, NewRunnerError("GetBotLogs", botID, err, true)
	}

	return &LogReader{
		ReadCloser: logs,
	}, nil
}

// UpdateBot updates a bot container (limited support - mainly for resource limits)
func (d *DockerRuntime) UpdateBot(ctx context.Context, botID string, spec UpdateBotSpec) error {
	containerID, err := d.findContainer(ctx, botID)
	if err != nil {
		return NewRunnerError("UpdateBot", botID, err, false)
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
		return NewRunnerError("UpdateBot", botID, err, true)
	}

	// Note: Image updates require recreation - not supported here
	if spec.Image != nil {
		return NewRunnerError("UpdateBot", botID,
			fmt.Errorf("image updates not supported - please recreate the bot"), false)
	}

	return nil
}

// ListBots returns all managed bot containers
func (d *DockerRuntime) ListBots(ctx context.Context) ([]BotStatus, error) {
	// Filter for managed containers
	filterArgs := filters.NewArgs()
	filterArgs.Add("label", labelManaged+"=true")

	containers, err := d.client.ContainerList(ctx, container.ListOptions{
		All:     true,
		Filters: filterArgs,
	})
	if err != nil {
		return nil, NewRunnerError("ListBots", "", err, true)
	}

	// Convert to BotStatus
	statuses := make([]BotStatus, 0, len(containers))
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
func (d *DockerRuntime) HealthCheck(ctx context.Context) error {
	_, err := d.client.Ping(ctx)
	if err != nil {
		return NewRunnerError("HealthCheck", "", err, true)
	}
	return nil
}

// Close closes the Docker client
func (d *DockerRuntime) Close() error {
	if d.client != nil {
		return d.client.Close()
	}
	return nil
}

// Type returns the runtime type
func (d *DockerRuntime) Type() string {
	return "docker"
}

// Helper methods

func (d *DockerRuntime) buildContainerConfig(spec BotSpec, configPaths *configFilePaths) *container.Config {
	// Build environment variables (minimal - only metadata)
	env := []string{
		"FREQTRADE_VERSION=" + spec.FreqtradeVersion,
		"STRATEGY_NAME=" + spec.StrategyName,
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

	// Build command with config files
	// Format: trade --config <exchange_config> --config <strategy_config> --config <bot_config> --strategy <strategy_name>
	// Note: The freqtrade image already has "freqtrade" as its entrypoint
	// Config files are layered - later configs override earlier ones
	cmd := []string{"trade"}

	// Add config file arguments in order: exchange -> strategy -> bot
	if configPaths.exchangeConfigHost != "" {
		cmd = append(cmd, "--config", configPaths.exchangeConfigContainer)
	}
	if configPaths.strategyConfigHost != "" {
		cmd = append(cmd, "--config", configPaths.strategyConfigContainer)
	}
	if configPaths.botConfigHost != "" {
		cmd = append(cmd, "--config", configPaths.botConfigContainer)
	}

	// Add strategy name
	if spec.StrategyName != "" {
		cmd = append(cmd, "--strategy", spec.StrategyName)
	}

	return &container.Config{
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
}

func (d *DockerRuntime) buildHostConfig(spec BotSpec, configPaths *configFilePaths) *container.HostConfig {
	hostConfig := &container.HostConfig{
		RestartPolicy: container.RestartPolicy{
			Name: "unless-stopped",
		},
		Mounts: []mount.Mount{},
	}

	// Add volume mounts for config files in order
	if configPaths.exchangeConfigHost != "" {
		hostConfig.Mounts = append(hostConfig.Mounts, mount.Mount{
			Type:     mount.TypeBind,
			Source:   configPaths.exchangeConfigHost,
			Target:   configPaths.exchangeConfigContainer,
			ReadOnly: true,
		})
	}
	if configPaths.strategyConfigHost != "" {
		hostConfig.Mounts = append(hostConfig.Mounts, mount.Mount{
			Type:     mount.TypeBind,
			Source:   configPaths.strategyConfigHost,
			Target:   configPaths.strategyConfigContainer,
			ReadOnly: true,
		})
	}
	if configPaths.botConfigHost != "" {
		hostConfig.Mounts = append(hostConfig.Mounts, mount.Mount{
			Type:     mount.TypeBind,
			Source:   configPaths.botConfigHost,
			Target:   configPaths.botConfigContainer,
			ReadOnly: true,
		})
	}

	// Add volume mount for strategy Python file
	if configPaths.strategyFileHost != "" {
		hostConfig.Mounts = append(hostConfig.Mounts, mount.Mount{
			Type:     mount.TypeBind,
			Source:   configPaths.strategyFileHost,
			Target:   configPaths.strategyFileContainer,
			ReadOnly: true,
		})
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

func (d *DockerRuntime) buildNetworkConfig(spec BotSpec) *network.NetworkingConfig {
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

func (d *DockerRuntime) ensureNetwork(ctx context.Context) error {
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

func (d *DockerRuntime) pullImage(ctx context.Context, imageName string) error {
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

func (d *DockerRuntime) findContainer(ctx context.Context, botID string) (string, error) {
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
		return "", ErrBotNotFound
	}

	return containers[0].ID, nil
}

func (d *DockerRuntime) getContainerStats(ctx context.Context, containerID string) (*container.StatsResponse, error) {
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

func (d *DockerRuntime) mapDockerState(state *container.State) enum.BotStatus {
	if state == nil {
		return enum.BotStatusError
	}

	if state.Running {
		return enum.BotStatusRunning
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

func loadTLSConfig(config *DockerConfig) (*tls.Config, error) {
	tlsConfig := &tls.Config{}

	// Load client certificate
	cert, err := tls.LoadX509KeyPair(config.CertPath, config.KeyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load client certificate: %w", err)
	}
	tlsConfig.Certificates = []tls.Certificate{cert}

	// Load CA certificate
	caCert, err := os.ReadFile(config.CAPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read CA certificate: %w", err)
	}

	caCertPool := x509.NewCertPool()
	if !caCertPool.AppendCertsFromPEM(caCert) {
		return nil, fmt.Errorf("failed to append CA certificate")
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
type configFilePaths struct {
	exchangeConfigHost      string // Host path to exchange config file
	exchangeConfigContainer string // Container path to exchange config file
	strategyConfigHost      string // Host path to strategy config file
	strategyConfigContainer string // Container path to strategy config file
	botConfigHost           string // Host path to bot config file
	botConfigContainer      string // Container path to bot config file
	strategyFileHost        string // Host path to strategy Python file
	strategyFileContainer   string // Container path to strategy Python file
}

// createConfigFiles creates temporary config files for the bot
func (d *DockerRuntime) createConfigFiles(spec BotSpec) (*configFilePaths, error) {
	// Create config directory for this bot
	configDir := getConfigDir(spec.ID)
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create config directory: %w", err)
	}

	paths := &configFilePaths{
		exchangeConfigContainer: "/freqtrade/user_data/config.exchange.json",
		strategyConfigContainer: "/freqtrade/user_data/config.strategy.json",
		botConfigContainer:      "/freqtrade/user_data/config.bot.json",
	}

	// Create exchange config file - write as-is (NO BUILDING, NO WRAPPING)
	// Exchange config is already complete freqtrade format: {"exchange": {"name": "...", "key": "...", ...}}
	if spec.ExchangeConfig != nil && len(spec.ExchangeConfig) > 0 {
		exchangeConfigPath := filepath.Join(configDir, "config.exchange.json")
		exchangeConfigJSON, err := json.MarshalIndent(spec.ExchangeConfig, "", "  ")
		if err != nil {
			d.cleanupConfigFiles(spec.ID)
			return nil, fmt.Errorf("failed to marshal exchange config: %w", err)
		}
		if err := os.WriteFile(exchangeConfigPath, exchangeConfigJSON, 0644); err != nil {
			d.cleanupConfigFiles(spec.ID)
			return nil, fmt.Errorf("failed to write exchange config file: %w", err)
		}
		paths.exchangeConfigHost = exchangeConfigPath
	}

	// Create strategy config file if strategy config exists
	if spec.StrategyConfig != nil && len(spec.StrategyConfig) > 0 {
		strategyConfigPath := filepath.Join(configDir, "config.strategy.json")
		strategyConfigJSON, err := json.MarshalIndent(spec.StrategyConfig, "", "  ")
		if err != nil {
			d.cleanupConfigFiles(spec.ID)
			return nil, fmt.Errorf("failed to marshal strategy config: %w", err)
		}
		if err := os.WriteFile(strategyConfigPath, strategyConfigJSON, 0644); err != nil {
			d.cleanupConfigFiles(spec.ID)
			return nil, fmt.Errorf("failed to write strategy config file: %w", err)
		}
		paths.strategyConfigHost = strategyConfigPath
	}

	// Create bot config file if bot config exists
	if spec.Config != nil && len(spec.Config) > 0 {
		botConfigPath := filepath.Join(configDir, "config.bot.json")
		botConfigJSON, err := json.MarshalIndent(spec.Config, "", "  ")
		if err != nil {
			d.cleanupConfigFiles(spec.ID)
			return nil, fmt.Errorf("failed to marshal bot config: %w", err)
		}
		if err := os.WriteFile(botConfigPath, botConfigJSON, 0644); err != nil {
			d.cleanupConfigFiles(spec.ID)
			return nil, fmt.Errorf("failed to write bot config file: %w", err)
		}
		paths.botConfigHost = botConfigPath
	}

	// Create strategy Python file if strategy code exists
	if spec.StrategyCode != "" && spec.StrategyName != "" {
		strategyFileName := spec.StrategyName + ".py"
		strategyFilePath := filepath.Join(configDir, strategyFileName)

		// Write the strategy Python code
		if err := os.WriteFile(strategyFilePath, []byte(spec.StrategyCode), 0644); err != nil {
			d.cleanupConfigFiles(spec.ID)
			return nil, fmt.Errorf("failed to write strategy file: %w", err)
		}

		paths.strategyFileHost = strategyFilePath
		paths.strategyFileContainer = "/freqtrade/user_data/strategies/" + strategyFileName
	}

	return paths, nil
}

// cleanupConfigFiles removes the temporary config files for a bot
func (d *DockerRuntime) cleanupConfigFiles(botID string) {
	configDir := getConfigDir(botID)
	os.RemoveAll(configDir) // Ignore errors - best effort cleanup
}

// getConfigDir returns the config directory path for a bot
func getConfigDir(botID string) string {
	return filepath.Join(os.TempDir(), "anytrade-configs", botID)
}
