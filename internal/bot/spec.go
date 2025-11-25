// Package bot provides bot domain logic for trading bots
package bot

import (
	"fmt"

	"volaticloud/internal/ent"
	"volaticloud/internal/enum"
	"volaticloud/internal/exchange"
	"volaticloud/internal/runner"
)

// BuildSpec builds a BotSpec from a Bot entity
// NO CONFIG MERGING - Each entity keeps its own config.json
// Freqtrade merges them via: --config exchange.json --config strategy.json --config bot.json
func BuildSpec(b *ent.Bot) (*runner.BotSpec, error) {
	if b.Edges.Exchange == nil {
		return nil, fmt.Errorf("bot has no exchange")
	}
	if b.Edges.Strategy == nil {
		return nil, fmt.Errorf("bot has no strategy")
	}

	ex := b.Edges.Exchange
	strategy := b.Edges.Strategy

	// Validate each config independently
	if err := exchange.ValidateConfigWithSchema(ex.Config); err != nil {
		return nil, fmt.Errorf("invalid exchange config: %w", err)
	}

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
		ExchangeConfig:   ex.Config,       // Separate config file
		SecureConfig:     b.SecureConfig,  // System-forced config (NEVER exposed to users)
		Environment:      make(map[string]string),
	}

	return spec, nil
}
