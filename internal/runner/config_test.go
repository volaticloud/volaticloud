package runner

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateDockerConfig(t *testing.T) {
	t.Run("ValidMinimalConfig", func(t *testing.T) {
		config := &DockerConfig{
			Host: "unix:///var/run/docker.sock",
		}
		err := ValidateDockerConfig(config)
		assert.NoError(t, err)
	})

	t.Run("ValidTCPConfig", func(t *testing.T) {
		config := &DockerConfig{
			Host:       "tcp://localhost:2375",
			Network:    "bridge",
			APIVersion: "1.41",
		}
		err := ValidateDockerConfig(config)
		assert.NoError(t, err)
	})

	t.Run("ValidTLSConfig", func(t *testing.T) {
		config := &DockerConfig{
			Host:      "tcp://docker.example.com:2376",
			TLSVerify: true,
			CertPath:  "/path/to/cert.pem",
			KeyPath:   "/path/to/key.pem",
			CAPath:    "/path/to/ca.pem",
		}
		err := ValidateDockerConfig(config)
		assert.NoError(t, err)
	})

	t.Run("ValidRegistryAuthConfig", func(t *testing.T) {
		config := &DockerConfig{
			Host: "unix:///var/run/docker.sock",
			RegistryAuth: &RegistryAuth{
				Username:      "user",
				Password:      "pass",
				ServerAddress: "https://index.docker.io/v1/",
			},
		}
		err := ValidateDockerConfig(config)
		assert.NoError(t, err)
	})

	t.Run("ErrorNilConfig", func(t *testing.T) {
		err := ValidateDockerConfig(nil)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "cannot be nil")
	})

	t.Run("ErrorMissingHost", func(t *testing.T) {
		config := &DockerConfig{}
		err := ValidateDockerConfig(config)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "host is required")
	})

	t.Run("ErrorTLSWithoutCert", func(t *testing.T) {
		config := &DockerConfig{
			Host:      "tcp://docker.example.com:2376",
			TLSVerify: true,
		}
		err := ValidateDockerConfig(config)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "cert_path is required")
	})

	t.Run("ErrorTLSWithoutKey", func(t *testing.T) {
		config := &DockerConfig{
			Host:      "tcp://docker.example.com:2376",
			TLSVerify: true,
			CertPath:  "/path/to/cert.pem",
		}
		err := ValidateDockerConfig(config)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "key_path is required")
	})

	t.Run("ErrorTLSWithoutCA", func(t *testing.T) {
		config := &DockerConfig{
			Host:      "tcp://docker.example.com:2376",
			TLSVerify: true,
			CertPath:  "/path/to/cert.pem",
			KeyPath:   "/path/to/key.pem",
		}
		err := ValidateDockerConfig(config)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "ca_path is required")
	})

	t.Run("ErrorRegistryAuthWithoutUsername", func(t *testing.T) {
		config := &DockerConfig{
			Host: "unix:///var/run/docker.sock",
			RegistryAuth: &RegistryAuth{
				Password: "pass",
			},
		}
		err := ValidateDockerConfig(config)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "username is required")
	})

	t.Run("ErrorRegistryAuthWithoutPassword", func(t *testing.T) {
		config := &DockerConfig{
			Host: "unix:///var/run/docker.sock",
			RegistryAuth: &RegistryAuth{
				Username: "user",
			},
		}
		err := ValidateDockerConfig(config)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "password is required")
	})
}

func TestParseDockerConfig(t *testing.T) {
	t.Run("ValidConfig", func(t *testing.T) {
		configData := map[string]interface{}{
			"host":        "unix:///var/run/docker.sock",
			"api_version": "1.41",
			"network":     "bridge",
		}

		config, err := ParseDockerConfig(configData)
		require.NoError(t, err)
		assert.NotNil(t, config)
		assert.Equal(t, "unix:///var/run/docker.sock", config.Host)
		assert.Equal(t, "1.41", config.APIVersion)
		assert.Equal(t, "bridge", config.Network)
	})

	t.Run("ValidTLSConfig", func(t *testing.T) {
		configData := map[string]interface{}{
			"host":       "tcp://docker.example.com:2376",
			"tls_verify": true,
			"cert_path":  "/certs/cert.pem",
			"key_path":   "/certs/key.pem",
			"ca_path":    "/certs/ca.pem",
		}

		config, err := ParseDockerConfig(configData)
		require.NoError(t, err)
		assert.NotNil(t, config)
		assert.True(t, config.TLSVerify)
		assert.Equal(t, "/certs/cert.pem", config.CertPath)
		assert.Equal(t, "/certs/key.pem", config.KeyPath)
		assert.Equal(t, "/certs/ca.pem", config.CAPath)
	})

	t.Run("ValidRegistryAuth", func(t *testing.T) {
		configData := map[string]interface{}{
			"host": "unix:///var/run/docker.sock",
			"registry_auth": map[string]interface{}{
				"username":       "myuser",
				"password":       "mypass",
				"server_address": "https://registry.example.com",
			},
		}

		config, err := ParseDockerConfig(configData)
		require.NoError(t, err)
		assert.NotNil(t, config)
		assert.NotNil(t, config.RegistryAuth)
		assert.Equal(t, "myuser", config.RegistryAuth.Username)
		assert.Equal(t, "mypass", config.RegistryAuth.Password)
		assert.Equal(t, "https://registry.example.com", config.RegistryAuth.ServerAddress)
	})

	t.Run("ErrorNilData", func(t *testing.T) {
		_, err := ParseDockerConfig(nil)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "cannot be nil")
	})

	t.Run("ErrorInvalidData", func(t *testing.T) {
		configData := map[string]interface{}{
			"host": 12345, // Should be string
		}

		_, err := ParseDockerConfig(configData)
		assert.Error(t, err)
	})

	t.Run("ErrorMissingHost", func(t *testing.T) {
		configData := map[string]interface{}{
			"network": "bridge",
		}

		_, err := ParseDockerConfig(configData)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "host is required")
	})
}

func TestDockerConfigToMap(t *testing.T) {
	t.Run("BasicConfig", func(t *testing.T) {
		config := &DockerConfig{
			Host:       "unix:///var/run/docker.sock",
			APIVersion: "1.41",
			Network:    "bridge",
		}

		configMap, err := config.ToMap()
		require.NoError(t, err)
		assert.NotNil(t, configMap)
		assert.Equal(t, "unix:///var/run/docker.sock", configMap["host"])
		assert.Equal(t, "1.41", configMap["api_version"])
		assert.Equal(t, "bridge", configMap["network"])
	})

	t.Run("TLSConfig", func(t *testing.T) {
		config := &DockerConfig{
			Host:      "tcp://docker.example.com:2376",
			TLSVerify: true,
			CertPath:  "/certs/cert.pem",
			KeyPath:   "/certs/key.pem",
			CAPath:    "/certs/ca.pem",
		}

		configMap, err := config.ToMap()
		require.NoError(t, err)
		assert.NotNil(t, configMap)
		assert.Equal(t, true, configMap["tls_verify"])
		assert.Equal(t, "/certs/cert.pem", configMap["cert_path"])
		assert.Equal(t, "/certs/key.pem", configMap["key_path"])
		assert.Equal(t, "/certs/ca.pem", configMap["ca_path"])
	})

	t.Run("WithRegistryAuth", func(t *testing.T) {
		config := &DockerConfig{
			Host: "unix:///var/run/docker.sock",
			RegistryAuth: &RegistryAuth{
				Username:      "user",
				Password:      "pass",
				ServerAddress: "https://registry.example.com",
			},
		}

		configMap, err := config.ToMap()
		require.NoError(t, err)
		assert.NotNil(t, configMap)

		registryAuth, ok := configMap["registry_auth"].(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, "user", registryAuth["username"])
		assert.Equal(t, "pass", registryAuth["password"])
		assert.Equal(t, "https://registry.example.com", registryAuth["server_address"])
	})

	t.Run("RoundTrip", func(t *testing.T) {
		original := &DockerConfig{
			Host:       "tcp://localhost:2375",
			APIVersion: "1.41",
			Network:    "custom_network",
		}

		// Convert to map
		configMap, err := original.ToMap()
		require.NoError(t, err)

		// Parse back from map
		parsed, err := ParseDockerConfig(configMap)
		require.NoError(t, err)

		// Should match original
		assert.Equal(t, original.Host, parsed.Host)
		assert.Equal(t, original.APIVersion, parsed.APIVersion)
		assert.Equal(t, original.Network, parsed.Network)
	})
}