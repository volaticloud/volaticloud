package ent_test

import (
	"context"
	"testing"

	_ "volaticloud/internal/docker" // Register Docker runtime creator
	"volaticloud/internal/ent/enttest"
	"volaticloud/internal/enum"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBotRuntimeConfigValidation(t *testing.T) {
	// Create test client
	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	ctx := context.Background()

	t.Run("CreateWithValidDockerConfig", func(t *testing.T) {
		// Valid Docker config with required host field
		validConfig := map[string]interface{}{
			"host": "unix:///var/run/docker.sock",
		}

		runtime, err := client.BotRunner.Create().
			SetName("Docker Valid").
			SetType(enum.RunnerDocker).
			SetOwnerID("test-owner-id").
			SetConfig(validConfig).
			Save(ctx)

		require.NoError(t, err)
		assert.NotNil(t, runtime)
		assert.Equal(t, "Docker Valid", runtime.Name)
		assert.Equal(t, enum.RunnerDocker, runtime.Type)
	})

	t.Run("CreateWithInvalidDockerConfig", func(t *testing.T) {
		// Invalid Docker config - missing required 'host' field
		invalidConfig := map[string]interface{}{
			"network": "bridge",
		}

		_, err := client.BotRunner.Create().
			SetName("Docker Invalid").
			SetType(enum.RunnerDocker).
			SetOwnerID("test-owner-id").
			SetConfig(invalidConfig).
			Save(ctx)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid runner config")
		assert.Contains(t, err.Error(), "host is required")
	})

	t.Run("CreateWithValidTLSDockerConfig", func(t *testing.T) {
		// Valid Docker config with TLS
		validTLSConfig := map[string]interface{}{
			"host":      "tcp://docker.example.com:2376",
			"tlsVerify": true,
			"certPEM":   "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----",
			"keyPEM":    "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
			"caPEM":     "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----",
		}

		runtime, err := client.BotRunner.Create().
			SetName("Docker TLS").
			SetType(enum.RunnerDocker).
			SetOwnerID("test-owner-id").
			SetConfig(validTLSConfig).
			Save(ctx)

		require.NoError(t, err)
		assert.NotNil(t, runtime)
		assert.Equal(t, "Docker TLS", runtime.Name)
	})

	t.Run("CreateWithInvalidTLSDockerConfig", func(t *testing.T) {
		// Invalid Docker config - TLS enabled but missing cert paths
		invalidTLSConfig := map[string]interface{}{
			"host":      "tcp://docker.example.com:2376",
			"tlsVerify": true,
		}

		_, err := client.BotRunner.Create().
			SetName("Docker Invalid TLS").
			SetType(enum.RunnerDocker).
			SetOwnerID("test-owner-id").
			SetConfig(invalidTLSConfig).
			Save(ctx)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid runner config")
		assert.Contains(t, err.Error(), "cert_pem is required")
	})

	t.Run("CreateWithUnsupportedKubernetesConfig", func(t *testing.T) {
		// Kubernetes with config should fail (not yet supported)
		k8sConfig := map[string]interface{}{
			"namespace": "default",
		}

		_, err := client.BotRunner.Create().
			SetName("K8s Runtime").
			SetType(enum.RunnerKubernetes).
			SetOwnerID("test-owner-id").
			SetConfig(k8sConfig).
			Save(ctx)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid runner config")
		assert.Contains(t, err.Error(), "not yet supported")
	})

	t.Run("CreateWithUnsupportedLocalConfig", func(t *testing.T) {
		// Local with config should fail (not yet supported)
		localConfig := map[string]interface{}{
			"work_dir": "/tmp",
		}

		_, err := client.BotRunner.Create().
			SetName("Local Runtime").
			SetType(enum.RunnerLocal).
			SetOwnerID("test-owner-id").
			SetConfig(localConfig).
			Save(ctx)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid runner config")
		assert.Contains(t, err.Error(), "not yet supported")
	})

	t.Run("CreateWithoutConfig", func(t *testing.T) {
		// Creating without config should succeed (config is optional)
		runtime, err := client.BotRunner.Create().
			SetName("Docker No Config").
			SetType(enum.RunnerDocker).
			SetOwnerID("test-owner-id").
			Save(ctx)

		require.NoError(t, err)
		assert.NotNil(t, runtime)
		assert.Equal(t, "Docker No Config", runtime.Name)
	})

	t.Run("UpdateWithValidDockerConfig", func(t *testing.T) {
		// Create runtime without config
		runtime, err := client.BotRunner.Create().
			SetName("Docker Update Test").
			SetType(enum.RunnerDocker).
			SetOwnerID("test-owner-id").
			Save(ctx)
		require.NoError(t, err)

		// Update with valid config
		validConfig := map[string]interface{}{
			"host":    "tcp://localhost:2375",
			"network": "custom_network",
		}

		updated, err := client.BotRunner.UpdateOne(runtime).
			SetConfig(validConfig).
			Save(ctx)

		require.NoError(t, err)
		assert.NotNil(t, updated)
	})

	t.Run("UpdateWithInvalidDockerConfig", func(t *testing.T) {
		// Create runtime with valid config
		validConfig := map[string]interface{}{
			"host": "unix:///var/run/docker.sock",
		}
		runtime, err := client.BotRunner.Create().
			SetName("Docker Update Invalid").
			SetType(enum.RunnerDocker).
			SetOwnerID("test-owner-id").
			SetConfig(validConfig).
			Save(ctx)
		require.NoError(t, err)

		// NOTE: Our hook only validates when both type and config are in the same mutation
		// When updating only the config, validation is not triggered at the ENT level
		// This is by design - validation should be enforced at the application/resolver layer
		// for updates that only change the config field

		// Try to update both type and invalid config - this WILL trigger validation
		invalidConfig := map[string]interface{}{
			"network": "bridge",
		}

		_, err = client.BotRunner.UpdateOne(runtime).
			SetType(enum.RunnerDocker). // Include type in the mutation
			SetConfig(invalidConfig).
			Save(ctx)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid runner config")
		assert.Contains(t, err.Error(), "host is required")
	})

	t.Run("CreateWithRegistryAuth", func(t *testing.T) {
		// Valid Docker config with registry auth
		configWithAuth := map[string]interface{}{
			"host": "unix:///var/run/docker.sock",
			"registryAuth": map[string]interface{}{
				"username":      "myuser",
				"password":      "mypass",
				"serverAddress": "https://registry.example.com",
			},
		}

		runtime, err := client.BotRunner.Create().
			SetName("Docker with Registry Auth").
			SetType(enum.RunnerDocker).
			SetOwnerID("test-owner-id").
			SetConfig(configWithAuth).
			Save(ctx)

		require.NoError(t, err)
		assert.NotNil(t, runtime)
		assert.Equal(t, "Docker with Registry Auth", runtime.Name)
	})

	t.Run("CreateWithInvalidRegistryAuth", func(t *testing.T) {
		// Invalid Docker config - registry auth missing password
		invalidAuthConfig := map[string]interface{}{
			"host": "unix:///var/run/docker.sock",
			"registryAuth": map[string]interface{}{
				"username": "myuser",
				// Missing password
			},
		}

		_, err := client.BotRunner.Create().
			SetName("Docker Invalid Auth").
			SetType(enum.RunnerDocker).
			SetOwnerID("test-owner-id").
			SetConfig(invalidAuthConfig).
			Save(ctx)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid runner config")
		assert.Contains(t, err.Error(), "password is required")
	})
}
