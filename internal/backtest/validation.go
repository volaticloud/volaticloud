package backtest

import (
	"fmt"
	"strings"
)

// SupportedExchanges is the whitelist of exchanges that can be used for backtesting.
// These exchanges are supported by Freqtrade and have been tested with the platform.
var SupportedExchanges = []string{
	"binance",
	"binanceus",
	"kraken",
	"kucoin",
	"bybit",
	"bitget",
	"gateio",
	"okx",
}

// ValidateBacktestConfig validates the user-provided backtest configuration.
// It ensures:
// - Exchange (if provided) is in the supported whitelist
// - dry_run cannot be explicitly set to false (backtests must always be dry runs)
// - Basic schema validation for known fields
func ValidateBacktestConfig(config map[string]interface{}) error {
	if config == nil {
		return nil // Empty config is valid
	}

	// Validate exchange if provided
	if exchange, ok := config["exchange"].(map[string]interface{}); ok {
		if name, ok := exchange["name"].(string); ok {
			if !isValidExchange(name) {
				return fmt.Errorf("unsupported exchange: %s (supported: %s)", name, strings.Join(SupportedExchanges, ", "))
			}
		}
	}

	// Ensure dry_run cannot be set to false
	// Backtests must ALWAYS run in dry_run mode for safety
	if dryRun, ok := config["dry_run"].(bool); ok && !dryRun {
		return fmt.Errorf("dry_run cannot be set to false for backtests")
	}

	// Validate pair_whitelist if provided
	if pairWhitelist, ok := config["pair_whitelist"].([]interface{}); ok {
		for i, pair := range pairWhitelist {
			pairStr, ok := pair.(string)
			if !ok {
				return fmt.Errorf("pair_whitelist[%d]: expected string, got %T", i, pair)
			}
			if err := validateTradingPair(pairStr); err != nil {
				return fmt.Errorf("pair_whitelist[%d]: %w", i, err)
			}
		}
	}

	return nil
}

// isValidExchange checks if the exchange name is in the supported whitelist.
func isValidExchange(name string) bool {
	nameLower := strings.ToLower(name)
	for _, exchange := range SupportedExchanges {
		if nameLower == exchange {
			return true
		}
	}
	return false
}

// isAlphanumeric checks if a rune is an ASCII letter or digit.
func isAlphanumeric(c rune) bool {
	return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')
}

// validateTradingPair validates the format of a trading pair.
// Expected format: BASE/QUOTE (e.g., BTC/USDT, ETH/BTC)
func validateTradingPair(pair string) error {
	pair = strings.TrimSpace(pair)
	if pair == "" {
		return fmt.Errorf("empty trading pair")
	}

	parts := strings.Split(pair, "/")
	if len(parts) != 2 {
		return fmt.Errorf("invalid trading pair format %q: expected BASE/QUOTE (e.g., BTC/USDT)", pair)
	}

	base := strings.TrimSpace(parts[0])
	quote := strings.TrimSpace(parts[1])

	if base == "" {
		return fmt.Errorf("invalid trading pair %q: empty base currency", pair)
	}
	if quote == "" {
		return fmt.Errorf("invalid trading pair %q: empty quote currency", pair)
	}

	// Basic character validation (alphanumeric only)
	for _, c := range base {
		if !isAlphanumeric(c) {
			return fmt.Errorf("invalid trading pair %q: base currency contains invalid character", pair)
		}
	}
	for _, c := range quote {
		if !isAlphanumeric(c) {
			return fmt.Errorf("invalid trading pair %q: quote currency contains invalid character", pair)
		}
	}

	return nil
}
