package backtest

import (
	"strings"
	"testing"
)

func TestValidateBacktestConfig(t *testing.T) {
	tests := []struct {
		name        string
		config      map[string]interface{}
		expectError bool
		errorMsg    string
	}{
		{
			name:        "nil config is valid",
			config:      nil,
			expectError: false,
		},
		{
			name:        "empty config is valid",
			config:      map[string]interface{}{},
			expectError: false,
		},
		{
			name: "valid exchange binance",
			config: map[string]interface{}{
				"exchange": map[string]interface{}{
					"name": "binance",
				},
			},
			expectError: false,
		},
		{
			name: "valid exchange OKX (case insensitive)",
			config: map[string]interface{}{
				"exchange": map[string]interface{}{
					"name": "OKX",
				},
			},
			expectError: false,
		},
		{
			name: "unsupported exchange",
			config: map[string]interface{}{
				"exchange": map[string]interface{}{
					"name": "unsupported_exchange",
				},
			},
			expectError: true,
			errorMsg:    "unsupported exchange",
		},
		{
			name: "dry_run false is rejected",
			config: map[string]interface{}{
				"dry_run": false,
			},
			expectError: true,
			errorMsg:    "dry_run cannot be set to false",
		},
		{
			name: "dry_run true is allowed",
			config: map[string]interface{}{
				"dry_run": true,
			},
			expectError: false,
		},
		{
			name: "valid pair_whitelist",
			config: map[string]interface{}{
				"pair_whitelist": []interface{}{"BTC/USDT", "ETH/USDT"},
			},
			expectError: false,
		},
		{
			name: "invalid pair format",
			config: map[string]interface{}{
				"pair_whitelist": []interface{}{"BTCUSDT"},
			},
			expectError: true,
			errorMsg:    "expected BASE/QUOTE",
		},
		{
			name: "empty pair in list",
			config: map[string]interface{}{
				"pair_whitelist": []interface{}{"BTC/USDT", ""},
			},
			expectError: true,
			errorMsg:    "empty trading pair",
		},
		{
			name: "complete valid config",
			config: map[string]interface{}{
				"exchange": map[string]interface{}{
					"name": "okx",
				},
				"pair_whitelist": []interface{}{"BTC/USDT", "ETH/USDT"},
				"dry_run":        true,
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateBacktestConfig(tt.config)
			if tt.expectError {
				if err == nil {
					t.Errorf("expected error containing %q, got nil", tt.errorMsg)
				} else if !strings.Contains(err.Error(), tt.errorMsg) {
					t.Errorf("expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("expected no error, got %v", err)
				}
			}
		})
	}
}

func TestIsValidExchange(t *testing.T) {
	validExchanges := []string{
		"binance", "BINANCE", "Binance",
		"binanceus", "BINANCEUS",
		"kraken", "KRAKEN",
		"kucoin", "KUCOIN",
		"bybit", "BYBIT",
		"bitget", "BITGET",
		"gateio", "GATEIO",
		"okx", "OKX",
	}

	for _, exchange := range validExchanges {
		if !isValidExchange(exchange) {
			t.Errorf("expected %q to be valid exchange", exchange)
		}
	}

	invalidExchanges := []string{
		"", "unknown", "fake_exchange", "coinbase", "ftx",
	}

	for _, exchange := range invalidExchanges {
		if isValidExchange(exchange) {
			t.Errorf("expected %q to be invalid exchange", exchange)
		}
	}
}

func TestValidateTradingPair(t *testing.T) {
	tests := []struct {
		pair        string
		expectError bool
	}{
		{"BTC/USDT", false},
		{"ETH/BTC", false},
		{"SOL/USDT", false},
		{"btc/usdt", false},
		{"BTC123/USDT456", false},
		{"", true},
		{"  ", true},
		{"BTCUSDT", true},
		{"BTC/", true},
		{"/USDT", true},
		{"BTC//USDT", true},
		{"BTC/USDT/ETH", true},
		{"BTC@/USDT", true},
		{"BTC/USDT!", true},
	}

	for _, tt := range tests {
		t.Run(tt.pair, func(t *testing.T) {
			err := validateTradingPair(tt.pair)
			if tt.expectError && err == nil {
				t.Errorf("expected error for pair %q", tt.pair)
			}
			if !tt.expectError && err != nil {
				t.Errorf("unexpected error for pair %q: %v", tt.pair, err)
			}
		})
	}
}
