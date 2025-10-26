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

	switch runnerType {
	case enum.RunnerDocker:
		// Config is passed directly, not nested
		_, err := ParseDockerConfig(configData)
		return err

	case enum.RunnerKubernetes:
		return fmt.Errorf("Kubernetes runner is not yet supported")

	case enum.RunnerLocal:
		return fmt.Errorf("Local runner is not yet supported")

	default:
		return fmt.Errorf("unsupported runner type: %s", runnerType)
	}
}