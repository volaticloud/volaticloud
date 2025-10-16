package contextutil

import (
	"context"
	"testing"

	"anytrade/internal/enum"
	"anytrade/internal/runner"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInitRuntimeDirect(t *testing.T) {
	ctx := context.Background()
	mockRuntime := &runner.MockRuntime{
		TypeFunc: func() string { return "mock" },
	}

	ctx = InitRuntimeDirect(ctx, mockRuntime)

	rt := GetRuntime(ctx)
	assert.NotNil(t, rt)
	assert.Equal(t, "mock", rt.Type())
}

func TestGetRuntime(t *testing.T) {
	t.Run("RuntimeExists", func(t *testing.T) {
		ctx := context.Background()
		mockRuntime := &runner.MockRuntime{
			TypeFunc: func() string { return "mock" },
		}
		ctx = InitRuntimeDirect(ctx, mockRuntime)

		rt := GetRuntime(ctx)
		assert.NotNil(t, rt)
		assert.Equal(t, "mock", rt.Type())
	})

	t.Run("RuntimeNotFound_Panics", func(t *testing.T) {
		ctx := context.Background()

		assert.Panics(t, func() {
			GetRuntime(ctx)
		})
	})
}

func TestGetRuntimeSafe(t *testing.T) {
	t.Run("RuntimeExists", func(t *testing.T) {
		ctx := context.Background()
		mockRuntime := &runner.MockRuntime{
			TypeFunc: func() string { return "mock" },
		}
		ctx = InitRuntimeDirect(ctx, mockRuntime)

		rt, err := GetRuntimeSafe(ctx)
		require.NoError(t, err)
		assert.NotNil(t, rt)
		assert.Equal(t, "mock", rt.Type())
	})

	t.Run("RuntimeNotFound_ReturnsError", func(t *testing.T) {
		ctx := context.Background()

		rt, err := GetRuntimeSafe(ctx)
		assert.Error(t, err)
		assert.Nil(t, rt)
		assert.Contains(t, err.Error(), "runtime not found")
	})
}

func TestHasRuntime(t *testing.T) {
	t.Run("RuntimeExists", func(t *testing.T) {
		ctx := context.Background()
		mockRuntime := &runner.MockRuntime{}
		ctx = InitRuntimeDirect(ctx, mockRuntime)

		assert.True(t, HasRuntime(ctx))
	})

	t.Run("RuntimeNotFound", func(t *testing.T) {
		ctx := context.Background()
		assert.False(t, HasRuntime(ctx))
	})
}

func TestMockRuntime(t *testing.T) {
	mock := &runner.MockRuntime{
		TypeFunc: func() string {
			return "test"
		},
		HealthCheckFunc: func(ctx context.Context) error {
			return nil
		},
		CreateBotFunc: func(ctx context.Context, spec runner.BotSpec) (string, error) {
			return "container-123", nil
		},
	}

	assert.Equal(t, "test", mock.Type())

	err := mock.HealthCheck(context.Background())
	assert.NoError(t, err)

	containerID, err := mock.CreateBot(context.Background(), runner.BotSpec{})
	assert.NoError(t, err)
	assert.Equal(t, "container-123", containerID)
}

func TestRuntimeTypes(t *testing.T) {
	t.Run("DockerRuntime", func(t *testing.T) {
		// Just verify the enum values are correct
		assert.Equal(t, "docker", string(enum.RuntimeDocker))
	})

	t.Run("KubernetesRuntime", func(t *testing.T) {
		assert.Equal(t, "kubernetes", string(enum.RuntimeKubernetes))
	})

	t.Run("LocalRuntime", func(t *testing.T) {
		assert.Equal(t, "local", string(enum.RuntimeLocal))
	})
}
