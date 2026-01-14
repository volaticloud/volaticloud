package graph

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"volaticloud/internal/bot"
	"volaticloud/internal/ent"
	"volaticloud/internal/enum"
	"volaticloud/internal/runner"
)

// TestEmailRegex tests the email validation regex pattern
func TestEmailRegex(t *testing.T) {
	tests := []struct {
		name    string
		email   string
		isValid bool
	}{
		// Valid emails
		{name: "simple email", email: "user@example.com", isValid: true},
		{name: "email with subdomain", email: "user@mail.example.com", isValid: true},
		{name: "email with plus", email: "user+tag@example.com", isValid: true},
		{name: "email with dots", email: "user.name@example.com", isValid: true},
		{name: "email with numbers", email: "user123@example.com", isValid: true},
		{name: "email with hyphen in domain", email: "user@my-company.com", isValid: true},
		{name: "email with underscore", email: "user_name@example.com", isValid: true},
		{name: "email with percent", email: "user%name@example.com", isValid: true},

		// Invalid emails
		{name: "empty string", email: "", isValid: false},
		{name: "no at sign", email: "userexample.com", isValid: false},
		{name: "no domain", email: "user@", isValid: false},
		{name: "no local part", email: "@example.com", isValid: false},
		{name: "no TLD", email: "user@example", isValid: false},
		{name: "single char TLD", email: "user@example.c", isValid: false},
		{name: "spaces in email", email: "user @example.com", isValid: false},
		{name: "multiple at signs", email: "user@@example.com", isValid: false},
		{name: "special chars", email: "user<script>@example.com", isValid: false},
		{name: "newline injection", email: "user\n@example.com", isValid: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := EmailRegex.MatchString(tt.email)
			assert.Equal(t, tt.isValid, result, "EmailRegex.MatchString(%q) = %v, want %v", tt.email, result, tt.isValid)
		})
	}
}

// TestDefaultDashboardClientID verifies the constant is set correctly
func TestDefaultDashboardClientID(t *testing.T) {
	assert.Equal(t, "dashboard", DefaultDashboardClientID, "DefaultDashboardClientID should be 'dashboard'")
}

// TestEmailRegexAlignment verifies the email regex pattern matches across all layers
// This test documents that the regex pattern is aligned with:
// - Go backend (helpers.go): EmailRegex
// - Dashboard (validation.ts): EMAIL_REGEX
// - Java/Keycloak (InvitationService.java): EMAIL_PATTERN
//
// All layers use the same pattern: ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$
//
// NOTE: Full end-to-end invitation flow testing requires a running Keycloak instance.
// Unit tests verify validation logic; integration tests require the complete stack.
func TestEmailRegexAlignment(t *testing.T) {
	// Pattern used across all layers (Go, TypeScript, Java)
	// This test ensures the pattern catches common validation cases
	testCases := []struct {
		email   string
		valid   bool
		comment string
	}{
		// Valid - should pass in all layers
		{"user@example.com", true, "basic email"},
		{"User.Name+Tag@example.co.uk", true, "complex with dots, plus, subdomain"},
		{"test123@my-company.org", true, "numbers and hyphen in domain"},

		// Invalid - should fail in all layers
		{"user@example.c", false, "single char TLD (rejected by {2,})"},
		{"@example.com", false, "no local part"},
		{"user@", false, "no domain"},
		{"user<script>@example.com", false, "script injection attempt"},
		{"user\n@example.com", false, "newline injection"},
		{"user @example.com", false, "space in local part"},
	}

	for _, tc := range testCases {
		t.Run(tc.comment, func(t *testing.T) {
			result := EmailRegex.MatchString(tc.email)
			assert.Equal(t, tc.valid, result,
				"Email %q: expected %v (aligned validation for: %s)", tc.email, tc.valid, tc.comment)
		})
	}
}

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
						"enabled":           false,
						"bids_to_ask_delta": 1,
					},
				},
				"order_types": map[string]interface{}{
					"entry":    "limit",
					"exit":     "limit",
					"stoploss": "market",
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
	jwtSecrets := make(map[string]bool)

	for i := 0; i < 10; i++ {
		config, err := bot.GenerateSecureConfig()
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

		// Verify jwt_secret_key
		jwtSecret, ok := apiServer["jwt_secret_key"].(string)
		assert.True(t, ok, "jwt_secret_key should be a string")
		assert.NotEmpty(t, jwtSecret, "jwt_secret_key should not be empty")
		assert.Equal(t, 43, len(jwtSecret), "jwt_secret_key should be 43 characters (32 bytes base64 URL encoded)")
		jwtSecrets[jwtSecret] = true

		// Verify CORS_origins
		corsOrigins, ok := apiServer["CORS_origins"].([]string)
		assert.True(t, ok, "CORS_origins should be a string array")
		assert.Contains(t, corsOrigins, "https://frequi.volaticloud.com", "CORS_origins should contain frequi URL")
	}

	// Verify all usernames are unique
	assert.Equal(t, 10, len(usernames), "All usernames should be unique")

	// Verify all passwords are unique
	assert.Equal(t, 10, len(passwords), "All passwords should be unique")

	// Verify all jwt_secrets are unique
	assert.Equal(t, 10, len(jwtSecrets), "All jwt_secret_keys should be unique")
}

// TestBuildBotSpec tests the bot spec building function
func TestBuildBotSpec(t *testing.T) {
	tests := []struct {
		name     string
		bot      *ent.Bot
		wantErr  bool
		errMsg   string
		validate func(t *testing.T, spec *runner.BotSpec, bot *ent.Bot)
	}{
		{
			name: "missing exchange",
			bot: &ent.Bot{
				ID:               uuid.New(),
				Name:             "TestBot",
				FreqtradeVersion: "2025.10",
				Mode:             enum.BotModeDryRun,
				Edges: ent.BotEdges{
					Exchange: nil,
					Strategy: &ent.Strategy{
						Name: "TestStrategy",
						Code: "# test code",
					},
				},
			},
			wantErr: true,
			errMsg:  "bot has no exchange",
		},
		{
			name: "missing strategy",
			bot: &ent.Bot{
				ID:               uuid.New(),
				Name:             "TestBot",
				FreqtradeVersion: "2025.10",
				Mode:             enum.BotModeDryRun,
				Edges: ent.BotEdges{
					Exchange: &ent.Exchange{
						Name: "Binance",
						Config: map[string]interface{}{
							"name": "binance",
						},
					},
					Strategy: nil,
				},
			},
			wantErr: true,
			errMsg:  "bot has no strategy",
		},
		{
			name: "dry_run injected for dry run mode",
			bot: &ent.Bot{
				ID:               uuid.New(),
				Name:             "DryRunBot",
				FreqtradeVersion: "2025.10",
				Mode:             enum.BotModeDryRun,
				Config: map[string]interface{}{
					"stake_currency": "USDT",
					"stake_amount":   100,
				},
				SecureConfig: map[string]interface{}{
					"api_server": map[string]interface{}{
						"enabled": true,
					},
				},
				Edges: ent.BotEdges{
					Exchange: &ent.Exchange{
						Name: "Binance",
						Config: map[string]interface{}{
							"name": "binance",
						},
					},
					Strategy: &ent.Strategy{
						Name: "TestStrategy",
						Code: "# test code",
					},
				},
			},
			wantErr: false,
			validate: func(t *testing.T, spec *runner.BotSpec, bot *ent.Bot) {
				// Verify dry_run is true for dry run mode
				dryRun, ok := spec.Config["dry_run"].(bool)
				require.True(t, ok, "dry_run should be a bool")
				assert.True(t, dryRun, "dry_run should be true for dry run mode")

				// Verify original config not mutated
				_, exists := bot.Config["dry_run"]
				assert.False(t, exists, "original bot config should not be mutated")
			},
		},
		{
			name: "dry_run injected for live mode",
			bot: &ent.Bot{
				ID:               uuid.New(),
				Name:             "LiveBot",
				FreqtradeVersion: "2025.10",
				Mode:             enum.BotModeLive,
				Config: map[string]interface{}{
					"stake_currency": "USDT",
					"stake_amount":   100,
				},
				SecureConfig: map[string]interface{}{
					"api_server": map[string]interface{}{
						"enabled": true,
					},
				},
				Edges: ent.BotEdges{
					Exchange: &ent.Exchange{
						Name: "Binance",
						Config: map[string]interface{}{
							"name": "binance",
						},
					},
					Strategy: &ent.Strategy{
						Name: "TestStrategy",
						Code: "# test code",
					},
				},
			},
			wantErr: false,
			validate: func(t *testing.T, spec *runner.BotSpec, bot *ent.Bot) {
				// Verify dry_run is false for live mode
				dryRun, ok := spec.Config["dry_run"].(bool)
				require.True(t, ok, "dry_run should be a bool")
				assert.False(t, dryRun, "dry_run should be false for live mode")

				// Verify original config not mutated
				_, exists := bot.Config["dry_run"]
				assert.False(t, exists, "original bot config should not be mutated")
			},
		},
		{
			name: "config mutation prevention - original config unchanged",
			bot: &ent.Bot{
				ID:               uuid.New(),
				Name:             "MutationTest",
				FreqtradeVersion: "2025.10",
				Mode:             enum.BotModeDryRun,
				Config: map[string]interface{}{
					"stake_currency": "USDT",
					"stake_amount":   100,
					"custom_field":   "original_value",
				},
				SecureConfig: map[string]interface{}{
					"api_server": map[string]interface{}{
						"enabled": true,
					},
				},
				Edges: ent.BotEdges{
					Exchange: &ent.Exchange{
						Name: "Binance",
						Config: map[string]interface{}{
							"name": "binance",
						},
					},
					Strategy: &ent.Strategy{
						Name: "TestStrategy",
						Code: "# test code",
						Config: map[string]interface{}{
							"stoploss": -0.1,
						},
					},
				},
			},
			wantErr: false,
			validate: func(t *testing.T, spec *runner.BotSpec, bot *ent.Bot) {
				// Verify spec has dry_run
				_, ok := spec.Config["dry_run"]
				require.True(t, ok, "spec config should have dry_run")

				// Verify original bot config is unchanged (CRITICAL: regression test for mutation bug)
				_, exists := bot.Config["dry_run"]
				assert.False(t, exists, "original bot config should NOT have dry_run (no mutation)")

				// Verify other original fields are preserved
				assert.Equal(t, "USDT", bot.Config["stake_currency"])
				assert.Equal(t, 100, bot.Config["stake_amount"])
				assert.Equal(t, "original_value", bot.Config["custom_field"])

				// Verify spec has all original fields plus dry_run
				assert.Equal(t, "USDT", spec.Config["stake_currency"])
				assert.Equal(t, 100, spec.Config["stake_amount"])
				assert.Equal(t, "original_value", spec.Config["custom_field"])
			},
		},
		{
			name: "nil config handled correctly",
			bot: &ent.Bot{
				ID:               uuid.New(),
				Name:             "NilConfigBot",
				FreqtradeVersion: "2025.10",
				Mode:             enum.BotModeDryRun,
				Config:           nil, // No config provided
				SecureConfig: map[string]interface{}{
					"api_server": map[string]interface{}{
						"enabled": true,
					},
				},
				Edges: ent.BotEdges{
					Exchange: &ent.Exchange{
						Name: "Binance",
						Config: map[string]interface{}{
							"name": "binance",
						},
					},
					Strategy: &ent.Strategy{
						Name: "TestStrategy",
						Code: "# test code",
					},
				},
			},
			wantErr: false,
			validate: func(t *testing.T, spec *runner.BotSpec, bot *ent.Bot) {
				// Verify spec config is not nil and has dry_run
				require.NotNil(t, spec.Config, "spec config should not be nil")
				dryRun, ok := spec.Config["dry_run"].(bool)
				require.True(t, ok, "dry_run should be a bool")
				assert.True(t, dryRun, "dry_run should be true")

				// Verify only dry_run is in the config
				assert.Equal(t, 1, len(spec.Config), "spec config should only have dry_run")
			},
		},
		{
			name: "all fields populated correctly",
			bot: &ent.Bot{
				ID:               uuid.New(),
				Name:             "CompleteBot",
				FreqtradeVersion: "2025.10",
				Mode:             enum.BotModeDryRun,
				Config: map[string]interface{}{
					"stake_currency": "USDT",
					"stake_amount":   100,
				},
				SecureConfig: map[string]interface{}{
					"api_server": map[string]interface{}{
						"enabled":  true,
						"username": "admin",
						"password": "secret",
					},
				},
				Edges: ent.BotEdges{
					Exchange: &ent.Exchange{
						Name: "Binance",
						Config: map[string]interface{}{
							"name":       "binance",
							"api_key":    "key123",
							"api_secret": "secret456",
						},
					},
					Strategy: &ent.Strategy{
						Name: "MyStrategy",
						Code: "# strategy code here",
						Config: map[string]interface{}{
							"stoploss":    -0.1,
							"take_profit": 0.2,
						},
					},
				},
			},
			wantErr: false,
			validate: func(t *testing.T, spec *runner.BotSpec, bot *ent.Bot) {
				// Verify basic fields
				assert.Equal(t, bot.ID.String(), spec.ID)
				assert.Equal(t, bot.Name, spec.Name)
				assert.Equal(t, "freqtradeorg/freqtrade:2025.10", spec.Image)
				assert.Equal(t, "2025.10", spec.FreqtradeVersion)
				assert.Equal(t, "MyStrategy", spec.StrategyName)
				assert.Equal(t, "# strategy code here", spec.StrategyCode)

				// Verify configs are separate
				assert.NotNil(t, spec.Config)
				assert.NotNil(t, spec.StrategyConfig)
				assert.NotNil(t, spec.ExchangeConfig)
				assert.NotNil(t, spec.SecureConfig)

				// Verify strategy config
				assert.Equal(t, -0.1, spec.StrategyConfig["stoploss"])
				assert.Equal(t, 0.2, spec.StrategyConfig["take_profit"])

				// Verify exchange config
				assert.Equal(t, "binance", spec.ExchangeConfig["name"])
				assert.Equal(t, "key123", spec.ExchangeConfig["api_key"])

				// Verify secure config
				apiServer, ok := spec.SecureConfig["api_server"].(map[string]interface{})
				require.True(t, ok)
				assert.Equal(t, true, apiServer["enabled"])
				assert.Equal(t, "admin", apiServer["username"])

				// Verify environment map exists
				assert.NotNil(t, spec.Environment)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			spec, err := buildBotSpec(tt.bot)

			if tt.wantErr {
				require.Error(t, err, "Expected error but got none")
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg, "Error message should contain expected text")
				}
				return
			}

			require.NoError(t, err, "Expected no error but got: %v", err)
			require.NotNil(t, spec, "Spec should not be nil")

			if tt.validate != nil {
				tt.validate(t, spec, tt.bot)
			}
		})
	}
}
