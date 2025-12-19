package runner

import (
	"fmt"

	"volaticloud/internal/enum"
)

// ExtractRunnerConfig extracts runner-type-specific config from the full runner config.
// Config may be nested under runner type key (e.g., {"docker": {...}}) or passed directly.
// This function handles both formats for backward compatibility.
func ExtractRunnerConfig(configData map[string]interface{}, runnerType enum.RunnerType) map[string]interface{} {
	switch runnerType {
	case enum.RunnerDocker:
		if nested, ok := configData["docker"].(map[string]interface{}); ok {
			return nested
		}
	case enum.RunnerKubernetes:
		if nested, ok := configData["kubernetes"].(map[string]interface{}); ok {
			return nested
		}
	case enum.RunnerLocal:
		if nested, ok := configData["local"].(map[string]interface{}); ok {
			return nested
		}
	}
	// If no nested config found, return the original (backward compatibility)
	return configData
}

// ValidateConfig validates runner configuration based on runner type
func ValidateConfig(runnerType enum.RunnerType, configData map[string]interface{}) error {
	if configData == nil {
		return fmt.Errorf("config cannot be nil")
	}

	// Extract runner-type-specific config (handle both nested and direct formats)
	typeConfig := ExtractRunnerConfig(configData, runnerType)

	// Try to get registered validator first
	validator, err := GetConfigValidator(runnerType)
	if err == nil {
		return validator(typeConfig)
	}

	// Fallback for unsupported types
	switch runnerType {
	case enum.RunnerKubernetes:
		return fmt.Errorf("Kubernetes runner is not yet supported")

	case enum.RunnerLocal:
		return fmt.Errorf("Local runner is not yet supported")

	default:
		return fmt.Errorf("unsupported runner type: %s", runnerType)
	}
}
