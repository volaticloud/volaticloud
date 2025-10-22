package graph

import (
	"anytrade/internal/ent"
	"anytrade/internal/enum"
	"anytrade/internal/runner"
	"fmt"
	"strings"
)

// buildBotSpec builds a BotSpec from a Bot entity
func buildBotSpec(b *ent.Bot) (*runner.BotSpec, error) {
	if b.Edges.Exchange == nil {
		return nil, fmt.Errorf("bot has no exchange")
	}
	if b.Edges.Strategy == nil {
		return nil, fmt.Errorf("bot has no strategy")
	}

	exchange := b.Edges.Exchange
	strategy := b.Edges.Strategy

	// Extract exchange credentials from config
	apiKey, apiSecret, err := extractExchangeCredentials(exchange)
	if err != nil {
		return nil, fmt.Errorf("failed to extract exchange credentials: %w", err)
	}

	// Build Docker image name
	image := fmt.Sprintf("freqtradeorg/freqtrade:%s", b.FreqtradeVersion)

	// Prepare bot config and ensure dry_run field is set
	// IMPORTANT: Create a copy of the config to avoid mutating the original
	botConfig := make(map[string]interface{})
	if b.Config != nil {
		// Copy all fields from original config
		for k, v := range b.Config {
			botConfig[k] = v
		}
	}

	// Add dry_run field based on bot mode
	// Freqtrade requires this field in config
	botConfig["dry_run"] = (b.Mode == enum.BotModeDryRun)

	spec := &runner.BotSpec{
		ID:               b.ID.String(),
		Name:             b.Name,
		Image:            image,
		FreqtradeVersion: b.FreqtradeVersion,
		StrategyName:     strategy.Name,
		StrategyCode:     strategy.Code,
		StrategyConfig:   strategy.Config,
		Config:           botConfig,
		ExchangeName:     string(exchange.Name),
		ExchangeAPIKey:   apiKey,
		ExchangeSecret:   apiSecret,
		APIUsername:      b.APIUsername,
		APIPassword:      b.APIPassword,
		APIPort:          8080, // Default Freqtrade API port
		Environment:      make(map[string]string),
	}

	return spec, nil
}

// extractExchangeCredentials extracts API credentials from exchange config
func extractExchangeCredentials(exchange *ent.Exchange) (apiKey, apiSecret string, err error) {
	if exchange.Config == nil {
		return "", "", fmt.Errorf("exchange has no config")
	}

	// Config structure: {"binance": {"api_key": "...", "api_secret": "..."}}
	exchangeName := strings.ToLower(string(exchange.Name))

	exchangeConfig, ok := exchange.Config[exchangeName].(map[string]interface{})
	if !ok {
		return "", "", fmt.Errorf("exchange config not found for %s", exchangeName)
	}

	apiKey, ok = exchangeConfig["api_key"].(string)
	if !ok || apiKey == "" {
		return "", "", fmt.Errorf("api_key not found in exchange config")
	}

	apiSecret, ok = exchangeConfig["api_secret"].(string)
	if !ok || apiSecret == "" {
		return "", "", fmt.Errorf("api_secret not found in exchange config")
	}

	return apiKey, apiSecret, nil
}

// validateFreqtradeConfig validates that bot config contains all required Freqtrade fields
func validateFreqtradeConfig(config map[string]interface{}) error {
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