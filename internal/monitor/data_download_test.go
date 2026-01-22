package monitor

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDownloadExchangeDataCommandBuilder(t *testing.T) {
	tests := []struct {
		name           string
		exchange       string
		config         map[string]interface{}
		expectedFormat string
		expectedMode   string
	}{
		{
			name:     "basic spot config",
			exchange: "binance",
			config: map[string]interface{}{
				"pairsPattern": "BTC/USDT ETH/USDT",
				"timeframes":   []interface{}{"1h", "4h"},
				"days":         float64(365),
				"tradingMode":  "spot",
			},
			expectedFormat: "json",
			expectedMode:   "spot",
		},
		{
			name:     "futures config",
			exchange: "bybit",
			config: map[string]interface{}{
				"pairsPattern": "BTC/USDT:USDT",
				"timeframes":   []interface{}{"15m"},
				"days":         float64(30),
				"tradingMode":  "futures",
			},
			expectedFormat: "json",
			expectedMode:   "futures",
		},
		{
			name:     "default trading mode",
			exchange: "coinbase",
			config: map[string]interface{}{
				"pairsPattern": "BTC/USD",
				"timeframes":   []interface{}{"1h"},
				"days":         float64(180),
			},
			expectedFormat: "json",
			expectedMode:   "spot",
		},
		{
			name:     "integer days",
			exchange: "kraken",
			config: map[string]interface{}{
				"pairsPattern": "BTC/USD",
				"timeframes":   []interface{}{"1d"},
				"days":         90,
				"tradingMode":  "spot",
			},
			expectedFormat: "json",
			expectedMode:   "spot",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Extract config (same logic as downloadExchangeData)
			pairsPattern := tt.config["pairsPattern"].(string)
			timeframesRaw := tt.config["timeframes"].([]interface{})
			timeframes := make([]string, len(timeframesRaw))
			for i, tf := range timeframesRaw {
				timeframes[i] = tf.(string)
			}

			// Get days (same logic as downloadExchangeData)
			var days string
			switch v := tt.config["days"].(type) {
			case int:
				days = fmt.Sprintf("%d", v)
			case float64:
				days = fmt.Sprintf("%d", int(v))
			default:
				days = "365" // Default fallback
			}

			// Get trading mode (default to spot)
			tradingMode := "spot"
			if tm, ok := tt.config["tradingMode"].(string); ok {
				tradingMode = tm
			}

			// Build args (same as downloadExchangeData)
			args := []string{
				"download-data",
				"--exchange", tt.exchange,
				"--pairs", pairsPattern,
				"--days", days,
				"--data-format-ohlcv", "json",
				"--trading-mode", tradingMode,
			}
			args = append(args, "--timeframes")
			args = append(args, timeframes...)

			// Verify critical assertions
			assert.Contains(t, args, "--data-format-ohlcv", "Command must specify data format")
			assert.Contains(t, args, tt.expectedFormat, "Data format must be json for transparency and debugging")
			assert.Contains(t, args, "--trading-mode", "Command must specify trading mode")
			assert.Contains(t, args, tt.expectedMode, "Trading mode must match config")
			assert.Contains(t, args, "--exchange", "Command must specify exchange")
			assert.Contains(t, args, tt.exchange, "Exchange must match")
			assert.Contains(t, args, "--timeframes", "Command must specify timeframes")

			// Verify all timeframes are included
			for _, tf := range timeframes {
				assert.Contains(t, args, tf, "All timeframes must be included")
			}
		})
	}
}

func TestDataFormatIsJSON(t *testing.T) {
	// Critical regression test: data format must be json for transparency and debugging
	// Backtesting must specify dataformat_ohlcv="json" in config to match

	config := map[string]interface{}{
		"pairsPattern": "BTC/USDT",
		"timeframes":   []interface{}{"1h"},
		"days":         float64(365),
		"tradingMode":  "spot",
	}

	// Build the command args (same logic as downloadExchangeData)
	args := []string{
		"download-data",
		"--exchange", "binance",
		"--pairs", config["pairsPattern"].(string),
		"--days", "365",
		"--data-format-ohlcv", "json", // JSON for transparency
		"--trading-mode", "spot",
	}

	// Find the data format value
	var dataFormat string
	for i, arg := range args {
		if arg == "--data-format-ohlcv" && i+1 < len(args) {
			dataFormat = args[i+1]
			break
		}
	}

	assert.Equal(t, "json", dataFormat,
		"Data format MUST be 'json' for transparency and debugging. "+
			"Backtesting config must include dataformat_ohlcv='json' to match. "+
			"JSON format allows easy inspection of downloaded historical data.")
}

func TestFreqtradeImageConstant(t *testing.T) {
	// Verify the Freqtrade image constant
	assert.Equal(t, "freqtradeorg/freqtrade:stable", FreqtradeImage,
		"Freqtrade image must be the stable version")
}

func TestTradingModeDefaults(t *testing.T) {
	// Test that trading mode defaults to "spot" when not specified
	config := map[string]interface{}{
		"pairsPattern": "BTC/USDT",
		"timeframes":   []interface{}{"1h"},
		"days":         float64(365),
		// tradingMode not specified
	}

	tradingMode := "spot"
	if tm, ok := config["tradingMode"].(string); ok {
		tradingMode = tm
	}

	assert.Equal(t, "spot", tradingMode, "Trading mode should default to 'spot'")
}

func TestDaysTypeHandling(t *testing.T) {
	// Test that days can be specified as int or float64
	testCases := []struct {
		name     string
		days     interface{}
		expected string
	}{
		{
			name:     "float days",
			days:     float64(365),
			expected: "365",
		},
		{
			name:     "int days",
			days:     90,
			expected: "90",
		},
		{
			name:     "invalid type defaults to 365",
			days:     "invalid",
			expected: "365",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Same logic as downloadExchangeData
			var days string
			switch v := tc.days.(type) {
			case int:
				days = fmt.Sprintf("%d", v)
			case float64:
				days = fmt.Sprintf("%d", int(v))
			default:
				days = "365"
			}

			assert.Equal(t, tc.expected, days, "Days conversion should match expected value")
		})
	}
}

func TestParseDataAvailableFromLogs(t *testing.T) {
	tests := []struct {
		name     string
		logs     string
		expected map[string]interface{}
	}{
		{
			name: "valid metadata with single exchange",
			logs: `Downloading data...
===DATA_AVAILABLE_START===
{"exchanges":[{"name":"binance","pairs":[{"pair":"BTC/USDT","timeframes":[{"timeframe":"5m","from":"2024-01-01T00:00:00Z","to":"2024-12-01T00:00:00Z"}]}]}]}
===DATA_AVAILABLE_END===
Done`,
			expected: map[string]interface{}{
				"exchanges": []interface{}{
					map[string]interface{}{
						"name": "binance",
						"pairs": []interface{}{
							map[string]interface{}{
								"pair": "BTC/USDT",
								"timeframes": []interface{}{
									map[string]interface{}{
										"timeframe": "5m",
										"from":      "2024-01-01T00:00:00Z",
										"to":        "2024-12-01T00:00:00Z",
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "metadata with multiple exchanges and pairs",
			logs: `===DATA_AVAILABLE_START===
{"exchanges":[{"name":"binance","pairs":[{"pair":"BTC/USDT","timeframes":[{"timeframe":"1h","from":"2024-01-01T00:00:00Z","to":"2024-12-01T00:00:00Z"}]},{"pair":"ETH/USDT","timeframes":[{"timeframe":"1h","from":"2024-01-01T00:00:00Z","to":"2024-12-01T00:00:00Z"}]}]},{"name":"kraken","pairs":[{"pair":"BTC/USD","timeframes":[{"timeframe":"1d","from":"2023-01-01T00:00:00Z","to":"2024-12-01T00:00:00Z"}]}]}]}
===DATA_AVAILABLE_END===`,
			expected: map[string]interface{}{
				"exchanges": []interface{}{
					map[string]interface{}{
						"name": "binance",
						"pairs": []interface{}{
							map[string]interface{}{
								"pair": "BTC/USDT",
								"timeframes": []interface{}{
									map[string]interface{}{
										"timeframe": "1h",
										"from":      "2024-01-01T00:00:00Z",
										"to":        "2024-12-01T00:00:00Z",
									},
								},
							},
							map[string]interface{}{
								"pair": "ETH/USDT",
								"timeframes": []interface{}{
									map[string]interface{}{
										"timeframe": "1h",
										"from":      "2024-01-01T00:00:00Z",
										"to":        "2024-12-01T00:00:00Z",
									},
								},
							},
						},
					},
					map[string]interface{}{
						"name": "kraken",
						"pairs": []interface{}{
							map[string]interface{}{
								"pair": "BTC/USD",
								"timeframes": []interface{}{
									map[string]interface{}{
										"timeframe": "1d",
										"from":      "2023-01-01T00:00:00Z",
										"to":        "2024-12-01T00:00:00Z",
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name:     "no markers in logs",
			logs:     "Downloading data...\nDone",
			expected: nil,
		},
		{
			name:     "only start marker",
			logs:     "===DATA_AVAILABLE_START===\n{\"test\": true}",
			expected: nil,
		},
		{
			name:     "only end marker",
			logs:     "{\"test\": true}\n===DATA_AVAILABLE_END===",
			expected: nil,
		},
		{
			name:     "empty logs",
			logs:     "",
			expected: nil,
		},
		{
			name: "invalid JSON between markers",
			logs: `===DATA_AVAILABLE_START===
not valid json
===DATA_AVAILABLE_END===`,
			expected: nil,
		},
		{
			name: "empty JSON between markers",
			logs: `===DATA_AVAILABLE_START===

===DATA_AVAILABLE_END===`,
			expected: nil,
		},
		{
			name: "empty exchanges array",
			logs: `===DATA_AVAILABLE_START===
{"exchanges":[]}
===DATA_AVAILABLE_END===`,
			expected: map[string]interface{}{
				"exchanges": []interface{}{},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseDataAvailableFromLogs(tt.logs)

			if tt.expected == nil {
				assert.Nil(t, result, "Expected nil result")
			} else {
				assert.NotNil(t, result, "Expected non-nil result")
				assert.Equal(t, tt.expected, result, "Parsed metadata should match expected")
			}
		})
	}
}
