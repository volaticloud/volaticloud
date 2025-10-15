package graph

import (
	"anytrade/internal/ent"
	"anytrade/internal/enum"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBotRuntimeMutations(t *testing.T) {
	resolver := setupTestResolver(t)
	mutationResolver := resolver.Mutation()

	t.Run("CreateBotRuntime", func(t *testing.T) {
		input := ent.CreateBotRuntimeInput{
			Name: "Docker Local",
			Type: ptr(enum.RuntimeDocker),
		}

		runtime, err := mutationResolver.CreateBotRuntime(ctx(), input)
		require.NoError(t, err)
		assert.NotNil(t, runtime)
		assert.Equal(t, "Docker Local", runtime.Name)
		assert.Equal(t, enum.RuntimeDocker, runtime.Type)
	})

	t.Run("UpdateBotRuntime", func(t *testing.T) {
		// Create runtime first
		input := ent.CreateBotRuntimeInput{
			Name: "K8s Cluster",
			Type: ptr(enum.RuntimeKubernetes),
		}
		runtime, err := mutationResolver.CreateBotRuntime(ctx(), input)
		require.NoError(t, err)

		// Update it
		newName := "Production K8s"
		updateInput := ent.UpdateBotRuntimeInput{
			Name: &newName,
		}
		updated, err := mutationResolver.UpdateBotRuntime(ctx(), runtime.ID, updateInput)
		require.NoError(t, err)
		assert.Equal(t, "Production K8s", updated.Name)
		assert.Equal(t, runtime.ID, updated.ID)
		assert.Equal(t, enum.RuntimeKubernetes, updated.Type)
	})

	t.Run("DeleteBotRuntime", func(t *testing.T) {
		// Create runtime first
		input := ent.CreateBotRuntimeInput{
			Name: "Local Test",
			Type: ptr(enum.RuntimeLocal),
		}
		runtime, err := mutationResolver.CreateBotRuntime(ctx(), input)
		require.NoError(t, err)

		// Delete it
		deleted, err := mutationResolver.DeleteBotRuntime(ctx(), runtime.ID)
		require.NoError(t, err)
		assert.True(t, deleted)
	})
}

func TestBotRuntimeQueries(t *testing.T) {
	resolver := setupTestResolver(t)
	mutationResolver := resolver.Mutation()
	queryResolver := resolver.Query()

	// Create test runtimes
	runtimes := []ent.CreateBotRuntimeInput{
		{Name: "Docker Dev", Type: ptr(enum.RuntimeDocker)},
		{Name: "K8s Prod", Type: ptr(enum.RuntimeKubernetes)},
		{Name: "Local Testing", Type: ptr(enum.RuntimeLocal)},
	}

	for _, input := range runtimes {
		_, err := mutationResolver.CreateBotRuntime(ctx(), input)
		require.NoError(t, err)
	}

	t.Run("QueryBotRuntimes", func(t *testing.T) {
		first := 10
		result, err := queryResolver.BotRuntimes(ctx(), nil, &first, nil, nil)
		require.NoError(t, err)
		assert.NotNil(t, result)
		assert.GreaterOrEqual(t, result.TotalCount, 3)
	})

	t.Run("QueryBotRuntimesWithPagination", func(t *testing.T) {
		first := 2
		result, err := queryResolver.BotRuntimes(ctx(), nil, &first, nil, nil)
		require.NoError(t, err)
		assert.LessOrEqual(t, len(result.Edges), 2)

		if result.PageInfo.HasNextPage {
			cursor := result.PageInfo.EndCursor
			result2, err := queryResolver.BotRuntimes(ctx(), cursor, &first, nil, nil)
			require.NoError(t, err)
			assert.NotNil(t, result2)
		}
	})
}