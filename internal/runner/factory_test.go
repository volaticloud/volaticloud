package runner_test

import (
	"context"
	"testing"

	_ "volaticloud/internal/docker" // Register Docker runtime creator
	"volaticloud/internal/enum"
	_ "volaticloud/internal/kubernetes" // Register Kubernetes runtime creator
	"volaticloud/internal/runner"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFactory(t *testing.T) {
	factory := runner.NewFactory()
	ctx := context.Background()

	t.Run("CreateDockerRuntime_ValidConfig_DirectFormat", func(t *testing.T) {
		config := map[string]interface{}{
			"host": "unix:///var/run/docker.sock",
		}

		// Note: This will fail if Docker is not running, which is expected
		rt, err := factory.Create(ctx, enum.RunnerDocker, config)

		// We expect either success (if Docker is available) or a connection error
		if err != nil {
			// Should be a connection error, not a config error
			assert.Contains(t, err.Error(), "Docker")
		} else {
			require.NotNil(t, rt)
			assert.Equal(t, "docker", rt.Type())
			rt.Close()
		}
	})

	t.Run("CreateDockerRuntime_ValidConfig_NestedFormat", func(t *testing.T) {
		config := map[string]interface{}{
			"docker": map[string]interface{}{
				"host": "unix:///var/run/docker.sock",
			},
		}

		// Note: This will fail if Docker is not running, which is expected
		rt, err := factory.Create(ctx, enum.RunnerDocker, config)

		// We expect either success (if Docker is available) or a connection error
		if err != nil {
			// Should be a connection error, not a config error
			assert.Contains(t, err.Error(), "Docker")
		} else {
			require.NotNil(t, rt)
			assert.Equal(t, "docker", rt.Type())
			rt.Close()
		}
	})

	t.Run("CreateDockerRuntime_InvalidConfig_DirectFormat", func(t *testing.T) {
		config := map[string]interface{}{
			"network": "bridge", // Missing required 'host'
		}

		rt, err := factory.Create(ctx, enum.RunnerDocker, config)

		assert.Error(t, err)
		assert.Nil(t, rt)
		assert.Contains(t, err.Error(), "host is required")
	})

	t.Run("CreateDockerRuntime_InvalidConfig_NestedFormat", func(t *testing.T) {
		config := map[string]interface{}{
			"docker": map[string]interface{}{
				"network": "bridge", // Missing required 'host'
			},
		}

		rt, err := factory.Create(ctx, enum.RunnerDocker, config)

		assert.Error(t, err)
		assert.Nil(t, rt)
		assert.Contains(t, err.Error(), "host is required")
	})

	t.Run("CreateKubernetesRuntime", func(t *testing.T) {
		config := map[string]interface{}{
			"namespace": "default",
		}

		// Kubernetes runtime requires a valid kubeconfig or in-cluster config
		// In test environment, this will fail at runtime creation or health check
		rt, err := factory.Create(ctx, enum.RunnerKubernetes, config)

		// We expect an error because we're not running in a K8s cluster
		// and haven't provided a kubeconfig
		if err != nil {
			assert.Contains(t, err.Error(), "Kubernetes")
		} else {
			require.NotNil(t, rt)
			assert.Equal(t, "kubernetes", rt.Type())
			rt.Close()
		}
	})

	t.Run("CreateLocalRuntime", func(t *testing.T) {
		config := map[string]interface{}{
			"work_dir": "/tmp",
		}

		rt, err := factory.Create(ctx, enum.RunnerLocal, config)

		require.NoError(t, err)
		require.NotNil(t, rt)
		assert.Equal(t, "local", rt.Type())

		// Verify it's not actually supported
		err = rt.HealthCheck(ctx)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not yet supported")
	})

	t.Run("CreateRuntime_UnsupportedType", func(t *testing.T) {
		config := map[string]interface{}{}

		rt, err := factory.Create(ctx, enum.RunnerType("invalid"), config)

		assert.Error(t, err)
		assert.Nil(t, rt)
		assert.Contains(t, err.Error(), "unsupported runner type")
	})
}

func TestCreateBacktestRunner(t *testing.T) {
	factory := runner.NewFactory()
	ctx := context.Background()

	t.Run("CreateDockerBacktestRunner_ValidConfig_DirectFormat", func(t *testing.T) {
		config := map[string]interface{}{
			"host": "unix:///var/run/docker.sock",
		}

		// Note: This will fail if Docker is not running, which is expected
		runner, err := factory.CreateBacktestRunner(ctx, enum.RunnerDocker, config)

		// We expect either success (if Docker is available) or a connection error
		if err != nil {
			// Should be a connection error, not a config error
			assert.Contains(t, err.Error(), "Docker")
		} else {
			require.NotNil(t, runner)
			assert.Equal(t, "docker", runner.Type())
			runner.Close()
		}
	})

	t.Run("CreateDockerBacktestRunner_ValidConfig_NestedFormat", func(t *testing.T) {
		config := map[string]interface{}{
			"docker": map[string]interface{}{
				"host": "unix:///var/run/docker.sock",
			},
		}

		// Note: This will fail if Docker is not running, which is expected
		runner, err := factory.CreateBacktestRunner(ctx, enum.RunnerDocker, config)

		// We expect either success (if Docker is available) or a connection error
		if err != nil {
			// Should be a connection error, not a config error
			assert.Contains(t, err.Error(), "Docker")
		} else {
			require.NotNil(t, runner)
			assert.Equal(t, "docker", runner.Type())
			runner.Close()
		}
	})

	t.Run("CreateDockerBacktestRunner_InvalidConfig_DirectFormat", func(t *testing.T) {
		config := map[string]interface{}{
			"network": "bridge", // Missing required 'host'
		}

		runner, err := factory.CreateBacktestRunner(ctx, enum.RunnerDocker, config)

		assert.Error(t, err)
		assert.Nil(t, runner)
		assert.Contains(t, err.Error(), "host is required")
	})

	t.Run("CreateDockerBacktestRunner_InvalidConfig_NestedFormat", func(t *testing.T) {
		config := map[string]interface{}{
			"docker": map[string]interface{}{
				"network": "bridge", // Missing required 'host'
			},
		}

		runner, err := factory.CreateBacktestRunner(ctx, enum.RunnerDocker, config)

		assert.Error(t, err)
		assert.Nil(t, runner)
		assert.Contains(t, err.Error(), "host is required")
	})

	t.Run("CreateKubernetesBacktestRunner", func(t *testing.T) {
		config := map[string]interface{}{
			"namespace": "default",
		}

		// Kubernetes backtest runner requires a valid kubeconfig or in-cluster config
		// In test environment, this will fail at runtime creation or health check
		runner, err := factory.CreateBacktestRunner(ctx, enum.RunnerKubernetes, config)

		// We expect an error because we're not running in a K8s cluster
		if err != nil {
			assert.Contains(t, err.Error(), "Kubernetes")
		} else {
			require.NotNil(t, runner)
			assert.Equal(t, "kubernetes", runner.Type())
			runner.Close()
		}
	})

	t.Run("CreateLocalBacktestRunner", func(t *testing.T) {
		config := map[string]interface{}{
			"work_dir": "/tmp",
		}

		runner, err := factory.CreateBacktestRunner(ctx, enum.RunnerLocal, config)

		require.NoError(t, err)
		require.NotNil(t, runner)
		// MockBacktestRunner returns "mock" as type
		assert.Equal(t, "mock", runner.Type())
	})

	t.Run("CreateBacktestRunner_UnsupportedType", func(t *testing.T) {
		config := map[string]interface{}{}

		runner, err := factory.CreateBacktestRunner(ctx, enum.RunnerType("invalid"), config)

		assert.Error(t, err)
		assert.Nil(t, runner)
		assert.Contains(t, err.Error(), "unsupported runner type")
	})
}

func TestNewFactory(t *testing.T) {
	factory := runner.NewFactory()
	assert.NotNil(t, factory)
}
