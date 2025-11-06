package schema

import (
	"context"
	"fmt"

	"entgo.io/ent"

	"anytrade/internal/exchange"
)

// validateExchangeConfig validates the exchange configuration using Freqtrade JSON schema.
// This hook validates config when it's present in the mutation.
func validateExchangeConfig(next ent.Mutator) ent.Mutator {
	return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
		// Get config from mutation
		configValue, configExists := m.Field("config")

		// Only validate if config is present in this mutation
		if configExists {
			config, ok := configValue.(map[string]interface{})
			if ok && config != nil {
				// Validate exchange config against Freqtrade schema
				if err := exchange.ValidateConfigWithSchema(config); err != nil {
					return nil, fmt.Errorf("invalid exchange config: %w", err)
				}
			}
		}

		return next.Mutate(ctx, m)
	})
}
