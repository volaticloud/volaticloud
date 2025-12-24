package runner

import (
	"context"
	"fmt"
	"net/http"
)

// LocalRuntime implements Runtime for local process environments
// This is a stub implementation - not yet supported
type LocalRuntime struct{}

// NewLocalRuntime creates a new Local runtime instance
func NewLocalRuntime() *LocalRuntime {
	return &LocalRuntime{}
}

// Ensure LocalRuntime implements Runtime interface
var _ Runtime = (*LocalRuntime)(nil)

func (l *LocalRuntime) CreateBot(ctx context.Context, spec BotSpec) error {
	return fmt.Errorf("local runtime is not yet supported")
}

func (l *LocalRuntime) DeleteBot(ctx context.Context, botID string) error {
	return fmt.Errorf("local runtime is not yet supported")
}

func (l *LocalRuntime) StartBot(ctx context.Context, botID string) error {
	return fmt.Errorf("local runtime is not yet supported")
}

func (l *LocalRuntime) StopBot(ctx context.Context, botID string) error {
	return fmt.Errorf("local runtime is not yet supported")
}

func (l *LocalRuntime) RestartBot(ctx context.Context, botID string) error {
	return fmt.Errorf("local runtime is not yet supported")
}

func (l *LocalRuntime) GetBotStatus(ctx context.Context, botID string) (*BotStatus, error) {
	return nil, fmt.Errorf("local runtime is not yet supported")
}

func (l *LocalRuntime) GetContainerIP(ctx context.Context, botID string) (string, error) {
	return "", fmt.Errorf("local runtime is not yet supported")
}

func (l *LocalRuntime) GetBotAPIURL(ctx context.Context, botID string) (string, error) {
	return "", fmt.Errorf("local runtime is not yet supported")
}

func (l *LocalRuntime) GetBotHTTPClient(ctx context.Context, botID string) (*http.Client, string, error) {
	return nil, "", fmt.Errorf("local runtime is not yet supported")
}

func (l *LocalRuntime) GetBotLogs(ctx context.Context, botID string, opts LogOptions) (*LogReader, error) {
	return nil, fmt.Errorf("local runtime is not yet supported")
}

func (l *LocalRuntime) UpdateBot(ctx context.Context, botID string, spec UpdateBotSpec) error {
	return fmt.Errorf("local runtime is not yet supported")
}

func (l *LocalRuntime) ListBots(ctx context.Context) ([]BotStatus, error) {
	return nil, fmt.Errorf("local runtime is not yet supported")
}

func (l *LocalRuntime) HealthCheck(ctx context.Context) error {
	return fmt.Errorf("local runtime is not yet supported")
}

func (l *LocalRuntime) Close() error {
	return nil
}

func (l *LocalRuntime) Type() string {
	return "local"
}
