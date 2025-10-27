package graph

import (
	"anytrade/internal/ent"
	"anytrade/internal/enum"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

// TestExtractExchangeCredentials tests credential extraction from exchange config
func TestExtractExchangeCredentials(t *testing.T) {
	tests := []struct {
		name           string
		exchange       *ent.Exchange
		wantAPIKey     string
		wantAPISecret  string
		wantErr        bool
		errMsg         string
	}{
		{
			name: "nil config",
			exchange: &ent.Exchange{
				Name:   string(enum.ExchangeBinance),
				Config: nil,
			},
			wantErr: true,
			errMsg:  "exchange has no config",
		},
		{
			name: "empty config",
			exchange: &ent.Exchange{
				Name:   string(enum.ExchangeBinance),
				Config: map[string]interface{}{},
			},
			wantErr: true,
			errMsg:  "exchange config not found",
		},
		{
			name: "config missing exchange key",
			exchange: &ent.Exchange{
				Name: string(enum.ExchangeBinance),
				Config: map[string]interface{}{
					"other": map[string]interface{}{},
				},
			},
			wantErr: true,
			errMsg:  "exchange config not found for binance",
		},
		{
			name: "exchange config not a map",
			exchange: &ent.Exchange{
				Name: string(enum.ExchangeBinance),
				Config: map[string]interface{}{
					"binance": "invalid",
				},
			},
			wantErr: true,
			errMsg:  "exchange config not found for binance",
		},
		{
			name: "missing api_key",
			exchange: &ent.Exchange{
				Name: string(enum.ExchangeBinance),
				Config: map[string]interface{}{
					"binance": map[string]interface{}{
						"api_secret": "secret123",
					},
				},
			},
			wantErr: true,
			errMsg:  "api_key not found",
		},
		{
			name: "empty api_key",
			exchange: &ent.Exchange{
				Name: string(enum.ExchangeBinance),
				Config: map[string]interface{}{
					"binance": map[string]interface{}{
						"api_key":    "",
						"api_secret": "secret123",
					},
				},
			},
			wantErr: true,
			errMsg:  "api_key not found",
		},
		{
			name: "api_key not a string",
			exchange: &ent.Exchange{
				Name: string(enum.ExchangeBinance),
				Config: map[string]interface{}{
					"binance": map[string]interface{}{
						"api_key":    123,
						"api_secret": "secret123",
					},
				},
			},
			wantErr: true,
			errMsg:  "api_key not found",
		},
		{
			name: "missing api_secret",
			exchange: &ent.Exchange{
				Name: string(enum.ExchangeBinance),
				Config: map[string]interface{}{
					"binance": map[string]interface{}{
						"api_key": "key123",
					},
				},
			},
			wantErr: true,
			errMsg:  "api_secret not found",
		},
		{
			name: "empty api_secret",
			exchange: &ent.Exchange{
				Name: string(enum.ExchangeBinance),
				Config: map[string]interface{}{
					"binance": map[string]interface{}{
						"api_key":    "key123",
						"api_secret": "",
					},
				},
			},
			wantErr: true,
			errMsg:  "api_secret not found",
		},
		{
			name: "api_secret not a string",
			exchange: &ent.Exchange{
				Name: string(enum.ExchangeBinance),
				Config: map[string]interface{}{
					"binance": map[string]interface{}{
						"api_key":    "key123",
						"api_secret": 456,
					},
				},
			},
			wantErr: true,
			errMsg:  "api_secret not found",
		},
		{
			name: "valid binance credentials",
			exchange: &ent.Exchange{
				Name: string(enum.ExchangeBinance),
				Config: map[string]interface{}{
					"binance": map[string]interface{}{
						"api_key":    "my_api_key",
						"api_secret": "my_api_secret",
					},
				},
			},
			wantAPIKey:    "my_api_key",
			wantAPISecret: "my_api_secret",
			wantErr:       false,
		},
		{
			name: "valid coinbase credentials",
			exchange: &ent.Exchange{
				Name: enum.ExchangeCoinbase,
				Config: map[string]interface{}{
					"coinbase": map[string]interface{}{
						"api_key":    "coinbase_key",
						"api_secret": "coinbase_secret",
					},
				},
			},
			wantAPIKey:    "coinbase_key",
			wantAPISecret: "coinbase_secret",
			wantErr:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			apiKey, apiSecret, err := extractExchangeCredentials(tt.exchange)
			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.wantAPIKey, apiKey)
				assert.Equal(t, tt.wantAPISecret, apiSecret)
			}
		})
	}
}

// TestBuildBotSpec tests the BotSpec building function
func TestBuildBotSpec(t *testing.T) {
	t.Run("missing exchange edge", func(t *testing.T) {
		bot := &ent.Bot{
			ID:               uuid.New(),
			Name:             "Test Bot",
			FreqtradeVersion: "2024.1",
			Mode:             enum.BotModeDryRun,
			Config:           map[string]interface{}{},
		}

		spec, err := buildBotSpec(bot)
		assert.Error(t, err)
		assert.Nil(t, spec)
		assert.Contains(t, err.Error(), "bot has no exchange")
	})

	t.Run("missing strategy edge", func(t *testing.T) {
		bot := &ent.Bot{
			ID:               uuid.New(),
			Name:             "Test Bot",
			FreqtradeVersion: "2024.1",
			Mode:             enum.BotModeDryRun,
			Config:           map[string]interface{}{},
			Edges: ent.BotEdges{
				Exchange: &ent.Exchange{
					Name: string(enum.ExchangeBinance),
					Config: map[string]interface{}{
						"binance": map[string]interface{}{
							"api_key":    "key",
							"api_secret": "secret",
						},
					},
				},
			},
		}

		spec, err := buildBotSpec(bot)
		assert.Error(t, err)
		assert.Nil(t, spec)
		assert.Contains(t, err.Error(), "bot has no strategy")
	})

	t.Run("valid bot spec with dry_run mode", func(t *testing.T) {
		botID := uuid.New()
		botConfig := map[string]interface{}{
			"stake_currency": "USDT",
			"stake_amount":   10,
		}

		bot := &ent.Bot{
			ID:               botID,
			Name:             "Test Bot",
			FreqtradeVersion: "2024.1",
			Mode:             enum.BotModeDryRun,
			Config:           botConfig,
			APIUsername:      "admin",
			APIPassword:      "pass123",
			Edges: ent.BotEdges{
				Exchange: &ent.Exchange{
					Name: string(enum.ExchangeBinance),
					Config: map[string]interface{}{
						"binance": map[string]interface{}{
							"api_key":    "my_key",
							"api_secret": "my_secret",
						},
					},
				},
				Strategy: &ent.Strategy{
					Name: "TestStrategy",
					Code: "strategy code here",
					Config: map[string]interface{}{
						"buy_param": 1,
					},
				},
			},
		}

		spec, err := buildBotSpec(bot)
		require.NoError(t, err)
		require.NotNil(t, spec)

		// Verify spec fields
		assert.Equal(t, botID.String(), spec.ID)
		assert.Equal(t, "Test Bot", spec.Name)
		assert.Equal(t, "freqtradeorg/freqtrade:2024.1", spec.Image)
		assert.Equal(t, "2024.1", spec.FreqtradeVersion)
		assert.Equal(t, "TestStrategy", spec.StrategyName)
		assert.Equal(t, "strategy code here", spec.StrategyCode)
		assert.Equal(t, "binance", spec.ExchangeName)
		assert.Equal(t, "my_key", spec.ExchangeAPIKey)
		assert.Equal(t, "my_secret", spec.ExchangeSecret)
		assert.Equal(t, "admin", spec.APIUsername)
		assert.Equal(t, "pass123", spec.APIPassword)
		assert.Equal(t, 8080, spec.APIPort)

		// Verify dry_run is injected
		assert.Equal(t, true, spec.Config["dry_run"])

		// Verify original config fields are preserved
		assert.Equal(t, "USDT", spec.Config["stake_currency"])
		assert.Equal(t, 10, spec.Config["stake_amount"])

		// IMPORTANT: Verify original bot config was NOT mutated
		_, hasDryRun := bot.Config["dry_run"]
		assert.False(t, hasDryRun, "Original bot config should not be mutated")
	})

	t.Run("valid bot spec with live mode", func(t *testing.T) {
		bot := &ent.Bot{
			ID:               uuid.New(),
			Name:             "Live Bot",
			FreqtradeVersion: "2024.1",
			Mode:             enum.BotModeLive,
			Config: map[string]interface{}{
				"stake_currency": "USDT",
			},
			Edges: ent.BotEdges{
				Exchange: &ent.Exchange{
					Name: string(enum.ExchangeBinance),
					Config: map[string]interface{}{
						"binance": map[string]interface{}{
							"api_key":    "key",
							"api_secret": "secret",
						},
					},
				},
				Strategy: &ent.Strategy{
					Name: "LiveStrategy",
					Code: "code",
				},
			},
		}

		spec, err := buildBotSpec(bot)
		require.NoError(t, err)
		require.NotNil(t, spec)

		// Verify dry_run is false for live mode
		assert.Equal(t, false, spec.Config["dry_run"])
	})

	t.Run("nil config creates new config with dry_run", func(t *testing.T) {
		bot := &ent.Bot{
			ID:               uuid.New(),
			Name:             "No Config Bot",
			FreqtradeVersion: "2024.1",
			Mode:             enum.BotModeDryRun,
			Config:           nil,
			Edges: ent.BotEdges{
				Exchange: &ent.Exchange{
					Name: string(enum.ExchangeBinance),
					Config: map[string]interface{}{
						"binance": map[string]interface{}{
							"api_key":    "key",
							"api_secret": "secret",
						},
					},
				},
				Strategy: &ent.Strategy{
					Name: "Strategy",
					Code: "code",
				},
			},
		}

		spec, err := buildBotSpec(bot)
		require.NoError(t, err)
		require.NotNil(t, spec)

		// Should have created config with dry_run
		assert.NotNil(t, spec.Config)
		assert.Equal(t, true, spec.Config["dry_run"])
	})

	t.Run("exchange credential extraction error", func(t *testing.T) {
		bot := &ent.Bot{
			ID:               uuid.New(),
			Name:             "Test Bot",
			FreqtradeVersion: "2024.1",
			Mode:             enum.BotModeDryRun,
			Config:           map[string]interface{}{},
			Edges: ent.BotEdges{
				Exchange: &ent.Exchange{
					Name: string(enum.ExchangeBinance),
					Config: nil, // Invalid - will cause extraction error
				},
				Strategy: &ent.Strategy{
					Name: "Strategy",
					Code: "code",
				},
			},
		}

		spec, err := buildBotSpec(bot)
		assert.Error(t, err)
		assert.Nil(t, spec)
		assert.Contains(t, err.Error(), "failed to extract exchange credentials")
	})
}