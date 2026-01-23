package kubernetes

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"volaticloud/internal/runner"
)

// TestStrategyConfigMapKeySanitization verifies that strategy names with spaces
// and special characters are properly sanitized for use as ConfigMap keys.
// Kubernetes ConfigMap keys must match [-._a-zA-Z0-9]+
func TestStrategyConfigMapKeySanitization(t *testing.T) {
	tests := []struct {
		name           string
		strategyName   string
		expectedKey    string
		description    string
	}{
		{
			name:         "spaces are removed and converted to PascalCase",
			strategyName: "RSI Test Strategy",
			expectedKey:  "RsiTestStrategy.py",
			description:  "Strategy names with spaces should be converted to PascalCase",
		},
		{
			name:         "multiple spaces between words",
			strategyName: "My   Super   Strategy",
			expectedKey:  "MySuperStrategy.py",
			description:  "Multiple spaces should be handled correctly",
		},
		{
			name:         "special characters removed",
			strategyName: "Strategy@Test#123",
			expectedKey:  "StrategyTest123.py",
			description:  "Special characters should be filtered out",
		},
		{
			name:         "hyphens removed",
			strategyName: "my-strategy-name",
			expectedKey:  "Mystrategyname.py",
			description:  "Hyphens should be removed",
		},
		{
			name:         "underscores removed",
			strategyName: "my_strategy_name",
			expectedKey:  "Mystrategyname.py",
			description:  "Underscores should be removed",
		},
		{
			name:         "already valid PascalCase",
			strategyName: "MyStrategy",
			expectedKey:  "MyStrategy.py",
			description:  "Already valid names should be preserved",
		},
		{
			name:         "lowercase single word",
			strategyName: "mystrategy",
			expectedKey:  "Mystrategy.py",
			description:  "Lowercase names should have first letter capitalized",
		},
		{
			name:         "empty string uses default",
			strategyName: "",
			expectedKey:  "MyStrategy.py",
			description:  "Empty names should use default 'MyStrategy'",
		},
		{
			name:         "only special characters uses default",
			strategyName: "@#$%",
			expectedKey:  "MyStrategy.py",
			description:  "Names with only special chars should use default",
		},
		{
			name:         "numbers preserved",
			strategyName: "Strategy 123 Test",
			expectedKey:  "Strategy123Test.py",
			description:  "Numbers should be preserved in the output",
		},
		{
			name:         "leading and trailing spaces",
			strategyName: "  My Strategy  ",
			expectedKey:  "MyStrategy.py",
			description:  "Leading/trailing spaces should be trimmed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test that SanitizeStrategyFilename produces valid ConfigMap keys
			sanitized := runner.SanitizeStrategyFilename(tt.strategyName)
			key := sanitized + ".py"

			assert.Equal(t, tt.expectedKey, key, tt.description)

			// Verify the key matches Kubernetes ConfigMap key requirements
			// Must match: [-._a-zA-Z0-9]+
			assert.Regexp(t, `^[-._a-zA-Z0-9]+$`, key,
				"ConfigMap key must only contain alphanumeric, hyphen, underscore, or dot")

			// Verify no spaces in the key
			assert.NotContains(t, key, " ", "ConfigMap key must not contain spaces")
		})
	}
}

// TestStrategyConfigMapKeyValidForKubernetes verifies that all sanitized names
// produce valid Kubernetes ConfigMap keys
func TestStrategyConfigMapKeyValidForKubernetes(t *testing.T) {
	// Test various edge cases that users might input
	edgeCases := []string{
		"RSI Test Strategy",
		"MACD Cross Strategy",
		"Simple Moving Average",
		"EMA 50/200 Crossover",
		"Bollinger Bands Breakout",
		"RSI + MACD Combined",
		"策略测试", // Chinese characters
		"стратегия", // Russian characters
		"Strategy (v2)",
		"Strategy [test]",
		"Strategy {new}",
		"",
		"   ",
		"a",
		"A",
		"123",
		"test123strategy",
	}

	configMapKeyRegex := `^[-._a-zA-Z0-9]+$`

	for _, input := range edgeCases {
		t.Run(input, func(t *testing.T) {
			sanitized := runner.SanitizeStrategyFilename(input)
			key := sanitized + ".py"

			// Every sanitized name must produce a valid ConfigMap key
			assert.Regexp(t, configMapKeyRegex, key,
				"Input %q produced invalid key %q", input, key)
			assert.NotContains(t, key, " ",
				"Input %q produced key with spaces: %q", input, key)
			assert.NotEmpty(t, sanitized,
				"Sanitized name should never be empty")
		})
	}
}

// TestInitContainerScriptUsesanitizedName verifies the init container setup script
// uses the sanitized strategy name for file operations
func TestInitContainerScriptStrategyFilename(t *testing.T) {
	// This test documents the expected behavior:
	// The init container script should use the sanitized name when copying
	// the strategy file from /strategy-source/ to /userdata/strategies/

	tests := []struct {
		strategyName     string
		expectedFilename string
	}{
		{"RSI Test Strategy", "RsiTestStrategy.py"},
		{"My Strategy", "MyStrategy.py"},
		{"MACD Crossover", "MacdCrossover.py"},
	}

	for _, tt := range tests {
		t.Run(tt.strategyName, func(t *testing.T) {
			sanitized := runner.SanitizeStrategyFilename(tt.strategyName)
			filename := sanitized + ".py"

			assert.Equal(t, tt.expectedFilename, filename,
				"Strategy %q should produce filename %q", tt.strategyName, tt.expectedFilename)

			// Verify the filename is safe for shell commands (no spaces or special chars)
			assert.NotContains(t, filename, " ")
			assert.NotContains(t, filename, "'")
			assert.NotContains(t, filename, "\"")
			assert.NotContains(t, filename, "$")
			assert.NotContains(t, filename, "`")
		})
	}
}
