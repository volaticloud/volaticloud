package backtest

import (
	"fmt"

	"volaticloud/internal/ent"
	"volaticloud/internal/runner"
)

// Constants for backtest configuration
const (
	// DefaultFreqtradeVersion is the default Freqtrade Docker image tag
	DefaultFreqtradeVersion = "stable"

	// DefaultDataFormatOHLCV is the OHLCV data format used by the data downloader
	DefaultDataFormatOHLCV = "json"

	// FreqtradeVersionConfigKey is the config key for Freqtrade version
	FreqtradeVersionConfigKey = "freqtrade_version"

	// DataFormatConfigKey is the config key for OHLCV data format
	DataFormatConfigKey = "dataformat_ohlcv"

	// TimerangeConfigKey is the config key for backtest time range
	TimerangeConfigKey = "timerange"

	// DryRunConfigKey is the config key for dry run mode
	DryRunConfigKey = "dry_run"
)

// BuildSpec builds a BacktestSpec from a Backtest entity.
// The bt.Edges.Strategy must be loaded before calling this function.
// This function validates the backtest config as a defense-in-depth measure,
// ensuring safety even if called from non-GraphQL code paths (e.g., monitor, retry logic).
func BuildSpec(bt *ent.Backtest) (*runner.BacktestSpec, error) {
	if bt.Edges.Strategy == nil {
		return nil, fmt.Errorf("backtest %s: strategy edge not loaded", bt.ID)
	}

	// Validate backtest config (defense in depth - also validated in GraphQL resolver)
	// This ensures dry_run safety and exchange validation even in non-GraphQL code paths
	if err := ValidateBacktestConfig(bt.Config); err != nil {
		return nil, fmt.Errorf("backtest %s: invalid config: %w", bt.ID, err)
	}

	strategy := bt.Edges.Strategy

	// Strategy config is optional - Freqtrade will validate at runtime
	if strategy.Config == nil {
		strategy.Config = make(map[string]interface{})
	}

	// Extract optional runtime configuration from config
	freqtradeVersion := DefaultFreqtradeVersion
	if fv, ok := strategy.Config[FreqtradeVersionConfigKey].(string); ok && fv != "" {
		freqtradeVersion = fv
	}

	// Strategy config (pairs, timeframe, stake_amount, etc.)
	strategyConfig := make(map[string]interface{})
	for k, v := range strategy.Config {
		strategyConfig[k] = v
	}

	// Set data format to JSON (matching data download format)
	strategyConfig[DataFormatConfigKey] = DefaultDataFormatOHLCV

	// Build timerange from start_date and end_date if provided
	// Freqtrade expects format: "YYYYMMDD-YYYYMMDD" (e.g., "20240101-20241231")
	if !bt.StartDate.IsZero() && !bt.EndDate.IsZero() {
		startStr := bt.StartDate.Format("20060102") // Go time format for YYYYMMDD
		endStr := bt.EndDate.Format("20060102")
		timerange := fmt.Sprintf("%s-%s", startStr, endStr)
		strategyConfig[TimerangeConfigKey] = timerange
	}

	// Backtest config - pass through user-provided config as-is
	// Freqtrade will validate and merge configs at runtime
	backtestConfig := make(map[string]interface{})
	if bt.Config != nil {
		for k, v := range bt.Config {
			backtestConfig[k] = v
		}
	}
	// Always set dry_run to true for backtests (safety measure)
	backtestConfig[DryRunConfigKey] = true

	// Build BacktestSpec with split configs (like bots)
	// DataDownloadURL is set by the caller when executing the backtest (from runner's S3 config)
	spec := &runner.BacktestSpec{
		ID:               bt.ID.String(),
		StrategyName:     strategy.Name,
		StrategyCode:     strategy.Code,
		StrategyConfig:   strategyConfig,
		BacktestConfig:   backtestConfig,
		FreqtradeVersion: freqtradeVersion,
		Environment:      make(map[string]string),
	}

	return spec, nil
}
