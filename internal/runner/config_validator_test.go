package runner

import (
	"testing"

	"volaticloud/internal/enum"

	"github.com/stretchr/testify/assert"
)

func TestExtractRunnerConfig(t *testing.T) {
	t.Run("Docker_NestedFormat", func(t *testing.T) {
		configData := map[string]interface{}{
			"docker": map[string]interface{}{
				"host": "unix:///var/run/docker.sock",
			},
		}

		extracted := ExtractRunnerConfig(configData, enum.RunnerDocker)
		assert.NotNil(t, extracted)
		assert.Equal(t, "unix:///var/run/docker.sock", extracted["host"])
		assert.Nil(t, extracted["docker"]) // Should not have nested key
	})

	t.Run("Docker_DirectFormat", func(t *testing.T) {
		configData := map[string]interface{}{
			"host": "unix:///var/run/docker.sock",
		}

		extracted := ExtractRunnerConfig(configData, enum.RunnerDocker)
		assert.NotNil(t, extracted)
		assert.Equal(t, "unix:///var/run/docker.sock", extracted["host"])
	})

	t.Run("Kubernetes_NestedFormat", func(t *testing.T) {
		configData := map[string]interface{}{
			"kubernetes": map[string]interface{}{
				"namespace": "default",
			},
		}

		extracted := ExtractRunnerConfig(configData, enum.RunnerKubernetes)
		assert.NotNil(t, extracted)
		assert.Equal(t, "default", extracted["namespace"])
	})

	t.Run("Local_NestedFormat", func(t *testing.T) {
		configData := map[string]interface{}{
			"local": map[string]interface{}{
				"basePath": "/tmp",
			},
		}

		extracted := ExtractRunnerConfig(configData, enum.RunnerLocal)
		assert.NotNil(t, extracted)
		assert.Equal(t, "/tmp", extracted["basePath"])
	})

	t.Run("EmptyConfig_ReturnsOriginal", func(t *testing.T) {
		configData := map[string]interface{}{}

		extracted := ExtractRunnerConfig(configData, enum.RunnerDocker)
		assert.NotNil(t, extracted)
		assert.Equal(t, configData, extracted)
	})

	t.Run("WrongNestedKey_ReturnsOriginal", func(t *testing.T) {
		configData := map[string]interface{}{
			"kubernetes": map[string]interface{}{
				"namespace": "default",
			},
		}

		// Asking for Docker but config has kubernetes key
		extracted := ExtractRunnerConfig(configData, enum.RunnerDocker)
		assert.NotNil(t, extracted)
		assert.Equal(t, configData, extracted)
	})
}

func TestValidateConfig(t *testing.T) {
	t.Run("ValidDockerConfig_DirectFormat", func(t *testing.T) {
		configData := map[string]interface{}{
			"host": "unix:///var/run/docker.sock",
		}

		err := ValidateConfig(enum.RunnerDocker, configData)
		assert.NoError(t, err)
	})

	t.Run("ValidDockerConfig_NestedFormat", func(t *testing.T) {
		configData := map[string]interface{}{
			"docker": map[string]interface{}{
				"host": "unix:///var/run/docker.sock",
			},
		}

		err := ValidateConfig(enum.RunnerDocker, configData)
		assert.NoError(t, err)
	})

	t.Run("ValidDockerConfig_NestedWithOptionalFields", func(t *testing.T) {
		configData := map[string]interface{}{
			"docker": map[string]interface{}{
				"host":       "tcp://localhost:2375",
				"tlsVerify":  true,
				"network":    "bridge",
				"apiVersion": "1.41",
			},
		}

		err := ValidateConfig(enum.RunnerDocker, configData)
		assert.NoError(t, err)
	})

	t.Run("InvalidDockerConfig_DirectFormat", func(t *testing.T) {
		configData := map[string]interface{}{
			"network": "bridge", // Missing required 'host'
		}

		err := ValidateConfig(enum.RunnerDocker, configData)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "host is required")
	})

	t.Run("InvalidDockerConfig_NestedFormat", func(t *testing.T) {
		configData := map[string]interface{}{
			"docker": map[string]interface{}{
				"network": "bridge", // Missing required 'host'
			},
		}

		err := ValidateConfig(enum.RunnerDocker, configData)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "host is required")
	})

	t.Run("KubernetesNotSupported", func(t *testing.T) {
		configData := map[string]interface{}{
			"namespace": "default",
		}

		err := ValidateConfig(enum.RunnerKubernetes, configData)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not yet supported")
	})

	t.Run("LocalNotSupported", func(t *testing.T) {
		configData := map[string]interface{}{
			"work_dir": "/tmp",
		}

		err := ValidateConfig(enum.RunnerLocal, configData)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not yet supported")
	})

	t.Run("NilConfig", func(t *testing.T) {
		err := ValidateConfig(enum.RunnerDocker, nil)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "config cannot be nil")
	})

	t.Run("UnsupportedRuntimeType", func(t *testing.T) {
		configData := map[string]interface{}{
			"host": "test",
		}

		err := ValidateConfig(enum.RunnerType("invalid"), configData)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "unsupported runner type")
	})
}
