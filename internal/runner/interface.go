package runner

import (
	"context"
)

// Runtime defines the interface for managing bot lifecycles across different runtime environments
type Runtime interface {
	// CreateBot deploys a new bot instance in the runtime environment
	// Container/deployment name is derived from spec.ID (the bot UUID)
	CreateBot(ctx context.Context, spec BotSpec) error

	// DeleteBot removes a bot instance and all its resources from the runtime environment
	// This is a destructive operation and cannot be undone
	DeleteBot(ctx context.Context, botID string) error

	// StartBot starts a stopped bot instance
	// Returns an error if the bot is already running or doesn't exist
	StartBot(ctx context.Context, botID string) error

	// StopBot stops a running bot instance
	// The bot can be restarted later with StartBot
	StopBot(ctx context.Context, botID string) error

	// RestartBot restarts a bot instance (stop + start)
	RestartBot(ctx context.Context, botID string) error

	// GetBotStatus retrieves the current status of a bot
	// Returns BotNotFound error if the bot doesn't exist
	GetBotStatus(ctx context.Context, botID string) (*BotStatus, error)

	// GetContainerIP retrieves the container's IP address for accessing the bot's Freqtrade API
	// Container name is derived from botID
	// Returns error if the container doesn't exist or network info unavailable
	GetContainerIP(ctx context.Context, botID string) (string, error)

	// GetBotLogs retrieves or streams logs from a bot
	// Use LogOptions to configure filtering, tailing, and streaming
	GetBotLogs(ctx context.Context, botID string, opts LogOptions) (*LogReader, error)

	// UpdateBot updates a running bot's configuration
	// Not all runtimes support all update operations
	// May require recreation for some changes (e.g., image update)
	UpdateBot(ctx context.Context, botID string, spec UpdateBotSpec) error

	// ListBots returns all bots managed by this runtime instance
	// Useful for reconciliation and discovery
	ListBots(ctx context.Context) ([]BotStatus, error)

	// HealthCheck verifies the runtime is accessible and functioning
	// Returns error if the runtime cannot be reached or is unhealthy
	HealthCheck(ctx context.Context) error

	// Close cleans up runtime resources and connections
	// Should be called when the runtime is no longer needed
	Close() error

	// Type returns the runtime type (docker, kubernetes, local)
	Type() string
}

// MockRuntime is a no-op implementation for testing
type MockRuntime struct {
	CreateBotFunc      func(ctx context.Context, spec BotSpec) error
	DeleteBotFunc      func(ctx context.Context, botID string) error
	StartBotFunc       func(ctx context.Context, botID string) error
	StopBotFunc        func(ctx context.Context, botID string) error
	RestartBotFunc     func(ctx context.Context, botID string) error
	GetBotStatusFunc   func(ctx context.Context, botID string) (*BotStatus, error)
	GetContainerIPFunc func(ctx context.Context, botID string) (string, error)
	GetBotLogsFunc     func(ctx context.Context, botID string, opts LogOptions) (*LogReader, error)
	UpdateBotFunc      func(ctx context.Context, botID string, spec UpdateBotSpec) error
	ListBotsFunc       func(ctx context.Context) ([]BotStatus, error)
	HealthCheckFunc    func(ctx context.Context) error
	CloseFunc          func() error
	TypeFunc           func() string
}

// Ensure MockRuntime implements Runtime interface
var _ Runtime = (*MockRuntime)(nil)

func (m *MockRuntime) CreateBot(ctx context.Context, spec BotSpec) error {
	if m.CreateBotFunc != nil {
		return m.CreateBotFunc(ctx, spec)
	}
	return nil
}

func (m *MockRuntime) DeleteBot(ctx context.Context, botID string) error {
	if m.DeleteBotFunc != nil {
		return m.DeleteBotFunc(ctx, botID)
	}
	return nil
}

func (m *MockRuntime) StartBot(ctx context.Context, botID string) error {
	if m.StartBotFunc != nil {
		return m.StartBotFunc(ctx, botID)
	}
	return nil
}

func (m *MockRuntime) StopBot(ctx context.Context, botID string) error {
	if m.StopBotFunc != nil {
		return m.StopBotFunc(ctx, botID)
	}
	return nil
}

func (m *MockRuntime) RestartBot(ctx context.Context, botID string) error {
	if m.RestartBotFunc != nil {
		return m.RestartBotFunc(ctx, botID)
	}
	return nil
}

func (m *MockRuntime) GetBotStatus(ctx context.Context, botID string) (*BotStatus, error) {
	if m.GetBotStatusFunc != nil {
		return m.GetBotStatusFunc(ctx, botID)
	}
	return &BotStatus{BotID: botID}, nil
}

func (m *MockRuntime) GetContainerIP(ctx context.Context, botID string) (string, error) {
	if m.GetContainerIPFunc != nil {
		return m.GetContainerIPFunc(ctx, botID)
	}
	return "127.0.0.1", nil
}

func (m *MockRuntime) GetBotLogs(ctx context.Context, botID string, opts LogOptions) (*LogReader, error) {
	if m.GetBotLogsFunc != nil {
		return m.GetBotLogsFunc(ctx, botID, opts)
	}
	return &LogReader{}, nil
}

func (m *MockRuntime) UpdateBot(ctx context.Context, botID string, spec UpdateBotSpec) error {
	if m.UpdateBotFunc != nil {
		return m.UpdateBotFunc(ctx, botID, spec)
	}
	return nil
}

func (m *MockRuntime) ListBots(ctx context.Context) ([]BotStatus, error) {
	if m.ListBotsFunc != nil {
		return m.ListBotsFunc(ctx)
	}
	return []BotStatus{}, nil
}

func (m *MockRuntime) HealthCheck(ctx context.Context) error {
	if m.HealthCheckFunc != nil {
		return m.HealthCheckFunc(ctx)
	}
	return nil
}

func (m *MockRuntime) Close() error {
	if m.CloseFunc != nil {
		return m.CloseFunc()
	}
	return nil
}

func (m *MockRuntime) Type() string {
	if m.TypeFunc != nil {
		return m.TypeFunc()
	}
	return "mock"
}
