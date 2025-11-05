package backtest

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExtractSummaryFromResult_Success(t *testing.T) {
	result := map[string]interface{}{
		"strategy": map[string]interface{}{
			"TestStrategy": map[string]interface{}{
				"total_trades":     27,
				"wins":             24,
				"losses":           3,
				"profit_total_abs": 7.96,
				"profit_total":     0.00796,
				"profit_mean":      0.003,
				"winrate":          0.8889,
				"max_drawdown":     0.0,
				"profit_factor":    1.58,
				"expectancy":       0.29,
				"sharpe":           1.5,
				"sortino":          2.1,
				"calmar":           3.2,
				"avg_stake_amount": 99.82,
				"stake_currency":   "USDT",
				"backtest_start":   "2024-11-01 00:00:00",
				"backtest_end":     "2024-11-30 23:59:59",
				"backtest_days":    30,
			},
		},
	}

	summary, err := ExtractSummaryFromResult(result)
	require.NoError(t, err)
	require.NotNil(t, summary)

	assert.Equal(t, "TestStrategy", summary.StrategyName)
	assert.Equal(t, 27, summary.TotalTrades)
	assert.Equal(t, 24, summary.Wins)
	assert.Equal(t, 3, summary.Losses)
	assert.Equal(t, 7.96, summary.ProfitTotalAbs)
	assert.Equal(t, 0.00796, summary.ProfitTotal)
	assert.Equal(t, "USDT", summary.StakeCurrency)

	// Optional fields
	require.NotNil(t, summary.ProfitMean)
	assert.Equal(t, 0.003, *summary.ProfitMean)
	require.NotNil(t, summary.WinRate)
	assert.Equal(t, 0.8889, *summary.WinRate)
	require.NotNil(t, summary.MaxDrawdown)
	assert.Equal(t, 0.0, *summary.MaxDrawdown)
	require.NotNil(t, summary.ProfitFactor)
	assert.Equal(t, 1.58, *summary.ProfitFactor)
	require.NotNil(t, summary.Expectancy)
	assert.Equal(t, 0.29, *summary.Expectancy)
	require.NotNil(t, summary.Sharpe)
	assert.Equal(t, 1.5, *summary.Sharpe)
	require.NotNil(t, summary.Sortino)
	assert.Equal(t, 2.1, *summary.Sortino)
	require.NotNil(t, summary.Calmar)
	assert.Equal(t, 3.2, *summary.Calmar)
	require.NotNil(t, summary.AvgStakeAmount)
	assert.Equal(t, 99.82, *summary.AvgStakeAmount)

	// Timestamps
	require.NotNil(t, summary.BacktestStart)
	expectedStart := time.Date(2024, 11, 1, 0, 0, 0, 0, time.UTC)
	assert.Equal(t, expectedStart, *summary.BacktestStart)

	require.NotNil(t, summary.BacktestEnd)
	expectedEnd := time.Date(2024, 11, 30, 23, 59, 59, 0, time.UTC)
	assert.Equal(t, expectedEnd, *summary.BacktestEnd)

	require.NotNil(t, summary.BacktestDays)
	assert.Equal(t, 30, *summary.BacktestDays)
}

func TestExtractSummaryFromResult_MinimalData(t *testing.T) {
	result := map[string]interface{}{
		"strategy": map[string]interface{}{
			"MinimalStrategy": map[string]interface{}{
				"total_trades":     0,
				"wins":             0,
				"losses":           0,
				"profit_total_abs": 0.0,
				"profit_total":     0.0,
				"stake_currency":   "BTC",
			},
		},
	}

	summary, err := ExtractSummaryFromResult(result)
	require.NoError(t, err)
	require.NotNil(t, summary)

	assert.Equal(t, "MinimalStrategy", summary.StrategyName)
	assert.Equal(t, 0, summary.TotalTrades)
	assert.Equal(t, 0, summary.Wins)
	assert.Equal(t, 0, summary.Losses)
	assert.Equal(t, 0.0, summary.ProfitTotalAbs)
	assert.Equal(t, 0.0, summary.ProfitTotal)
	assert.Equal(t, "BTC", summary.StakeCurrency)

	// Optional fields should be nil
	assert.Nil(t, summary.ProfitMean)
	assert.Nil(t, summary.WinRate)
	assert.Nil(t, summary.MaxDrawdown)
	assert.Nil(t, summary.ProfitFactor)
	assert.Nil(t, summary.Expectancy)
	assert.Nil(t, summary.BacktestStart)
	assert.Nil(t, summary.BacktestEnd)
	assert.Nil(t, summary.BacktestDays)
}

func TestExtractSummaryFromResult_NoStrategyData(t *testing.T) {
	tests := []struct {
		name   string
		result map[string]interface{}
	}{
		{
			name:   "nil result",
			result: nil,
		},
		{
			name:   "empty result",
			result: map[string]interface{}{},
		},
		{
			name: "no strategy key",
			result: map[string]interface{}{
				"other": "data",
			},
		},
		{
			name: "empty strategy map",
			result: map[string]interface{}{
				"strategy": map[string]interface{}{},
			},
		},
		{
			name: "strategy not a map",
			result: map[string]interface{}{
				"strategy": "invalid",
			},
		},
		{
			name: "strategy data not a map",
			result: map[string]interface{}{
				"strategy": map[string]interface{}{
					"TestStrategy": "invalid",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			summary, err := ExtractSummaryFromResult(tt.result)
			assert.NoError(t, err)
			assert.Nil(t, summary)
		})
	}
}

func TestExtractSummaryFromResult_TypeConversions(t *testing.T) {
	result := map[string]interface{}{
		"strategy": map[string]interface{}{
			"ConversionTest": map[string]interface{}{
				// Integer as float64 (common from JSON)
				"total_trades": float64(10),
				"wins":         float64(8),
				"losses":       float64(2),

				// Different number types
				"profit_total_abs": float64(100.5),
				"profit_total":     0.005,

				// Integer types
				"backtest_days": int(15),

				"stake_currency": "USD",
			},
		},
	}

	summary, err := ExtractSummaryFromResult(result)
	require.NoError(t, err)
	require.NotNil(t, summary)

	assert.Equal(t, 10, summary.TotalTrades)
	assert.Equal(t, 8, summary.Wins)
	assert.Equal(t, 2, summary.Losses)
	assert.Equal(t, 100.5, summary.ProfitTotalAbs)
	assert.Equal(t, 0.005, summary.ProfitTotal)

	require.NotNil(t, summary.BacktestDays)
	assert.Equal(t, 15, *summary.BacktestDays)
}

func TestExtractSummaryFromResult_InvalidTimestamps(t *testing.T) {
	result := map[string]interface{}{
		"strategy": map[string]interface{}{
			"TestStrategy": map[string]interface{}{
				"total_trades":     1,
				"wins":             1,
				"losses":           0,
				"profit_total_abs": 1.0,
				"profit_total":     0.01,
				"stake_currency":   "USDT",

				// Invalid timestamp formats
				"backtest_start": "invalid-date",
				"backtest_end":   "2024-13-99 25:99:99",
			},
		},
	}

	summary, err := ExtractSummaryFromResult(result)
	require.NoError(t, err)
	require.NotNil(t, summary)

	// Invalid timestamps should be nil (parsing fails gracefully)
	assert.Nil(t, summary.BacktestStart)
	assert.Nil(t, summary.BacktestEnd)

	// Other fields should still be extracted
	assert.Equal(t, "TestStrategy", summary.StrategyName)
	assert.Equal(t, 1, summary.TotalTrades)
}

func TestExtractSummaryFromResult_ZeroDays(t *testing.T) {
	result := map[string]interface{}{
		"strategy": map[string]interface{}{
			"TestStrategy": map[string]interface{}{
				"total_trades":     1,
				"wins":             1,
				"losses":           0,
				"profit_total_abs": 1.0,
				"profit_total":     0.01,
				"stake_currency":   "USDT",
				"backtest_days":    0, // Zero days should result in nil
			},
		},
	}

	summary, err := ExtractSummaryFromResult(result)
	require.NoError(t, err)
	require.NotNil(t, summary)

	// Zero days should be nil (not meaningful)
	assert.Nil(t, summary.BacktestDays)
}

func TestExtractSummaryFromResult_MultipleStrategies(t *testing.T) {
	result := map[string]interface{}{
		"strategy": map[string]interface{}{
			"Strategy1": map[string]interface{}{
				"total_trades":     10,
				"wins":             8,
				"losses":           2,
				"profit_total_abs": 100.0,
				"profit_total":     0.1,
				"stake_currency":   "USDT",
			},
			"Strategy2": map[string]interface{}{
				"total_trades":     20,
				"wins":             15,
				"losses":           5,
				"profit_total_abs": 200.0,
				"profit_total":     0.2,
				"stake_currency":   "BTC",
			},
		},
	}

	summary, err := ExtractSummaryFromResult(result)
	require.NoError(t, err)
	require.NotNil(t, summary)

	// Should extract the first strategy (order not guaranteed, but one should be extracted)
	assert.NotEmpty(t, summary.StrategyName)
	assert.True(t, summary.StrategyName == "Strategy1" || summary.StrategyName == "Strategy2")
	assert.Greater(t, summary.TotalTrades, 0)
}

func TestGetInt(t *testing.T) {
	tests := []struct {
		name     string
		m        map[string]interface{}
		key      string
		expected int
	}{
		{"int value", map[string]interface{}{"key": int(42)}, "key", 42},
		{"int64 value", map[string]interface{}{"key": int64(42)}, "key", 42},
		{"float64 value", map[string]interface{}{"key": float64(42.7)}, "key", 42},
		{"missing key", map[string]interface{}{}, "key", 0},
		{"wrong type", map[string]interface{}{"key": "string"}, "key", 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getInt(tt.m, tt.key)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestGetFloat(t *testing.T) {
	tests := []struct {
		name     string
		m        map[string]interface{}
		key      string
		expected float64
	}{
		{"float64 value", map[string]interface{}{"key": float64(42.5)}, "key", 42.5},
		{"int value", map[string]interface{}{"key": int(42)}, "key", 42.0},
		{"int64 value", map[string]interface{}{"key": int64(42)}, "key", 42.0},
		{"missing key", map[string]interface{}{}, "key", 0.0},
		{"wrong type", map[string]interface{}{"key": "string"}, "key", 0.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getFloat(tt.m, tt.key)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestGetFloatPtr(t *testing.T) {
	tests := []struct {
		name     string
		m        map[string]interface{}
		key      string
		expected *float64
	}{
		{
			"float64 value",
			map[string]interface{}{"key": float64(42.5)},
			"key",
			ptr(42.5),
		},
		{
			"int value",
			map[string]interface{}{"key": int(42)},
			"key",
			ptr(42.0),
		},
		{
			"missing key",
			map[string]interface{}{},
			"key",
			nil,
		},
		{
			"wrong type",
			map[string]interface{}{"key": "string"},
			"key",
			nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getFloatPtr(tt.m, tt.key)
			if tt.expected == nil {
				assert.Nil(t, result)
			} else {
				require.NotNil(t, result)
				assert.Equal(t, *tt.expected, *result)
			}
		})
	}
}

func TestGetString(t *testing.T) {
	tests := []struct {
		name     string
		m        map[string]interface{}
		key      string
		expected string
	}{
		{"string value", map[string]interface{}{"key": "value"}, "key", "value"},
		{"missing key", map[string]interface{}{}, "key", ""},
		{"wrong type", map[string]interface{}{"key": 42}, "key", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getString(tt.m, tt.key)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// Helper function for test assertions
func ptr(f float64) *float64 {
	return &f
}
