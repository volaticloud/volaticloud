package schema

import (
	"context"
	"fmt"

	"entgo.io/ent"

	"anytrade/internal/enum"
	"anytrade/internal/runner"
)

// validateRuntimeConfig validates the runtime configuration based on runtime type.
// This hook validates config when both type and config are present in the mutation.
// For updates where only config changes, validation will be done in resolver layer.
func validateRuntimeConfig(next ent.Mutator) ent.Mutator {
	return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
		// Get runtime type and config from mutation
		runtimeTypeValue, typeExists := m.Field("type")
		configValue, configExists := m.Field("config")

		// Only validate if both type and config are present in this mutation
		if typeExists && configExists {
			config, ok := configValue.(map[string]interface{})
			if ok && config != nil {
				// The type could be enum.RuntimeType or string
				var runtimeType enum.RuntimeType
				switch v := runtimeTypeValue.(type) {
				case enum.RuntimeType:
					runtimeType = v
				case string:
					runtimeType = enum.RuntimeType(v)
				default:
					return nil, fmt.Errorf("invalid runtime type: %T", runtimeTypeValue)
				}

				if err := runner.ValidateConfig(runtimeType, config); err != nil {
					return nil, fmt.Errorf("invalid runtime config: %w", err)
				}
			}
		}

		return next.Mutate(ctx, m)
	})
}