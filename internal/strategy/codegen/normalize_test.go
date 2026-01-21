package codegen

import (
	"encoding/json"
	"testing"
)

func TestNormalizeUIBuilderConfig_V1ToV2Migration(t *testing.T) {
	// V1 config with flat entry/exit conditions
	v1JSON := `{
		"version": 1,
		"indicators": [],
		"entry_conditions": {
			"id": "entry_1",
			"type": "AND",
			"children": []
		},
		"exit_conditions": {
			"id": "exit_1",
			"type": "AND",
			"children": []
		},
		"parameters": {
			"stoploss": -0.10,
			"minimal_roi": {"0": 0.10},
			"trailing_stop": false,
			"use_exit_signal": true
		},
		"callbacks": {}
	}`

	var config UIBuilderConfig
	if err := json.Unmarshal([]byte(v1JSON), &config); err != nil {
		t.Fatalf("failed to unmarshal v1 config: %v", err)
	}

	// Normalize should migrate to v2
	normalized := NormalizeUIBuilderConfig(&config)

	// Check version is now 2
	if normalized.Version != 2 {
		t.Errorf("expected version 2, got %d", normalized.Version)
	}

	// Check position_mode is set to LONG_ONLY
	if normalized.PositionMode != PositionModeLongOnly {
		t.Errorf("expected position_mode LONG_ONLY, got %s", normalized.PositionMode)
	}

	// Check Long signal config was created
	if normalized.Long == nil {
		t.Fatal("expected Long signal config to be created")
	}

	// Check entry_conditions were migrated to Long
	entryNodeType, err := normalized.Long.EntryConditions.GetNodeType()
	if err != nil {
		t.Fatalf("failed to get entry node type: %v", err)
	}
	if entryNodeType != NodeTypeAND {
		t.Errorf("expected entry node type AND, got %s", entryNodeType)
	}

	// Check deprecated fields are cleared
	if normalized.EntryConditions.raw != nil {
		t.Error("expected deprecated entry_conditions to be cleared")
	}
	if normalized.ExitConditions.raw != nil {
		t.Error("expected deprecated exit_conditions to be cleared")
	}
}

func TestNormalizeUIBuilderConfig_AlreadyV2(t *testing.T) {
	// V2 config with nested signal config
	v2JSON := `{
		"version": 2,
		"position_mode": "LONG_AND_SHORT",
		"indicators": [],
		"long": {
			"entry_conditions": {"id": "long_entry", "type": "AND", "children": []},
			"exit_conditions": {"id": "long_exit", "type": "AND", "children": []}
		},
		"short": {
			"entry_conditions": {"id": "short_entry", "type": "AND", "children": []},
			"exit_conditions": {"id": "short_exit", "type": "AND", "children": []}
		},
		"parameters": {
			"stoploss": -0.10,
			"minimal_roi": {"0": 0.10},
			"trailing_stop": false,
			"use_exit_signal": true
		},
		"callbacks": {}
	}`

	var config UIBuilderConfig
	if err := json.Unmarshal([]byte(v2JSON), &config); err != nil {
		t.Fatalf("failed to unmarshal v2 config: %v", err)
	}

	// Normalize should not change a v2 config
	normalized := NormalizeUIBuilderConfig(&config)

	// Check version is still 2
	if normalized.Version != 2 {
		t.Errorf("expected version 2, got %d", normalized.Version)
	}

	// Check position_mode is preserved
	if normalized.PositionMode != PositionModeLongAndShort {
		t.Errorf("expected position_mode LONG_AND_SHORT, got %s", normalized.PositionMode)
	}

	// Check Long and Short configs are preserved
	if normalized.Long == nil {
		t.Error("expected Long signal config to be preserved")
	}
	if normalized.Short == nil {
		t.Error("expected Short signal config to be preserved")
	}
}

func TestNormalizeUIBuilderConfig_NilConfig(t *testing.T) {
	result := NormalizeUIBuilderConfig(nil)
	if result != nil {
		t.Error("expected nil for nil input")
	}
}

func TestNormalizeUIBuilderConfig_EmptyConfig(t *testing.T) {
	config := &UIBuilderConfig{}
	normalized := NormalizeUIBuilderConfig(config)

	// Should set default position_mode
	if normalized.PositionMode != PositionModeLongOnly {
		t.Errorf("expected position_mode LONG_ONLY, got %s", normalized.PositionMode)
	}
}

func TestIsV2Config(t *testing.T) {
	tests := []struct {
		name     string
		config   *UIBuilderConfig
		expected bool
	}{
		{
			name:     "nil config",
			config:   nil,
			expected: false,
		},
		{
			name:     "empty config",
			config:   &UIBuilderConfig{},
			expected: false,
		},
		{
			name: "v1 config with flat conditions",
			config: &UIBuilderConfig{
				Version: 1,
				// No Long or Short
			},
			expected: false,
		},
		{
			name: "v2 config with Long",
			config: &UIBuilderConfig{
				Version: 2,
				Long:    &SignalConfig{},
			},
			expected: true,
		},
		{
			name: "v2 config with Short",
			config: &UIBuilderConfig{
				Version: 2,
				Short:   &SignalConfig{},
			},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsV2Config(tt.config)
			if result != tt.expected {
				t.Errorf("IsV2Config() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestShouldGenerateLongSignals(t *testing.T) {
	tests := []struct {
		name         string
		positionMode PositionMode
		expected     bool
	}{
		{"nil config defaults to true", "", true},
		{"LONG_ONLY returns true", PositionModeLongOnly, true},
		{"SHORT_ONLY returns false", PositionModeShortOnly, false},
		{"LONG_AND_SHORT returns true", PositionModeLongAndShort, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := &UIBuilderConfig{PositionMode: tt.positionMode}
			result := ShouldGenerateLongSignals(config)
			if result != tt.expected {
				t.Errorf("ShouldGenerateLongSignals() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestShouldGenerateShortSignals(t *testing.T) {
	tests := []struct {
		name         string
		positionMode PositionMode
		expected     bool
	}{
		{"nil config defaults to false", "", false},
		{"LONG_ONLY returns false", PositionModeLongOnly, false},
		{"SHORT_ONLY returns true", PositionModeShortOnly, true},
		{"LONG_AND_SHORT returns true", PositionModeLongAndShort, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := &UIBuilderConfig{PositionMode: tt.positionMode}
			result := ShouldGenerateShortSignals(config)
			if result != tt.expected {
				t.Errorf("ShouldGenerateShortSignals() = %v, want %v", result, tt.expected)
			}
		})
	}
}
