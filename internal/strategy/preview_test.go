package strategy

import (
	"strings"
	"testing"
)

func TestValidateClassName(t *testing.T) {
	tests := []struct {
		name      string
		className string
		wantErr   bool
		errMsg    string
	}{
		{
			name:      "valid PascalCase",
			className: "MyStrategy",
			wantErr:   false,
		},
		{
			name:      "valid single word",
			className: "Strategy",
			wantErr:   false,
		},
		{
			name:      "valid with numbers",
			className: "Strategy123",
			wantErr:   false,
		},
		{
			name:      "valid complex name",
			className: "MyAwesome2024Strategy",
			wantErr:   false,
		},
		{
			name:      "empty string",
			className: "",
			wantErr:   true,
			errMsg:    "class name is required",
		},
		{
			name:      "lowercase start",
			className: "myStrategy",
			wantErr:   true,
			errMsg:    "must be PascalCase",
		},
		{
			name:      "starts with number",
			className: "123Strategy",
			wantErr:   true,
			errMsg:    "must be PascalCase",
		},
		{
			name:      "contains underscore",
			className: "My_Strategy",
			wantErr:   true,
			errMsg:    "must be PascalCase",
		},
		{
			name:      "contains hyphen",
			className: "My-Strategy",
			wantErr:   true,
			errMsg:    "must be PascalCase",
		},
		{
			name:      "contains space",
			className: "My Strategy",
			wantErr:   true,
			errMsg:    "must be PascalCase",
		},
		{
			name:      "too long",
			className: strings.Repeat("A", MaxClassNameLength+1),
			wantErr:   true,
			errMsg:    "class name too long",
		},
		{
			name:      "exactly max length",
			className: strings.Repeat("A", MaxClassNameLength),
			wantErr:   false,
		},
		{
			name:      "single uppercase letter",
			className: "A",
			wantErr:   false,
		},
		{
			name:      "contains special characters",
			className: "Strategy!@#",
			wantErr:   true,
			errMsg:    "must be PascalCase",
		},
		{
			name:      "code injection attempt - semicolon",
			className: "Strategy;import os",
			wantErr:   true,
			errMsg:    "must be PascalCase",
		},
		{
			name:      "code injection attempt - newline",
			className: "Strategy\nimport os",
			wantErr:   true,
			errMsg:    "must be PascalCase",
		},
		{
			name:      "code injection attempt - quotes",
			className: "Strategy\"",
			wantErr:   true,
			errMsg:    "must be PascalCase",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateClassName(tt.className)
			if tt.wantErr {
				if err == nil {
					t.Errorf("ValidateClassName(%q) expected error, got nil", tt.className)
					return
				}
				if tt.errMsg != "" && !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("ValidateClassName(%q) error = %q, want error containing %q", tt.className, err.Error(), tt.errMsg)
				}
			} else {
				if err != nil {
					t.Errorf("ValidateClassName(%q) unexpected error: %v", tt.className, err)
				}
			}
		})
	}
}

func TestPreviewStrategyCode(t *testing.T) {
	tests := []struct {
		name      string
		config    map[string]interface{}
		className string
		wantOK    bool
		wantCode  bool
		errMsg    string
	}{
		{
			name:      "invalid class name - empty",
			config:    map[string]interface{}{},
			className: "",
			wantOK:    false,
			errMsg:    "class name is required",
		},
		{
			name:      "invalid class name - lowercase",
			config:    map[string]interface{}{},
			className: "myStrategy",
			wantOK:    false,
			errMsg:    "must be PascalCase",
		},
		{
			name: "valid simple config",
			config: map[string]interface{}{
				"timeframe": "5m",
				"ui_builder": map[string]interface{}{
					"version":    1,
					"indicators": []interface{}{},
					"entry_conditions": map[string]interface{}{
						"id":       "root",
						"type":     "COMPARE",
						"left":     map[string]interface{}{"type": "CONSTANT", "value": 1},
						"operator": "gt",
						"right":    map[string]interface{}{"type": "CONSTANT", "value": 0},
					},
					"exit_conditions": map[string]interface{}{
						"id":       "root",
						"type":     "COMPARE",
						"left":     map[string]interface{}{"type": "CONSTANT", "value": 0},
						"operator": "gt",
						"right":    map[string]interface{}{"type": "CONSTANT", "value": 1},
					},
					"parameters": map[string]interface{}{
						"stoploss":        -0.1,
						"use_exit_signal": true,
					},
				},
			},
			className: "TestStrategy",
			wantOK:    true,
			wantCode:  true,
		},
		{
			name: "config without ui_builder",
			config: map[string]interface{}{
				"timeframe": "5m",
			},
			className: "TestStrategy",
			wantOK:    false,
			errMsg:    "no ui_builder config found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := PreviewStrategyCode(tt.config, tt.className)

			if result == nil {
				t.Fatal("PreviewStrategyCode returned nil")
			}

			if tt.wantOK {
				if !result.Success {
					t.Errorf("expected success, got error: %s", result.Error)
				}
				if tt.wantCode && result.Code == "" {
					t.Error("expected generated code, got empty string")
				}
				if tt.wantCode && result.Code != "" {
					// Verify class name appears in generated code
					if !strings.Contains(result.Code, tt.className) {
						t.Errorf("generated code should contain class name %q", tt.className)
					}
				}
			} else {
				if result.Success {
					t.Error("expected failure, got success")
				}
				if tt.errMsg != "" && !strings.Contains(result.Error, tt.errMsg) {
					t.Errorf("error = %q, want error containing %q", result.Error, tt.errMsg)
				}
			}
		})
	}
}

func TestPreviewStrategyCode_ConfigSizeLimit(t *testing.T) {
	// Create a config that exceeds the max size
	largeConfig := make(map[string]interface{})
	for i := 0; i < 50000; i++ {
		largeConfig[strings.Repeat("k", 20)+string(rune(i))] = strings.Repeat("v", 100)
	}

	result := PreviewStrategyCode(largeConfig, "TestStrategy")

	if result.Success {
		t.Error("expected failure for oversized config")
	}
	if !strings.Contains(result.Error, "too large") {
		t.Errorf("expected 'too large' error, got: %s", result.Error)
	}
}

func TestNameToClassName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "empty string",
			input:    "",
			expected: "MyStrategy",
		},
		{
			name:     "simple name no spaces - preserve casing",
			input:    "NewBuilderStrat",
			expected: "NewBuilderStrat",
		},
		{
			name:     "camelCase - uppercase first letter only",
			input:    "myStrategy",
			expected: "MyStrategy",
		},
		{
			name:     "space separated words",
			input:    "my strategy",
			expected: "MyStrategy",
		},
		{
			name:     "multiple spaces",
			input:    "my  awesome   strategy",
			expected: "MyAwesomeStrategy",
		},
		{
			name:     "with numbers",
			input:    "strategy 123",
			expected: "Strategy123",
		},
		{
			name:     "with special characters - removed",
			input:    "test-strategy_v2!",
			expected: "Teststrategyv2",
		},
		{
			name:     "all special characters",
			input:    "!@#$%",
			expected: "MyStrategy",
		},
		{
			name:     "mixed case with spaces",
			input:    "My AWESOME Strategy",
			expected: "MyAwesomeStrategy",
		},
		{
			name:     "single word uppercase",
			input:    "STRATEGY",
			expected: "STRATEGY",
		},
		{
			name:     "single letter",
			input:    "s",
			expected: "S",
		},
		{
			name:     "preserves PascalCase without spaces",
			input:    "MyAwesomeStrategy2024",
			expected: "MyAwesomeStrategy2024",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := NameToClassName(tt.input)
			if result != tt.expected {
				t.Errorf("NameToClassName(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestGenerateCodeFromUIBuilder(t *testing.T) {
	tests := []struct {
		name        string
		stratName   string
		config      map[string]interface{}
		wantErr     bool
		errContains string
		wantClass   string
	}{
		{
			name:        "missing ui_builder config",
			stratName:   "TestStrategy",
			config:      map[string]interface{}{"timeframe": "5m"},
			wantErr:     true,
			errContains: "missing ui_builder",
		},
		{
			name:      "valid config",
			stratName: "TestStrategy",
			config: map[string]interface{}{
				"timeframe": "5m",
				"ui_builder": map[string]interface{}{
					"version":    1,
					"indicators": []interface{}{},
					"entry_conditions": map[string]interface{}{
						"id":       "root",
						"type":     "COMPARE",
						"left":     map[string]interface{}{"type": "CONSTANT", "value": 1},
						"operator": "gt",
						"right":    map[string]interface{}{"type": "CONSTANT", "value": 0},
					},
					"exit_conditions": map[string]interface{}{
						"id":       "root",
						"type":     "COMPARE",
						"left":     map[string]interface{}{"type": "CONSTANT", "value": 0},
						"operator": "gt",
						"right":    map[string]interface{}{"type": "CONSTANT", "value": 1},
					},
					"parameters": map[string]interface{}{
						"stoploss":        -0.1,
						"use_exit_signal": true,
					},
				},
			},
			wantErr:   false,
			wantClass: "TestStrategy",
		},
		{
			name:      "name with spaces converted to PascalCase",
			stratName: "my test strategy",
			config: map[string]interface{}{
				"timeframe": "5m",
				"ui_builder": map[string]interface{}{
					"version":    1,
					"indicators": []interface{}{},
					"entry_conditions": map[string]interface{}{
						"id":       "root",
						"type":     "COMPARE",
						"left":     map[string]interface{}{"type": "CONSTANT", "value": 1},
						"operator": "gt",
						"right":    map[string]interface{}{"type": "CONSTANT", "value": 0},
					},
					"exit_conditions": map[string]interface{}{
						"id":       "root",
						"type":     "COMPARE",
						"left":     map[string]interface{}{"type": "CONSTANT", "value": 0},
						"operator": "gt",
						"right":    map[string]interface{}{"type": "CONSTANT", "value": 1},
					},
					"parameters": map[string]interface{}{
						"stoploss":        -0.1,
						"use_exit_signal": true,
					},
				},
			},
			wantErr:   false,
			wantClass: "MyTestStrategy",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			code, err := GenerateCodeFromUIBuilder(tt.stratName, tt.config)

			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error, got nil")
					return
				}
				if tt.errContains != "" && !strings.Contains(err.Error(), tt.errContains) {
					t.Errorf("error = %q, want error containing %q", err.Error(), tt.errContains)
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
					return
				}
				if !strings.Contains(code, "class "+tt.wantClass) {
					t.Errorf("generated code should contain 'class %s', got:\n%s", tt.wantClass, code)
				}
			}
		})
	}
}
