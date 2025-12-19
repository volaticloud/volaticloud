// Package docker provides Docker container runtime implementations for the runner interfaces.
//
// This package contains the Docker-specific implementations of the runner.Runtime and
// runner.BacktestRunner interfaces, along with Docker configuration, volume management,
// and container lifecycle operations.
//
// # Architecture
//
// ```mermaid
// graph TB
//
//	subgraph runner["internal/runner (Abstractions)"]
//	    RT[Runtime Interface]
//	    BT[BacktestRunner Interface]
//	    Types[BotSpec, BotStatus, etc.]
//	    Factory[Factory]
//	end
//
//	subgraph docker["internal/docker (Implementation)"]
//	    DR[DockerRuntime]
//	    DBR[DockerBacktestRunner]
//	    DVH[DockerVolumeHelper]
//	    CFG[DockerConfig]
//	end
//
//	RT --> DR
//	BT --> DBR
//	Factory --> DR
//	Factory --> DBR
//	DR --> DVH
//	DBR --> DVH
//	DR --> CFG
//	DBR --> CFG
//
// ```
//
// # Components
//
// DockerRuntime implements runner.Runtime interface for managing bot containers:
//   - Container lifecycle (create, start, stop, remove)
//   - Real-time log streaming
//   - Resource metrics collection (CPU, memory, network, storage)
//   - Health monitoring
//
// DockerBacktestRunner implements runner.BacktestRunner interface for backtesting:
//   - Backtest container execution
//   - HyperOpt parallel optimization
//   - Result parsing and volume management
//
// DockerVolumeHelper manages Docker volumes for data persistence:
//   - Data directories (user_data, strategies)
//   - Exchange config injection
//   - Strategy file management
//
// DockerConfig holds Docker daemon connection and registry settings:
//   - Host configuration
//   - TLS certificates
//   - Registry authentication
//   - Resource limits (CPU, memory, GPU)
//
// # Usage
//
//	config, err := docker.ParseConfig(configData)
//	if err != nil {
//	    return err
//	}
//
//	runtime, err := docker.NewRuntime(ctx, config)
//	if err != nil {
//	    return err
//	}
//
//	// Use runtime to manage bot containers
//	err = runtime.CreateBot(ctx, botSpec)
//
// # Client Access
//
// For cases where direct Docker client access is needed (e.g., monitoring),
// DockerRuntime implements the ClientAccessor interface:
//
//	if accessor, ok := rt.(docker.ClientAccessor); ok {
//	    cli := accessor.GetClient()
//	    // Use Docker client directly
//	}
package docker
