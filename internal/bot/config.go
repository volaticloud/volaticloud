package bot

import (
	"fmt"

	"volaticloud/internal/utils"
)

// ValidateFreqtradeConfig validates that bot config contains all required Freqtrade fields
func ValidateFreqtradeConfig(config map[string]interface{}) error {
	if config == nil {
		return fmt.Errorf("bot config is required")
	}

	// List of required top-level fields
	requiredFields := []string{
		"stake_currency",
		"stake_amount",
		"exit_pricing",
		"entry_pricing",
	}

	var missingFields []string
	for _, field := range requiredFields {
		if _, exists := config[field]; !exists {
			missingFields = append(missingFields, field)
		}
	}

	if len(missingFields) > 0 {
		return fmt.Errorf("missing required Freqtrade config fields: %v. Please provide complete bot configuration", missingFields)
	}

	// Validate exit_pricing structure
	if exitPricing, ok := config["exit_pricing"].(map[string]interface{}); ok {
		exitPricingRequired := []string{"price_side", "use_order_book", "order_book_top"}
		for _, field := range exitPricingRequired {
			if _, exists := exitPricing[field]; !exists {
				return fmt.Errorf("exit_pricing.%s is required", field)
			}
		}
	} else {
		return fmt.Errorf("exit_pricing must be an object with price_side, use_order_book, and order_book_top fields")
	}

	// Validate entry_pricing structure
	if entryPricing, ok := config["entry_pricing"].(map[string]interface{}); ok {
		entryPricingRequired := []string{"price_side", "use_order_book", "order_book_top"}
		for _, field := range entryPricingRequired {
			if _, exists := entryPricing[field]; !exists {
				return fmt.Errorf("entry_pricing.%s is required", field)
			}
		}
	} else {
		return fmt.Errorf("entry_pricing must be an object with price_side, use_order_book, and order_book_top fields")
	}

	// Validate stake_amount is a number
	if stakeAmount, ok := config["stake_amount"]; ok {
		switch stakeAmount.(type) {
		case int, int64, float64, float32:
			// Valid number types
		default:
			return fmt.Errorf("stake_amount must be a number")
		}
	}

	// Validate stake_currency is a string
	if stakeCurrency, ok := config["stake_currency"]; ok {
		if _, ok := stakeCurrency.(string); !ok {
			return fmt.Errorf("stake_currency must be a string")
		}
	}

	return nil
}

// GenerateSecureConfig generates a secure configuration with API server credentials
// This config contains system-forced settings that users cannot override:
// - initial_state: Always "running"
// - api_server: Enabled with auto-generated credentials
func GenerateSecureConfig() (map[string]interface{}, error) {
	username, err := utils.GenerateSecureUsername()
	if err != nil {
		return nil, fmt.Errorf("failed to generate username: %w", err)
	}

	password, err := utils.GenerateSecurePassword()
	if err != nil {
		return nil, fmt.Errorf("failed to generate password: %w", err)
	}

	secureConfig := map[string]interface{}{
		"initial_state": "running",
		"api_server": map[string]interface{}{
			"enabled":           true,
			"listen_ip_address": "0.0.0.0",
			"listen_port":       8080,
			"username":          username,
			"password":          password,
			"enable_openapi":    true,
		},
	}

	return secureConfig, nil
}
