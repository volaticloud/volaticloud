package graph

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestValidateFreqtradeConfig tests the validation function with various scenarios
func TestValidateFreqtradeConfig(t *testing.T) {
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
			errMsg:  "bot config is required",
		},
		{
			name:    "empty config",
			config:  map[string]interface{}{},
			wantErr: true,
			errMsg:  "missing required Freqtrade config fields",
		},
		{
			name: "missing stake_currency",
			config: map[string]interface{}{
				"stake_amount": 10,
				"exit_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
				"entry_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
			},
			wantErr: true,
			errMsg:  "stake_currency",
		},
		{
			name: "missing stake_amount",
			config: map[string]interface{}{
				"stake_currency": "USDT",
				"exit_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
				"entry_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
			},
			wantErr: true,
			errMsg:  "stake_amount",
		},
		{
			name: "missing exit_pricing",
			config: map[string]interface{}{
				"stake_currency": "USDT",
				"stake_amount":   10,
				"entry_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
			},
			wantErr: true,
			errMsg:  "exit_pricing",
		},
		{
			name: "missing entry_pricing",
			config: map[string]interface{}{
				"stake_currency": "USDT",
				"stake_amount":   10,
				"exit_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
			},
			wantErr: true,
			errMsg:  "entry_pricing",
		},
		{
			name: "exit_pricing missing price_side",
			config: map[string]interface{}{
				"stake_currency": "USDT",
				"stake_amount":   10,
				"exit_pricing": map[string]interface{}{
					"use_order_book": true,
					"order_book_top": 1,
				},
				"entry_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
			},
			wantErr: true,
			errMsg:  "exit_pricing.price_side is required",
		},
		{
			name: "exit_pricing missing use_order_book",
			config: map[string]interface{}{
				"stake_currency": "USDT",
				"stake_amount":   10,
				"exit_pricing": map[string]interface{}{
					"price_side":     "other",
					"order_book_top": 1,
				},
				"entry_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
			},
			wantErr: true,
			errMsg:  "exit_pricing.use_order_book is required",
		},
		{
			name: "exit_pricing missing order_book_top",
			config: map[string]interface{}{
				"stake_currency": "USDT",
				"stake_amount":   10,
				"exit_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
				},
				"entry_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
			},
			wantErr: true,
			errMsg:  "exit_pricing.order_book_top is required",
		},
		{
			name: "exit_pricing not an object",
			config: map[string]interface{}{
				"stake_currency": "USDT",
				"stake_amount":   10,
				"exit_pricing":   "invalid",
				"entry_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
			},
			wantErr: true,
			errMsg:  "exit_pricing must be an object",
		},
		{
			name: "entry_pricing missing price_side",
			config: map[string]interface{}{
				"stake_currency": "USDT",
				"stake_amount":   10,
				"exit_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
				"entry_pricing": map[string]interface{}{
					"use_order_book": true,
					"order_book_top": 1,
				},
			},
			wantErr: true,
			errMsg:  "entry_pricing.price_side is required",
		},
		{
			name: "entry_pricing not an object",
			config: map[string]interface{}{
				"stake_currency": "USDT",
				"stake_amount":   10,
				"exit_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
				"entry_pricing": "invalid",
			},
			wantErr: true,
			errMsg:  "entry_pricing must be an object",
		},
		{
			name: "stake_amount is string (invalid type)",
			config: map[string]interface{}{
				"stake_currency": "USDT",
				"stake_amount":   "invalid",
				"exit_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
				"entry_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
			},
			wantErr: true,
			errMsg:  "stake_amount must be a number",
		},
		{
			name: "stake_currency is number (invalid type)",
			config: map[string]interface{}{
				"stake_currency": 123,
				"stake_amount":   10,
				"exit_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
				"entry_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
			},
			wantErr: true,
			errMsg:  "stake_currency must be a string",
		},
		{
			name: "valid minimal config with int stake_amount",
			config: map[string]interface{}{
				"stake_currency": "USDT",
				"stake_amount":   10,
				"exit_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
				"entry_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
			},
			wantErr: false,
		},
		{
			name: "valid config with float64 stake_amount",
			config: map[string]interface{}{
				"stake_currency": "USDT",
				"stake_amount":   10.5,
				"exit_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
				"entry_pricing": map[string]interface{}{
					"price_side":     "other",
					"use_order_book": true,
					"order_book_top": 1,
				},
			},
			wantErr: false,
		},
		{
			name: "valid complete config with optional fields",
			config: map[string]interface{}{
				"stake_currency":  "USDT",
				"stake_amount":    10,
				"dry_run_wallet":  1000,
				"timeframe":       "5m",
				"max_open_trades": 3,
				"exit_pricing": map[string]interface{}{
					"price_side":         "other",
					"use_order_book":     true,
					"order_book_top":     1,
					"price_last_balance": 0.0,
				},
				"entry_pricing": map[string]interface{}{
					"price_side":         "other",
					"use_order_book":     true,
					"order_book_top":     1,
					"price_last_balance": 0.0,
					"check_depth_of_market": map[string]interface{}{
						"enabled":          false,
						"bids_to_ask_delta": 1,
					},
				},
				"order_types": map[string]interface{}{
					"entry":     "limit",
					"exit":      "limit",
					"stoploss":  "market",
				},
				"pairlists": []interface{}{
					map[string]interface{}{
						"method": "StaticPairList",
					},
				},
				"exchange": map[string]interface{}{
					"pair_whitelist": []interface{}{"BTC/USDT", "ETH/USDT"},
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateFreqtradeConfig(tt.config)
			if tt.wantErr {
				assert.Error(t, err, "Expected error but got none")
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg, "Error message should contain expected text")
				}
			} else {
				assert.NoError(t, err, "Expected no error but got: %v", err)
			}
		})
	}
}

// TestGenerateSecureConfig tests the secure config generation
func TestGenerateSecureConfig(t *testing.T) {
	// Generate multiple configs to test uniqueness
	configs := make([]map[string]interface{}, 10)
	usernames := make(map[string]bool)
	passwords := make(map[string]bool)

	for i := 0; i < 10; i++ {
		config, err := generateSecureConfig()
		assert.NoError(t, err, "Should not error when generating secure config")
		assert.NotNil(t, config, "Config should not be nil")

		configs[i] = config

		// Verify initial_state is always "running"
		initialState, ok := config["initial_state"].(string)
		assert.True(t, ok, "initial_state should be a string")
		assert.Equal(t, "running", initialState, "initial_state should always be 'running'")

		// Verify api_server exists and is a map
		apiServer, ok := config["api_server"].(map[string]interface{})
		assert.True(t, ok, "api_server should be a map")
		assert.NotNil(t, apiServer, "api_server should not be nil")

		// Verify api_server fields
		assert.Equal(t, true, apiServer["enabled"], "api_server.enabled should be true")
		assert.Equal(t, "0.0.0.0", apiServer["listen_ip_address"], "api_server.listen_ip_address should be 0.0.0.0")
		assert.Equal(t, 8080, apiServer["listen_port"], "api_server.listen_port should be 8080")
		assert.Equal(t, true, apiServer["enable_openapi"], "api_server.enable_openapi should be true")

		// Verify username format
		username, ok := apiServer["username"].(string)
		assert.True(t, ok, "username should be a string")
		assert.NotEmpty(t, username, "username should not be empty")
		assert.True(t, len(username) >= 7, "username should be at least 7 characters (admin_ + random)")
		assert.True(t, username[:6] == "admin_", "username should start with admin_")
		usernames[username] = true

		// Verify password
		password, ok := apiServer["password"].(string)
		assert.True(t, ok, "password should be a string")
		assert.NotEmpty(t, password, "password should not be empty")
		assert.Equal(t, 32, len(password), "password should be 32 characters")
		passwords[password] = true
	}

	// Verify all usernames are unique
	assert.Equal(t, 10, len(usernames), "All usernames should be unique")

	// Verify all passwords are unique
	assert.Equal(t, 10, len(passwords), "All passwords should be unique")
}
