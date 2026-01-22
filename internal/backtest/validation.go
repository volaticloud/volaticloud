package backtest

import (
	"fmt"
	"strings"
	"time"
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
		seen := make(map[string]int) // Track seen pairs with their index for error reporting
		for i, pair := range pairWhitelist {
			pairStr, ok := pair.(string)
			if !ok {
				return fmt.Errorf("pair_whitelist[%d]: expected string, got %T", i, pair)
			}
			if err := validateTradingPair(pairStr); err != nil {
				return fmt.Errorf("pair_whitelist[%d]: %w", i, err)
			}
			// Check for duplicate pairs (case-insensitive)
			normalizedPair := strings.ToUpper(strings.TrimSpace(pairStr))
			if firstIdx, exists := seen[normalizedPair]; exists {
				return fmt.Errorf("pair_whitelist[%d]: duplicate pair %q (first occurrence at index %d)", i, pairStr, firstIdx)
			}
			seen[normalizedPair] = i
		}
	}

	return nil
}

// ValidateDateRange validates that start date is before end date and both are valid.
// Returns nil if validation passes or both dates are zero (optional dates).
func ValidateDateRange(startDate, endDate time.Time) error {
	// Both dates must be provided or both must be zero
	if startDate.IsZero() && endDate.IsZero() {
		return nil // Optional dates, both empty is valid
	}
	if startDate.IsZero() {
		return fmt.Errorf("start_date is required when end_date is provided")
	}
	if endDate.IsZero() {
		return fmt.Errorf("end_date is required when start_date is provided")
	}

	// Start date must be before end date
	if !startDate.Before(endDate) {
		return fmt.Errorf("start_date (%s) must be before end_date (%s)",
			startDate.Format("2006-01-02"), endDate.Format("2006-01-02"))
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
// Supported formats:
// - Spot: BASE/QUOTE (e.g., BTC/USDT, ETH/BTC)
// - Futures: BASE/QUOTE:SETTLE (e.g., BTC/USDT:USDT for perpetual futures)
//
// IMPORTANT: This validation logic is duplicated in the frontend for client-side validation.
// If you modify this function, you MUST also update the frontend validation:
// - Frontend: dashboard/src/components/Backtests/CreateBacktestDialog.tsx (validateTradingPair)
// Both implementations must stay in sync to ensure consistent behavior.
func validateTradingPair(pair string) error {
	pair = strings.TrimSpace(pair)
	if pair == "" {
		return fmt.Errorf("empty trading pair")
	}

	parts := strings.Split(pair, "/")
	if len(parts) != 2 {
		return fmt.Errorf("invalid trading pair format %q: expected BASE/QUOTE (e.g., BTC/USDT) or BASE/QUOTE:SETTLE (e.g., BTC/USDT:USDT)", pair)
	}

	base := strings.TrimSpace(parts[0])
	quotePart := strings.TrimSpace(parts[1])

	if base == "" {
		return fmt.Errorf("invalid trading pair %q: empty base currency", pair)
	}
	if quotePart == "" {
		return fmt.Errorf("invalid trading pair %q: empty quote currency", pair)
	}

	// Basic character validation for base (alphanumeric only)
	for _, c := range base {
		if !isAlphanumeric(c) {
			return fmt.Errorf("invalid trading pair %q: base currency contains invalid character", pair)
		}
	}

	// Check if futures format (BASE/QUOTE:SETTLE)
	if strings.Contains(quotePart, ":") {
		settleParts := strings.Split(quotePart, ":")
		if len(settleParts) != 2 {
			return fmt.Errorf("invalid trading pair format %q: expected BASE/QUOTE:SETTLE for futures", pair)
		}
		quote := strings.TrimSpace(settleParts[0])
		settle := strings.TrimSpace(settleParts[1])

		if quote == "" {
			return fmt.Errorf("invalid trading pair %q: empty quote currency", pair)
		}
		if settle == "" {
			return fmt.Errorf("invalid trading pair %q: empty settlement currency", pair)
		}

		// Validate quote currency (alphanumeric only)
		for _, c := range quote {
			if !isAlphanumeric(c) {
				return fmt.Errorf("invalid trading pair %q: quote currency contains invalid character", pair)
			}
		}
		// Validate settlement currency (alphanumeric only)
		for _, c := range settle {
			if !isAlphanumeric(c) {
				return fmt.Errorf("invalid trading pair %q: settlement currency contains invalid character", pair)
			}
		}
	} else {
		// Spot format: validate quote currency
		for _, c := range quotePart {
			if !isAlphanumeric(c) {
				return fmt.Errorf("invalid trading pair %q: quote currency contains invalid character", pair)
			}
		}
	}

	return nil
}
