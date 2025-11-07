package backtest

import "time"

// BacktestSummary represents a typed summary of key backtest metrics.
// This provides type-safe access to commonly used metrics without parsing the full result JSON.
// GraphQL type is defined in internal/graph/schema.graphqls and auto-mapped via gqlgen autobind.
type BacktestSummary struct {
	StrategyName   string     `json:"strategyName"`
	TotalTrades    int        `json:"totalTrades"`
	Wins           int        `json:"wins"`
	Losses         int        `json:"losses"`
	ProfitTotalAbs float64    `json:"profitTotalAbs"`
	ProfitTotal    float64    `json:"profitTotal"`
	ProfitMean     *float64   `json:"profitMean,omitempty"`
	WinRate        *float64   `json:"winRate,omitempty"`
	MaxDrawdown    *float64   `json:"maxDrawdown,omitempty"`
	ProfitFactor   *float64   `json:"profitFactor,omitempty"`
	Expectancy     *float64   `json:"expectancy,omitempty"`
	Sharpe         *float64   `json:"sharpe,omitempty"`
	Sortino        *float64   `json:"sortino,omitempty"`
	Calmar         *float64   `json:"calmar,omitempty"`
	AvgStakeAmount *float64   `json:"avgStakeAmount,omitempty"`
	StakeCurrency  string     `json:"stakeCurrency"`
	BacktestStart  *time.Time `json:"backtestStart,omitempty"`
	BacktestEnd    *time.Time `json:"backtestEnd,omitempty"`
	BacktestDays   *int       `json:"backtestDays,omitempty"`
}

// ExtractSummaryFromResult extracts a typed summary from Freqtrade backtest result JSON
func ExtractSummaryFromResult(result map[string]interface{}) (*BacktestSummary, error) {
	// Navigate to strategy data
	strategyMap, ok := result["strategy"].(map[string]interface{})
	if !ok || len(strategyMap) == 0 {
		return nil, nil // No strategy data available
	}

	// Get first (and usually only) strategy
	var strategyName string
	var strategyData map[string]interface{}
	for name, data := range strategyMap {
		strategyName = name
		strategyData, ok = data.(map[string]interface{})
		if !ok {
			return nil, nil
		}
		break
	}

	// Extract required fields
	summary := &BacktestSummary{
		StrategyName:   strategyName,
		TotalTrades:    getInt(strategyData, "total_trades"),
		Wins:           getInt(strategyData, "wins"),
		Losses:         getInt(strategyData, "losses"),
		ProfitTotalAbs: getFloat(strategyData, "profit_total_abs"),
		ProfitTotal:    getFloat(strategyData, "profit_total"),
		StakeCurrency:  getString(strategyData, "stake_currency"),
	}

	// Extract optional fields
	summary.ProfitMean = getFloatPtr(strategyData, "profit_mean")
	summary.WinRate = getFloatPtr(strategyData, "winrate")
	summary.MaxDrawdown = getFloatPtr(strategyData, "max_drawdown")
	summary.ProfitFactor = getFloatPtr(strategyData, "profit_factor")
	summary.Expectancy = getFloatPtr(strategyData, "expectancy")
	summary.Sharpe = getFloatPtr(strategyData, "sharpe")
	summary.Sortino = getFloatPtr(strategyData, "sortino")
	summary.Calmar = getFloatPtr(strategyData, "calmar")
	summary.AvgStakeAmount = getFloatPtr(strategyData, "avg_stake_amount")

	// Extract timestamps
	if startStr := getString(strategyData, "backtest_start"); startStr != "" {
		if t, err := time.Parse("2006-01-02 15:04:05", startStr); err == nil {
			summary.BacktestStart = &t
		}
	}
	if endStr := getString(strategyData, "backtest_end"); endStr != "" {
		if t, err := time.Parse("2006-01-02 15:04:05", endStr); err == nil {
			summary.BacktestEnd = &t
		}
	}

	days := getInt(strategyData, "backtest_days")
	if days > 0 {
		summary.BacktestDays = &days
	}

	return summary, nil
}

// Helper functions for safe type extraction

func getInt(m map[string]interface{}, key string) int {
	if v, ok := m[key]; ok {
		switch val := v.(type) {
		case int:
			return val
		case int64:
			return int(val)
		case float64:
			return int(val)
		}
	}
	return 0
}

func getFloat(m map[string]interface{}, key string) float64 {
	if v, ok := m[key]; ok {
		switch val := v.(type) {
		case float64:
			return val
		case int:
			return float64(val)
		case int64:
			return float64(val)
		}
	}
	return 0.0
}

func getFloatPtr(m map[string]interface{}, key string) *float64 {
	if v, ok := m[key]; ok {
		switch val := v.(type) {
		case float64:
			return &val
		case int:
			f := float64(val)
			return &f
		case int64:
			f := float64(val)
			return &f
		}
	}
	return nil
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if str, ok := v.(string); ok {
			return str
		}
	}
	return ""
}
