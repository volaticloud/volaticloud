package graph

import (
	"context"
	"fmt"

	"anytrade/internal/ent"
	"anytrade/internal/ent/backtest"
	"anytrade/internal/enum"
	"anytrade/internal/exchange"
	"anytrade/internal/freqtrade"
	"anytrade/internal/runner"
	"anytrade/internal/utils"
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
		StrategyConfig:   strategy.Config, // Separate config file
		Config:           botConfig,       // Separate config file
		ExchangeConfig:   exchange.Config, // Separate config file
		SecureConfig:     b.SecureConfig,  // System-forced config (NEVER exposed to users)
		Environment:      make(map[string]string),
	}

	return spec, nil
}

// validateExchangeConfig validates exchange config using Freqtrade JSON schema
func validateExchangeConfig(config map[string]interface{}) error {
	return exchange.ValidateConfigWithSchema(config)
}

// validateFreqtradeConfig validates that bot config contains all required Freqtrade fields
//
//nolint:unused // Used in helpers_test.go (tests excluded from linting)
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

// buildBacktestSpec builds a BacktestSpec from a Backtest entity
func buildBacktestSpec(bt *ent.Backtest) (*runner.BacktestSpec, error) {
	if bt.Edges.Strategy == nil {
		return nil, fmt.Errorf("backtest has no strategy")
	}

	strategy := bt.Edges.Strategy

	// The strategy config should contain all required fields
	if strategy.Config == nil {
		return nil, fmt.Errorf("strategy has no config")
	}

	// Validate config contains all required fields (like bots do)
	if err := freqtrade.ValidateConfig(strategy.Config); err != nil {
		return nil, fmt.Errorf("invalid strategy config: %w", err)
	}

	// Extract required fields from config
	pairs, ok := strategy.Config["pairs"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("pairs not found in strategy config")
	}
	pairStrings := make([]string, len(pairs))
	for i, p := range pairs {
		str, ok := p.(string)
		if !ok {
			return nil, fmt.Errorf("pair at index %d is not a string", i)
		}
		pairStrings[i] = str
	}

	timeframe, ok := strategy.Config["timeframe"].(string)
	if !ok {
		return nil, fmt.Errorf("timeframe not found in strategy config")
	}

	// Extract stake_amount and stake_currency
	stakeAmount, ok := strategy.Config["stake_amount"].(float64)
	if !ok {
		// Try int
		if stakeAmountInt, ok := strategy.Config["stake_amount"].(int); ok {
			stakeAmount = float64(stakeAmountInt)
		} else {
			return nil, fmt.Errorf("stake_amount not found or invalid in strategy config")
		}
	}

	stakeCurrency, ok := strategy.Config["stake_currency"].(string)
	if !ok {
		return nil, fmt.Errorf("stake_currency not found in strategy config")
	}

	// Optional fields with defaults
	maxOpenTrades := 3 // Default
	if mot, ok := strategy.Config["max_open_trades"].(float64); ok {
		maxOpenTrades = int(mot)
	} else if mot, ok := strategy.Config["max_open_trades"].(int); ok {
		maxOpenTrades = mot
	}

	enablePositionStacking := false
	if eps, ok := strategy.Config["enable_position_stacking"].(bool); ok {
		enablePositionStacking = eps
	}

	// Get Freqtrade version (default to stable if not specified)
	freqtradeVersion := "stable"
	if fv, ok := strategy.Config["freqtrade_version"].(string); ok && fv != "" {
		freqtradeVersion = fv
	}

	// Data source configuration
	dataSource := "download" // Default to downloading data
	if ds, ok := strategy.Config["data_source"].(string); ok {
		dataSource = ds
	}

	dataPath := ""
	if dp, ok := strategy.Config["data_path"].(string); ok {
		dataPath = dp
	}

	spec := &runner.BacktestSpec{
		ID:                     bt.ID.String(),
		StrategyName:           strategy.Name,
		StrategyCode:           strategy.Code,
		Config:                 strategy.Config,
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

// generateSecureConfig generates a secure configuration with API server credentials
// This config contains system-forced settings that users cannot override:
// - initial_state: Always "running"
// - api_server: Enabled with auto-generated credentials
func generateSecureConfig() (map[string]interface{}, error) {
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

// runBacktestHelper runs a backtest given its backtest entity
// This is a helper function used by both CreateBacktest (auto-run) and RunBacktest (manual run)
func (r *mutationResolver) runBacktestHelper(ctx context.Context, bt *ent.Backtest) (*ent.Backtest, error) {
	// Ensure backtest has runner and strategy loaded
	if bt.Edges.Runner == nil || bt.Edges.Strategy == nil {
		// Reload with edges if not loaded
		var err error
		bt, err = r.client.Backtest.Query().
			Where(backtest.ID(bt.ID)).
			WithRunner().
			WithStrategy().
			Only(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to load backtest with edges: %w", err)
		}
	}

	// Get the runner
	btRunner := bt.Edges.Runner
	if btRunner == nil {
		return nil, fmt.Errorf("backtest has no runner configuration")
	}

	// Create runner client
	factory := runner.NewFactory()
	backtestRunner, err := factory.CreateBacktestRunner(ctx, btRunner.Type, btRunner.Config)
	if err != nil {
		return nil, fmt.Errorf("failed to create backtest runner client: %w", err)
	}
	defer func() {
		_ = backtestRunner.Close() // Best effort close
	}()

	// Build BacktestSpec from backtest data
	spec, err := buildBacktestSpec(bt)
	if err != nil {
		return nil, fmt.Errorf("failed to build backtest spec: %w", err)
	}

	// Run the backtest
	containerID, err := backtestRunner.RunBacktest(ctx, *spec)
	if err != nil {
		// Update backtest status to error (best effort, ignore save errors)
		_, _ = r.client.Backtest.UpdateOneID(bt.ID).
			SetStatus(enum.TaskStatusFailed).
			SetErrorMessage(fmt.Sprintf("Failed to run backtest: %v", err)).
			Save(ctx)
		return nil, fmt.Errorf("failed to run backtest: %w", err)
	}

	// Update backtest with container_id and set status to running
	bt, err = r.client.Backtest.UpdateOneID(bt.ID).
		SetContainerID(containerID).
		SetStatus(enum.TaskStatusRunning).
		ClearErrorMessage().
		Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to update backtest with container ID: %w", err)
	}

	return bt, nil
}
