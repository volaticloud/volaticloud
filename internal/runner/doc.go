/*
Package runner provides runtime abstraction for deploying and managing trading bots across multiple container orchestration platforms.

# Architecture Overview

The runner package implements a runtime-agnostic abstraction layer that allows VolatiCloud to deploy
and manage Freqtrade bots on Docker, Kubernetes, or local processes without coupling business logic
to any specific infrastructure.

	┌──────────────────────────────────────────────────────┐
	│         GraphQL Resolver (createBot, startBot)       │
	└────────────────────┬─────────────────────────────────┘
	                     │
	              ┌──────▼──────┐
	              │   Factory   │
	              └──────┬──────┘
	                     │
	     ┌───────────────┼───────────────┐
	     │               │               │
	┌────▼────┐    ┌────▼────┐    ┌────▼────┐
	│ Docker  │    │  K8s    │    │  Local  │
	│ Runtime │    │ Runtime │    │ Runtime │
	└────┬────┘    └────┬────┘    └────┬────┘
	     │               │               │
	┌────▼────┐    ┌────▼────┐    ┌────▼────┐
	│ Docker  │    │ kubectl │    │   OS    │
	│   SDK   │    │client-go│    │Process  │
	└─────────┘    └─────────┘    └─────────┘

# Core Interfaces

## Runtime Interface

The Runtime interface defines lifecycle operations for long-running stateful bots:

	type Runtime interface {
		CreateBot(ctx context.Context, spec BotSpec) (containerID string, err error)
		DeleteBot(ctx context.Context, botID string) error
		StartBot(ctx context.Context, botID string) error
		StopBot(ctx context.Context, botID string) error
		RestartBot(ctx context.Context, botID string) error
		GetBotStatus(ctx context.Context, botID string) (*BotStatus, error)
		GetContainerIP(ctx context.Context, containerID string) (string, error)
		GetBotLogs(ctx context.Context, botID string, opts LogOptions) (*LogReader, error)
		UpdateBot(ctx context.Context, botID string, spec UpdateBotSpec) error
		ListBots(ctx context.Context) ([]BotStatus, error)
		HealthCheck(ctx context.Context) error
		Close() error
		Type() string
	}

## BacktestRunner Interface

The BacktestRunner interface defines operations for one-time backtest jobs:

	type BacktestRunner interface {
		RunBacktest(ctx context.Context, spec BacktestSpec) (*BacktestResult, error)
		GetBacktestStatus(ctx context.Context, backtestID string) (*BacktestStatus, error)
		GetBacktestResult(ctx context.Context, backtestID string) (*BacktestResult, error)
		DeleteBacktest(ctx context.Context, backtestID string) error
		HealthCheck(ctx context.Context) error
		Close() error
		Type() string
	}

## DataDownloader Interface

The DataDownloader interface defines operations for downloading historical data on runner infrastructure:

	type DataDownloader interface {
		StartDownload(ctx context.Context, spec DataDownloadSpec) (taskID string, err error)
		GetDownloadStatus(ctx context.Context, taskID string) (*DataDownloadStatus, error)
		GetDownloadLogs(ctx context.Context, taskID string) (string, error)
		CancelDownload(ctx context.Context, taskID string) error
		CleanupDownload(ctx context.Context, taskID string) error
	}

Data download runs on the runner's infrastructure (Docker host or K8s cluster), not on the control plane.
This enables downloading data even when the control plane runs in K8s without Docker access.

Key Difference:
  - Bots are stateful (start/stop/restart operations)
  - Backtests are one-shot (run once, get results, cleanup)
  - DataDownloads are background tasks (start, poll status, cleanup)

# Factory Pattern

The Factory creates runtime instances based on BotRunner configuration:

	factory := runner.NewFactory()
	runtime, err := factory.Create(ctx, enum.RunnerDocker, dockerConfig)
	if err != nil {
		return err
	}
	defer runtime.Close()

	containerID, err := runtime.CreateBot(ctx, botSpec)

## Runtime Selection

Factory selects runtime based on enum.RunnerType:

	Docker (enum.RunnerDocker):
	  - Uses Docker SDK
	  - Supports TLS with certificates
	  - Default host: unix:///var/run/docker.sock
	  - API version negotiation

	Kubernetes (enum.RunnerKubernetes):
	  - Uses client-go library
	  - Kubeconfig or in-cluster config
	  - Namespace isolation
	  - Pod management

	Local (enum.RunnerLocal):
	  - Direct OS process spawning
	  - For debugging and development
	  - No container isolation

# Implementations

## DockerRuntime

Production runtime for Docker environments:

### Features:
  - Container lifecycle management
  - Network creation (volaticloud-network)
  - Volume mounting for configs and data
  - Port mapping for Freqtrade API
  - Resource limits (CPU/memory)
  - Container labels for management
  - Image pulling with authentication
  - TLS support for remote Docker hosts

### Container Configuration:

Three-layer config file generation:

 1. config.exchange.json (shared credentials)
 2. config.strategy.json (strategy defaults)
 3. config.bot.json (bot-specific overrides + dry_run)

Freqtrade merges them via command:

	freqtrade trade \
	  --config /freqtrade/config/config.exchange.json \
	  --config /freqtrade/config/config.strategy.json \
	  --config /freqtrade/config/config.bot.json \
	  --strategy MyStrategy

### Volume Mounts:

	Config Volume:
	  - Host: /tmp/volaticloud-configs/{botID}/
	  - Container: /freqtrade/config/
	  - Read-only: true
	  - Contains: 3 layered config files

	Strategy Volume:
	  - Host: /tmp/volaticloud-strategies/{botID}/
	  - Container: /freqtrade/user_data/strategies/
	  - Read-only: true
	  - Contains: strategy Python file

	Data Volume (Optional):
	  - Named volume: volaticloud-freqtrade-data
	  - Container: /freqtrade/user_data/data/
	  - Shared across bots for historical data

### Network Configuration:

	Default Network:
	  - Name: volaticloud-network
	  - Driver: bridge
	  - Auto-created if missing
	  - All bots connected to same network

	Port Mapping:
	  - Container port: 8080 (Freqtrade API)
	  - Host port: Dynamic allocation
	  - Used for metrics fetching and monitoring

## DockerBacktest

Docker implementation for one-time backtest execution:

### Features:
  - One-shot container execution
  - Result ZIP file extraction
  - Automatic container cleanup
  - Parallel backtest support via isolated workspaces
  - Shared historical data volume

### Mount-Based Parallel Strategy:

Each backtest gets isolated workspace while sharing data:

	Architecture:
	  --userdir /freqtrade/user_data/{backtestID}
	      ↓
	  Freqtrade auto-resolves data: {userdir}/data/
	      ↓
	  Mount shared data to: /freqtrade/user_data/{backtestID}/data/

Volume Mounts:

	Config Volume (Per-Backtest):
	  - Source: volaticloud-backtest-{backtestID}
	  - Target: /freqtrade/user_data
	  - Isolation: Each backtest has own volume
	  - Contains: configs, results, logs

	Data Volume (Shared):
	  - Source: volaticloud-freqtrade-data
	  - Target: /freqtrade/user_data/{backtestID}/data
	  - Shared: All backtests use same historical data
	  - Benefits: Single data download, parallel execution

Command Structure:

	freqtrade backtesting \
	  --strategy MyStrategy \
	  --userdir /freqtrade/user_data/{backtestID} \
	  --data-format-ohlcv json
	  # No --datadir needed - automatic resolution

Benefits:
  - Parallel support (isolated userdirs)
  - Shared data (efficient storage)
  - Clean architecture (mount-based, not config-based)
  - Automatic resolution (Freqtrade handles it)

### Result Processing:

 1. Container execution completes
 2. Check exit code (0 = success)
 3. Read result files from volume
 4. Parse backtest-result.json
 5. Extract trades and metrics
 6. Cleanup container and volume
 7. Return BacktestResult with parsed data

## KubernetesRuntime (Stub)

Kubernetes implementation for production clusters:

	Planned Features:
	  - Pod lifecycle management
	  - Deployment/StatefulSet support
	  - ConfigMap for configs
	  - Secret for credentials
	  - PVC for data volumes
	  - Service for API access
	  - Resource quotas and limits

## LocalRuntime (Stub)

Local process implementation for debugging:

	Planned Features:
	  - Direct process spawning (exec.Command)
	  - No container isolation
	  - Direct filesystem access
	  - For development only

## DockerDataDownloader

Docker implementation for downloading historical data:

	Features:
	  - Runs freqtrade container on Docker host
	  - Downloads existing data from S3 (incremental updates)
	  - Runs freqtrade download-data command
	  - Packages results as tar.gz
	  - Uploads to S3 via presigned PUT URL
	  - Uses Python urllib (no wget/curl needed in image)

	Container Configuration:
	  - Image: freqtradeorg/freqtrade:stable
	  - Runs as root for volume permissions
	  - Executes shell script with multiple phases

	Download Script Phases:
	  1. Download existing data from S3 (if available)
	  2. Extract existing data to /freqtrade/user_data/data
	  3. Run freqtrade download-data for each exchange
	  4. Package data as tar.gz
	  5. Upload to S3 using presigned URL

## KubernetesDataDownloader

Kubernetes implementation for downloading historical data:

	Features:
	  - Creates Job on K8s cluster
	  - TTL-based cleanup (1 hour after completion)
	  - Labels for resource management
	  - Pod log retrieval for debugging

	Job Configuration:
	  - RestartPolicy: Never
	  - BackoffLimit: 0 (no retries)
	  - TTLSecondsAfterFinished: 3600

	Labels:
	  - volaticloud.io/managed: true
	  - volaticloud.io/data-download-id: {runnerID}
	  - volaticloud.io/task-type: data-download

# Bot Specification

BotSpec defines complete bot configuration:

	type BotSpec struct {
		ID   string
		Name string

		// Container
		Image            string
		FreqtradeVersion string

		// Strategy
		StrategyName   string
		StrategyCode   string
		StrategyConfig map[string]interface{}

		// Bot configuration
		Config map[string]interface{} // includes dry_run

		// Exchange configuration
		ExchangeConfig map[string]interface{} // includes credentials

		// Secure system configuration
		SecureConfig map[string]interface{} // api_server, etc.

		// Runner configuration
		Environment    map[string]string
		ResourceLimits *ResourceLimits
		NetworkMode    string
		APIPort        int
	}

## Three-Layer Config Architecture:

	ExchangeConfig (config.exchange.json):
	  - API credentials (key, secret)
	  - Pair whitelist
	  - Trading mode (spot/futures)
	  - Shared across all bots using same exchange

	StrategyConfig (config.strategy.json):
	  - Strategy-specific parameters
	  - Entry/exit pricing
	  - Order types
	  - Timeframe
	  - Shared across all bots using same strategy

	Config (config.bot.json):
	  - Stake amount
	  - Max open trades
	  - dry_run flag (auto-injected based on bot mode)
	  - Bot-specific overrides
	  - Unique per bot

Benefits:
  - DRY: No credential duplication
  - Security: Credentials isolated
  - Inheritance: Strategy defaults + bot overrides
  - Immutable: Configs mounted read-only

# Status and Health Checking

BotStatus represents runtime state:

	type BotStatus struct {
		BotID       string
		Status      enum.BotStatus // creating, running, stopped, error
		ContainerID string

		Healthy    bool
		LastSeenAt *time.Time

		CPUUsage    float64
		MemoryUsage int64

		IPAddress string
		HostPort  int

		ErrorMessage string

		CreatedAt time.Time
		StartedAt *time.Time
		StoppedAt *time.Time
	}

## CPU Usage Calculation (cgroups v1 vs v2):

CPU percentage is calculated from Docker stats API response.
The formula differs based on the cgroup version:

	cgroups v1:
	  - Uses PercpuUsage slice length for CPU count
	  - cpuPercent = (cpuDelta / systemDelta) * len(PercpuUsage) * 100

	cgroups v2 (modern Linux):
	  - PercpuUsage is empty (not populated)
	  - Falls back to OnlineCPUs field
	  - cpuPercent = (cpuDelta / systemDelta) * OnlineCPUs * 100

	Fallback:
	  - If both are empty/zero, assumes 1 CPU

## Status States:

	Creating:
	  - Container being created
	  - Configs being generated
	  - Image being pulled

	Running:
	  - Container started successfully
	  - Freqtrade process running
	  - API responding to health checks

	Stopped:
	  - Container stopped gracefully
	  - Can be restarted

	Error:
	  - Container failed to start
	  - Health checks failing
	  - Freqtrade crashed
	  - ErrorMessage contains details

## Health Checks:

DockerRuntime health check:

 1. Check container state (Inspect API)
 2. Parse health check output (if defined)
 3. Check last health check timestamp
 4. Return healthy=true only if all pass

Container health is exposed to Kubernetes probes:

	Liveness Probe:
	  - Kills unhealthy containers
	  - Triggers restart

	Readiness Probe:
	  - Removes from load balancer
	  - Prevents traffic to unhealthy bots

# Error Handling

RunnerError provides structured error information:

	type RunnerError struct {
		Operation string // "CreateBot", "StartBot", etc.
		BotID     string
		Err       error
		Retryable bool
	}

## Common Errors:

	ErrBotNotFound:
	  - Container doesn't exist in runtime
	  - Non-retryable

	ErrBotAlreadyExists:
	  - Container with same ID already exists
	  - Non-retryable (delete first)

	ErrRunnerNotConnected:
	  - Docker daemon not reachable
	  - Retryable (connection may recover)

	ErrInvalidSpec:
	  - BotSpec validation failed
	  - Non-retryable (fix spec first)

	ErrResourceLimit:
	  - Resource constraints exceeded
	  - Non-retryable (adjust limits)

## Error Wrapping:

RunnerError implements error unwrapping:

	if errors.Is(err, runner.ErrBotNotFound) {
		// Container not found - mark as stopped
	}

This allows proper error handling with errors.Is and errors.As.

# Resource Management

ResourceLimits defines container resource constraints:

	type ResourceLimits struct {
		MemoryBytes int64   // Memory limit in bytes
		Memory      string  // Human-readable (e.g., "512M")
		CPUQuota    float64 // CPU quota (0.5 = 50%, 1.0 = 100%)
		CPUPeriod   int64   // CPU period in microseconds
	}

## Docker Implementation:

Memory:

	resources := container.Resources{
		Memory: spec.ResourceLimits.MemoryBytes,
	}

CPU:

	resources := container.Resources{
		CPUPeriod: spec.ResourceLimits.CPUPeriod,
		CPUQuota:  int64(spec.ResourceLimits.CPUQuota * float64(spec.ResourceLimits.CPUPeriod)),
	}

## Kubernetes Implementation (Planned):

	resources:
	  requests:
	    memory: "256Mi"
	    cpu: "250m"
	  limits:
	    memory: "512Mi"
	    cpu: "1000m"

# Testing

## MockRuntime

The package provides MockRuntime for testing without Docker:

	mockRuntime := &runner.MockRuntime{
		CreateBotFunc: func(ctx context.Context, spec runner.BotSpec) (string, error) {
			assert.Equal(t, "test-bot", spec.Name)
			return "mock-container-123", nil
		},
		GetBotStatusFunc: func(ctx context.Context, botID string) (*runner.BotStatus, error) {
			return &runner.BotStatus{
				BotID:  botID,
				Status: enum.BotStatusRunning,
			}, nil
		},
	}

	containerID, err := mockRuntime.CreateBot(ctx, botSpec)
	assert.NoError(t, err)

## Interface Compliance

All implementations verify interface compliance at compile time:

	var _ Runtime = (*DockerRuntime)(nil)
	var _ Runtime = (*KubernetesRuntime)(nil)
	var _ Runtime = (*LocalRuntime)(nil)
	var _ BacktestRunner = (*DockerBacktest)(nil)

## Integration Tests

Docker integration tests require Docker daemon:

	go test -v ./internal/runner -run TestDockerRuntime

Factory tests verify runtime creation:

	go test -v ./internal/runner -run TestFactory

# Usage Patterns

## Creating and Managing a Bot

	// Create factory
	factory := runner.NewFactory()

	// Get bot runner config from database
	botRunner, _ := db.BotRunner.Get(ctx, runnerID)

	// Create runtime
	runtime, err := factory.Create(ctx, botRunner.Type, botRunner.Config)
	if err != nil {
		return err
	}
	defer runtime.Close()

	// Build bot spec
	spec := runner.BotSpec{
		ID:             bot.ID.String(),
		Name:           bot.Name,
		Image:          "freqtradeorg/freqtrade:stable",
		StrategyName:   strategy.Name,
		StrategyCode:   strategy.Code,
		ExchangeConfig: exchange.Config,
		Config:         bot.Config,
		SecureConfig:   buildSecureConfig(bot),
	}

	// Create bot
	containerID, err := runtime.CreateBot(ctx, spec)
	if err != nil {
		return err
	}

	// Bot is now running - save container ID
	bot.ContainerID = containerID

## Running a Backtest

	// Create factory
	factory := runner.NewFactory()

	// Create backtest runner
	backtestRunner, err := factory.CreateBacktestRunner(ctx, botRunner.Type, botRunner.Config)
	if err != nil {
		return err
	}
	defer backtestRunner.Close()

	// Build backtest spec
	spec := runner.BacktestSpec{
		ID:           backtest.ID.String(),
		StrategyName: strategy.Name,
		StrategyCode: strategy.Code,
		Config:       backtest.Config,
		Timerange:    "20240101-20241101",
		Pairs:        []string{"BTC/USDT", "ETH/USDT"},
	}

	// Run backtest (blocks until complete)
	result, err := backtestRunner.RunBacktest(ctx, spec)
	if err != nil {
		return err
	}

	// Process result
	summary, _ := backtest.ExtractSummaryFromResult(result.RawResult)
	log.Printf("Backtest complete: %d trades, profit: %.2f", summary.TotalTrades, summary.ProfitTotalAbs)

## Monitoring Bot Status

	status, err := runtime.GetBotStatus(ctx, containerID)
	if err != nil {
		if errors.Is(err, runner.ErrBotNotFound) {
			// Container not found - bot stopped
			return nil
		}
		return err
	}

	if status.Healthy {
		log.Printf("Bot %s is healthy", status.BotID)
	} else {
		log.Printf("Bot %s is unhealthy: %s", status.BotID, status.ErrorMessage)
	}

# Configuration

## DockerConfig

	type DockerConfig struct {
		Host       string // Docker host (default: unix:///var/run/docker.sock)
		APIVersion string // API version (default: negotiate)
		TLSVerify  bool   // Enable TLS verification
		CertPath   string // Path to TLS certificates
		KeyPath    string // Path to TLS key
		CAPath     string // Path to CA certificate
	}

## KubernetesConfig (Planned)

	type KubernetesConfig struct {
		Kubeconfig string // Path to kubeconfig file
		Context    string // Context to use
		Namespace  string // Default namespace
		InCluster  bool   // Use in-cluster config
	}

## LocalConfig (Planned)

	type LocalConfig struct {
		WorkDir    string // Working directory for processes
		DataDir    string // Data directory
		ConfigDir  string // Config directory
	}

# Files

	interface.go           - Runtime interface definition
	backtest_interface.go  - BacktestRunner interface definition
	data_downloader.go     - DataDownloader interface definition
	factory.go             - Runtime factory implementation
	docker_runner.go       - Docker SDK implementation
	docker_backtest.go     - Docker backtest implementation
	kubernetes.go          - Kubernetes implementation (stub)
	local.go               - Local process implementation (stub)
	types.go               - Core types (BotSpec, BotStatus, etc.)
	backtest_types.go      - Backtest-specific types
	config.go              - Runtime configuration types
	config_validator.go    - BotSpec validation logic

DataDownloader implementations are in their respective packages:

	internal/docker/data_downloader.go      - Docker implementation
	internal/kubernetes/data_downloader.go  - Kubernetes implementation

# Related Packages

	internal/monitor        - Bot monitoring and metrics collection
	internal/graph          - GraphQL resolvers (runtime consumers)
	internal/ent            - Database entities (BotRunner, Bot)
	internal/freqtrade      - Freqtrade API client
	internal/backtest       - Backtest result parsing

# References

  - ADR-0004: Runtime Abstraction Layer
  - ADR-0006: Bot Configuration Layer Separation
  - ADR-0007: Kubernetes Deployment Strategy
  - internal/graph/schema.resolvers.go (Runtime usage in GraphQL)
  - internal/monitor/bot_monitor.go (Runtime usage in monitoring)
  - cmd/server/main.go (Runtime initialization)
*/
package runner
