package codegen

import (
	"encoding/json"
	"testing"
)

func TestInvertOperator(t *testing.T) {
	tests := []struct {
		input    ComparisonOperator
		expected ComparisonOperator
	}{
		{OperatorGt, OperatorLt},
		{OperatorGte, OperatorLte},
		{OperatorLt, OperatorGt},
		{OperatorLte, OperatorGte},
		// eq and neq stay the same
		{OperatorEq, OperatorEq},
		{OperatorNeq, OperatorNeq},
		// in and not_in stay the same
		{OperatorIn, OperatorIn},
		{OperatorNotIn, OperatorNotIn},
	}

	for _, tt := range tests {
		t.Run(string(tt.input), func(t *testing.T) {
			result := invertOperator(tt.input)
			if result != tt.expected {
				t.Errorf("invertOperator(%s) = %s, want %s", tt.input, result, tt.expected)
			}
		})
	}
}

func TestApplyMirrorConfig_Disabled(t *testing.T) {
	config := &UIBuilderConfig{
		PositionMode: PositionModeLongAndShort,
		Long: &SignalConfig{
			EntryConditions: mustParseConditionNode(`{"type": "AND", "children": []}`),
			ExitConditions:  mustParseConditionNode(`{"type": "AND", "children": []}`),
		},
		MirrorConfig: &MirrorConfig{
			Enabled: false,
			Source:  SignalDirectionLong,
		},
	}

	result, err := ApplyMirrorConfig(config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Short should not be created when mirroring is disabled
	if result.Short != nil {
		t.Error("expected Short to be nil when mirroring is disabled")
	}
}

func TestApplyMirrorConfig_LongToShort(t *testing.T) {
	config := &UIBuilderConfig{
		PositionMode: PositionModeLongAndShort,
		Long: &SignalConfig{
			EntryConditions: mustParseConditionNode(`{
				"id": "entry",
				"type": "COMPARE",
				"left": {"type": "INDICATOR", "indicatorId": "rsi_1"},
				"operator": "lt",
				"right": {"type": "CONSTANT", "value": 30}
			}`),
			ExitConditions: mustParseConditionNode(`{
				"id": "exit",
				"type": "CROSSOVER",
				"series1": {"type": "INDICATOR", "indicatorId": "ema_fast"},
				"series2": {"type": "INDICATOR", "indicatorId": "ema_slow"}
			}`),
		},
		MirrorConfig: &MirrorConfig{
			Enabled:           true,
			Source:            SignalDirectionLong,
			InvertComparisons: true,
			InvertCrossovers:  true,
		},
	}

	result, err := ApplyMirrorConfig(config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Short == nil {
		t.Fatal("expected Short to be created from mirroring")
	}

	// Check entry was inverted (lt -> gt)
	shortEntryNode, err := result.Short.EntryConditions.AsCompareNode()
	if err != nil {
		t.Fatalf("failed to parse short entry as compare node: %v", err)
	}
	if shortEntryNode.Operator != OperatorGt {
		t.Errorf("expected inverted operator gt, got %s", shortEntryNode.Operator)
	}

	// Check exit was inverted (CROSSOVER -> CROSSUNDER)
	shortExitType, err := result.Short.ExitConditions.GetNodeType()
	if err != nil {
		t.Fatalf("failed to get short exit node type: %v", err)
	}
	if shortExitType != NodeTypeCROSSUNDER {
		t.Errorf("expected inverted node type CROSSUNDER, got %s", shortExitType)
	}
}

func TestApplyMirrorConfig_ShortToLong(t *testing.T) {
	config := &UIBuilderConfig{
		PositionMode: PositionModeLongAndShort,
		Short: &SignalConfig{
			EntryConditions: mustParseConditionNode(`{
				"id": "entry",
				"type": "COMPARE",
				"left": {"type": "INDICATOR", "indicatorId": "rsi_1"},
				"operator": "gt",
				"right": {"type": "CONSTANT", "value": 70}
			}`),
			ExitConditions: mustParseConditionNode(`{
				"id": "exit",
				"type": "CROSSUNDER",
				"series1": {"type": "INDICATOR", "indicatorId": "ema_fast"},
				"series2": {"type": "INDICATOR", "indicatorId": "ema_slow"}
			}`),
		},
		MirrorConfig: &MirrorConfig{
			Enabled:           true,
			Source:            SignalDirectionShort,
			InvertComparisons: true,
			InvertCrossovers:  true,
		},
	}

	result, err := ApplyMirrorConfig(config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Long == nil {
		t.Fatal("expected Long to be created from mirroring")
	}

	// Check entry was inverted (gt -> lt)
	longEntryNode, err := result.Long.EntryConditions.AsCompareNode()
	if err != nil {
		t.Fatalf("failed to parse long entry as compare node: %v", err)
	}
	if longEntryNode.Operator != OperatorLt {
		t.Errorf("expected inverted operator lt, got %s", longEntryNode.Operator)
	}

	// Check exit was inverted (CROSSUNDER -> CROSSOVER)
	longExitType, err := result.Long.ExitConditions.GetNodeType()
	if err != nil {
		t.Fatalf("failed to get long exit node type: %v", err)
	}
	if longExitType != NodeTypeCROSSOVER {
		t.Errorf("expected inverted node type CROSSOVER, got %s", longExitType)
	}
}

func TestApplyMirrorConfig_NoInversion(t *testing.T) {
	config := &UIBuilderConfig{
		PositionMode: PositionModeLongAndShort,
		Long: &SignalConfig{
			EntryConditions: mustParseConditionNode(`{
				"id": "entry",
				"type": "COMPARE",
				"left": {"type": "INDICATOR", "indicatorId": "rsi_1"},
				"operator": "lt",
				"right": {"type": "CONSTANT", "value": 30}
			}`),
			ExitConditions: mustParseConditionNode(`{
				"id": "exit",
				"type": "CROSSOVER",
				"series1": {"type": "INDICATOR", "indicatorId": "ema_fast"},
				"series2": {"type": "INDICATOR", "indicatorId": "ema_slow"}
			}`),
		},
		MirrorConfig: &MirrorConfig{
			Enabled:           true,
			Source:            SignalDirectionLong,
			InvertComparisons: false, // Don't invert
			InvertCrossovers:  false, // Don't invert
		},
	}

	result, err := ApplyMirrorConfig(config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Short == nil {
		t.Fatal("expected Short to be created from mirroring")
	}

	// Check entry was NOT inverted (still lt)
	shortEntryNode, err := result.Short.EntryConditions.AsCompareNode()
	if err != nil {
		t.Fatalf("failed to parse short entry as compare node: %v", err)
	}
	if shortEntryNode.Operator != OperatorLt {
		t.Errorf("expected non-inverted operator lt, got %s", shortEntryNode.Operator)
	}

	// Check exit was NOT inverted (still CROSSOVER)
	shortExitType, err := result.Short.ExitConditions.GetNodeType()
	if err != nil {
		t.Fatalf("failed to get short exit node type: %v", err)
	}
	if shortExitType != NodeTypeCROSSOVER {
		t.Errorf("expected non-inverted node type CROSSOVER, got %s", shortExitType)
	}
}

func TestInvertConditionNode_NestedAnd(t *testing.T) {
	node := mustParseConditionNode(`{
		"id": "root",
		"type": "AND",
		"children": [
			{
				"id": "cond1",
				"type": "COMPARE",
				"left": {"type": "INDICATOR", "indicatorId": "rsi_1"},
				"operator": "lt",
				"right": {"type": "CONSTANT", "value": 30}
			},
			{
				"id": "cond2",
				"type": "COMPARE",
				"left": {"type": "INDICATOR", "indicatorId": "adx_1"},
				"operator": "gt",
				"right": {"type": "CONSTANT", "value": 25}
			}
		]
	}`)

	mc := &MirrorConfig{
		InvertComparisons: true,
		InvertCrossovers:  true,
	}

	inverted := invertConditionNode(node, mc)

	andNode, err := inverted.AsAndNode()
	if err != nil {
		t.Fatalf("failed to parse inverted as AND node: %v", err)
	}

	if len(andNode.Children) != 2 {
		t.Errorf("expected 2 children, got %d", len(andNode.Children))
	}

	// Check first child was inverted (lt -> gt)
	child1, err := andNode.Children[0].AsCompareNode()
	if err != nil {
		t.Fatalf("failed to parse child1 as compare node: %v", err)
	}
	if child1.Operator != OperatorGt {
		t.Errorf("expected child1 operator gt, got %s", child1.Operator)
	}

	// Check second child was inverted (gt -> lt)
	child2, err := andNode.Children[1].AsCompareNode()
	if err != nil {
		t.Fatalf("failed to parse child2 as compare node: %v", err)
	}
	if child2.Operator != OperatorLt {
		t.Errorf("expected child2 operator lt, got %s", child2.Operator)
	}
}

func TestInvertConditionNode_InRange(t *testing.T) {
	// IN_RANGE should not be inverted
	node := mustParseConditionNode(`{
		"id": "range",
		"type": "IN_RANGE",
		"value": {"type": "INDICATOR", "indicatorId": "rsi_1"},
		"min": {"type": "CONSTANT", "value": 30},
		"max": {"type": "CONSTANT", "value": 70},
		"inclusive": true
	}`)

	mc := &MirrorConfig{
		InvertComparisons: true,
		InvertCrossovers:  true,
	}

	inverted := invertConditionNode(node, mc)

	// Should still be IN_RANGE
	nodeType, err := inverted.GetNodeType()
	if err != nil {
		t.Fatalf("failed to get node type: %v", err)
	}
	if nodeType != NodeTypeInRange {
		t.Errorf("expected IN_RANGE node type, got %s", nodeType)
	}
}

func TestApplyMirrorConfig_NilConfig(t *testing.T) {
	result, err := ApplyMirrorConfig(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != nil {
		t.Error("expected nil for nil input")
	}
}

func TestApplyMirrorConfig_NilMirrorConfig(t *testing.T) {
	config := &UIBuilderConfig{
		PositionMode: PositionModeLongOnly,
		Long: &SignalConfig{
			EntryConditions: mustParseConditionNode(`{"type": "AND", "children": []}`),
			ExitConditions:  mustParseConditionNode(`{"type": "AND", "children": []}`),
		},
	}

	result, err := ApplyMirrorConfig(config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Should return unchanged
	if result.Short != nil {
		t.Error("expected Short to be nil when mirror config is nil")
	}
}

func TestApplyMirrorConfig_NilSourceConditions(t *testing.T) {
	// Test that mirroring returns error when source direction has no conditions
	tests := []struct {
		name     string
		config   *UIBuilderConfig
		wantErr  string
	}{
		{
			name: "LONG source with nil Long",
			config: &UIBuilderConfig{
				PositionMode: PositionModeLongAndShort,
				Long:         nil, // No conditions
				MirrorConfig: &MirrorConfig{
					Enabled: true,
					Source:  SignalDirectionLong,
				},
			},
			wantErr: "mirror source LONG has no conditions defined",
		},
		{
			name: "SHORT source with nil Short",
			config: &UIBuilderConfig{
				PositionMode: PositionModeLongAndShort,
				Short:        nil, // No conditions
				MirrorConfig: &MirrorConfig{
					Enabled: true,
					Source:  SignalDirectionShort,
				},
			},
			wantErr: "mirror source SHORT has no conditions defined",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ApplyMirrorConfig(tt.config)
			if err == nil {
				t.Errorf("expected error but got nil")
				return
			}
			if err.Error() != tt.wantErr {
				t.Errorf("expected error %q, got %q", tt.wantErr, err.Error())
			}
		})
	}
}

// Helper to parse a condition node from JSON string
func mustParseConditionNode(jsonStr string) ConditionNode {
	var node ConditionNode
	if err := json.Unmarshal([]byte(jsonStr), &node); err != nil {
		panic("failed to parse condition node: " + err.Error())
	}
	return node
}
