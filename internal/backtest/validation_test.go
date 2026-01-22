package backtest

import (
	"strings"
	"testing"
	"time"
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
			name: "valid pair_whitelist with futures format",
			config: map[string]interface{}{
				"pair_whitelist": []interface{}{"BTC/USDT:USDT", "ETH/USDT:USDT"},
			},
			expectError: false,
		},
		{
			name: "valid pair_whitelist mixed spot and futures",
			config: map[string]interface{}{
				"pair_whitelist": []interface{}{"BTC/USDT", "ETH/USDT:USDT"},
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
		{
			name: "duplicate pairs rejected",
			config: map[string]interface{}{
				"pair_whitelist": []interface{}{"BTC/USDT", "ETH/USDT", "BTC/USDT"},
			},
			expectError: true,
			errorMsg:    "duplicate pair",
		},
		{
			name: "duplicate pairs case insensitive",
			config: map[string]interface{}{
				"pair_whitelist": []interface{}{"BTC/USDT", "btc/usdt"},
			},
			expectError: true,
			errorMsg:    "duplicate pair",
		},
		{
			name: "duplicate futures pairs rejected",
			config: map[string]interface{}{
				"pair_whitelist": []interface{}{"BTC/USDT:USDT", "ETH/USDT", "BTC/USDT:USDT"},
			},
			expectError: true,
			errorMsg:    "duplicate pair",
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
		// Valid spot pairs
		{"BTC/USDT", false},
		{"ETH/BTC", false},
		{"SOL/USDT", false},
		{"btc/usdt", false},
		{"BTC123/USDT456", false},
		// Valid futures pairs (BASE/QUOTE:SETTLE)
		{"BTC/USDT:USDT", false},
		{"ETH/USDT:USDT", false},
		{"SOL/USDT:USDT", false},
		{"btc/usdt:usdt", false},
		{"XRP/USD:USD", false},
		// Invalid empty
		{"", true},
		{"  ", true},
		// Invalid formats
		{"BTCUSDT", true},
		{"BTC/", true},
		{"/USDT", true},
		{"BTC//USDT", true},
		{"BTC/USDT/ETH", true},
		// Invalid special characters
		{"BTC@/USDT", true},
		{"BTC/USDT!", true},
		// Invalid futures formats
		{"BTC/USDT:", true},
		{"BTC/:USDT", true},
		{"BTC/USDT:USDT:EXTRA", true},
		{"BTC/USDT:@", true},
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

func TestValidateDateRange(t *testing.T) {
	now := time.Now()
	yesterday := now.AddDate(0, 0, -1)
	tomorrow := now.AddDate(0, 0, 1)
	nextWeek := now.AddDate(0, 0, 7)

	tests := []struct {
		name        string
		startDate   time.Time
		endDate     time.Time
		expectError bool
		errorMsg    string
	}{
		{
			name:        "both dates zero is valid",
			startDate:   time.Time{},
			endDate:     time.Time{},
			expectError: false,
		},
		{
			name:        "valid date range",
			startDate:   yesterday,
			endDate:     tomorrow,
			expectError: false,
		},
		{
			name:        "start date equals end date rejected",
			startDate:   now,
			endDate:     now,
			expectError: true,
			errorMsg:    "must be before end_date",
		},
		{
			name:        "start date after end date rejected",
			startDate:   nextWeek,
			endDate:     yesterday,
			expectError: true,
			errorMsg:    "must be before end_date",
		},
		{
			name:        "only start date provided rejected",
			startDate:   yesterday,
			endDate:     time.Time{},
			expectError: true,
			errorMsg:    "end_date is required",
		},
		{
			name:        "only end date provided rejected",
			startDate:   time.Time{},
			endDate:     tomorrow,
			expectError: true,
			errorMsg:    "start_date is required",
		},
		{
			name:        "far past to far future valid",
			startDate:   time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC),
			endDate:     time.Date(2025, 12, 31, 0, 0, 0, 0, time.UTC),
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateDateRange(tt.startDate, tt.endDate)
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
