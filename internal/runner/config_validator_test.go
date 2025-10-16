package runner

import (
	"testing"

	"anytrade/internal/enum"

	"github.com/stretchr/testify/assert"
)

func TestValidateConfig(t *testing.T) {
	t.Run("ValidDockerConfig", func(t *testing.T) {
		configData := map[string]interface{}{
			"host": "unix:///var/run/docker.sock",
		}

		err := ValidateConfig(enum.RuntimeDocker, configData)
		assert.NoError(t, err)
	})

	t.Run("InvalidDockerConfig", func(t *testing.T) {
		configData := map[string]interface{}{
			"network": "bridge", // Missing required 'host'
		}

		err := ValidateConfig(enum.RuntimeDocker, configData)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "host is required")
	})

	t.Run("KubernetesNotSupported", func(t *testing.T) {
		configData := map[string]interface{}{
			"namespace": "default",
		}

		err := ValidateConfig(enum.RuntimeKubernetes, configData)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not yet supported")
	})

	t.Run("LocalNotSupported", func(t *testing.T) {
		configData := map[string]interface{}{
			"work_dir": "/tmp",
		}

		err := ValidateConfig(enum.RuntimeLocal, configData)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not yet supported")
	})

	t.Run("NilConfig", func(t *testing.T) {
		err := ValidateConfig(enum.RuntimeDocker, nil)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "config cannot be nil")
	})

	t.Run("UnsupportedRuntimeType", func(t *testing.T) {
		configData := map[string]interface{}{
			"host": "test",
		}

		err := ValidateConfig(enum.RuntimeType("invalid"), configData)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "unsupported runtime type")
	})
}