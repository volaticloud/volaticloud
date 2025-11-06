package runner

import (
	"encoding/json"
	"fmt"
)

// DockerConfig holds configuration for Docker runner
type DockerConfig struct {
	// Host is the Docker daemon host (e.g., "unix:///var/run/docker.sock" or "tcp://localhost:2375")
	Host string `json:"host" validate:"required"`

	// TLSVerify enables TLS verification
	TLSVerify bool `json:"tls_verify,omitempty"`

	// CertPath is the path to TLS certificates (if TLSVerify is true)
	CertPath string `json:"cert_path,omitempty"`

	// KeyPath is the path to TLS key file
	KeyPath string `json:"key_path,omitempty"`

	// CAPath is the path to TLS CA file
	CAPath string `json:"ca_path,omitempty"`

	// APIVersion is the Docker API version to use (e.g., "1.41")
	APIVersion string `json:"api_version,omitempty"`

	// Network is the Docker network to use for containers
	Network string `json:"network,omitempty"`

	// RegistryAuth holds registry authentication if needed for private images
	RegistryAuth *RegistryAuth `json:"registry_auth,omitempty"`
}

// RegistryAuth holds Docker registry authentication
type RegistryAuth struct {
	// Username for registry authentication
	Username string `json:"username"`

	// Password for registry authentication
	Password string `json:"password"`

	// ServerAddress is the registry server address (e.g., "https://index.docker.io/v1/")
	ServerAddress string `json:"server_address,omitempty"`
}

// ValidateDockerConfig validates Docker-specific configuration
func ValidateDockerConfig(config *DockerConfig) error {
	if config == nil {
		return fmt.Errorf("Docker config cannot be nil")
	}

	if config.Host == "" {
		return fmt.Errorf("host is required")
	}

	// If TLS is enabled, require certificate paths
	if config.TLSVerify {
		if config.CertPath == "" {
			return fmt.Errorf("cert_path is required when tls_verify is enabled")
		}
		if config.KeyPath == "" {
			return fmt.Errorf("key_path is required when tls_verify is enabled")
		}
		if config.CAPath == "" {
			return fmt.Errorf("ca_path is required when tls_verify is enabled")
		}
	}

	// Validate registry auth if provided
	if config.RegistryAuth != nil {
		if config.RegistryAuth.Username == "" {
			return fmt.Errorf("registry_auth.username is required when registry_auth is provided")
		}
		if config.RegistryAuth.Password == "" {
			return fmt.Errorf("registry_auth.password is required when registry_auth is provided")
		}
	}

	return nil
}

// ParseDockerConfig parses and validates Docker config from a map
func ParseDockerConfig(configData map[string]interface{}) (*DockerConfig, error) {
	if configData == nil {
		return nil, fmt.Errorf("config data cannot be nil")
	}

	configJSON, err := json.Marshal(configData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}

	var config DockerConfig
	if err := json.Unmarshal(configJSON, &config); err != nil {
		return nil, fmt.Errorf("failed to parse Docker config: %w", err)
	}

	if err := ValidateDockerConfig(&config); err != nil {
		return nil, fmt.Errorf("Docker config validation failed: %w", err)
	}

	return &config, nil
}

// ToMap converts DockerConfig to a map for storage
func (c *DockerConfig) ToMap() (map[string]interface{}, error) {
	data, err := json.Marshal(c)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal DockerConfig: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal to map: %w", err)
	}

	return result, nil
}
