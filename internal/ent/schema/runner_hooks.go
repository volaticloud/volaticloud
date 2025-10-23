package schema

import (
	"context"
	"fmt"

	"entgo.io/ent"

	"anytrade/internal/enum"
	"anytrade/internal/runner"
)

// validateRunnerConfig validates the runner configuration based on runner type.
// This hook validates config when both type and config are present in the mutation.
// For updates where only config changes, validation will be done in resolver layer.
func validateRunnerConfig(next ent.Mutator) ent.Mutator {
	return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
		// Get runner type and config from mutation
		runnerTypeValue, typeExists := m.Field("type")
		configValue, configExists := m.Field("config")

		// Only validate if both type and config are present in this mutation
		if typeExists && configExists {
			config, ok := configValue.(map[string]interface{})
			if ok && config != nil {
				// The type could be enum.RunnerType or string
				var runnerType enum.RunnerType
				switch v := runnerTypeValue.(type) {
				case enum.RunnerType:
					runnerType = v
				case string:
					runnerType = enum.RunnerType(v)
				default:
					return nil, fmt.Errorf("invalid runner type: %T", runnerTypeValue)
				}

				if err := runner.ValidateConfig(runnerType, config); err != nil {
					return nil, fmt.Errorf("invalid runner config: %w", err)
				}
			}
		}

		return next.Mutate(ctx, m)
	})
}