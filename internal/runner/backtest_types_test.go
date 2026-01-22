package runner

import "testing"

func TestSanitizeStrategyFilename(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "space separated words to PascalCase",
			input:    "RSI Test Strategy",
			expected: "RsiTestStrategy",
		},
		{
			name:     "hyphenated name removes hyphens",
			input:    "my-strategy",
			expected: "Mystrategy",
		},
		{
			name:     "underscores removed, casing preserved",
			input:    "Test_Strategy_123",
			expected: "TestStrategy123",
		},
		{
			name:     "already PascalCase preserved",
			input:    "StrategyName",
			expected: "StrategyName",
		},
		{
			name:     "empty string returns default",
			input:    "",
			expected: "MyStrategy",
		},
		{
			name:     "only special characters returns default",
			input:    "!!!",
			expected: "MyStrategy",
		},
		{
			name:     "single letters become uppercase",
			input:    "a b c",
			expected: "ABC",
		},
		{
			name:     "lowercase single word gets capitalized first letter",
			input:    "lowercase",
			expected: "Lowercase",
		},
		{
			name:     "mixed case words normalized",
			input:    "UPPER lower MiXeD",
			expected: "UpperLowerMixed",
		},
		{
			name:     "numbers preserved",
			input:    "Strategy 123 Test",
			expected: "Strategy123Test",
		},
		{
			name:     "leading spaces handled",
			input:    "  Test Strategy",
			expected: "TestStrategy",
		},
		{
			name:     "trailing spaces handled",
			input:    "Test Strategy  ",
			expected: "TestStrategy",
		},
		{
			name:     "multiple spaces between words",
			input:    "Test    Strategy",
			expected: "TestStrategy",
		},
		{
			name:     "special characters filtered out",
			input:    "Test@Strategy#Name!",
			expected: "TestStrategyName",
		},
		{
			name:     "unicode characters filtered",
			input:    "Tëst Strätegy",
			expected: "TstStrtegy",
		},
		{
			name:     "single character",
			input:    "a",
			expected: "A",
		},
		{
			name:     "single uppercase character",
			input:    "A",
			expected: "A",
		},
		{
			name:     "preserves casing when no spaces",
			input:    "myStrategy",
			expected: "MyStrategy",
		},
		{
			name:     "preserves internal casing when no spaces",
			input:    "MySTRATEGY",
			expected: "MySTRATEGY",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeStrategyFilename(tt.input)
			if result != tt.expected {
				t.Errorf("SanitizeStrategyFilename(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestSanitizeStrategyFilename_ValidConfigMapKey(t *testing.T) {
	// Test that output is always a valid Kubernetes ConfigMap key
	// ConfigMap keys must match: [-._a-zA-Z0-9]+
	inputs := []string{
		"RSI Test Strategy",
		"my-strategy",
		"Test_Strategy_123",
		"",
		"!!!",
		"a b c",
		"Test@Strategy#Name!",
	}

	validKeyRegex := `^[a-zA-Z][a-zA-Z0-9]*$`
	for _, input := range inputs {
		result := SanitizeStrategyFilename(input)
		if result == "" {
			t.Errorf("SanitizeStrategyFilename(%q) returned empty string", input)
			continue
		}
		// First character must be a letter (Python class name requirement)
		if result[0] < 'A' || result[0] > 'Z' {
			t.Errorf("SanitizeStrategyFilename(%q) = %q, first character is not uppercase letter", input, result)
		}
		// All characters must be alphanumeric (ConfigMap key + Python identifier)
		for i, c := range result {
			if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
				t.Errorf("SanitizeStrategyFilename(%q) = %q, invalid character %q at position %d", input, result, string(c), i)
			}
		}
	}
	_ = validKeyRegex // Used for documentation
}
