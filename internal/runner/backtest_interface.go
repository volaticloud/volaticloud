package runner

import (
	"context"
	"errors"
)

var (
	// ErrBacktestNotFound is returned when a backtest task cannot be found
	ErrBacktestNotFound = errors.New("backtest not found in runtime")

	// ErrHyperOptNotFound is returned when a hyperopt task cannot be found
	ErrHyperOptNotFound = errors.New("hyperopt not found in runtime")

	// ErrBacktestAlreadyRunning is returned when trying to start a backtest that's already running
	ErrBacktestAlreadyRunning = errors.New("backtest is already running")

	// ErrHyperOptAlreadyRunning is returned when trying to start a hyperopt that's already running
	ErrHyperOptAlreadyRunning = errors.New("hyperopt is already running")
)

// BacktestRunner defines the interface for running backtest and hyperopt tasks
// Unlike Runtime (which manages long-running bots), BacktestRunner manages
// one-time tasks that run to completion and produce results.
type BacktestRunner interface {
	// Backtest Operations

	// RunBacktest starts a new backtest task
	// Returns the container ID and any error
	RunBacktest(ctx context.Context, spec BacktestSpec) (containerID string, err error)

	// GetBacktestStatus retrieves the current status of a backtest
	// Returns ErrBacktestNotFound if the backtest doesn't exist
	GetBacktestStatus(ctx context.Context, backtestID string) (*BacktestStatus, error)

	// GetBacktestResult retrieves the final results of a completed backtest
	// Returns error if backtest is not completed or failed
	GetBacktestResult(ctx context.Context, backtestID string) (*BacktestResult, error)

	// GetBacktestLogs retrieves logs from a backtest (running or completed)
	GetBacktestLogs(ctx context.Context, backtestID string, opts LogOptions) (*LogReader, error)

	// StopBacktest stops a running backtest
	// The backtest will be marked as failed/cancelled
	StopBacktest(ctx context.Context, backtestID string) error

	// DeleteBacktest removes a backtest task and cleans up resources
	// This deletes the container and any associated data
	DeleteBacktest(ctx context.Context, backtestID string) error

	// ListBacktests returns all backtest tasks managed by this runner
	ListBacktests(ctx context.Context) ([]BacktestStatus, error)

	// HyperOpt Operations

	// RunHyperOpt starts a new hyperparameter optimization task
	// Returns the container ID and any error
	RunHyperOpt(ctx context.Context, spec HyperOptSpec) (containerID string, err error)

	// GetHyperOptStatus retrieves the current status of a hyperopt
	// Returns ErrHyperOptNotFound if the hyperopt doesn't exist
	GetHyperOptStatus(ctx context.Context, hyperOptID string) (*HyperOptStatus, error)

	// GetHyperOptResult retrieves the final results of a completed hyperopt
	// Returns error if hyperopt is not completed or failed
	GetHyperOptResult(ctx context.Context, hyperOptID string) (*HyperOptResult, error)

	// GetHyperOptLogs retrieves logs from a hyperopt (running or completed)
	GetHyperOptLogs(ctx context.Context, hyperOptID string, opts LogOptions) (*LogReader, error)

	// StopHyperOpt stops a running hyperopt
	// The hyperopt will be marked as failed/cancelled
	StopHyperOpt(ctx context.Context, hyperOptID string) error

	// DeleteHyperOpt removes a hyperopt task and cleans up resources
	DeleteHyperOpt(ctx context.Context, hyperOptID string) error

	// ListHyperOpts returns all hyperopt tasks managed by this runner
	ListHyperOpts(ctx context.Context) ([]HyperOptStatus, error)

	// Common Operations

	// HealthCheck verifies the runner is accessible and functioning
	HealthCheck(ctx context.Context) error

	// Close cleans up runner resources and connections
	Close() error

	// Type returns the runner type (docker, kubernetes, local)
	Type() string
}

// MockBacktestRunner is a no-op implementation for testing
type MockBacktestRunner struct {
	RunBacktestFunc       func(ctx context.Context, spec BacktestSpec) (string, error)
	GetBacktestStatusFunc func(ctx context.Context, backtestID string) (*BacktestStatus, error)
	GetBacktestResultFunc func(ctx context.Context, backtestID string) (*BacktestResult, error)
	GetBacktestLogsFunc   func(ctx context.Context, backtestID string, opts LogOptions) (*LogReader, error)
	StopBacktestFunc      func(ctx context.Context, backtestID string) error
	DeleteBacktestFunc    func(ctx context.Context, backtestID string) error
	ListBacktestsFunc     func(ctx context.Context) ([]BacktestStatus, error)

	RunHyperOptFunc       func(ctx context.Context, spec HyperOptSpec) (string, error)
	GetHyperOptStatusFunc func(ctx context.Context, hyperOptID string) (*HyperOptStatus, error)
	GetHyperOptResultFunc func(ctx context.Context, hyperOptID string) (*HyperOptResult, error)
	GetHyperOptLogsFunc   func(ctx context.Context, hyperOptID string, opts LogOptions) (*LogReader, error)
	StopHyperOptFunc      func(ctx context.Context, hyperOptID string) error
	DeleteHyperOptFunc    func(ctx context.Context, hyperOptID string) error
	ListHyperOptsFunc     func(ctx context.Context) ([]HyperOptStatus, error)

	HealthCheckFunc func(ctx context.Context) error
	CloseFunc       func() error
	TypeFunc        func() string
}

// Ensure MockBacktestRunner implements BacktestRunner interface
var _ BacktestRunner = (*MockBacktestRunner)(nil)

// Backtest Operations

func (m *MockBacktestRunner) RunBacktest(ctx context.Context, spec BacktestSpec) (string, error) {
	if m.RunBacktestFunc != nil {
		return m.RunBacktestFunc(ctx, spec)
	}
	return "mock-backtest-container-id", nil
}

func (m *MockBacktestRunner) GetBacktestStatus(ctx context.Context, backtestID string) (*BacktestStatus, error) {
	if m.GetBacktestStatusFunc != nil {
		return m.GetBacktestStatusFunc(ctx, backtestID)
	}
	return &BacktestStatus{BacktestID: backtestID}, nil
}

func (m *MockBacktestRunner) GetBacktestResult(ctx context.Context, backtestID string) (*BacktestResult, error) {
	if m.GetBacktestResultFunc != nil {
		return m.GetBacktestResultFunc(ctx, backtestID)
	}
	return &BacktestResult{BacktestID: backtestID}, nil
}

func (m *MockBacktestRunner) GetBacktestLogs(ctx context.Context, backtestID string, opts LogOptions) (*LogReader, error) {
	if m.GetBacktestLogsFunc != nil {
		return m.GetBacktestLogsFunc(ctx, backtestID, opts)
	}
	return &LogReader{}, nil
}

func (m *MockBacktestRunner) StopBacktest(ctx context.Context, backtestID string) error {
	if m.StopBacktestFunc != nil {
		return m.StopBacktestFunc(ctx, backtestID)
	}
	return nil
}

func (m *MockBacktestRunner) DeleteBacktest(ctx context.Context, backtestID string) error {
	if m.DeleteBacktestFunc != nil {
		return m.DeleteBacktestFunc(ctx, backtestID)
	}
	return nil
}

func (m *MockBacktestRunner) ListBacktests(ctx context.Context) ([]BacktestStatus, error) {
	if m.ListBacktestsFunc != nil {
		return m.ListBacktestsFunc(ctx)
	}
	return []BacktestStatus{}, nil
}

// HyperOpt Operations

func (m *MockBacktestRunner) RunHyperOpt(ctx context.Context, spec HyperOptSpec) (string, error) {
	if m.RunHyperOptFunc != nil {
		return m.RunHyperOptFunc(ctx, spec)
	}
	return "mock-hyperopt-container-id", nil
}

func (m *MockBacktestRunner) GetHyperOptStatus(ctx context.Context, hyperOptID string) (*HyperOptStatus, error) {
	if m.GetHyperOptStatusFunc != nil {
		return m.GetHyperOptStatusFunc(ctx, hyperOptID)
	}
	return &HyperOptStatus{HyperOptID: hyperOptID}, nil
}

func (m *MockBacktestRunner) GetHyperOptResult(ctx context.Context, hyperOptID string) (*HyperOptResult, error) {
	if m.GetHyperOptResultFunc != nil {
		return m.GetHyperOptResultFunc(ctx, hyperOptID)
	}
	return &HyperOptResult{HyperOptID: hyperOptID}, nil
}

func (m *MockBacktestRunner) GetHyperOptLogs(ctx context.Context, hyperOptID string, opts LogOptions) (*LogReader, error) {
	if m.GetHyperOptLogsFunc != nil {
		return m.GetHyperOptLogsFunc(ctx, hyperOptID, opts)
	}
	return &LogReader{}, nil
}

func (m *MockBacktestRunner) StopHyperOpt(ctx context.Context, hyperOptID string) error {
	if m.StopHyperOptFunc != nil {
		return m.StopHyperOptFunc(ctx, hyperOptID)
	}
	return nil
}

func (m *MockBacktestRunner) DeleteHyperOpt(ctx context.Context, hyperOptID string) error {
	if m.DeleteHyperOptFunc != nil {
		return m.DeleteHyperOptFunc(ctx, hyperOptID)
	}
	return nil
}

func (m *MockBacktestRunner) ListHyperOpts(ctx context.Context) ([]HyperOptStatus, error) {
	if m.ListHyperOptsFunc != nil {
		return m.ListHyperOptsFunc(ctx)
	}
	return []HyperOptStatus{}, nil
}

// Common Operations

func (m *MockBacktestRunner) HealthCheck(ctx context.Context) error {
	if m.HealthCheckFunc != nil {
		return m.HealthCheckFunc(ctx)
	}
	return nil
}

func (m *MockBacktestRunner) Close() error {
	if m.CloseFunc != nil {
		return m.CloseFunc()
	}
	return nil
}

func (m *MockBacktestRunner) Type() string {
	if m.TypeFunc != nil {
		return m.TypeFunc()
	}
	return "mock"
}
