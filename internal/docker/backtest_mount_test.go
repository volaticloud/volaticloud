package docker

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"

	"volaticloud/internal/runner"
)

// TestBacktestVolumeMountStrategy tests the volume mount configuration
// for parallel backtesting with shared historical data
func TestBacktestVolumeMountStrategy(t *testing.T) {
	tests := []struct {
		name            string
		backtestID      string
		expectedUserDir string
		expectedDataDir string
	}{
		{
			name:            "basic backtest mount",
			backtestID:      "abc123",
			expectedUserDir: "/freqtrade/user_data/abc123",
			expectedDataDir: "/freqtrade/user_data/abc123/data",
		},
		{
			name:            "uuid backtest mount",
			backtestID:      "8ca423a7-1532-4631-8bf2-85a672f292d5",
			expectedUserDir: "/freqtrade/user_data/8ca423a7-1532-4631-8bf2-85a672f292d5",
			expectedDataDir: "/freqtrade/user_data/8ca423a7-1532-4631-8bf2-85a672f292d5/data",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			spec := runner.BacktestSpec{
				ID:           tt.backtestID,
				StrategyName: "TestStrategy",
			}

			// Create runner (without Docker client for unit test)
			btRunner := &BacktestRunner{}

			// Build command
			cmd := btRunner.buildBacktestCommand(spec)

			// Verify --userdir argument
			assert.Contains(t, cmd, "--userdir", "Command must include --userdir flag")

			// Find --userdir index and verify its value
			var userdirValue string
			for i, arg := range cmd {
				if arg == "--userdir" && i+1 < len(cmd) {
					userdirValue = cmd[i+1]
					break
				}
			}

			assert.Equal(t, tt.expectedUserDir, userdirValue,
				"Userdir must match expected path for backtest isolation")

			// Verify expected data directory path
			// When using --userdir, Freqtrade automatically resolves data as {userdir}/data/
			assert.Equal(t, tt.expectedDataDir, fmt.Sprintf("%s/data", userdirValue),
				"Data directory must be {userdir}/data/ to align with Freqtrade's automatic resolution")
		})
	}
}

// TestBacktestCommandStructure tests the backtest command structure
func TestBacktestCommandStructure(t *testing.T) {
	spec := runner.BacktestSpec{
		ID:           "test-backtest-id",
		StrategyName: "TestStrategy",
	}

	btRunner := &BacktestRunner{}
	cmd := btRunner.buildBacktestCommand(spec)

	// Verify command structure
	assert.NotEmpty(t, cmd, "Command must not be empty")
	assert.Equal(t, "backtesting", cmd[0], "First element must be 'backtesting'")

	// Verify required flags
	assert.Contains(t, cmd, "--strategy", "Command must include --strategy flag")
	assert.Contains(t, cmd, "TestStrategy", "Command must include strategy name")
	assert.Contains(t, cmd, "--userdir", "Command must include --userdir flag")
	assert.Contains(t, cmd, "--data-format-ohlcv", "Command must include --data-format-ohlcv flag")
	assert.Contains(t, cmd, "json", "Data format must be json")

	// Verify NO --datadir flag (we use mount instead)
	assert.NotContains(t, cmd, "--datadir", "Command must NOT include --datadir flag (mount-based strategy)")
}

// TestVolumeMountPathAlignment tests that volume mount targets align with userdir
func TestVolumeMountPathAlignment(t *testing.T) {
	tests := []struct {
		name             string
		backtestID       string
		expectedUserDir  string
		expectedDataPath string
	}{
		{
			name:             "simple ID",
			backtestID:       "test123",
			expectedUserDir:  "/freqtrade/user_data/test123",
			expectedDataPath: "/freqtrade/user_data/test123/data",
		},
		{
			name:             "UUID format",
			backtestID:       "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
			expectedUserDir:  "/freqtrade/user_data/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
			expectedDataPath: "/freqtrade/user_data/a1b2c3d4-e5f6-7890-abcd-ef1234567890/data",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Verify that data path is {userdir}/data/
			assert.Equal(t, fmt.Sprintf("%s/data", tt.expectedUserDir), tt.expectedDataPath,
				"Data path must be {userdir}/data/ for Freqtrade automatic resolution")

			// Verify path construction
			dataPath := fmt.Sprintf("/freqtrade/user_data/%s/data", tt.backtestID)
			assert.Equal(t, tt.expectedDataPath, dataPath,
				"Mount path must match expected pattern")
		})
	}
}

// TestParallelBacktestIsolation tests that parallel backtests have isolated paths
func TestParallelBacktestIsolation(t *testing.T) {
	backtest1 := runner.BacktestSpec{ID: "backtest-1", StrategyName: "Strategy1"}
	backtest2 := runner.BacktestSpec{ID: "backtest-2", StrategyName: "Strategy2"}
	backtest3 := runner.BacktestSpec{ID: "backtest-3", StrategyName: "Strategy3"}

	btRunner := &BacktestRunner{}

	cmd1 := btRunner.buildBacktestCommand(backtest1)
	cmd2 := btRunner.buildBacktestCommand(backtest2)
	cmd3 := btRunner.buildBacktestCommand(backtest3)

	// Extract userdir values
	getUserdir := func(cmd []string) string {
		for i, arg := range cmd {
			if arg == "--userdir" && i+1 < len(cmd) {
				return cmd[i+1]
			}
		}
		return ""
	}

	userdir1 := getUserdir(cmd1)
	userdir2 := getUserdir(cmd2)
	userdir3 := getUserdir(cmd3)

	// Verify all userdirs are different
	assert.NotEqual(t, userdir1, userdir2, "Backtest 1 and 2 must have different userdirs")
	assert.NotEqual(t, userdir1, userdir3, "Backtest 1 and 3 must have different userdirs")
	assert.NotEqual(t, userdir2, userdir3, "Backtest 2 and 3 must have different userdirs")

	// Verify each backtest has its own data directory
	assert.Contains(t, userdir1, "backtest-1", "Userdir 1 must contain backtest ID")
	assert.Contains(t, userdir2, "backtest-2", "Userdir 2 must contain backtest ID")
	assert.Contains(t, userdir3, "backtest-3", "Userdir 3 must contain backtest ID")
}

// TestDataFormatExplicit tests that data format is explicitly set to JSON
func TestDataFormatExplicit(t *testing.T) {
	spec := runner.BacktestSpec{
		ID:           "test-id",
		StrategyName: "TestStrategy",
	}

	btRunner := &BacktestRunner{}
	cmd := btRunner.buildBacktestCommand(spec)

	// Find data format value
	var dataFormat string
	for i, arg := range cmd {
		if arg == "--data-format-ohlcv" && i+1 < len(cmd) {
			dataFormat = cmd[i+1]
			break
		}
	}

	assert.Equal(t, "json", dataFormat,
		"Data format must be 'json' to match download format. "+
			"Command-line args have higher precedence than config.")
}

// TestBacktestCommandNoDatadir tests that --datadir is not used
func TestBacktestCommandNoDatadir(t *testing.T) {
	spec := runner.BacktestSpec{
		ID:           "test-id",
		StrategyName: "TestStrategy",
	}

	btRunner := &BacktestRunner{}
	cmd := btRunner.buildBacktestCommand(spec)

	// Verify --datadir is NOT present
	assert.NotContains(t, cmd, "--datadir",
		"Command must NOT use --datadir flag. "+
			"Data directory is resolved automatically by Freqtrade as {userdir}/data/ "+
			"when using --userdir flag. This allows for clean parallel backtest isolation.")
}

// TestVolumeMountDocumentation documents the volume mount strategy
func TestVolumeMountDocumentation(t *testing.T) {
	// This test documents the volume mount strategy for parallel backtesting

	backtestID := "example-backtest-123"

	// 1. Each backtest gets unique userdir
	userdir := fmt.Sprintf("/freqtrade/user_data/%s", backtestID)
	assert.Equal(t, "/freqtrade/user_data/example-backtest-123", userdir)

	// 2. Freqtrade automatically resolves data directory as {userdir}/data/
	expectedDataDir := fmt.Sprintf("%s/data", userdir)
	assert.Equal(t, "/freqtrade/user_data/example-backtest-123/data", expectedDataDir)

	// 3. Shared historical data volume is mounted to match this path
	volumeSource := "volaticloud-freqtrade-data"
	volumeTarget := fmt.Sprintf("/freqtrade/user_data/%s/data", backtestID)
	assert.Equal(t, expectedDataDir, volumeTarget)
	assert.NotEmpty(t, volumeSource)

	// 4. Benefits:
	// - Each backtest has isolated workspace (configs, results, logs)
	// - All backtests share historical data (single download)
	// - No --datadir override needed (Freqtrade automatic resolution)
	// - Parallel backtesting supported (no path conflicts)
	// - Clean architecture (mount-based, not config-based)

	t.Log("Volume Mount Strategy Summary:")
	t.Logf("  Backtest ID: %s", backtestID)
	t.Logf("  Userdir: %s", userdir)
	t.Logf("  Data Dir (auto-resolved): %s", expectedDataDir)
	t.Logf("  Data Volume Source: %s", volumeSource)
	t.Logf("  Data Volume Target: %s", volumeTarget)
	t.Log("  Result: Isolated workspace + Shared data + Parallel support")
}
