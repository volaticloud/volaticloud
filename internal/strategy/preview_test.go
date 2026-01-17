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