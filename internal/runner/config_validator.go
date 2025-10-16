package runner

import (
	"fmt"

	"anytrade/internal/enum"
)

// ValidateConfig validates runtime configuration based on runtime type
func ValidateConfig(runtimeType enum.RuntimeType, configData map[string]interface{}) error {
	if configData == nil {
		return fmt.Errorf("config cannot be nil")
	}

	switch runtimeType {
	case enum.RuntimeDocker:
		_, err := ParseDockerConfig(configData)
		return err

	case enum.RuntimeKubernetes:
		return fmt.Errorf("Kubernetes runtime is not yet supported")

	case enum.RuntimeLocal:
		return fmt.Errorf("Local runtime is not yet supported")

	default:
		return fmt.Errorf("unsupported runtime type: %s", runtimeType)
	}
}