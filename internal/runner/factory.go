package runner

import (
	"context"
	"fmt"

	"anytrade/internal/enum"
)

// Factory creates Runtime and BacktestRunner instances based on runtime type and configuration
type Factory struct{}

// NewFactory creates a new runtime factory
func NewFactory() *Factory {
	return &Factory{}
}

// Create creates a Runtime instance based on the given type and configuration
func (f *Factory) Create(ctx context.Context, runnerType enum.RunnerType, configData map[string]interface{}) (Runtime, error) {
	switch runnerType {
	case enum.RunnerDocker:
		return f.createDockerRuntime(ctx, configData)

	case enum.RunnerKubernetes:
		return f.createKubernetesRuntime(ctx, configData)

	case enum.RunnerLocal:
		return f.createLocalRuntime(ctx, configData)

	default:
		return nil, fmt.Errorf("unsupported runner type: %s", runnerType)
	}
}

// CreateBacktestRunner creates a BacktestRunner instance based on the given type and configuration
func (f *Factory) CreateBacktestRunner(ctx context.Context, runnerType enum.RunnerType, configData map[string]interface{}) (BacktestRunner, error) {
	switch runnerType {
	case enum.RunnerDocker:
		return f.createDockerBacktestRunner(ctx, configData)

	case enum.RunnerKubernetes:
		return f.createKubernetesBacktestRunner(ctx, configData)

	case enum.RunnerLocal:
		return f.createLocalBacktestRunner(ctx, configData)

	default:
		return nil, fmt.Errorf("unsupported runner type: %s", runnerType)
	}
}

// createDockerRuntime creates a Docker runtime instance
func (f *Factory) createDockerRuntime(ctx context.Context, configData map[string]interface{}) (Runtime, error) {
	// Extract the docker config from the wrapper
	// Config structure is: {"docker": {...}}
	dockerConfig, ok := configData["docker"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("docker config not found or invalid")
	}

	// Parse and validate Docker configuration
	config, err := ParseDockerConfig(dockerConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Docker config: %w", err)
	}

	// Create Docker runtime with configuration
	runtime, err := NewDockerRuntime(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create Docker runtime: %w", err)
	}

	// Verify connection
	if err := runtime.HealthCheck(ctx); err != nil {
		runtime.Close()
		return nil, fmt.Errorf("Docker runtime health check failed: %w", err)
	}

	return runtime, nil
}

// createKubernetesRuntime creates a Kubernetes runtime instance
func (f *Factory) createKubernetesRuntime(ctx context.Context, configData map[string]interface{}) (Runtime, error) {
	// For now, Kubernetes is not implemented
	runtime := NewKubernetesRuntime()
	return runtime, nil
}

// createLocalRuntime creates a Local runtime instance
func (f *Factory) createLocalRuntime(ctx context.Context, configData map[string]interface{}) (Runtime, error) {
	// For now, Local is not implemented
	runtime := NewLocalRuntime()
	return runtime, nil
}

// createDockerBacktestRunner creates a Docker backtest runner instance
func (f *Factory) createDockerBacktestRunner(ctx context.Context, configData map[string]interface{}) (BacktestRunner, error) {
	// Extract the docker config from the wrapper
	// Config structure is: {"docker": {...}}
	dockerConfig, ok := configData["docker"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("docker config not found or invalid")
	}

	// Parse and validate Docker configuration
	config, err := ParseDockerConfig(dockerConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Docker config: %w", err)
	}

	// Create Docker backtest runner with configuration
	runner, err := NewDockerBacktestRunner(ctx, *config)
	if err != nil {
		return nil, fmt.Errorf("failed to create Docker backtest runner: %w", err)
	}

	// Verify connection
	if err := runner.HealthCheck(ctx); err != nil {
		runner.Close()
		return nil, fmt.Errorf("Docker backtest runner health check failed: %w", err)
	}

	return runner, nil
}

// createKubernetesBacktestRunner creates a Kubernetes backtest runner instance
func (f *Factory) createKubernetesBacktestRunner(ctx context.Context, configData map[string]interface{}) (BacktestRunner, error) {
	// For now, Kubernetes is not implemented
	return &MockBacktestRunner{}, nil
}

// createLocalBacktestRunner creates a Local backtest runner instance
func (f *Factory) createLocalBacktestRunner(ctx context.Context, configData map[string]interface{}) (BacktestRunner, error) {
	// For now, Local is not implemented
	return &MockBacktestRunner{}, nil
}
