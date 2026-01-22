package runner

import (
	"regexp"
	"strings"
	"time"

	"volaticloud/internal/enum"
)

// sanitizeFilenameRegex matches characters that are not alphanumeric or space
var sanitizeFilenameRegex = regexp.MustCompile(`[^a-zA-Z0-9\s]`)

// SanitizeStrategyFilename converts a strategy name to a valid Python class name (PascalCase).
// This matches the frontend's toClassName function to ensure consistency.
// Example: "RSI Test Strategy" -> "RsiTestStrategy"
// The result is used for:
// - Kubernetes ConfigMap keys (no spaces allowed)
// - Python file names (no spaces allowed)
// - Freqtrade --strategy flag (expects Python class name)
func SanitizeStrategyFilename(name string) string {
	if name == "" {
		return "MyStrategy"
	}

	// Remove invalid characters (keep alphanumeric and spaces)
	sanitized := sanitizeFilenameRegex.ReplaceAllString(name, "")
	if sanitized == "" {
		return "MyStrategy"
	}

	// If no spaces, preserve original casing but ensure first char is uppercase
	if !strings.Contains(sanitized, " ") {
		if len(sanitized) == 0 {
			return "MyStrategy"
		}
		return strings.ToUpper(string(sanitized[0])) + sanitized[1:]
	}

	// Convert space-separated words to PascalCase
	words := strings.Fields(sanitized)
	var result strings.Builder
	for _, word := range words {
		if len(word) > 0 {
			result.WriteString(strings.ToUpper(string(word[0])))
			if len(word) > 1 {
				result.WriteString(strings.ToLower(word[1:]))
			}
		}
	}

	if result.Len() == 0 {
		return "MyStrategy"
	}
	return result.String()
}

// BacktestSpec defines the specification for running a backtest
type BacktestSpec struct {
	// Identity
	ID           string
	StrategyName string
	StrategyCode string

	// Split Configuration (like bots)
	// StrategyConfig: pairs, timeframe, timerange, stake_amount, stake_currency, etc. (from strategy.Config)
	// BacktestConfig: exchange, dry_run, and other backtest-specific overrides (from backtest.Config)
	// Freqtrade merges configs in order via multiple --config flags (later overrides earlier)
	StrategyConfig map[string]interface{}
	BacktestConfig map[string]interface{}

	// Runtime Configuration
	FreqtradeVersion string            // Freqtrade Docker image version
	Environment      map[string]string // Additional environment variables
	ResourceLimits   *ResourceLimits   // CPU/Memory limits

	// S3 Data Configuration
	// DataDownloadURL is a presigned S3 URL for downloading OHLCV data.
	// This field is set by the caller (runner implementation) when executing the backtest.
	// The caller is responsible for:
	// - Generating a valid presigned URL from the runner's S3 configuration
	// - Ensuring the URL has sufficient expiration time for the backtest duration
	// - Handling errors if the URL is invalid or expired
	DataDownloadURL string
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

	// Network I/O (for billing)
	NetworkRxBytes int64
	NetworkTxBytes int64

	// Disk I/O (for billing)
	BlockReadBytes  int64
	BlockWriteBytes int64

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

	// S3 Data Configuration
	DataDownloadURL string // Presigned S3 URL for downloading OHLCV data
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
	CPUUsage        float64
	MemoryUsage     int64
	NetworkRxBytes  int64
	NetworkTxBytes  int64
	BlockReadBytes  int64
	BlockWriteBytes int64

	// Error Info
	ErrorMessage string
	ExitCode     int

	// Metadata
	CreatedAt time.Time
	UpdatedAt time.Time
}
