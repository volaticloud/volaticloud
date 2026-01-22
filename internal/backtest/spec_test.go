package backtest

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"volaticloud/internal/ent"
	"volaticloud/internal/enum"
)

func TestBuildSpec_DryRunAlwaysTrue(t *testing.T) {
	// Test that dry_run is always true even if user provides dry_run: false
	bt := &ent.Backtest{
		ID:        uuid.New(),
		StartDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC),
		Config: map[string]interface{}{
			"dry_run": false, // User tries to set dry_run to false
		},
		Edges: ent.BacktestEdges{
			Strategy: &ent.Strategy{
				ID:          uuid.New(),
				Name:        "TestStrategy",
				Code:        "class TestStrategy(IStrategy): pass",
				BuilderMode: enum.StrategyBuilderModeCode,
				Config:      map[string]interface{}{},
			},
		},
	}

	spec, err := BuildSpec(bt)
	require.NoError(t, err)

	// dry_run must always be true
	assert.Equal(t, true, spec.BacktestConfig["dry_run"])
}

func TestBuildSpec_TimerangeFormat(t *testing.T) {
	// Test that timerange is formatted correctly: YYYYMMDD-YYYYMMDD
	bt := &ent.Backtest{
		ID:        uuid.New(),
		StartDate: time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2024, 6, 30, 0, 0, 0, 0, time.UTC),
		Config:    map[string]interface{}{},
		Edges: ent.BacktestEdges{
			Strategy: &ent.Strategy{
				ID:          uuid.New(),
				Name:        "TestStrategy",
				Code:        "class TestStrategy(IStrategy): pass",
				BuilderMode: enum.StrategyBuilderModeCode,
				Config:      map[string]interface{}{},
			},
		},
	}

	spec, err := BuildSpec(bt)
	require.NoError(t, err)

	// Check timerange format
	assert.Equal(t, "20240115-20240630", spec.StrategyConfig["timerange"])
}

func TestBuildSpec_ConfigMerging(t *testing.T) {
	// Test that strategy config and backtest config are properly separated
	strategyConfig := map[string]interface{}{
		"timeframe":    "5m",
		"stake_amount": 100.0,
	}
	backtestConfig := map[string]interface{}{
		"exchange": map[string]interface{}{
			"name":           "binance",
			"pair_whitelist": []string{"BTC/USDT"},
		},
	}

	bt := &ent.Backtest{
		ID:        uuid.New(),
		StartDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC),
		Config:    backtestConfig,
		Edges: ent.BacktestEdges{
			Strategy: &ent.Strategy{
				ID:          uuid.New(),
				Name:        "TestStrategy",
				Code:        "class TestStrategy(IStrategy): pass",
				BuilderMode: enum.StrategyBuilderModeCode,
				Config:      strategyConfig,
			},
		},
	}

	spec, err := BuildSpec(bt)
	require.NoError(t, err)

	// Strategy config should contain strategy fields
	assert.Equal(t, "5m", spec.StrategyConfig["timeframe"])
	assert.Equal(t, 100.0, spec.StrategyConfig["stake_amount"])

	// Backtest config should contain backtest fields
	exchange := spec.BacktestConfig["exchange"].(map[string]interface{})
	assert.Equal(t, "binance", exchange["name"])

	// dry_run should always be true in backtest config
	assert.Equal(t, true, spec.BacktestConfig["dry_run"])
}

func TestBuildSpec_MissingStrategy(t *testing.T) {
	// Test that missing strategy returns error
	bt := &ent.Backtest{
		ID:     uuid.New(),
		Config: map[string]interface{}{},
		Edges:  ent.BacktestEdges{}, // No strategy
	}

	_, err := BuildSpec(bt)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no strategy")
}

func TestBuildSpec_NilStrategyConfig(t *testing.T) {
	// Test that nil strategy config is handled gracefully
	bt := &ent.Backtest{
		ID:        uuid.New(),
		StartDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC),
		Config:    map[string]interface{}{},
		Edges: ent.BacktestEdges{
			Strategy: &ent.Strategy{
				ID:          uuid.New(),
				Name:        "TestStrategy",
				Code:        "class TestStrategy(IStrategy): pass",
				BuilderMode: enum.StrategyBuilderModeCode,
				Config:      nil, // Nil config
			},
		},
	}

	spec, err := BuildSpec(bt)
	require.NoError(t, err)
	assert.NotNil(t, spec.StrategyConfig)
}

func TestBuildSpec_FreqtradeVersion(t *testing.T) {
	// Test that freqtrade_version is extracted from strategy config
	bt := &ent.Backtest{
		ID:        uuid.New(),
		StartDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC),
		Config:    map[string]interface{}{},
		Edges: ent.BacktestEdges{
			Strategy: &ent.Strategy{
				ID:          uuid.New(),
				Name:        "TestStrategy",
				Code:        "class TestStrategy(IStrategy): pass",
				BuilderMode: enum.StrategyBuilderModeCode,
				Config: map[string]interface{}{
					"freqtrade_version": "2024.1",
				},
			},
		},
	}

	spec, err := BuildSpec(bt)
	require.NoError(t, err)
	assert.Equal(t, "2024.1", spec.FreqtradeVersion)
}

func TestBuildSpec_DefaultFreqtradeVersion(t *testing.T) {
	// Test that default freqtrade_version is "stable"
	bt := &ent.Backtest{
		ID:        uuid.New(),
		StartDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC),
		Config:    map[string]interface{}{},
		Edges: ent.BacktestEdges{
			Strategy: &ent.Strategy{
				ID:          uuid.New(),
				Name:        "TestStrategy",
				Code:        "class TestStrategy(IStrategy): pass",
				BuilderMode: enum.StrategyBuilderModeCode,
				Config:      map[string]interface{}{}, // No freqtrade_version
			},
		},
	}

	spec, err := BuildSpec(bt)
	require.NoError(t, err)
	assert.Equal(t, "stable", spec.FreqtradeVersion)
}

func TestBuildSpec_DataFormatOHLCV(t *testing.T) {
	// Test that dataformat_ohlcv is always set to "json"
	bt := &ent.Backtest{
		ID:        uuid.New(),
		StartDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC),
		Config:    map[string]interface{}{},
		Edges: ent.BacktestEdges{
			Strategy: &ent.Strategy{
				ID:          uuid.New(),
				Name:        "TestStrategy",
				Code:        "class TestStrategy(IStrategy): pass",
				BuilderMode: enum.StrategyBuilderModeCode,
				Config:      map[string]interface{}{},
			},
		},
	}

	spec, err := BuildSpec(bt)
	require.NoError(t, err)
	assert.Equal(t, "json", spec.StrategyConfig["dataformat_ohlcv"])
}

func TestBuildSpec_ZeroDates(t *testing.T) {
	// Test that zero dates don't add timerange
	bt := &ent.Backtest{
		ID:     uuid.New(),
		Config: map[string]interface{}{},
		// StartDate and EndDate are zero values
		Edges: ent.BacktestEdges{
			Strategy: &ent.Strategy{
				ID:          uuid.New(),
				Name:        "TestStrategy",
				Code:        "class TestStrategy(IStrategy): pass",
				BuilderMode: enum.StrategyBuilderModeCode,
				Config:      map[string]interface{}{},
			},
		},
	}

	spec, err := BuildSpec(bt)
	require.NoError(t, err)
	_, hasTimerange := spec.StrategyConfig["timerange"]
	assert.False(t, hasTimerange, "timerange should not be set when dates are zero")
}
