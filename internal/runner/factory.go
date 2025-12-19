package runner

import (
	"context"
	"fmt"

	"volaticloud/internal/enum"
)

// Factory creates Runtime and BacktestRunner instances based on runtime type and configuration
type Factory struct{}

// NewFactory creates a new runtime factory
func NewFactory() *Factory {
	return &Factory{}
}

// Create creates a Runtime instance based on the given type and configuration
func (f *Factory) Create(ctx context.Context, runnerType enum.RunnerType, configData map[string]interface{}) (Runtime, error) {
	// Extract runner-type-specific config
	typeConfig := ExtractRunnerConfig(configData, runnerType)

	// Try to get registered creator first
	creator, err := GetRuntimeCreator(runnerType)
	if err == nil {
		return creator(ctx, typeConfig)
	}

	// Fallback to built-in stubs
	switch runnerType {
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
	// Extract runner-type-specific config
	typeConfig := ExtractRunnerConfig(configData, runnerType)

	// Try to get registered creator first
	creator, err := GetBacktestRunnerCreator(runnerType)
	if err == nil {
		return creator(ctx, typeConfig)
	}

	// Fallback to built-in stubs
	switch runnerType {
	case enum.RunnerKubernetes:
		return f.createKubernetesBacktestRunner(ctx, configData)

	case enum.RunnerLocal:
		return f.createLocalBacktestRunner(ctx, configData)

	default:
		return nil, fmt.Errorf("unsupported runner type: %s", runnerType)
	}
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
