package runner

import (
	"fmt"

	"anytrade/internal/enum"
)

// ValidateConfig validates runner configuration based on runner type
func ValidateConfig(runnerType enum.RunnerType, configData map[string]interface{}) error {
	if configData == nil {
		return fmt.Errorf("config cannot be nil")
	}

	// Extract the inner config based on runner type
	// Config structure is: {"docker": {...}} or {"kubernetes": {...}} or {"local": {...}}
	var innerConfig map[string]interface{}
	var ok bool

	switch runnerType {
	case enum.RunnerDocker:
		innerConfig, ok = configData["docker"].(map[string]interface{})
		if !ok || innerConfig == nil {
			return fmt.Errorf("docker config not found or invalid")
		}
		_, err := ParseDockerConfig(innerConfig)
		return err

	case enum.RunnerKubernetes:
		return fmt.Errorf("Kubernetes runner is not yet supported")

	case enum.RunnerLocal:
		return fmt.Errorf("Local runner is not yet supported")

	default:
		return fmt.Errorf("unsupported runner type: %s", runnerType)
	}
}