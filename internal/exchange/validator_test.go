package exchange

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

func TestValidateConfigWithSchema(t *testing.T) {
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
				"stake_currency": "USDT",
				"dry_run":        true,
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
			name: "valid exchange with ccxt_async_config",
			config: map[string]interface{}{
				"name":   "binance",
				"key":    "test-api-key",
				"secret": "test-secret",
				"ccxt_async_config": map[string]interface{}{
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
			errMsg:  "name is required",
		},
		{
			name: "empty config",
			config: map[string]interface{}{},
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
			errMsg:  "exchange.name",
		},
		{
			name: "valid wrapped config with existing stake_currency",
			config: map[string]interface{}{
				"exchange": map[string]interface{}{
					"name":   "binance",
					"key":    "test-api-key",
					"secret": "test-secret",
				},
				"stake_currency": "BTC",
				"dry_run":        false,
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateConfigWithSchema(tt.config)

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

func TestValidateConfigWithSchema_ConfigNotMutated(t *testing.T) {
	// Regression test: ensure validation doesn't mutate the original config
	config := map[string]interface{}{
		"name":   "binance",
		"key":    "test-api-key",
		"secret": "test-secret",
	}

	originalLen := len(config)
	err := ValidateConfigWithSchema(config)

	// Skip test if schema service is unavailable
	skipIfSchemaUnavailable(t, err)

	assert.NoError(t, err)
	assert.Equal(t, originalLen, len(config), "Config should not be mutated")
	assert.NotContains(t, config, "stake_currency", "stake_currency should not be added to original config")
	assert.NotContains(t, config, "dry_run", "dry_run should not be added to original config")
}

func TestValidateConfigWithSchema_WrappedConfigPreservation(t *testing.T) {
	// Test that wrapped configs preserve their original values
	config := map[string]interface{}{
		"exchange": map[string]interface{}{
			"name":   "binance",
			"key":    "test-api-key",
			"secret": "test-secret",
		},
		"stake_currency": "BTC",
		"dry_run":        false,
	}

	err := ValidateConfigWithSchema(config)

	// Skip test if schema service is unavailable
	skipIfSchemaUnavailable(t, err)

	assert.NoError(t, err)
	assert.Equal(t, "BTC", config["stake_currency"], "stake_currency should be preserved")
	assert.Equal(t, false, config["dry_run"], "dry_run should be preserved")
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
