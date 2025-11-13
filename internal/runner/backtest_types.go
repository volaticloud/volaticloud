package runner

import (
	"time"

	"anytrade/internal/enum"
)

// BacktestSpec defines the specification for running a backtest
type BacktestSpec struct {
	// Identity
	ID           string
	StrategyName string
	StrategyCode string

	// Backtest Configuration
	// Contains ALL backtest settings: pairs, timeframe, timerange, stake_amount,
	// stake_currency, max_open_trades, enable_position_stacking, trading_mode, etc.
	// This is passed directly to Freqtrade as config.json
	Config map[string]interface{}

	// Runtime Configuration
	FreqtradeVersion string            // Freqtrade Docker image version
	Environment      map[string]string // Additional environment variables
	ResourceLimits   *ResourceLimits   // CPU/Memory limits

	// Data Source
	DataSource string // "download" or "local"
	DataPath   string // Path to local data if using local source
}

// BacktestResult represents the results of a completed backtest
type BacktestResult struct {
	// Identity
	BacktestID string
	Status     enum.TaskStatus

	// Container Info
	ContainerID string
	ExitCode    int

	// Execution Timing
	StartedAt   *time.Time
	CompletedAt *time.Time
	Duration    time.Duration

	// Performance Metrics
	TotalTrades     int
	WinningTrades   int
	LosingTrades    int
	WinRate         float64
	ProfitFactor    float64
	TotalProfit     float64
	TotalProfitPct  float64
	MaxDrawdown     float64
	MaxDrawdownPct  float64
	SharpeRatio     float64
	SortinoRatio    float64
	CalmarRatio     float64
	ExpectancyRatio float64
	AvgProfit       float64
	AvgLoss         float64
	AvgProfitPct    float64
	AvgLossPct      float64

	// Trade Statistics
	BestTrade        float64
	WorstTrade       float64
	BestTradePct     float64
	WorstTradePct    float64
	AvgTradeDuration string

	// Final Balance
	StartingBalance float64
	FinalBalance    float64

	// Raw Data
	RawResult    map[string]interface{} // Full JSON result from freqtrade
	Logs         string                 // Container logs
	ErrorMessage string                 // Error message if failed
}

// BacktestStatus represents the current state of a running or completed backtest
type BacktestStatus struct {
	// Identity
	BacktestID  string
	Status      enum.TaskStatus
	ContainerID string

	// Execution Info
	StartedAt   *time.Time
	CompletedAt *time.Time
	Progress    float64 // 0-100 percent complete (if available)

	// Resource Usage
	CPUUsage    float64
	MemoryUsage int64

	// Error Info
	ErrorMessage string
	ExitCode     int

	// Metadata
	CreatedAt time.Time
	UpdatedAt time.Time
}

// HyperOptSpec defines the specification for running hyperparameter optimization
type HyperOptSpec struct {
	// Identity
	ID           string
	StrategyName string
	StrategyCode string

	// HyperOpt Configuration
	// Contains ALL config settings: pairs, timeframe, stake_amount, stake_currency,
	// max_open_trades, trading_mode, timerange, etc.
	// This is passed directly to Freqtrade as config.json
	Config map[string]interface{}

	// Optimization Parameters (used in command line arguments)
	Epochs       int      // Number of optimization epochs
	Spaces       []string // Spaces to optimize (buy, sell, roi, stoploss, trailing, protection, etc.)
	LossFunction string   // Loss function (SharpeHyperOptLoss, SortinoHyperOptLoss, etc.)

	// Runtime Configuration
	FreqtradeVersion string
	Environment      map[string]string
	ResourceLimits   *ResourceLimits

	// Data Source
	DataSource string
	DataPath   string
}

// HyperOptResult represents the results of a completed hyperopt run
type HyperOptResult struct {
	// Identity
	HyperOptID string
	Status     enum.TaskStatus

	// Container Info
	ContainerID string
	ExitCode    int

	// Execution Timing
	StartedAt   *time.Time
	CompletedAt *time.Time
	Duration    time.Duration

	// Optimization Results
	TotalEpochs   int
	BestEpoch     int
	BestObjective float64
	BestParams    map[string]interface{} // Best hyperparameters found

	// Best Performance Metrics (from best epoch)
	TotalTrades int
	WinRate     float64
	TotalProfit float64
	MaxDrawdown float64
	SharpeRatio float64

	// Raw Data
	RawResult    map[string]interface{} // Full JSON result from freqtrade
	Logs         string
	ErrorMessage string
}

// HyperOptStatus represents the current state of a running or completed hyperopt
type HyperOptStatus struct {
	// Identity
	HyperOptID  string
	Status      enum.TaskStatus
	ContainerID string

	// Execution Info
	StartedAt        *time.Time
	CompletedAt      *time.Time
	CurrentEpoch     int
	TotalEpochs      int
	Progress         float64 // 0-100 percent complete
	CurrentObjective float64 // Current best objective value

	// Resource Usage
	CPUUsage    float64
	MemoryUsage int64

	// Error Info
	ErrorMessage string
	ExitCode     int

	// Metadata
	CreatedAt time.Time
	UpdatedAt time.Time
}
