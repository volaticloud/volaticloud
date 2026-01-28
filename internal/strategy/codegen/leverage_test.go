package codegen

import (
	"encoding/json"
	"strings"
	"testing"
)

// Helper to create a LeverageConfig from JSON
func mustParseLeverageConfig(t *testing.T, jsonStr string) *LeverageConfig {
	t.Helper()
	var config LeverageConfig
	if err := json.Unmarshal([]byte(jsonStr), &config); err != nil {
		t.Fatalf("failed to parse leverage config JSON: %v", err)
	}
	return &config
}

func TestGenerateLeverage_DefaultOnly(t *testing.T) {
	g := NewGenerator()

	config := mustParseLeverageConfig(t, `{
		"enabled": true,
		"rules": [],
		"default_leverage": 3.0
	}`)

	result, err := g.generateLeverage(config)
	if err != nil {
		t.Fatalf("generateLeverage() error = %v", err)
	}

	// Check method signature
	if !strings.Contains(result, "def leverage(self, pair: str") {
		t.Error("Expected leverage method signature")
	}

	// Should have is_short helper
	if !strings.Contains(result, "is_short = (side == 'short')") {
		t.Error("Expected is_short helper variable")
	}

	// Should have default leverage
	if !strings.Contains(result, "return min(3.0, max_leverage)") {
		t.Errorf("Expected default leverage of 3.0, got %q", result)
	}

	// Should NOT have dataframe access (no indicator-based rules)
	if strings.Contains(result, "get_analyzed_dataframe") {
		t.Error("Should not include dataframe access for simple config")
	}
}

func TestGenerateLeverage_WithMaxLeverage(t *testing.T) {
	g := NewGenerator()

	config := mustParseLeverageConfig(t, `{
		"enabled": true,
		"rules": [],
		"default_leverage": 5.0,
		"max_leverage": 10.0
	}`)

	result, err := g.generateLeverage(config)
	if err != nil {
		t.Fatalf("generateLeverage() error = %v", err)
	}

	// Should include max leverage cap
	if !strings.Contains(result, "min(max_leverage, 10.0)") {
		t.Errorf("Expected max leverage cap, got %q", result)
	}
}

func TestGenerateLeverage_IsShortRule(t *testing.T) {
	g := NewGenerator()

	config := mustParseLeverageConfig(t, `{
		"enabled": true,
		"rules": [{
			"id": "rule1",
			"label": "Short positions",
			"priority": 10,
			"condition": {
				"type": "COMPARE",
				"left": {"type": "TRADE_CONTEXT", "field": "is_short"},
				"operator": "eq",
				"right": {"type": "CONSTANT", "value": 1}
			},
			"leverage": {
				"type": "CONSTANT",
				"value": 2.0
			}
		}],
		"default_leverage": 5.0
	}`)

	result, err := g.generateLeverage(config)
	if err != nil {
		t.Fatalf("generateLeverage() error = %v", err)
	}

	// Check for rule label
	if !strings.Contains(result, "# Short positions") {
		t.Error("Expected rule label in comments")
	}

	// Check for is_short condition
	if !strings.Contains(result, "if is_short == 1") {
		t.Errorf("Expected is_short condition, got %q", result)
	}

	// Check for leverage value
	if !strings.Contains(result, "return min(2.0, max_leverage)") {
		t.Errorf("Expected leverage 2.0 for short, got %q", result)
	}
}

func TestGenerateLeverage_IndicatorBasedRule(t *testing.T) {
	g := NewGenerator()

	config := mustParseLeverageConfig(t, `{
		"enabled": true,
		"rules": [{
			"id": "rule1",
			"label": "High RSI",
			"priority": 5,
			"condition": {
				"type": "COMPARE",
				"left": {"type": "INDICATOR", "indicatorId": "rsi_14"},
				"operator": "gt",
				"right": {"type": "CONSTANT", "value": 70}
			},
			"leverage": {
				"type": "CONSTANT",
				"value": 1.0
			}
		}],
		"default_leverage": 3.0
	}`)

	result, err := g.generateLeverage(config)
	if err != nil {
		t.Fatalf("generateLeverage() error = %v", err)
	}

	// Should have dataframe access for indicator-based condition
	if !strings.Contains(result, "get_analyzed_dataframe") {
		t.Error("Expected dataframe access for indicator-based rule")
	}

	if !strings.Contains(result, "last_candle = dataframe.iloc[-1]") {
		t.Error("Expected last_candle assignment")
	}

	// Check for RSI condition
	if !strings.Contains(result, "last_candle['rsi_14'] > 70") {
		t.Errorf("Expected RSI condition, got %q", result)
	}
}

func TestGenerateLeverage_MultipleRulesPriority(t *testing.T) {
	g := NewGenerator()

	config := mustParseLeverageConfig(t, `{
		"enabled": true,
		"rules": [
			{
				"id": "rule1",
				"label": "Low priority",
				"priority": 1,
				"condition": {
					"type": "COMPARE",
					"left": {"type": "TRADE_CONTEXT", "field": "is_short"},
					"operator": "eq",
					"right": {"type": "CONSTANT", "value": 1}
				},
				"leverage": {"type": "CONSTANT", "value": 2.0}
			},
			{
				"id": "rule2",
				"label": "High priority",
				"priority": 10,
				"condition": {
					"type": "COMPARE",
					"left": {"type": "TRADE_CONTEXT", "field": "is_short"},
					"operator": "eq",
					"right": {"type": "CONSTANT", "value": 0}
				},
				"leverage": {"type": "CONSTANT", "value": 5.0}
			}
		],
		"default_leverage": 3.0
	}`)

	result, err := g.generateLeverage(config)
	if err != nil {
		t.Fatalf("generateLeverage() error = %v", err)
	}

	// High priority rule (priority 10) should appear BEFORE low priority rule (priority 1)
	highPriorityIdx := strings.Index(result, "# High priority (priority 10)")
	lowPriorityIdx := strings.Index(result, "# Low priority (priority 1)")

	if highPriorityIdx == -1 || lowPriorityIdx == -1 {
		t.Fatal("Expected both rule labels in output")
	}

	if highPriorityIdx > lowPriorityIdx {
		t.Error("High priority rule should appear before low priority rule")
	}
}

func TestGenerateLeverage_DisabledRule(t *testing.T) {
	g := NewGenerator()

	config := mustParseLeverageConfig(t, `{
		"enabled": true,
		"rules": [{
			"id": "rule1",
			"label": "Disabled rule",
			"priority": 10,
			"disabled": true,
			"condition": {
				"type": "COMPARE",
				"left": {"type": "TRADE_CONTEXT", "field": "is_short"},
				"operator": "eq",
				"right": {"type": "CONSTANT", "value": 1}
			},
			"leverage": {"type": "CONSTANT", "value": 2.0}
		}],
		"default_leverage": 3.0
	}`)

	result, err := g.generateLeverage(config)
	if err != nil {
		t.Fatalf("generateLeverage() error = %v", err)
	}

	// Disabled rule should NOT appear in output
	if strings.Contains(result, "Disabled rule") {
		t.Error("Disabled rule should not appear in output")
	}

	// Should only have default leverage
	if !strings.Contains(result, "return min(3.0, max_leverage)") {
		t.Error("Should have default leverage")
	}
}

func TestGenerateLeverage_TimeBasedCondition(t *testing.T) {
	g := NewGenerator()

	config := mustParseLeverageConfig(t, `{
		"enabled": true,
		"rules": [{
			"id": "rule1",
			"label": "Weekend rule",
			"priority": 5,
			"condition": {
				"type": "COMPARE",
				"left": {"type": "TIME", "field": "is_weekend"},
				"operator": "eq",
				"right": {"type": "CONSTANT", "value": 1}
			},
			"leverage": {"type": "CONSTANT", "value": 1.0}
		}],
		"default_leverage": 3.0
	}`)

	result, err := g.generateLeverage(config)
	if err != nil {
		t.Fatalf("generateLeverage() error = %v", err)
	}

	// Should have weekend check
	if !strings.Contains(result, "(current_time.weekday() >= 5)") {
		t.Errorf("Expected weekend check, got %q", result)
	}
}

func TestGenerateLeverage_ANDCondition(t *testing.T) {
	g := NewGenerator()

	config := mustParseLeverageConfig(t, `{
		"enabled": true,
		"rules": [{
			"id": "rule1",
			"label": "Combined condition",
			"priority": 5,
			"condition": {
				"type": "AND",
				"children": [
					{
						"type": "COMPARE",
						"left": {"type": "TRADE_CONTEXT", "field": "is_short"},
						"operator": "eq",
						"right": {"type": "CONSTANT", "value": 1}
					},
					{
						"type": "COMPARE",
						"left": {"type": "INDICATOR", "indicatorId": "rsi_14"},
						"operator": "gt",
						"right": {"type": "CONSTANT", "value": 70}
					}
				]
			},
			"leverage": {"type": "CONSTANT", "value": 1.0}
		}],
		"default_leverage": 3.0
	}`)

	result, err := g.generateLeverage(config)
	if err != nil {
		t.Fatalf("generateLeverage() error = %v", err)
	}

	// Should have AND condition
	if !strings.Contains(result, " and ") {
		t.Error("Expected AND condition")
	}

	// Should have both conditions
	if !strings.Contains(result, "is_short == 1") {
		t.Error("Expected is_short condition")
	}
	if !strings.Contains(result, "last_candle['rsi_14'] > 70") {
		t.Error("Expected RSI condition")
	}
}

func TestGenerateLeverage_ExpressionValue(t *testing.T) {
	g := NewGenerator()

	config := mustParseLeverageConfig(t, `{
		"enabled": true,
		"rules": [{
			"id": "rule1",
			"label": "Dynamic leverage",
			"priority": 5,
			"leverage": {
				"type": "EXPRESSION",
				"operand": {"type": "INDICATOR", "indicatorId": "atr_14"},
				"min": 1.0,
				"max": 10.0
			}
		}],
		"default_leverage": 3.0
	}`)

	result, err := g.generateLeverage(config)
	if err != nil {
		t.Fatalf("generateLeverage() error = %v", err)
	}

	// Should have dataframe access for expression operand
	if !strings.Contains(result, "get_analyzed_dataframe") {
		t.Error("Expected dataframe access for expression-based leverage")
	}

	// Should have min/max bounds
	if !strings.Contains(result, "max(1.0,") {
		t.Errorf("Expected min bound, got %q", result)
	}
	if !strings.Contains(result, "min(10.0,") {
		t.Errorf("Expected max bound, got %q", result)
	}
}

func TestSortRulesByPriority(t *testing.T) {
	rules := []LeverageRule{
		{ID: "a", Priority: 1},
		{ID: "b", Priority: 10},
		{ID: "c", Priority: 5},
	}

	sorted := sortRulesByPriority(rules)

	if sorted[0].ID != "b" || sorted[0].Priority != 10 {
		t.Errorf("Expected first rule to have priority 10, got %d", sorted[0].Priority)
	}
	if sorted[1].ID != "c" || sorted[1].Priority != 5 {
		t.Errorf("Expected second rule to have priority 5, got %d", sorted[1].Priority)
	}
	if sorted[2].ID != "a" || sorted[2].Priority != 1 {
		t.Errorf("Expected third rule to have priority 1, got %d", sorted[2].Priority)
	}

	// Original should be unchanged
	if rules[0].ID != "a" {
		t.Error("Original rules array should be unchanged")
	}
}

func TestLeverageNeedsDataframe(t *testing.T) {
	g := NewGenerator()

	tests := []struct {
		name string
		json string
		want bool
	}{
		{
			name: "No rules - no dataframe needed",
			json: `{
				"rules": [],
				"default_leverage": 3.0
			}`,
			want: false,
		},
		{
			name: "Trade context only - no dataframe needed",
			json: `{
				"rules": [{
					"condition": {
						"type": "COMPARE",
						"left": {"type": "TRADE_CONTEXT", "field": "is_short"},
						"operator": "eq",
						"right": {"type": "CONSTANT", "value": 1}
					},
					"leverage": {"type": "CONSTANT", "value": 2.0}
				}],
				"default_leverage": 3.0
			}`,
			want: false,
		},
		{
			name: "Indicator condition - needs dataframe",
			json: `{
				"rules": [{
					"condition": {
						"type": "COMPARE",
						"left": {"type": "INDICATOR", "indicatorId": "rsi_14"},
						"operator": "gt",
						"right": {"type": "CONSTANT", "value": 70}
					},
					"leverage": {"type": "CONSTANT", "value": 1.0}
				}],
				"default_leverage": 3.0
			}`,
			want: true,
		},
		{
			name: "Expression leverage with indicator - needs dataframe",
			json: `{
				"rules": [{
					"leverage": {
						"type": "EXPRESSION",
						"operand": {"type": "INDICATOR", "indicatorId": "atr_14"}
					}
				}],
				"default_leverage": 3.0
			}`,
			want: true,
		},
		{
			name: "Disabled rule with indicator - no dataframe needed",
			json: `{
				"rules": [{
					"disabled": true,
					"condition": {
						"type": "COMPARE",
						"left": {"type": "INDICATOR", "indicatorId": "rsi_14"},
						"operator": "gt",
						"right": {"type": "CONSTANT", "value": 70}
					},
					"leverage": {"type": "CONSTANT", "value": 1.0}
				}],
				"default_leverage": 3.0
			}`,
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := mustParseLeverageConfig(t, tt.json)
			got := g.leverageNeedsDataframe(config)
			if got != tt.want {
				t.Errorf("leverageNeedsDataframe() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestGenerateLeverage_ORCondition(t *testing.T) {
	g := NewGenerator()

	config := mustParseLeverageConfig(t, `{
		"enabled": true,
		"rules": [{
			"id": "rule1",
			"label": "OR condition",
			"priority": 5,
			"condition": {
				"type": "OR",
				"children": [
					{
						"type": "COMPARE",
						"left": {"type": "TRADE_CONTEXT", "field": "is_short"},
						"operator": "eq",
						"right": {"type": "CONSTANT", "value": 1}
					},
					{
						"type": "COMPARE",
						"left": {"type": "INDICATOR", "indicatorId": "rsi_14"},
						"operator": "lt",
						"right": {"type": "CONSTANT", "value": 30}
					}
				]
			},
			"leverage": {"type": "CONSTANT", "value": 2.0}
		}],
		"default_leverage": 3.0
	}`)

	result, err := g.generateLeverage(config)
	if err != nil {
		t.Fatalf("generateLeverage() error = %v", err)
	}

	// Should have OR condition
	if !strings.Contains(result, " or ") {
		t.Error("Expected OR condition")
	}
}

func TestGenerateLeverage_NOTCondition(t *testing.T) {
	g := NewGenerator()

	config := mustParseLeverageConfig(t, `{
		"enabled": true,
		"rules": [{
			"id": "rule1",
			"label": "NOT condition",
			"priority": 5,
			"condition": {
				"type": "NOT",
				"child": {
					"type": "COMPARE",
					"left": {"type": "TRADE_CONTEXT", "field": "is_short"},
					"operator": "eq",
					"right": {"type": "CONSTANT", "value": 1}
				}
			},
			"leverage": {"type": "CONSTANT", "value": 5.0}
		}],
		"default_leverage": 3.0
	}`)

	result, err := g.generateLeverage(config)
	if err != nil {
		t.Fatalf("generateLeverage() error = %v", err)
	}

	// Should have NOT condition
	if !strings.Contains(result, "not (") {
		t.Error("Expected NOT condition")
	}
}

func TestGenerateLeverage_InRangeCondition(t *testing.T) {
	g := NewGenerator()

	config := mustParseLeverageConfig(t, `{
		"enabled": true,
		"rules": [{
			"id": "rule1",
			"label": "RSI in range",
			"priority": 5,
			"condition": {
				"type": "IN_RANGE",
				"value": {"type": "INDICATOR", "indicatorId": "rsi_14"},
				"min": {"type": "CONSTANT", "value": 30},
				"max": {"type": "CONSTANT", "value": 70},
				"inclusive": true
			},
			"leverage": {"type": "CONSTANT", "value": 3.0}
		}],
		"default_leverage": 2.0
	}`)

	result, err := g.generateLeverage(config)
	if err != nil {
		t.Fatalf("generateLeverage() error = %v", err)
	}

	// Should have range check with inclusive bounds
	if !strings.Contains(result, ">= 30") {
		t.Errorf("Expected >= 30 for inclusive min, got %q", result)
	}
	if !strings.Contains(result, "<= 70") {
		t.Errorf("Expected <= 70 for inclusive max, got %q", result)
	}
}

func TestGenerateLeverage_CatchAllRule(t *testing.T) {
	g := NewGenerator()

	config := mustParseLeverageConfig(t, `{
		"enabled": true,
		"rules": [
			{
				"id": "rule1",
				"label": "Conditional rule",
				"priority": 10,
				"condition": {
					"type": "COMPARE",
					"left": {"type": "TRADE_CONTEXT", "field": "is_short"},
					"operator": "eq",
					"right": {"type": "CONSTANT", "value": 1}
				},
				"leverage": {"type": "CONSTANT", "value": 2.0}
			},
			{
				"id": "rule2",
				"label": "Catch-all",
				"priority": 1,
				"leverage": {"type": "CONSTANT", "value": 5.0}
			}
		],
		"default_leverage": 3.0
	}`)

	result, err := g.generateLeverage(config)
	if err != nil {
		t.Fatalf("generateLeverage() error = %v", err)
	}

	// Should have catch-all comment
	if !strings.Contains(result, "Catch-all rule (no condition)") {
		t.Errorf("Expected catch-all comment, got %q", result)
	}
}

func TestGenerateLeverage_IfThenElse(t *testing.T) {
	g := NewGenerator()

	config := mustParseLeverageConfig(t, `{
		"enabled": true,
		"rules": [
			{
				"id": "rule1",
				"label": "If-Then-Else rule",
				"priority": 10,
				"condition": {
					"type": "IF_THEN_ELSE",
					"condition": {
						"type": "COMPARE",
						"left": {"type": "TRADE_CONTEXT", "field": "is_short"},
						"operator": "eq",
						"right": {"type": "CONSTANT", "value": true}
					},
					"then": {
						"type": "COMPARE",
						"left": {"type": "TRADE_CONTEXT", "field": "current_rate"},
						"operator": "gt",
						"right": {"type": "CONSTANT", "value": 50000}
					},
					"else": {
						"type": "COMPARE",
						"left": {"type": "TRADE_CONTEXT", "field": "current_rate"},
						"operator": "lt",
						"right": {"type": "CONSTANT", "value": 30000}
					}
				},
				"leverage": {"type": "CONSTANT", "value": 5.0}
			}
		],
		"default_leverage": 3.0
	}`)

	result, err := g.generateLeverage(config)
	if err != nil {
		t.Fatalf("generateLeverage() error = %v", err)
	}

	// Should contain Python ternary expression
	if !strings.Contains(result, "if") || !strings.Contains(result, "else") {
		t.Errorf("Expected Python ternary (if/else), got %q", result)
	}

	// Should contain is_short and current_rate
	if !strings.Contains(result, "is_short") {
		t.Errorf("Expected is_short in condition, got %q", result)
	}
	if !strings.Contains(result, "current_rate") {
		t.Errorf("Expected current_rate in condition, got %q", result)
	}
}

func TestGenerateLeverage_Crossover(t *testing.T) {
	g := NewGenerator()

	// Register indicators
	g.SetIndicators([]IndicatorDefinition{
		{ID: "rsi_1", Type: "RSI"},
		{ID: "sma_1", Type: "SMA"},
	})

	config := mustParseLeverageConfig(t, `{
		"enabled": true,
		"rules": [
			{
				"id": "rule1",
				"label": "Crossover rule",
				"priority": 10,
				"condition": {
					"type": "CROSSOVER",
					"series1": {"type": "INDICATOR", "indicator_id": "rsi_1"},
					"series2": {"type": "CONSTANT", "value": 30}
				},
				"leverage": {"type": "CONSTANT", "value": 5.0}
			}
		],
		"default_leverage": 3.0
	}`)

	result, err := g.generateLeverage(config)
	if err != nil {
		t.Fatalf("generateLeverage() error = %v", err)
	}

	// Should require at least 2 candles for crossover
	if !strings.Contains(result, "if len(dataframe) < 2:") {
		t.Errorf("Expected check for at least 2 candles, got %q", result)
	}

	// Should have prev_candle for crossover
	if !strings.Contains(result, "prev_candle = dataframe.iloc[-2]") {
		t.Errorf("Expected prev_candle assignment, got %q", result)
	}

	// Should have last_candle
	if !strings.Contains(result, "last_candle = dataframe.iloc[-1]") {
		t.Errorf("Expected last_candle assignment, got %q", result)
	}
}

func TestGenerateLeverage_Crossunder(t *testing.T) {
	g := NewGenerator()

	// Register indicators
	g.SetIndicators([]IndicatorDefinition{
		{ID: "rsi_1", Type: "RSI"},
	})

	config := mustParseLeverageConfig(t, `{
		"enabled": true,
		"rules": [
			{
				"id": "rule1",
				"label": "Crossunder rule",
				"priority": 10,
				"condition": {
					"type": "CROSSUNDER",
					"series1": {"type": "INDICATOR", "indicator_id": "rsi_1"},
					"series2": {"type": "CONSTANT", "value": 70}
				},
				"leverage": {"type": "CONSTANT", "value": 2.0}
			}
		],
		"default_leverage": 3.0
	}`)

	result, err := g.generateLeverage(config)
	if err != nil {
		t.Fatalf("generateLeverage() error = %v", err)
	}

	// Should have prev_candle for crossunder
	if !strings.Contains(result, "prev_candle") {
		t.Errorf("Expected prev_candle for crossunder, got %q", result)
	}
}
