package runner

import (
	"context"
	"fmt"

	"anytrade/internal/enum"
)

// Factory creates Runtime instances based on runtime type and configuration
type Factory struct{}

// NewFactory creates a new runtime factory
func NewFactory() *Factory {
	return &Factory{}
}

// Create creates a Runtime instance based on the given type and configuration
func (f *Factory) Create(ctx context.Context, runtimeType enum.RuntimeType, configData map[string]interface{}) (Runtime, error) {
	switch runtimeType {
	case enum.RuntimeDocker:
		return f.createDockerRuntime(ctx, configData)

	case enum.RuntimeKubernetes:
		return f.createKubernetesRuntime(ctx, configData)

	case enum.RuntimeLocal:
		return f.createLocalRuntime(ctx, configData)

	default:
		return nil, fmt.Errorf("unsupported runtime type: %s", runtimeType)
	}
}

// createDockerRuntime creates a Docker runtime instance
func (f *Factory) createDockerRuntime(ctx context.Context, configData map[string]interface{}) (Runtime, error) {
	// Parse and validate Docker configuration
	config, err := ParseDockerConfig(configData)
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
