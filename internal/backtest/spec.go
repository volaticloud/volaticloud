package backtest

import (
	"fmt"

	"volaticloud/internal/ent"
	"volaticloud/internal/freqtrade"
	"volaticloud/internal/runner"
)

// BuildSpec builds a BacktestSpec from a Backtest entity
func BuildSpec(bt *ent.Backtest) (*runner.BacktestSpec, error) {
	if bt.Edges.Strategy == nil {
		return nil, fmt.Errorf("backtest has no strategy")
	}

	strategy := bt.Edges.Strategy

	// The strategy config should contain all required fields
	if strategy.Config == nil {
		return nil, fmt.Errorf("strategy has no config")
	}

	// Validate config contains all required fields
	if err := freqtrade.ValidateConfig(strategy.Config); err != nil {
		return nil, fmt.Errorf("invalid strategy config: %w", err)
	}

	// Extract optional runtime configuration from config
	freqtradeVersion := "stable"
	if fv, ok := strategy.Config["freqtrade_version"].(string); ok && fv != "" {
		freqtradeVersion = fv
	}

	dataSource := "download"
	if ds, ok := strategy.Config["data_source"].(string); ok {
		dataSource = ds
	}

	dataPath := ""
	if dp, ok := strategy.Config["data_path"].(string); ok {
		dataPath = dp
	}

	// Create a copy of the config to avoid mutating the original
	config := make(map[string]interface{})
	for k, v := range strategy.Config {
		config[k] = v
	}

	// Set data format to JSON (matching data download format)
	config["dataformat_ohlcv"] = "json"

	// Build timerange from start_date and end_date if provided
	// Freqtrade expects format: "YYYYMMDD-YYYYMMDD" (e.g., "20240101-20241231")
	if !bt.StartDate.IsZero() && !bt.EndDate.IsZero() {
		startStr := bt.StartDate.Format("20060102") // Go time format for YYYYMMDD
		endStr := bt.EndDate.Format("20060102")
		timerange := fmt.Sprintf("%s-%s", startStr, endStr)
		config["timerange"] = timerange
	}

	// Build BacktestSpec - config contains everything (pairs, timeframe, stake_amount, etc.)
	spec := &runner.BacktestSpec{
		ID:               bt.ID.String(),
		StrategyName:     strategy.Name,
		StrategyCode:     strategy.Code,
		Config:           config,
		FreqtradeVersion: freqtradeVersion,
		Environment:      make(map[string]string),
		DataSource:       dataSource,
		DataPath:         dataPath,
	}

	return spec, nil
}
