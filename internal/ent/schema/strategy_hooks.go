package schema

import (
	"context"
	"fmt"

	"entgo.io/ent"

	"anytrade/internal/freqtrade"
)

// validateStrategyConfig validates the strategy configuration.
// Only validates when config is being updated (allows other field updates like is_latest).
func validateStrategyConfig(next ent.Mutator) ent.Mutator {
	return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
		// Get config from mutation
		configValue, configExists := m.Field("config")

		// Only validate if config is being updated
		// This allows updates to other fields (like is_latest) without requiring config
		if !configExists {
			return next.Mutate(ctx, m)
		}

		// If config is being updated, it must be valid
		config, ok := configValue.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("strategy config must be a valid JSON object")
		}

		// Config cannot be nil or empty when being set
		if config == nil || len(config) == 0 {
			return nil, fmt.Errorf("strategy config cannot be empty - must be a complete Freqtrade configuration")
		}

		// 100% validation against Freqtrade schema
		if err := freqtrade.ValidateConfig(config); err != nil {
			return nil, fmt.Errorf("invalid strategy config: %w", err)
		}

		return next.Mutate(ctx, m)
	})
}
