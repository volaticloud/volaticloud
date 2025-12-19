package docker

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateConfig(t *testing.T) {
	t.Run("ValidMinimalConfig", func(t *testing.T) {
		config := &Config{
			Host: "unix:///var/run/docker.sock",
		}
		err := ValidateConfig(config)
		assert.NoError(t, err)
	})

	t.Run("ValidTCPConfig", func(t *testing.T) {
		config := &Config{
			Host:       "tcp://localhost:2375",
			Network:    "bridge",
			APIVersion: "1.41",
		}
		err := ValidateConfig(config)
		assert.NoError(t, err)
	})

	t.Run("ValidTLSConfig", func(t *testing.T) {
		config := &Config{
			Host:      "tcp://docker.example.com:2376",
			TLSVerify: true,
			CertPEM:   "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----",
			KeyPEM:    "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
			CAPEM:     "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----",
		}
		err := ValidateConfig(config)
		assert.NoError(t, err)
	})

	t.Run("ValidRegistryAuthConfig", func(t *testing.T) {
		config := &Config{
			Host: "unix:///var/run/docker.sock",
			RegistryAuth: &RegistryAuth{
				Username:      "user",
				Password:      "pass",
				ServerAddress: "https://index.docker.io/v1/",
			},
		}
		err := ValidateConfig(config)
		assert.NoError(t, err)
	})

	t.Run("ErrorNilConfig", func(t *testing.T) {
		err := ValidateConfig(nil)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "cannot be nil")
	})

	t.Run("ErrorMissingHost", func(t *testing.T) {
		config := &Config{}
		err := ValidateConfig(config)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "host is required")
	})

	t.Run("ErrorTLSWithoutCert", func(t *testing.T) {
		config := &Config{
			Host:      "tcp://docker.example.com:2376",
			TLSVerify: true,
		}
		err := ValidateConfig(config)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "cert_pem is required")
	})

	t.Run("ErrorTLSWithoutKey", func(t *testing.T) {
		config := &Config{
			Host:      "tcp://docker.example.com:2376",
			TLSVerify: true,
			CertPEM:   "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----",
		}
		err := ValidateConfig(config)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "key_pem is required")
	})

	t.Run("ErrorTLSWithoutCA", func(t *testing.T) {
		config := &Config{
			Host:      "tcp://docker.example.com:2376",
			TLSVerify: true,
			CertPEM:   "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----",
			KeyPEM:    "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
		}
		err := ValidateConfig(config)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "ca_pem is required")
	})

	t.Run("ErrorRegistryAuthWithoutUsername", func(t *testing.T) {
		config := &Config{
			Host: "unix:///var/run/docker.sock",
			RegistryAuth: &RegistryAuth{
				Password: "pass",
			},
		}
		err := ValidateConfig(config)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "username is required")
	})

	t.Run("ErrorRegistryAuthWithoutPassword", func(t *testing.T) {
		config := &Config{
			Host: "unix:///var/run/docker.sock",
			RegistryAuth: &RegistryAuth{
				Username: "user",
			},
		}
		err := ValidateConfig(config)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "password is required")
	})
}

func TestParseConfig(t *testing.T) {
	t.Run("ValidConfig", func(t *testing.T) {
		configData := map[string]interface{}{
			"host":       "unix:///var/run/docker.sock",
			"apiVersion": "1.41",
			"network":    "bridge",
		}

		config, err := ParseConfig(configData)
		require.NoError(t, err)
		assert.NotNil(t, config)
		assert.Equal(t, "unix:///var/run/docker.sock", config.Host)
		assert.Equal(t, "1.41", config.APIVersion)
		assert.Equal(t, "bridge", config.Network)
	})

	t.Run("ValidTLSConfig", func(t *testing.T) {
		certPEM := "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----"
		keyPEM := "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----"
		caPEM := "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----"

		configData := map[string]interface{}{
			"host":      "tcp://docker.example.com:2376",
			"tlsVerify": true,
			"certPEM":   certPEM,
			"keyPEM":    keyPEM,
			"caPEM":     caPEM,
		}

		config, err := ParseConfig(configData)
		require.NoError(t, err)
		assert.NotNil(t, config)
		assert.True(t, config.TLSVerify)
		assert.Equal(t, certPEM, config.CertPEM)
		assert.Equal(t, keyPEM, config.KeyPEM)
		assert.Equal(t, caPEM, config.CAPEM)
	})

	t.Run("ValidRegistryAuth", func(t *testing.T) {
		configData := map[string]interface{}{
			"host": "unix:///var/run/docker.sock",
			"registryAuth": map[string]interface{}{
				"username":      "myuser",
				"password":      "mypass",
				"serverAddress": "https://registry.example.com",
			},
		}

		config, err := ParseConfig(configData)
		require.NoError(t, err)
		assert.NotNil(t, config)
		assert.NotNil(t, config.RegistryAuth)
		assert.Equal(t, "myuser", config.RegistryAuth.Username)
		assert.Equal(t, "mypass", config.RegistryAuth.Password)
		assert.Equal(t, "https://registry.example.com", config.RegistryAuth.ServerAddress)
	})

	t.Run("ErrorNilData", func(t *testing.T) {
		_, err := ParseConfig(nil)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "cannot be nil")
	})

	t.Run("ErrorInvalidData", func(t *testing.T) {
		configData := map[string]interface{}{
			"host": 12345, // Should be string
		}

		_, err := ParseConfig(configData)
		assert.Error(t, err)
	})

	t.Run("ErrorMissingHost", func(t *testing.T) {
		configData := map[string]interface{}{
			"network": "bridge",
		}

		_, err := ParseConfig(configData)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "host is required")
	})
}

func TestConfigToMap(t *testing.T) {
	t.Run("BasicConfig", func(t *testing.T) {
		config := &Config{
			Host:       "unix:///var/run/docker.sock",
			APIVersion: "1.41",
			Network:    "bridge",
		}

		configMap, err := config.ToMap()
		require.NoError(t, err)
		assert.NotNil(t, configMap)
		assert.Equal(t, "unix:///var/run/docker.sock", configMap["host"])
		assert.Equal(t, "1.41", configMap["apiVersion"])
		assert.Equal(t, "bridge", configMap["network"])
	})

	t.Run("TLSConfig", func(t *testing.T) {
		certPEM := "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----"
		keyPEM := "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----"
		caPEM := "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----"

		config := &Config{
			Host:      "tcp://docker.example.com:2376",
			TLSVerify: true,
			CertPEM:   certPEM,
			KeyPEM:    keyPEM,
			CAPEM:     caPEM,
		}

		configMap, err := config.ToMap()
		require.NoError(t, err)
		assert.NotNil(t, configMap)
		assert.Equal(t, true, configMap["tlsVerify"])
		assert.Equal(t, certPEM, configMap["certPEM"])
		assert.Equal(t, keyPEM, configMap["keyPEM"])
		assert.Equal(t, caPEM, configMap["caPEM"])
	})

	t.Run("WithRegistryAuth", func(t *testing.T) {
		config := &Config{
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

		registryAuth, ok := configMap["registryAuth"].(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, "user", registryAuth["username"])
		assert.Equal(t, "pass", registryAuth["password"])
		assert.Equal(t, "https://registry.example.com", registryAuth["serverAddress"])
	})

	t.Run("RoundTrip", func(t *testing.T) {
		original := &Config{
			Host:       "tcp://localhost:2375",
			APIVersion: "1.41",
			Network:    "custom_network",
		}

		// Convert to map
		configMap, err := original.ToMap()
		require.NoError(t, err)

		// Parse back from map
		parsed, err := ParseConfig(configMap)
		require.NoError(t, err)

		// Should match original
		assert.Equal(t, original.Host, parsed.Host)
		assert.Equal(t, original.APIVersion, parsed.APIVersion)
		assert.Equal(t, original.Network, parsed.Network)
	})
}
