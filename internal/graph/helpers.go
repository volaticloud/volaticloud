package graph

import (
	"context"
	"encoding/json"
	"fmt"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/backtest"
	"volaticloud/internal/enum"
	"volaticloud/internal/exchange"
	"volaticloud/internal/freqtrade"
	"volaticloud/internal/graph/model"
	"volaticloud/internal/runner"
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

	// Validate config contains all required fields
	if err := freqtrade.ValidateConfig(strategy.Config); err != nil {
		return nil, fmt.Errorf("invalid strategy config: %w", err)
	}

	// Extract optional runtime configuration from config
	freqtradeVersion := "stable"
	if fv, ok := strategy.Config["freqtrade_version"].(string); ok && fv != "" {
		freqtradeVersion = fv
	}

	dataSource := "download"
	if ds, ok := strategy.Config["data_source"].(string); ok {
		dataSource = ds
	}

	dataPath := ""
	if dp, ok := strategy.Config["data_path"].(string); ok {
		dataPath = dp
	}

	// Create a copy of the config to avoid mutating the original
	config := make(map[string]interface{})
	for k, v := range strategy.Config {
		config[k] = v
	}

	// Set data format to JSON (matching data download format)
	config["dataformat_ohlcv"] = "json"

	// Build timerange from start_date and end_date if provided
	// Freqtrade expects format: "YYYYMMDD-YYYYMMDD" (e.g., "20240101-20241231")
	if !bt.StartDate.IsZero() && !bt.EndDate.IsZero() {
		startStr := bt.StartDate.Format("20060102") // Go time format for YYYYMMDD
		endStr := bt.EndDate.Format("20060102")
		timerange := fmt.Sprintf("%s-%s", startStr, endStr)
		config["timerange"] = timerange
	}

	// Build BacktestSpec - config contains everything (pairs, timeframe, stake_amount, etc.)
	spec := &runner.BacktestSpec{
		ID:               bt.ID.String(),
		StrategyName:     strategy.Name,
		StrategyCode:     strategy.Code,
		Config:           config,
		FreqtradeVersion: freqtradeVersion,
		Environment:      make(map[string]string),
		DataSource:       dataSource,
		DataPath:         dataPath,
	}

	return spec, nil
}

// convertRunnerConfigInput converts GraphQL RunnerConfigInput to map format for runner factory
func convertRunnerConfigInput(input model.RunnerConfigInput) (map[string]interface{}, error) {
	// Marshal to JSON and unmarshal to map for type conversion
	jsonBytes, err := json.Marshal(input)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}

	var configMap map[string]interface{}
	if err := json.Unmarshal(jsonBytes, &configMap); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// The configMap will have keys like "docker", "kubernetes", "local"
	// Extract the non-nil one based on which type is set
	if dockerCfg, ok := configMap["docker"]; ok && dockerCfg != nil {
		if dockerMap, ok := dockerCfg.(map[string]interface{}); ok {
			return dockerMap, nil
		}
	}

	if k8sCfg, ok := configMap["kubernetes"]; ok && k8sCfg != nil {
		if k8sMap, ok := k8sCfg.(map[string]interface{}); ok {
			return k8sMap, nil
		}
	}

	if localCfg, ok := configMap["local"]; ok && localCfg != nil {
		if localMap, ok := localCfg.(map[string]interface{}); ok {
			return localMap, nil
		}
	}

	return nil, fmt.Errorf("no valid runner config provided")
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
		//nolint:errcheck // Best-effort status update before returning error
		r.client.Backtest.UpdateOneID(bt.ID).
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
