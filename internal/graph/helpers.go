package graph

import (
	"anytrade/internal/ent"
	"anytrade/internal/enum"
	"anytrade/internal/runner"
	"fmt"
)

// buildBotSpec builds a BotSpec from a Bot entity
// NO CONFIG MERGING - Each entity keeps its own config.json
// Freqtrade merges them via: --config exchange.json --config strategy.json --config bot.json
func buildBotSpec(b *ent.Bot) (*runner.BotSpec, error) {
	if b.Edges.Exchange == nil {
		return nil, fmt.Errorf("bot has no exchange")
	}
	if b.Edges.Strategy == nil {
		return nil, fmt.Errorf("bot has no strategy")
	}

	exchange := b.Edges.Exchange
	strategy := b.Edges.Strategy

	// Validate each config independently
	if err := validateExchangeConfig(exchange.Config); err != nil {
		return nil, fmt.Errorf("invalid exchange config: %w", err)
	}

	// Bot config validation (optional - can be minimal)
	// Just ensure dry_run will be set correctly

	// Build Docker image name
	image := fmt.Sprintf("freqtradeorg/freqtrade:%s", b.FreqtradeVersion)

	// Prepare bot config - COPY to avoid mutation
	botConfig := make(map[string]interface{})
	if b.Config != nil {
		for k, v := range b.Config {
			botConfig[k] = v
		}
	}

	// Inject dry_run field (this is the only modification we make)
	botConfig["dry_run"] = (b.Mode == enum.BotModeDryRun)

	spec := &runner.BotSpec{
		ID:               b.ID.String(),
		Name:             b.Name,
		Image:            image,
		FreqtradeVersion: b.FreqtradeVersion,
		StrategyName:     strategy.Name,
		StrategyCode:     strategy.Code,
		StrategyConfig:   strategy.Config,   // Separate config file
		Config:           botConfig,          // Separate config file
		ExchangeConfig:   exchange.Config,    // Separate config file (NEW)
		Environment:      make(map[string]string),
	}

	return spec, nil
}

// validateExchangeConfig validates exchange config has required fields
func validateExchangeConfig(config map[string]interface{}) error {
	if config == nil {
		return fmt.Errorf("exchange config is required")
	}

	// Check if config has the nested "exchange" structure
	exchangeConfig, hasNested := config["exchange"].(map[string]interface{})
	if !hasNested {
		// Fall back to checking at the top level
		exchangeConfig = config
	}

	required := []string{"name", "key", "secret"}
	var missing []string

	for _, field := range required {
		if _, exists := exchangeConfig[field]; !exists {
			missing = append(missing, field)
		}
	}

	if len(missing) > 0 {
		return fmt.Errorf("missing required exchange config fields: %v", missing)
	}

	return nil
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

// validateBacktestConfig validates that backtest config contains all required fields
func validateBacktestConfig(config map[string]interface{}) error {
	if config == nil {
		return fmt.Errorf("backtest config is required")
	}

	// Required fields for backtesting (these must exist in the JSON config)
	requiredFields := []string{
		"pairs",
		"timeframe",
		"stake_currency",
		"stake_amount",
		"max_open_trades",
		"exchange",
		"pairlists",
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
		return fmt.Errorf("missing required backtest config fields: %v. Please provide complete configuration in JSON format", missingFields)
	}

	// Validate pairs is an array
	if pairs, ok := config["pairs"].([]interface{}); !ok || len(pairs) == 0 {
		return fmt.Errorf("pairs must be a non-empty array")
	}

	// Validate exchange has pair_whitelist
	if exchange, ok := config["exchange"].(map[string]interface{}); ok {
		if _, exists := exchange["pair_whitelist"]; !exists {
			return fmt.Errorf("exchange.pair_whitelist is required")
		}
	} else {
		return fmt.Errorf("exchange must be an object with pair_whitelist")
	}

	// Validate timeframe is a string
	if timeframe, ok := config["timeframe"].(string); !ok || timeframe == "" {
		return fmt.Errorf("timeframe must be a non-empty string")
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
	if stakeCurrency, ok := config["stake_currency"].(string); !ok || stakeCurrency == "" {
		return fmt.Errorf("stake_currency must be a non-empty string")
	}

	return nil
}

// buildBacktestSpec builds a BacktestSpec from a Backtest entity
func buildBacktestSpec(bt *ent.Backtest) (*runner.BacktestSpec, error) {
	if bt.Edges.Strategy == nil {
		return nil, fmt.Errorf("backtest has no strategy")
	}

	strategy := bt.Edges.Strategy

	// The backtest config should contain all required fields
	if bt.Config == nil {
		return nil, fmt.Errorf("backtest has no config")
	}

	// Validate config contains all required fields (like bots do)
	if err := validateBacktestConfig(bt.Config); err != nil {
		return nil, fmt.Errorf("invalid backtest config: %w", err)
	}

	// Extract required fields from config
	pairs, ok := bt.Config["pairs"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("pairs not found in backtest config")
	}
	pairStrings := make([]string, len(pairs))
	for i, p := range pairs {
		pairStrings[i] = p.(string)
	}

	timeframe, ok := bt.Config["timeframe"].(string)
	if !ok {
		return nil, fmt.Errorf("timeframe not found in backtest config")
	}

	// Extract stake_amount and stake_currency
	stakeAmount, ok := bt.Config["stake_amount"].(float64)
	if !ok {
		// Try int
		if stakeAmountInt, ok := bt.Config["stake_amount"].(int); ok {
			stakeAmount = float64(stakeAmountInt)
		} else {
			return nil, fmt.Errorf("stake_amount not found or invalid in backtest config")
		}
	}

	stakeCurrency, ok := bt.Config["stake_currency"].(string)
	if !ok {
		return nil, fmt.Errorf("stake_currency not found in backtest config")
	}

	// Optional fields with defaults
	maxOpenTrades := 3 // Default
	if mot, ok := bt.Config["max_open_trades"].(float64); ok {
		maxOpenTrades = int(mot)
	} else if mot, ok := bt.Config["max_open_trades"].(int); ok {
		maxOpenTrades = mot
	}

	enablePositionStacking := false
	if eps, ok := bt.Config["enable_position_stacking"].(bool); ok {
		enablePositionStacking = eps
	}

	// Get Freqtrade version (default to stable if not specified)
	freqtradeVersion := "stable"
	if fv, ok := bt.Config["freqtrade_version"].(string); ok && fv != "" {
		freqtradeVersion = fv
	}

	// Data source configuration
	dataSource := "download" // Default to downloading data
	if ds, ok := bt.Config["data_source"].(string); ok {
		dataSource = ds
	}

	dataPath := ""
	if dp, ok := bt.Config["data_path"].(string); ok {
		dataPath = dp
	}

	spec := &runner.BacktestSpec{
		ID:                     bt.ID.String(),
		StrategyName:           strategy.Name,
		StrategyCode:           strategy.Code,
		Config:                 bt.Config,
		Pairs:                  pairStrings,
		Timeframe:              timeframe,
		StakeAmount:            stakeAmount,
		StakeCurrency:          stakeCurrency,
		MaxOpenTrades:          maxOpenTrades,
		EnablePositionStacking: enablePositionStacking,
		FreqtradeVersion:       freqtradeVersion,
		Environment:            make(map[string]string),
		DataSource:             dataSource,
		DataPath:               dataPath,
	}

	return spec, nil
}