package graph

import (
	"encoding/json"
	"fmt"

	"anytrade/internal/graph/model"
)

// convertRunnerConfigToMap converts the typed GraphQL RunnerConfigInput to a map
// preserving the runner type key for validation
func convertRunnerConfigToMap(input *model.RunnerConfigInput) (map[string]interface{}, error) {
	if input == nil {
		return nil, nil
	}

	// Only one of docker, kubernetes, or local should be set
	var runnerType string
	var configData interface{}
	configCount := 0

	if input.Docker != nil {
		runnerType = "docker"
		configData = convertDockerConfig(input.Docker)
		configCount++
	}
	if input.Kubernetes != nil {
		runnerType = "kubernetes"
		configData = convertKubernetesConfig(input.Kubernetes)
		configCount++
	}
	if input.Local != nil {
		runnerType = "local"
		configData = convertLocalConfig(input.Local)
		configCount++
	}

	if configCount == 0 {
		return nil, fmt.Errorf("no configuration provided")
	}
	if configCount > 1 {
		return nil, fmt.Errorf("only one runner type configuration can be provided")
	}

	// Convert the inner config to map
	jsonData, err := json.Marshal(configData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}

	var innerConfig map[string]interface{}
	if err := json.Unmarshal(jsonData, &innerConfig); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Wrap with runner type key for validation
	result := map[string]interface{}{
		runnerType: innerConfig,
	}

	return result, nil
}

// convertDockerConfig converts DockerConfigInput to a map-friendly struct
func convertDockerConfig(input *model.DockerConfigInput) map[string]interface{} {
	result := map[string]interface{}{
		"host": input.Host,
	}

	if input.TLSVerify != nil {
		result["tls_verify"] = *input.TLSVerify
	}
	if input.CertPath != nil {
		result["cert_path"] = *input.CertPath
	}
	if input.KeyPath != nil {
		result["key_path"] = *input.KeyPath
	}
	if input.CaPath != nil {
		result["ca_path"] = *input.CaPath
	}
	if input.APIVersion != nil {
		result["api_version"] = *input.APIVersion
	}
	if input.Network != nil {
		result["network"] = *input.Network
	}
	if input.RegistryAuth != nil {
		result["registry_auth"] = map[string]interface{}{
			"username": input.RegistryAuth.Username,
			"password": input.RegistryAuth.Password,
		}
		if input.RegistryAuth.ServerAddress != nil {
			result["registry_auth"].(map[string]interface{})["server_address"] = *input.RegistryAuth.ServerAddress
		}
	}

	return result
}

// convertKubernetesConfig converts KubernetesConfigInput to a map-friendly struct
func convertKubernetesConfig(input *model.KubernetesConfigInput) map[string]interface{} {
	result := make(map[string]interface{})

	if input.KubeconfigPath != nil {
		result["kubeconfig_path"] = *input.KubeconfigPath
	}
	if input.Namespace != nil {
		result["namespace"] = *input.Namespace
	}
	if input.Context != nil {
		result["context"] = *input.Context
	}

	return result
}

// convertLocalConfig converts LocalConfigInput to a map-friendly struct
func convertLocalConfig(input *model.LocalConfigInput) map[string]interface{} {
	result := make(map[string]interface{})

	if input.BasePath != nil {
		result["base_path"] = *input.BasePath
	}

	return result
}