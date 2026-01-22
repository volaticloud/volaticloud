package backtest

import (
	"fmt"

	"volaticloud/internal/ent"
	"volaticloud/internal/runner"
)

// BuildSpec builds a BacktestSpec from a Backtest entity
func BuildSpec(bt *ent.Backtest) (*runner.BacktestSpec, error) {
	if bt.Edges.Strategy == nil {
		return nil, fmt.Errorf("backtest has no strategy")
	}

	strategy := bt.Edges.Strategy

	// Strategy config is optional - Freqtrade will validate at runtime
	if strategy.Config == nil {
		strategy.Config = make(map[string]interface{})
	}

	// Extract optional runtime configuration from config
	freqtradeVersion := "stable"
	if fv, ok := strategy.Config["freqtrade_version"].(string); ok && fv != "" {
		freqtradeVersion = fv
	}

	// Strategy config (pairs, timeframe, stake_amount, etc.)
	strategyConfig := make(map[string]interface{})
	for k, v := range strategy.Config {
		strategyConfig[k] = v
	}

	// Set data format to JSON (matching data download format)
	strategyConfig["dataformat_ohlcv"] = "json"

	// Build timerange from start_date and end_date if provided
	// Freqtrade expects format: "YYYYMMDD-YYYYMMDD" (e.g., "20240101-20241231")
	if !bt.StartDate.IsZero() && !bt.EndDate.IsZero() {
		startStr := bt.StartDate.Format("20060102") // Go time format for YYYYMMDD
		endStr := bt.EndDate.Format("20060102")
		timerange := fmt.Sprintf("%s-%s", startStr, endStr)
		strategyConfig["timerange"] = timerange
	}

	// Backtest config - pass through user-provided config as-is
	// Freqtrade will validate and merge configs at runtime
	backtestConfig := make(map[string]interface{})
	if bt.Config != nil {
		for k, v := range bt.Config {
			backtestConfig[k] = v
		}
	}
	// Always set dry_run to true for backtests
	backtestConfig["dry_run"] = true

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
