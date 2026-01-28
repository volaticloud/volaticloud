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
			expected: DefaultStrategyName,
		},
		{
			name:     "only special characters returns default",
			input:    "!!!",
			expected: DefaultStrategyName,
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
			name:     "capitalizes first letter when no spaces",
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

func TestSanitizeLabelValue(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "spaces replaced with dashes",
			input:    "My Bot Name",
			expected: "My-Bot-Name",
		},
		{
			name:     "special characters removed",
			input:    "Bot@Name!Test#",
			expected: "BotNameTest",
		},
		{
			name:     "leading/trailing dashes trimmed",
			input:    "-test-bot-",
			expected: "test-bot",
		},
		{
			name:     "empty string returns empty",
			input:    "",
			expected: "",
		},
		{
			name:     "preserves underscores and dots",
			input:    "my_bot.v1",
			expected: "my_bot.v1",
		},
		{
			name:     "multiple spaces collapsed",
			input:    "My   Bot   Name",
			expected: "My-Bot-Name",
		},
		{
			name:     "unicode characters removed",
			input:    "Bot 📈 Name",
			expected: "Bot-Name",
		},
		{
			name:     "long name truncated to 63 chars",
			input:    "This-is-a-very-long-bot-name-that-exceeds-the-kubernetes-label-value-limit-of-63-chars",
			expected: "This-is-a-very-long-bot-name-that-exceeds-the-kubernetes-label",
		},
		{
			name:     "truncation removes trailing dashes",
			input:    "This-is-a-very-long-bot-name-that-exceeds-the-kubernetes-------",
			expected: "This-is-a-very-long-bot-name-that-exceeds-the-kubernetes",
		},
		{
			name:     "numbers preserved",
			input:    "bot123test456",
			expected: "bot123test456",
		},
		{
			name:     "mixed case preserved",
			input:    "MyBotName",
			expected: "MyBotName",
		},
		{
			name:     "only special characters returns empty",
			input:    "!!!@@@###",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeLabelValue(tt.input)
			if result != tt.expected {
				t.Errorf("SanitizeLabelValue(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestSanitizeLabelValue_ValidK8sLabel(t *testing.T) {
	// Test that output is always a valid Kubernetes label value
	// Label values must:
	// - Be 63 characters or fewer
	// - Contain only alphanumeric, dashes, underscores, dots
	// - Begin and end with alphanumeric (if non-empty)
	inputs := []string{
		"My Bot Name",
		"Bot@Name!Test#",
		"-test-bot-",
		"my_bot.v1",
		"Bot 📈 Name",
		"This-is-a-very-long-bot-name-that-exceeds-the-kubernetes-label-value-limit-of-63-chars",
	}

	for _, input := range inputs {
		result := SanitizeLabelValue(input)
		if result == "" {
			continue // Empty is valid
		}

		// Check length
		if len(result) > 63 {
			t.Errorf("SanitizeLabelValue(%q) = %q, exceeds 63 characters (len=%d)", input, result, len(result))
		}

		// Check first character is alphanumeric
		first := result[0]
		if !((first >= 'a' && first <= 'z') || (first >= 'A' && first <= 'Z') || (first >= '0' && first <= '9')) {
			t.Errorf("SanitizeLabelValue(%q) = %q, first character %q is not alphanumeric", input, result, string(first))
		}

		// Check last character is alphanumeric
		last := result[len(result)-1]
		if !((last >= 'a' && last <= 'z') || (last >= 'A' && last <= 'Z') || (last >= '0' && last <= '9')) {
			t.Errorf("SanitizeLabelValue(%q) = %q, last character %q is not alphanumeric", input, result, string(last))
		}

		// Check all characters are valid
		for i, c := range result {
			valid := (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.'
			if !valid {
				t.Errorf("SanitizeLabelValue(%q) = %q, invalid character %q at position %d", input, result, string(c), i)
			}
		}
	}
}
