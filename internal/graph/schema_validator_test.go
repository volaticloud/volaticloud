package graph

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// skipIfSchemaUnavailable skips the test if the Freqtrade schema is unavailable
func skipIfSchemaUnavailable(t *testing.T, err error) {
	if err != nil && (strings.Contains(err.Error(), "503") || strings.Contains(err.Error(), "Could not read schema")) {
		t.Skip("Skipping test: Freqtrade schema service is unavailable")
	}
}

func TestValidateFreqtradeConfigWithSchema(t *testing.T) {
	tests := []struct {
		name    string
		config  map[string]interface{}
		wantErr bool
		errMsg  string
	}{
		{
			name:    "nil config",
			config:  nil,
			wantErr: true,
			errMsg:  "config cannot be nil",
		},
		{
			name: "valid minimal config",
			config: map[string]interface{}{
				"stake_currency": "USDT",
				"stake_amount":   10.0,
				"dry_run":        true,
				"exchange": map[string]interface{}{
					"name":   "binance",
					"key":    "test-key",
					"secret": "test-secret",
				},
				"entry_pricing": map[string]interface{}{
					"price_side":     "same",
					"use_order_book": false,
				},
				"exit_pricing": map[string]interface{}{
					"price_side":     "same",
					"use_order_book": false,
				},
			},
			wantErr: false,
		},
		{
			name: "valid complete config",
			config: map[string]interface{}{
				"stake_currency": "USDT",
				"stake_amount":   100.0,
				"dry_run":        true,
				"timeframe":      "5m",
				"max_open_trades": 3,
				"exchange": map[string]interface{}{
					"name":   "binance",
					"key":    "test-key",
					"secret": "test-secret",
					"pair_whitelist": []interface{}{
						"BTC/USDT",
						"ETH/USDT",
					},
				},
				"entry_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
				"exit_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
				"pairlists": []interface{}{
					map[string]interface{}{
						"method": "StaticPairList",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "invalid stake_currency type",
			config: map[string]interface{}{
				"stake_currency": 123, // should be string
				"stake_amount":   10.0,
				"dry_run":        true,
			},
			wantErr: true,
			errMsg:  "stake_currency",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateFreqtradeConfigWithSchema(tt.config)

			// Skip test if schema service is unavailable
			skipIfSchemaUnavailable(t, err)

			if tt.wantErr {
				require.Error(t, err, "Expected error but got none")
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg,
						"Error message should contain expected substring")
				}
			} else {
				assert.NoError(t, err, "Expected no error but got: %v", err)
			}
		})
	}
}

func TestValidateExchangeConfigWithSchema(t *testing.T) {
	tests := []struct {
		name    string
		config  map[string]interface{}
		wantErr bool
		errMsg  string
	}{
		{
			name:    "nil config",
			config:  nil,
			wantErr: true,
			errMsg:  "exchange config cannot be nil",
		},
		{
			name: "valid exchange config - unwrapped",
			config: map[string]interface{}{
				"name":   "binance",
				"key":    "test-api-key",
				"secret": "test-secret",
			},
			wantErr: false,
		},
		{
			name: "valid exchange config - wrapped",
			config: map[string]interface{}{
				"exchange": map[string]interface{}{
					"name":   "binance",
					"key":    "test-api-key",
					"secret": "test-secret",
				},
			},
			wantErr: false,
		},
		{
			name: "valid exchange with pair_whitelist",
			config: map[string]interface{}{
				"name":   "binance",
				"key":    "test-api-key",
				"secret": "test-secret",
				"pair_whitelist": []interface{}{
					"BTC/USDT",
					"ETH/USDT",
				},
			},
			wantErr: false,
		},
		{
			name: "valid exchange with ccxt_config",
			config: map[string]interface{}{
				"name":   "binance",
				"key":    "test-api-key",
				"secret": "test-secret",
				"ccxt_config": map[string]interface{}{
					"enableRateLimit": true,
				},
			},
			wantErr: false,
		},
		{
			name: "missing required field - name",
			config: map[string]interface{}{
				"key":    "test-api-key",
				"secret": "test-secret",
			},
			wantErr: true,
			errMsg:  "exchange",
		},
		{
			name:    "empty config",
			config:  map[string]interface{}{},
			wantErr: true,
			errMsg:  "exchange",
		},
		{
			name: "invalid exchange name type",
			config: map[string]interface{}{
				"name":   123, // should be string
				"key":    "test-api-key",
				"secret": "test-secret",
			},
			wantErr: true,
			errMsg:  "exchange",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateExchangeConfigWithSchema(tt.config)

			// Skip test if schema service is unavailable
			skipIfSchemaUnavailable(t, err)

			if tt.wantErr {
				require.Error(t, err, "Expected error but got none")
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg,
						"Error message should contain expected substring")
				}
			} else {
				assert.NoError(t, err, "Expected no error but got: %v", err)
			}
		})
	}
}

func TestValidateExchangeConfigWithSchema_ConfigNotMutated(t *testing.T) {
	// Regression test: ensure validation doesn't mutate the original config
	config := map[string]interface{}{
		"name":   "binance",
		"key":    "test-api-key",
		"secret": "test-secret",
	}

	originalLen := len(config)
	err := ValidateExchangeConfigWithSchema(config)

	// Skip test if schema service is unavailable
	skipIfSchemaUnavailable(t, err)

	assert.NoError(t, err)
	assert.Equal(t, originalLen, len(config), "Config should not be mutated")
	assert.NotContains(t, config, "stake_currency", "stake_currency should not be added to original config")
	assert.NotContains(t, config, "dry_run", "dry_run should not be added to original config")
}

func TestGetSchemaLoader_Singleton(t *testing.T) {
	// Test that schema loader is cached (singleton pattern)
	loader1, err1 := getSchemaLoader()
	loader2, err2 := getSchemaLoader()

	// Both calls should return the same error (or lack thereof) - this proves caching works
	if err1 != nil || err2 != nil {
		// If there's an error (e.g., schema service is down), both errors should be identical
		assert.Equal(t, err1, err2, "Errors should be identical (proves singleton caching)")

		// Skip further checks if schema service is unavailable
		if err1 != nil {
			t.Logf("Schema service unavailable (expected for external dependency): %v", err1)
			return
		}
	}

	// If schema loaded successfully, verify loaders are not nil
	assert.NotNil(t, loader1)
	assert.NotNil(t, loader2)
}

func TestValidateFreqtradeConfigWithSchema_ComplexStructures(t *testing.T) {
	// Test validation with complex nested structures
	config := map[string]interface{}{
		"stake_currency":  "USDT",
		"stake_amount":    "unlimited",
		"dry_run":         true,
		"max_open_trades": 5,
		"exchange": map[string]interface{}{
			"name":   "binance",
			"key":    "test-key",
			"secret": "test-secret",
			"ccxt_config": map[string]interface{}{
				"enableRateLimit": true,
				"rateLimit":       1000,
			},
			"pair_whitelist": []interface{}{
				"BTC/USDT",
			},
		},
		"entry_pricing": map[string]interface{}{
			"price_side":     "same",
			"use_order_book": false,
		},
		"exit_pricing": map[string]interface{}{
			"price_side":     "same",
			"use_order_book": false,
		},
		"order_types": map[string]interface{}{
			"entry":                "limit",
			"exit":                 "limit",
			"stoploss":             "market",
			"stoploss_on_exchange": false,
		},
		"pairlists": []interface{}{
			map[string]interface{}{
				"method": "StaticPairList",
			},
		},
	}

	err := validateFreqtradeConfigWithSchema(config)

	// Skip test if schema service is unavailable
	skipIfSchemaUnavailable(t, err)

	assert.NoError(t, err, "Complex valid config should pass validation")
}
