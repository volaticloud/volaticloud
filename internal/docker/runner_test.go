package docker

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"volaticloud/internal/runner"
)

// TestStrategyFilenameSanitization verifies that strategy names with spaces
// and special characters are properly sanitized for use as filenames.
func TestStrategyFilenameSanitization(t *testing.T) {
	tests := []struct {
		name             string
		strategyName     string
		expectedFilename string
		description      string
	}{
		{
			name:             "spaces are removed and converted to PascalCase",
			strategyName:     "RSI Test Strategy",
			expectedFilename: "RsiTestStrategy.py",
			description:      "Strategy names with spaces should be converted to PascalCase",
		},
		{
			name:             "multiple spaces between words",
			strategyName:     "My   Super   Strategy",
			expectedFilename: "MySuperStrategy.py",
			description:      "Multiple spaces should be handled correctly",
		},
		{
			name:             "special characters removed",
			strategyName:     "Strategy@Test#123",
			expectedFilename: "StrategyTest123.py",
			description:      "Special characters should be filtered out",
		},
		{
			name:             "already valid PascalCase",
			strategyName:     "MyStrategy",
			expectedFilename: "MyStrategy.py",
			description:      "Already valid names should be preserved",
		},
		{
			name:             "empty string uses default",
			strategyName:     "",
			expectedFilename: "MyStrategy.py",
			description:      "Empty names should use default 'MyStrategy'",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sanitized := runner.SanitizeStrategyFilename(tt.strategyName)
			filename := sanitized + ".py"

			assert.Equal(t, tt.expectedFilename, filename, tt.description)

			// Verify the filename is safe for filesystem operations
			assert.NotContains(t, filename, " ", "Filename must not contain spaces")
			assert.NotContains(t, filename, "/", "Filename must not contain path separators")
			assert.NotContains(t, filename, "\\", "Filename must not contain backslashes")
		})
	}
}

// TestStrategyVolumePathConstruction verifies that the volume path for strategy files
// is constructed correctly with sanitized names
func TestStrategyVolumePathConstruction(t *testing.T) {
	tests := []struct {
		botID          string
		strategyName   string
		expectedPath   string
	}{
		{
			botID:        "bot-123",
			strategyName: "RSI Test Strategy",
			expectedPath: "bot-123/strategies/RsiTestStrategy.py",
		},
		{
			botID:        "abc-def-ghi",
			strategyName: "My Strategy",
			expectedPath: "abc-def-ghi/strategies/MyStrategy.py",
		},
	}

	for _, tt := range tests {
		t.Run(tt.strategyName, func(t *testing.T) {
			sanitized := runner.SanitizeStrategyFilename(tt.strategyName)
			filename := sanitized + ".py"
			// Simulating filepath.Join behavior
			path := tt.botID + "/strategies/" + filename

			assert.Equal(t, tt.expectedPath, path)
			assert.NotContains(t, path, " ", "Path must not contain spaces")
		})
	}
}

// TestStrategyContainerPathConstruction verifies the container path for strategy files
func TestStrategyContainerPathConstruction(t *testing.T) {
	tests := []struct {
		botID          string
		strategyName   string
		expectedPath   string
	}{
		{
			botID:        "bot-123",
			strategyName: "RSI Test Strategy",
			expectedPath: "/freqtrade/user_data/bot-123/strategies/RsiTestStrategy.py",
		},
		{
			botID:        "abc-def-ghi",
			strategyName: "MACD Crossover",
			expectedPath: "/freqtrade/user_data/abc-def-ghi/strategies/MacdCrossover.py",
		},
	}

	for _, tt := range tests {
		t.Run(tt.strategyName, func(t *testing.T) {
			sanitized := runner.SanitizeStrategyFilename(tt.strategyName)
			filename := sanitized + ".py"
			// Simulating the container path construction from runner.go
			containerPath := "/freqtrade/user_data/" + tt.botID + "/strategies/" + filename

			assert.Equal(t, tt.expectedPath, containerPath)
			assert.NotContains(t, containerPath, " ", "Container path must not contain spaces")
		})
	}
}
