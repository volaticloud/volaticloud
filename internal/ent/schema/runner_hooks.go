package schema

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

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

// validateDataDownloadConfig validates the data download configuration.
func validateDataDownloadConfig(next ent.Mutator) ent.Mutator {
	return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
		// Get data_download_config from mutation if present
		configValue, configExists := m.Field("data_download_config")

		if !configExists {
			// No config in this mutation, skip validation
			return next.Mutate(ctx, m)
		}

		config, ok := configValue.(map[string]interface{})
		if !ok || config == nil {
			// Allow nil/empty config (optional field)
			return next.Mutate(ctx, m)
		}

		// Validate config structure
		exchangesRaw, hasExchanges := config["exchanges"]
		if !hasExchanges {
			return nil, fmt.Errorf("data_download_config must have 'exchanges' field")
		}

		exchanges, ok := exchangesRaw.([]interface{})
		if !ok {
			return nil, fmt.Errorf("data_download_config.exchanges must be an array")
		}

		if len(exchanges) == 0 {
			return nil, fmt.Errorf("data_download_config.exchanges must have at least one exchange")
		}

		// Valid timeframes
		validTimeframes := map[string]bool{
			"1m": true, "3m": true, "5m": true, "15m": true, "30m": true,
			"1h": true, "2h": true, "4h": true, "6h": true, "8h": true, "12h": true,
			"1d": true, "3d": true, "1w": true, "2w": true, "1M": true,
		}

		// Validate each exchange config
		hasEnabledExchange := false
		for i, exchRaw := range exchanges {
			exch, ok := exchRaw.(map[string]interface{})
			if !ok {
				return nil, fmt.Errorf("data_download_config.exchanges[%d] must be an object", i)
			}

			// Validate name (required)
			name, hasName := exch["name"]
			if !hasName {
				return nil, fmt.Errorf("data_download_config.exchanges[%d] must have 'name' field", i)
			}
			nameStr, ok := name.(string)
			if !ok || nameStr == "" {
				return nil, fmt.Errorf("data_download_config.exchanges[%d].name must be a non-empty string", i)
			}

			// Validate enabled (required)
			enabled, hasEnabled := exch["enabled"]
			if !hasEnabled {
				return nil, fmt.Errorf("data_download_config.exchanges[%d] must have 'enabled' field", i)
			}
			enabledBool, ok := enabled.(bool)
			if !ok {
				return nil, fmt.Errorf("data_download_config.exchanges[%d].enabled must be a boolean", i)
			}

			if enabledBool {
				hasEnabledExchange = true

				// For enabled exchanges, validate additional fields
				// Validate timeframes (required for enabled exchanges)
				timeframesRaw, hasTimeframes := exch["timeframes"]
				if !hasTimeframes {
					return nil, fmt.Errorf("data_download_config.exchanges[%d] must have 'timeframes' field when enabled", i)
				}
				timeframes, ok := timeframesRaw.([]interface{})
				if !ok {
					return nil, fmt.Errorf("data_download_config.exchanges[%d].timeframes must be an array", i)
				}
				if len(timeframes) == 0 {
					return nil, fmt.Errorf("data_download_config.exchanges[%d].timeframes must have at least one timeframe when enabled", i)
				}

				for j, tfRaw := range timeframes {
					tf, ok := tfRaw.(string)
					if !ok {
						return nil, fmt.Errorf("data_download_config.exchanges[%d].timeframes[%d] must be a string", i, j)
					}
					if !validTimeframes[tf] {
						return nil, fmt.Errorf("data_download_config.exchanges[%d].timeframes[%d] has invalid value '%s'", i, j, tf)
					}
				}

				// Validate pairsPattern (required for enabled exchanges)
				pairsPattern, hasPairsPattern := exch["pairsPattern"]
				if !hasPairsPattern {
					return nil, fmt.Errorf("data_download_config.exchanges[%d] must have 'pairsPattern' field when enabled", i)
				}
				pairsPatternStr, ok := pairsPattern.(string)
				if !ok || pairsPatternStr == "" {
					return nil, fmt.Errorf("data_download_config.exchanges[%d].pairsPattern must be a non-empty string when enabled", i)
				}

				// Validate days (required for enabled exchanges)
				daysRaw, hasDays := exch["days"]
				if !hasDays {
					return nil, fmt.Errorf("data_download_config.exchanges[%d] must have 'days' field when enabled", i)
				}
				// Days could be int, int64, float64, or json.Number from JSON parsing
				var days float64
				switch v := daysRaw.(type) {
				case int:
					days = float64(v)
				case int32:
					days = float64(v)
				case int64:
					days = float64(v)
				case float32:
					days = float64(v)
				case float64:
					days = v
				case json.Number:
					// Convert json.Number to float64
					f, err := strconv.ParseFloat(string(v), 64)
					if err != nil {
						return nil, fmt.Errorf("data_download_config.exchanges[%d].days must be a valid number: %w", i, err)
					}
					days = f
				default:
					return nil, fmt.Errorf("data_download_config.exchanges[%d].days must be a number (got type %T with value %v)", i, daysRaw, daysRaw)
				}
				if days <= 0 {
					return nil, fmt.Errorf("data_download_config.exchanges[%d].days must be greater than 0", i)
				}

				// Validate tradingMode (optional, accepts any string value)
				if tradingModeRaw, hasTradingMode := exch["tradingMode"]; hasTradingMode {
					_, ok := tradingModeRaw.(string)
					if !ok {
						return nil, fmt.Errorf("data_download_config.exchanges[%d].tradingMode must be a string", i)
					}
				}
			}
		}

		// Ensure at least one exchange is enabled
		if !hasEnabledExchange {
			return nil, fmt.Errorf("data_download_config must have at least one enabled exchange")
		}

		return next.Mutate(ctx, m)
	})
}