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

	// Fallback to built-in stubs (only local is stubbed)
	switch runnerType {
	case enum.RunnerLocal:
		return f.createLocalRuntime(ctx, configData)

	default:
		return nil, fmt.Errorf("unsupported runner type: %s (no registered creator found)", runnerType)
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

	// Fallback to built-in stubs (only local is stubbed)
	switch runnerType {
	case enum.RunnerLocal:
		return f.createLocalBacktestRunner(ctx, configData)

	default:
		return nil, fmt.Errorf("unsupported runner type: %s (no registered creator found)", runnerType)
	}
}

// createLocalRuntime creates a Local runtime instance (stub - not yet supported)
func (f *Factory) createLocalRuntime(ctx context.Context, configData map[string]interface{}) (Runtime, error) {
	runtime := NewLocalRuntime()
	return runtime, nil
}

// createLocalBacktestRunner creates a Local backtest runner instance (stub - not yet supported)
func (f *Factory) createLocalBacktestRunner(ctx context.Context, configData map[string]interface{}) (BacktestRunner, error) {
	return &MockBacktestRunner{}, nil
}
