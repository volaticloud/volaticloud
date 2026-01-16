package codegen

import (
	"encoding/json"
	"strings"
	"testing"
)

// Helper to create a ConditionNode from JSON
func mustParseCondition(t *testing.T, jsonStr string) *ConditionNode {
	t.Helper()
	var node ConditionNode
	if err := json.Unmarshal([]byte(jsonStr), &node); err != nil {
		t.Fatalf("failed to parse condition JSON: %v", err)
	}
	return &node
}

// Helper to create an Operand from JSON
func mustParseOperand(t *testing.T, jsonStr string) *Operand {
	t.Helper()
	var op Operand
	if err := json.Unmarshal([]byte(jsonStr), &op); err != nil {
		t.Fatalf("failed to parse operand JSON: %v", err)
	}
	return &op
}

func TestGenerateCondition_Compare(t *testing.T) {
	tests := []struct {
		name     string
		json     string
		expected string
		wantErr  bool
	}{
		{
			name: "RSI less than constant",
			json: `{
				"id": "rsi_check",
				"type": "COMPARE",
				"left": {"type": "INDICATOR", "indicatorId": "rsi_1"},
				"operator": "lt",
				"right": {"type": "CONSTANT", "value": 30}
			}`,
			expected: "dataframe['rsi_1'] < 30",
		},
		{
			name: "price greater than or equal indicator",
			json: `{
				"id": "price_check",
				"type": "COMPARE",
				"left": {"type": "PRICE", "field": "close"},
				"operator": "gte",
				"right": {"type": "INDICATOR", "indicatorId": "ema_20"}
			}`,
			expected: "dataframe['close'] >= dataframe['ema_20']",
		},
		{
			name: "indicator equals constant",
			json: `{
				"id": "eq_check",
				"type": "COMPARE",
				"left": {"type": "INDICATOR", "indicatorId": "adx_1"},
				"operator": "eq",
				"right": {"type": "CONSTANT", "value": 25}
			}`,
			expected: "dataframe['adx_1'] == 25",
		},
		{
			name: "indicator not equals constant",
			json: `{
				"id": "neq_check",
				"type": "COMPARE",
				"left": {"type": "INDICATOR", "indicatorId": "rsi_1"},
				"operator": "neq",
				"right": {"type": "CONSTANT", "value": 50}
			}`,
			expected: "dataframe['rsi_1'] != 50",
		},
		{
			name: "indicator greater than constant",
			json: `{
				"id": "gt_check",
				"type": "COMPARE",
				"left": {"type": "INDICATOR", "indicatorId": "adx_1"},
				"operator": "gt",
				"right": {"type": "CONSTANT", "value": 20}
			}`,
			expected: "dataframe['adx_1'] > 20",
		},
		{
			name: "indicator less than or equal constant",
			json: `{
				"id": "lte_check",
				"type": "COMPARE",
				"left": {"type": "INDICATOR", "indicatorId": "rsi_1"},
				"operator": "lte",
				"right": {"type": "CONSTANT", "value": 70}
			}`,
			expected: "dataframe['rsi_1'] <= 70",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			g := NewGenerator()
			node := mustParseCondition(t, tt.json)

			result, err := g.GenerateCondition(node)
			if (err != nil) != tt.wantErr {
				t.Errorf("GenerateCondition() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if result != tt.expected {
				t.Errorf("GenerateCondition() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestGenerateCondition_And(t *testing.T) {
	tests := []struct {
		name     string
		json     string
		expected string
	}{
		{
			name: "empty AND",
			json: `{
				"id": "empty_and",
				"type": "AND",
				"children": []
			}`,
			expected: "True",
		},
		{
			name: "single child AND",
			json: `{
				"id": "single_and",
				"type": "AND",
				"children": [
					{
						"id": "rsi_check",
						"type": "COMPARE",
						"left": {"type": "INDICATOR", "indicatorId": "rsi_1"},
						"operator": "lt",
						"right": {"type": "CONSTANT", "value": 30}
					}
				]
			}`,
			expected: "(dataframe['rsi_1'] < 30)",
		},
		{
			name: "multiple children AND",
			json: `{
				"id": "multi_and",
				"type": "AND",
				"children": [
					{
						"id": "rsi_check",
						"type": "COMPARE",
						"left": {"type": "INDICATOR", "indicatorId": "rsi_1"},
						"operator": "lt",
						"right": {"type": "CONSTANT", "value": 30}
					},
					{
						"id": "macd_check",
						"type": "COMPARE",
						"left": {"type": "INDICATOR", "indicatorId": "macd_1", "field": "histogram"},
						"operator": "gt",
						"right": {"type": "CONSTANT", "value": 0}
					}
				]
			}`,
			expected: "(dataframe['rsi_1'] < 30) & (dataframe['macd_1_histogram'] > 0)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			g := NewGenerator()
			node := mustParseCondition(t, tt.json)

			result, err := g.GenerateCondition(node)
			if err != nil {
				t.Errorf("GenerateCondition() error = %v", err)
				return
			}

			if result != tt.expected {
				t.Errorf("GenerateCondition() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestGenerateCondition_Or(t *testing.T) {
	tests := []struct {
		name     string
		json     string
		expected string
	}{
		{
			name: "empty OR",
			json: `{
				"id": "empty_or",
				"type": "OR",
				"children": []
			}`,
			expected: "False",
		},
		{
			name: "multiple children OR",
			json: `{
				"id": "multi_or",
				"type": "OR",
				"children": [
					{
						"id": "rsi_oversold",
						"type": "COMPARE",
						"left": {"type": "INDICATOR", "indicatorId": "rsi_1"},
						"operator": "lt",
						"right": {"type": "CONSTANT", "value": 30}
					},
					{
						"id": "rsi_overbought",
						"type": "COMPARE",
						"left": {"type": "INDICATOR", "indicatorId": "rsi_1"},
						"operator": "gt",
						"right": {"type": "CONSTANT", "value": 70}
					}
				]
			}`,
			expected: "(dataframe['rsi_1'] < 30) | (dataframe['rsi_1'] > 70)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			g := NewGenerator()
			node := mustParseCondition(t, tt.json)

			result, err := g.GenerateCondition(node)
			if err != nil {
				t.Errorf("GenerateCondition() error = %v", err)
				return
			}

			if result != tt.expected {
				t.Errorf("GenerateCondition() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestGenerateCondition_Not(t *testing.T) {
	json := `{
		"id": "not_overbought",
		"type": "NOT",
		"child": {
			"id": "overbought",
			"type": "COMPARE",
			"left": {"type": "INDICATOR", "indicatorId": "rsi_1"},
			"operator": "gt",
			"right": {"type": "CONSTANT", "value": 70}
		}
	}`

	g := NewGenerator()
	node := mustParseCondition(t, json)

	result, err := g.GenerateCondition(node)
	if err != nil {
		t.Errorf("GenerateCondition() error = %v", err)
		return
	}

	expected := "~(dataframe['rsi_1'] > 70)"
	if result != expected {
		t.Errorf("GenerateCondition() = %q, want %q", result, expected)
	}
}

func TestGenerateCondition_IfThenElse(t *testing.T) {
	tests := []struct {
		name     string
		json     string
		contains []string // Check contains instead of exact match due to np.where formatting
	}{
		{
			name: "if-then-else with else",
			json: `{
				"id": "trend_entry",
				"type": "IF_THEN_ELSE",
				"condition": {
					"id": "adx_check",
					"type": "COMPARE",
					"left": {"type": "INDICATOR", "indicatorId": "adx_1"},
					"operator": "gt",
					"right": {"type": "CONSTANT", "value": 25}
				},
				"then": {
					"id": "strong_trend",
					"type": "COMPARE",
					"left": {"type": "INDICATOR", "indicatorId": "rsi_1"},
					"operator": "lt",
					"right": {"type": "CONSTANT", "value": 30}
				},
				"else": {
					"id": "weak_trend",
					"type": "COMPARE",
					"left": {"type": "INDICATOR", "indicatorId": "rsi_1"},
					"operator": "lt",
					"right": {"type": "CONSTANT", "value": 20}
				}
			}`,
			contains: []string{"np.where", "dataframe['adx_1'] > 25", "dataframe['rsi_1'] < 30", "dataframe['rsi_1'] < 20"},
		},
		{
			name: "if-then without else",
			json: `{
				"id": "simple_if",
				"type": "IF_THEN_ELSE",
				"condition": {
					"id": "adx_check",
					"type": "COMPARE",
					"left": {"type": "INDICATOR", "indicatorId": "adx_1"},
					"operator": "gt",
					"right": {"type": "CONSTANT", "value": 25}
				},
				"then": {
					"id": "strong_trend",
					"type": "COMPARE",
					"left": {"type": "INDICATOR", "indicatorId": "rsi_1"},
					"operator": "lt",
					"right": {"type": "CONSTANT", "value": 30}
				}
			}`,
			contains: []string{"np.where", "dataframe['adx_1'] > 25", "dataframe['rsi_1'] < 30", "False"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			g := NewGenerator()
			node := mustParseCondition(t, tt.json)

			result, err := g.GenerateCondition(node)
			if err != nil {
				t.Errorf("GenerateCondition() error = %v", err)
				return
			}

			for _, c := range tt.contains {
				if !strings.Contains(result, c) {
					t.Errorf("GenerateCondition() = %q, expected to contain %q", result, c)
				}
			}

			// Verify numpy import was tracked
			imports := g.GetRequiredImports()
			hasNumpy := false
			for _, imp := range imports {
				if imp == "numpy" {
					hasNumpy = true
					break
				}
			}
			if !hasNumpy {
				t.Error("IF_THEN_ELSE should require numpy import")
			}
		})
	}
}

func TestGenerateCondition_Crossover(t *testing.T) {
	json := `{
		"id": "ema_crossover",
		"type": "CROSSOVER",
		"series1": {"type": "INDICATOR", "indicatorId": "ema_fast"},
		"series2": {"type": "INDICATOR", "indicatorId": "ema_slow"}
	}`

	g := NewGenerator()
	node := mustParseCondition(t, json)

	result, err := g.GenerateCondition(node)
	if err != nil {
		t.Errorf("GenerateCondition() error = %v", err)
		return
	}

	expected := "qtpylib.crossed_above(dataframe['ema_fast'], dataframe['ema_slow'])"
	if result != expected {
		t.Errorf("GenerateCondition() = %q, want %q", result, expected)
	}

	// Verify qtpylib import was tracked
	imports := g.GetRequiredImports()
	hasQtpylib := false
	for _, imp := range imports {
		if imp == "qtpylib" {
			hasQtpylib = true
			break
		}
	}
	if !hasQtpylib {
		t.Error("CROSSOVER should require qtpylib import")
	}
}

func TestGenerateCondition_Crossunder(t *testing.T) {
	json := `{
		"id": "ema_crossunder",
		"type": "CROSSUNDER",
		"series1": {"type": "INDICATOR", "indicatorId": "ema_fast"},
		"series2": {"type": "INDICATOR", "indicatorId": "ema_slow"}
	}`

	g := NewGenerator()
	node := mustParseCondition(t, json)

	result, err := g.GenerateCondition(node)
	if err != nil {
		t.Errorf("GenerateCondition() error = %v", err)
		return
	}

	expected := "qtpylib.crossed_below(dataframe['ema_fast'], dataframe['ema_slow'])"
	if result != expected {
		t.Errorf("GenerateCondition() = %q, want %q", result, expected)
	}
}

func TestGenerateCondition_InRange(t *testing.T) {
	tests := []struct {
		name     string
		json     string
		expected string
	}{
		{
			name: "inclusive range",
			json: `{
				"id": "rsi_range",
				"type": "IN_RANGE",
				"value": {"type": "INDICATOR", "indicatorId": "rsi_1"},
				"min": {"type": "CONSTANT", "value": 30},
				"max": {"type": "CONSTANT", "value": 70},
				"inclusive": true
			}`,
			expected: "(dataframe['rsi_1'] >= 30) & (dataframe['rsi_1'] <= 70)",
		},
		{
			name: "exclusive range",
			json: `{
				"id": "rsi_range_exclusive",
				"type": "IN_RANGE",
				"value": {"type": "INDICATOR", "indicatorId": "rsi_1"},
				"min": {"type": "CONSTANT", "value": 30},
				"max": {"type": "CONSTANT", "value": 70},
				"inclusive": false
			}`,
			expected: "(dataframe['rsi_1'] > 30) & (dataframe['rsi_1'] < 70)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			g := NewGenerator()
			node := mustParseCondition(t, tt.json)

			result, err := g.GenerateCondition(node)
			if err != nil {
				t.Errorf("GenerateCondition() error = %v", err)
				return
			}

			if result != tt.expected {
				t.Errorf("GenerateCondition() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestGenerateOperand_Constant(t *testing.T) {
	tests := []struct {
		name     string
		json     string
		expected string
	}{
		{
			name:     "integer constant",
			json:     `{"type": "CONSTANT", "value": 30}`,
			expected: "30",
		},
		{
			name:     "float constant",
			json:     `{"type": "CONSTANT", "value": 0.05}`,
			expected: "0.05",
		},
		{
			name:     "string constant",
			json:     `{"type": "CONSTANT", "value": "test"}`,
			expected: `"test"`,
		},
		{
			name:     "boolean true",
			json:     `{"type": "CONSTANT", "value": true}`,
			expected: "True",
		},
		{
			name:     "boolean false",
			json:     `{"type": "CONSTANT", "value": false}`,
			expected: "False",
		},
		{
			name:     "null constant",
			json:     `{"type": "CONSTANT", "value": null}`,
			expected: "None",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			g := NewGenerator()
			op := mustParseOperand(t, tt.json)

			result, err := g.GenerateOperand(op)
			if err != nil {
				t.Errorf("GenerateOperand() error = %v", err)
				return
			}

			if result != tt.expected {
				t.Errorf("GenerateOperand() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestGenerateOperand_Indicator(t *testing.T) {
	tests := []struct {
		name     string
		json     string
		expected string
	}{
		{
			name:     "simple indicator",
			json:     `{"type": "INDICATOR", "indicatorId": "rsi_1"}`,
			expected: "dataframe['rsi_1']",
		},
		{
			name:     "indicator with field",
			json:     `{"type": "INDICATOR", "indicatorId": "macd_1", "field": "histogram"}`,
			expected: "dataframe['macd_1_histogram']",
		},
		{
			name:     "indicator with offset",
			json:     `{"type": "INDICATOR", "indicatorId": "rsi_1", "offset": 1}`,
			expected: "dataframe['rsi_1'].shift(1)",
		},
		{
			name:     "indicator with field and offset",
			json:     `{"type": "INDICATOR", "indicatorId": "macd_1", "field": "signal", "offset": 2}`,
			expected: "dataframe['macd_1_signal'].shift(2)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			g := NewGenerator()
			op := mustParseOperand(t, tt.json)

			result, err := g.GenerateOperand(op)
			if err != nil {
				t.Errorf("GenerateOperand() error = %v", err)
				return
			}

			if result != tt.expected {
				t.Errorf("GenerateOperand() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestGenerateOperand_Price(t *testing.T) {
	tests := []struct {
		name     string
		json     string
		expected string
	}{
		{
			name:     "close price",
			json:     `{"type": "PRICE", "field": "close"}`,
			expected: "dataframe['close']",
		},
		{
			name:     "high price",
			json:     `{"type": "PRICE", "field": "high"}`,
			expected: "dataframe['high']",
		},
		{
			name:     "volume",
			json:     `{"type": "PRICE", "field": "volume"}`,
			expected: "dataframe['volume']",
		},
		{
			name:     "ohlc4",
			json:     `{"type": "PRICE", "field": "ohlc4"}`,
			expected: "(dataframe['open'] + dataframe['high'] + dataframe['low'] + dataframe['close']) / 4",
		},
		{
			name:     "hlc3",
			json:     `{"type": "PRICE", "field": "hlc3"}`,
			expected: "(dataframe['high'] + dataframe['low'] + dataframe['close']) / 3",
		},
		{
			name:     "hl2",
			json:     `{"type": "PRICE", "field": "hl2"}`,
			expected: "(dataframe['high'] + dataframe['low']) / 2",
		},
		{
			name:     "close with offset",
			json:     `{"type": "PRICE", "field": "close", "offset": 1}`,
			expected: "dataframe['close'].shift(1)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			g := NewGenerator()
			op := mustParseOperand(t, tt.json)

			result, err := g.GenerateOperand(op)
			if err != nil {
				t.Errorf("GenerateOperand() error = %v", err)
				return
			}

			if result != tt.expected {
				t.Errorf("GenerateOperand() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestGenerateOperand_TradeContext(t *testing.T) {
	tests := []struct {
		name     string
		json     string
		expected string
	}{
		{
			name:     "current profit",
			json:     `{"type": "TRADE_CONTEXT", "field": "current_profit"}`,
			expected: "current_profit",
		},
		{
			name:     "current profit percentage",
			json:     `{"type": "TRADE_CONTEXT", "field": "current_profit_pct"}`,
			expected: "(current_profit * 100)",
		},
		{
			name:     "entry rate",
			json:     `{"type": "TRADE_CONTEXT", "field": "entry_rate"}`,
			expected: "trade.open_rate",
		},
		{
			name:     "current rate",
			json:     `{"type": "TRADE_CONTEXT", "field": "current_rate"}`,
			expected: "current_rate",
		},
		{
			name:     "number of entries",
			json:     `{"type": "TRADE_CONTEXT", "field": "nr_of_entries"}`,
			expected: "trade.nr_of_successful_entries",
		},
		{
			name:     "is short",
			json:     `{"type": "TRADE_CONTEXT", "field": "is_short"}`,
			expected: "trade.is_short",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			g := NewGenerator()
			op := mustParseOperand(t, tt.json)

			result, err := g.GenerateOperand(op)
			if err != nil {
				t.Errorf("GenerateOperand() error = %v", err)
				return
			}

			if result != tt.expected {
				t.Errorf("GenerateOperand() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestGenerateOperand_Time(t *testing.T) {
	tests := []struct {
		name     string
		json     string
		expected string
	}{
		{
			name:     "hour",
			json:     `{"type": "TIME", "field": "hour"}`,
			expected: "dataframe['date'].dt.hour",
		},
		{
			name:     "day of week",
			json:     `{"type": "TIME", "field": "day_of_week"}`,
			expected: "dataframe['date'].dt.dayofweek",
		},
		{
			name:     "is weekend",
			json:     `{"type": "TIME", "field": "is_weekend"}`,
			expected: "(dataframe['date'].dt.dayofweek >= 5)",
		},
		{
			name:     "month",
			json:     `{"type": "TIME", "field": "month"}`,
			expected: "dataframe['date'].dt.month",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			g := NewGenerator()
			op := mustParseOperand(t, tt.json)

			result, err := g.GenerateOperand(op)
			if err != nil {
				t.Errorf("GenerateOperand() error = %v", err)
				return
			}

			if result != tt.expected {
				t.Errorf("GenerateOperand() = %q, want %q", result, tt.expected)
			}

			// Verify pandas import
			imports := g.GetRequiredImports()
			hasPandas := false
			for _, imp := range imports {
				if imp == "pandas" {
					hasPandas = true
					break
				}
			}
			if !hasPandas {
				t.Error("TIME operand should require pandas import")
			}
		})
	}
}

func TestGenerateOperand_Computed(t *testing.T) {
	tests := []struct {
		name     string
		json     string
		expected string
	}{
		{
			name: "addition",
			json: `{
				"type": "COMPUTED",
				"operation": "add",
				"operands": [
					{"type": "INDICATOR", "indicatorId": "ema_10"},
					{"type": "CONSTANT", "value": 5}
				]
			}`,
			expected: "(dataframe['ema_10'] + 5)",
		},
		{
			name: "subtraction",
			json: `{
				"type": "COMPUTED",
				"operation": "subtract",
				"operands": [
					{"type": "PRICE", "field": "close"},
					{"type": "INDICATOR", "indicatorId": "ema_20"}
				]
			}`,
			expected: "(dataframe['close'] - dataframe['ema_20'])",
		},
		{
			name: "multiplication",
			json: `{
				"type": "COMPUTED",
				"operation": "multiply",
				"operands": [
					{"type": "INDICATOR", "indicatorId": "atr_14"},
					{"type": "CONSTANT", "value": 2}
				]
			}`,
			expected: "(dataframe['atr_14'] * 2)",
		},
		{
			name: "division",
			json: `{
				"type": "COMPUTED",
				"operation": "divide",
				"operands": [
					{"type": "INDICATOR", "indicatorId": "macd_1", "field": "histogram"},
					{"type": "INDICATOR", "indicatorId": "atr_14"}
				]
			}`,
			expected: "(dataframe['macd_1_histogram'] / dataframe['atr_14'])",
		},
		{
			name: "absolute value",
			json: `{
				"type": "COMPUTED",
				"operation": "abs",
				"operands": [
					{"type": "INDICATOR", "indicatorId": "macd_1", "field": "histogram"}
				]
			}`,
			expected: "abs(dataframe['macd_1_histogram'])",
		},
		{
			name: "round",
			json: `{
				"type": "COMPUTED",
				"operation": "round",
				"operands": [
					{"type": "INDICATOR", "indicatorId": "rsi_1"}
				]
			}`,
			expected: "np.round(dataframe['rsi_1'])",
		},
		{
			name: "floor",
			json: `{
				"type": "COMPUTED",
				"operation": "floor",
				"operands": [
					{"type": "PRICE", "field": "close"}
				]
			}`,
			expected: "np.floor(dataframe['close'])",
		},
		{
			name: "ceil",
			json: `{
				"type": "COMPUTED",
				"operation": "ceil",
				"operands": [
					{"type": "INDICATOR", "indicatorId": "atr_14"}
				]
			}`,
			expected: "np.ceil(dataframe['atr_14'])",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			g := NewGenerator()
			op := mustParseOperand(t, tt.json)

			result, err := g.GenerateOperand(op)
			if err != nil {
				t.Errorf("GenerateOperand() error = %v", err)
				return
			}

			if result != tt.expected {
				t.Errorf("GenerateOperand() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestGenerateCondition_NestedComplex(t *testing.T) {
	// Test complex nested condition: (RSI < 30 AND MACD > 0) OR (EMA crossover AND NOT RSI > 70)
	json := `{
		"id": "complex_entry",
		"type": "OR",
		"children": [
			{
				"id": "oversold_bullish",
				"type": "AND",
				"children": [
					{
						"id": "rsi_oversold",
						"type": "COMPARE",
						"left": {"type": "INDICATOR", "indicatorId": "rsi_1"},
						"operator": "lt",
						"right": {"type": "CONSTANT", "value": 30}
					},
					{
						"id": "macd_positive",
						"type": "COMPARE",
						"left": {"type": "INDICATOR", "indicatorId": "macd_1", "field": "histogram"},
						"operator": "gt",
						"right": {"type": "CONSTANT", "value": 0}
					}
				]
			},
			{
				"id": "trend_reversal",
				"type": "AND",
				"children": [
					{
						"id": "ema_crossover",
						"type": "CROSSOVER",
						"series1": {"type": "INDICATOR", "indicatorId": "ema_fast"},
						"series2": {"type": "INDICATOR", "indicatorId": "ema_slow"}
					},
					{
						"id": "not_overbought",
						"type": "NOT",
						"child": {
							"id": "overbought",
							"type": "COMPARE",
							"left": {"type": "INDICATOR", "indicatorId": "rsi_1"},
							"operator": "gt",
							"right": {"type": "CONSTANT", "value": 70}
						}
					}
				]
			}
		]
	}`

	g := NewGenerator()
	node := mustParseCondition(t, json)

	result, err := g.GenerateCondition(node)
	if err != nil {
		t.Fatalf("GenerateCondition() error = %v", err)
	}

	// Verify key components are present
	expectedParts := []string{
		"dataframe['rsi_1'] < 30",
		"dataframe['macd_1_histogram'] > 0",
		"qtpylib.crossed_above(dataframe['ema_fast'], dataframe['ema_slow'])",
		"~(dataframe['rsi_1'] > 70)",
		"&", // AND operator
		"|", // OR operator
	}

	for _, part := range expectedParts {
		if !strings.Contains(result, part) {
			t.Errorf("GenerateCondition() result should contain %q, got %q", part, result)
		}
	}
}

func TestGenerator_ResetImports(t *testing.T) {
	g := NewGenerator()

	// Generate something that adds imports
	node := mustParseCondition(t, `{
		"id": "crossover",
		"type": "CROSSOVER",
		"series1": {"type": "INDICATOR", "indicatorId": "ema_fast"},
		"series2": {"type": "INDICATOR", "indicatorId": "ema_slow"}
	}`)

	_, err := g.GenerateCondition(node)
	if err != nil {
		t.Fatalf("GenerateCondition() error = %v", err)
	}

	if len(g.GetRequiredImports()) == 0 {
		t.Error("Expected imports after generating CROSSOVER")
	}

	// Reset and verify cleared
	g.ResetImports()
	if len(g.GetRequiredImports()) != 0 {
		t.Error("Expected no imports after reset")
	}
}

func TestGenerateCondition_UnknownNodeType(t *testing.T) {
	json := `{
		"id": "unknown",
		"type": "UNKNOWN_TYPE"
	}`

	g := NewGenerator()
	node := mustParseCondition(t, json)

	_, err := g.GenerateCondition(node)
	if err == nil {
		t.Error("Expected error for unknown node type")
	}
	// GraphQL generated types validate enum values during JSON unmarshal
	// Error message is "UNKNOWN_TYPE is not a valid ConditionNodeType"
	if !strings.Contains(err.Error(), "not a valid ConditionNodeType") && !strings.Contains(err.Error(), "unknown node type") {
		t.Errorf("Expected 'not a valid ConditionNodeType' or 'unknown node type' error, got: %v", err)
	}
}

func TestGenerateOperand_UnknownOperandType(t *testing.T) {
	json := `{"type": "UNKNOWN_OPERAND"}`

	g := NewGenerator()
	op := mustParseOperand(t, json)

	_, err := g.GenerateOperand(op)
	if err == nil {
		t.Error("Expected error for unknown operand type")
	}
	// GraphQL generated types validate enum values during JSON unmarshal
	// Error message is "UNKNOWN_OPERAND is not a valid OperandType"
	if !strings.Contains(err.Error(), "not a valid OperandType") && !strings.Contains(err.Error(), "unsupported operand type") {
		t.Errorf("Expected 'not a valid OperandType' or 'unsupported operand type' error, got: %v", err)
	}
}
