package runner

import (
	"context"
	"fmt"
)

// KubernetesRuntime implements Runtime for Kubernetes environments
// This is a stub implementation - not yet supported
type KubernetesRuntime struct{}

// NewKubernetesRuntime creates a new Kubernetes runtime instance
func NewKubernetesRuntime() *KubernetesRuntime {
	return &KubernetesRuntime{}
}

// Ensure KubernetesRuntime implements Runtime interface
var _ Runtime = (*KubernetesRuntime)(nil)

func (k *KubernetesRuntime) CreateBot(ctx context.Context, spec BotSpec) (string, error) {
	return "", fmt.Errorf("Kubernetes runtime is not yet supported")
}

func (k *KubernetesRuntime) DeleteBot(ctx context.Context, botID string) error {
	return fmt.Errorf("Kubernetes runtime is not yet supported")
}

func (k *KubernetesRuntime) StartBot(ctx context.Context, botID string) error {
	return fmt.Errorf("Kubernetes runtime is not yet supported")
}

func (k *KubernetesRuntime) StopBot(ctx context.Context, botID string) error {
	return fmt.Errorf("Kubernetes runtime is not yet supported")
}

func (k *KubernetesRuntime) RestartBot(ctx context.Context, botID string) error {
	return fmt.Errorf("Kubernetes runtime is not yet supported")
}

func (k *KubernetesRuntime) GetBotStatus(ctx context.Context, botID string) (*BotStatus, error) {
	return nil, fmt.Errorf("Kubernetes runtime is not yet supported")
}

func (k *KubernetesRuntime) GetContainerIP(ctx context.Context, containerID string) (string, error) {
	return "", fmt.Errorf("Kubernetes runtime is not yet supported")
}

func (k *KubernetesRuntime) GetBotLogs(ctx context.Context, botID string, opts LogOptions) (*LogReader, error) {
	return nil, fmt.Errorf("Kubernetes runtime is not yet supported")
}

func (k *KubernetesRuntime) UpdateBot(ctx context.Context, botID string, spec UpdateBotSpec) error {
	return fmt.Errorf("Kubernetes runtime is not yet supported")
}

func (k *KubernetesRuntime) ListBots(ctx context.Context) ([]BotStatus, error) {
	return nil, fmt.Errorf("Kubernetes runtime is not yet supported")
}

func (k *KubernetesRuntime) HealthCheck(ctx context.Context) error {
	return fmt.Errorf("Kubernetes runtime is not yet supported")
}

func (k *KubernetesRuntime) Close() error {
	return nil
}

func (k *KubernetesRuntime) Type() string {
	return "kubernetes"
}
