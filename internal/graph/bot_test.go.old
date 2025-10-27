package graph

import (
	"testing"

	"anytrade/internal/ent"
	"anytrade/internal/enum"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBotMutations(t *testing.T) {
	resolver := setupTestResolver(t)
	mutationResolver := resolver.Mutation()

	// Create dependencies
	exchange, err := mutationResolver.CreateExchange(ctx(), ent.CreateExchangeInput{
		Name:     enum.ExchangeBinance,
		TestMode: ptr(true),
	})
	require.NoError(t, err)

	strategy, err := mutationResolver.CreateStrategy(ctx(), ent.CreateStrategyInput{
		Name:        "Test Strategy",
		Description: ptr("Test"),
		Code:        "print('test')",
	})
	require.NoError(t, err)

	runtime, err := mutationResolver.CreateBotRuntime(ctx(), ent.CreateBotRuntimeInput{
		Name: "Test Runtime",
		Type: ptr(enum.RuntimeDocker),
	})
	require.NoError(t, err)

	t.Run("CreateBot", func(t *testing.T) {
		input := ent.CreateBotInput{
			Name:       "My Trading Bot",
			Status:     ptr(enum.BotStatusStopped),
			ExchangeID: exchange.ID,
			StrategyID: strategy.ID,
			RuntimeID:  runtime.ID,
		}

		bot, err := mutationResolver.CreateBot(ctx(), input)
		require.NoError(t, err)
		assert.NotNil(t, bot)
		assert.Equal(t, "My Trading Bot", bot.Name)
		assert.Equal(t, enum.BotStatusStopped, bot.Status)
		assert.Equal(t, exchange.ID, bot.ExchangeID)
		assert.Equal(t, strategy.ID, bot.StrategyID)
	})

	t.Run("UpdateBot", func(t *testing.T) {
		// Create bot first
		input := ent.CreateBotInput{
			Name:       "Update Test Bot",
			Status:     ptr(enum.BotStatusStopped),
			ExchangeID: exchange.ID,
			StrategyID: strategy.ID,
			RuntimeID:  runtime.ID,
		}
		bot, err := mutationResolver.CreateBot(ctx(), input)
		require.NoError(t, err)

		// Update it
		newStatus := enum.BotStatusRunning
		updateInput := ent.UpdateBotInput{
			Status: &newStatus,
		}
		updated, err := mutationResolver.UpdateBot(ctx(), bot.ID, updateInput)
		require.NoError(t, err)
		assert.Equal(t, enum.BotStatusRunning, updated.Status)
		assert.Equal(t, bot.ID, updated.ID)
	})

	t.Run("DeleteBot", func(t *testing.T) {
		// Create bot first
		input := ent.CreateBotInput{
			Name:       "Delete Bot",
			Status:     ptr(enum.BotStatusStopped),
			ExchangeID: exchange.ID,
			StrategyID: strategy.ID,
			RuntimeID:  runtime.ID,
		}
		bot, err := mutationResolver.CreateBot(ctx(), input)
		require.NoError(t, err)

		// Delete it
		deleted, err := mutationResolver.DeleteBot(ctx(), bot.ID)
		require.NoError(t, err)
		assert.True(t, deleted)
	})
}

func TestBotQueries(t *testing.T) {
	resolver := setupTestResolver(t)
	mutationResolver := resolver.Mutation()
	queryResolver := resolver.Query()

	// Create dependencies
	exchange, err := mutationResolver.CreateExchange(ctx(), ent.CreateExchangeInput{
		Name:     enum.ExchangeKraken,
		TestMode: ptr(true),
	})
	require.NoError(t, err)

	strategy, err := mutationResolver.CreateStrategy(ctx(), ent.CreateStrategyInput{
		Name:        "Strategy",
		Description: ptr("Desc"),
		Code:        "print('strategy')",
	})
	require.NoError(t, err)

	runtime, err := mutationResolver.CreateBotRuntime(ctx(), ent.CreateBotRuntimeInput{
		Name: "Query Runtime",
		Type: ptr(enum.RuntimeDocker),
	})
	require.NoError(t, err)

	// Create test bots
	bots := []ent.CreateBotInput{
		{Name: "Bot 1", Status: ptr(enum.BotStatusStopped), ExchangeID: exchange.ID, StrategyID: strategy.ID, RuntimeID: runtime.ID},
		{Name: "Bot 2", Status: ptr(enum.BotStatusRunning), ExchangeID: exchange.ID, StrategyID: strategy.ID, RuntimeID: runtime.ID},
		{Name: "Bot 3", Status: ptr(enum.BotStatusError), ExchangeID: exchange.ID, StrategyID: strategy.ID, RuntimeID: runtime.ID},
	}

	for _, input := range bots {
		_, err := mutationResolver.CreateBot(ctx(), input)
		require.NoError(t, err)
	}

	t.Run("QueryBots", func(t *testing.T) {
		first := 10
		result, err := queryResolver.Bots(ctx(), nil, &first, nil, nil)
		require.NoError(t, err)
		assert.NotNil(t, result)
		assert.GreaterOrEqual(t, result.TotalCount, 3)
	})

	t.Run("QueryBotsWithPagination", func(t *testing.T) {
		first := 2
		result, err := queryResolver.Bots(ctx(), nil, &first, nil, nil)
		require.NoError(t, err)
		assert.LessOrEqual(t, len(result.Edges), 2)

		if result.PageInfo.HasNextPage {
			cursor := result.PageInfo.EndCursor
			result2, err := queryResolver.Bots(ctx(), cursor, &first, nil, nil)
			require.NoError(t, err)
			assert.NotNil(t, result2)
		}
	})
}

func TestBotLifecycleMutations(t *testing.T) {
	resolver := setupTestResolver(t)
	mutationResolver := resolver.Mutation()

	// Create dependencies
	exchange, err := mutationResolver.CreateExchange(ctx(), ent.CreateExchangeInput{
		Name:     enum.ExchangeBinance,
		TestMode: ptr(true),
	})
	require.NoError(t, err)

	strategy, err := mutationResolver.CreateStrategy(ctx(), ent.CreateStrategyInput{
		Name:        "Lifecycle Test Strategy",
		Description: ptr("Test"),
		Code:        "print('test')",
	})
	require.NoError(t, err)

	// Create runtime with Docker config
	// Note: Config field is not in GraphQL input, so we create and update separately
	runtime, err := mutationResolver.CreateBotRuntime(ctx(), ent.CreateBotRuntimeInput{
		Name: "Docker Runtime",
		Type: ptr(enum.RuntimeDocker),
	})
	require.NoError(t, err)

	// Update with config directly via ENT client
	dockerConfig := map[string]interface{}{
		"host": "unix:///var/run/docker.sock",
	}
	runtime, err = resolver.client.BotRuntime.UpdateOneID(runtime.ID).
		SetConfig(dockerConfig).
		Save(ctx())
	require.NoError(t, err)

	t.Run("StartBot_NoContainerID", func(t *testing.T) {
		// Create a bot without container ID
		bot, err := mutationResolver.CreateBot(ctx(), ent.CreateBotInput{
			Name:       "Bot Without Container",
			Status:     ptr(enum.BotStatusStopped),
			ExchangeID: exchange.ID,
			StrategyID: strategy.ID,
			RuntimeID:  runtime.ID,
		})
		require.NoError(t, err)

		// Try to start it - should fail because no container ID
		_, err = mutationResolver.StartBot(ctx(), bot.ID)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "no container ID")
	})

	t.Run("StopBot_NoContainerID", func(t *testing.T) {
		// Create a bot without container ID
		bot, err := mutationResolver.CreateBot(ctx(), ent.CreateBotInput{
			Name:       "Bot Stop Test",
			Status:     ptr(enum.BotStatusRunning),
			ExchangeID: exchange.ID,
			StrategyID: strategy.ID,
			RuntimeID:  runtime.ID,
		})
		require.NoError(t, err)

		// Try to stop it - should fail because no container ID
		_, err = mutationResolver.StopBot(ctx(), bot.ID)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "no container ID")
	})

	t.Run("RestartBot_NoContainerID", func(t *testing.T) {
		// Create a bot without container ID
		bot, err := mutationResolver.CreateBot(ctx(), ent.CreateBotInput{
			Name:       "Bot Restart Test",
			Status:     ptr(enum.BotStatusRunning),
			ExchangeID: exchange.ID,
			StrategyID: strategy.ID,
			RuntimeID:  runtime.ID,
		})
		require.NoError(t, err)

		// Try to restart it - should fail because no container ID
		_, err = mutationResolver.RestartBot(ctx(), bot.ID)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "no container ID")
	})

	t.Run("StartBot_WithContainerID_RuntimeUnavailable", func(t *testing.T) {
		// Create a bot with a fake container ID
		containerID := "test-container-123"
		bot, err := mutationResolver.CreateBot(ctx(), ent.CreateBotInput{
			Name:        "Bot With Container",
			Status:      ptr(enum.BotStatusStopped),
			ContainerID: &containerID,
			ExchangeID:  exchange.ID,
			StrategyID:  strategy.ID,
			RuntimeID:   runtime.ID,
		})
		require.NoError(t, err)

		// Try to start it - will fail because Docker might not be available or container doesn't exist
		// This tests that the resolver properly calls the runtime
		_, err = mutationResolver.StartBot(ctx(), bot.ID)
		// We expect an error since we're not running a real Docker daemon in tests
		assert.Error(t, err)
	})

	t.Run("StopBot_WithContainerID_RuntimeUnavailable", func(t *testing.T) {
		// Create a bot with a fake container ID
		containerID := "test-container-456"
		bot, err := mutationResolver.CreateBot(ctx(), ent.CreateBotInput{
			Name:        "Bot Stop Container Test",
			Status:      ptr(enum.BotStatusRunning),
			ContainerID: &containerID,
			ExchangeID:  exchange.ID,
			StrategyID:  strategy.ID,
			RuntimeID:   runtime.ID,
		})
		require.NoError(t, err)

		// Try to stop it - will fail because Docker might not be available or container doesn't exist
		_, err = mutationResolver.StopBot(ctx(), bot.ID)
		assert.Error(t, err)
	})

	t.Run("RestartBot_WithContainerID_RuntimeUnavailable", func(t *testing.T) {
		// Create a bot with a fake container ID
		containerID := "test-container-789"
		bot, err := mutationResolver.CreateBot(ctx(), ent.CreateBotInput{
			Name:        "Bot Restart Container Test",
			Status:      ptr(enum.BotStatusRunning),
			ContainerID: &containerID,
			ExchangeID:  exchange.ID,
			StrategyID:  strategy.ID,
			RuntimeID:   runtime.ID,
		})
		require.NoError(t, err)

		// Try to restart it - will fail because Docker might not be available or container doesn't exist
		_, err = mutationResolver.RestartBot(ctx(), bot.ID)
		assert.Error(t, err)
	})
}

func TestBotRuntimeStatusQuery(t *testing.T) {
	resolver := setupTestResolver(t)
	mutationResolver := resolver.Mutation()
	queryResolver := resolver.Query()

	// Create dependencies
	exchange, err := mutationResolver.CreateExchange(ctx(), ent.CreateExchangeInput{
		Name:     enum.ExchangeKraken,
		TestMode: ptr(true),
	})
	require.NoError(t, err)

	strategy, err := mutationResolver.CreateStrategy(ctx(), ent.CreateStrategyInput{
		Name:        "Status Query Strategy",
		Description: ptr("Test"),
		Code:        "print('test')",
	})
	require.NoError(t, err)

	// Create runtime with Docker config
	// Note: Config field is not in GraphQL input, so we create and update separately
	runtime, err := mutationResolver.CreateBotRuntime(ctx(), ent.CreateBotRuntimeInput{
		Name: "Status Query Runtime",
		Type: ptr(enum.RuntimeDocker),
	})
	require.NoError(t, err)

	// Update with config directly via ENT client
	dockerConfig := map[string]interface{}{
		"host": "unix:///var/run/docker.sock",
	}
	runtime, err = resolver.client.BotRuntime.UpdateOneID(runtime.ID).
		SetConfig(dockerConfig).
		Save(ctx())
	require.NoError(t, err)

	t.Run("GetBotRuntimeStatus_NoContainerID", func(t *testing.T) {
		// Create a bot without container ID
		bot, err := mutationResolver.CreateBot(ctx(), ent.CreateBotInput{
			Name:       "Status Bot No Container",
			Status:     ptr(enum.BotStatusStopped),
			ExchangeID: exchange.ID,
			StrategyID: strategy.ID,
			RuntimeID:  runtime.ID,
		})
		require.NoError(t, err)

		// Try to get status - should fail because no container ID
		_, err = queryResolver.GetBotRuntimeStatus(ctx(), bot.ID)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "no container ID")
	})

	t.Run("GetBotRuntimeStatus_WithContainerID_RuntimeUnavailable", func(t *testing.T) {
		// Create a bot with a fake container ID
		containerID := "status-test-container-123"
		bot, err := mutationResolver.CreateBot(ctx(), ent.CreateBotInput{
			Name:        "Status Bot With Container",
			Status:      ptr(enum.BotStatusRunning),
			ContainerID: &containerID,
			ExchangeID:  exchange.ID,
			StrategyID:  strategy.ID,
			RuntimeID:   runtime.ID,
		})
		require.NoError(t, err)

		// Try to get status - will fail because Docker might not be available or container doesn't exist
		_, err = queryResolver.GetBotRuntimeStatus(ctx(), bot.ID)
		// We expect an error since we're not running a real Docker daemon in tests
		assert.Error(t, err)
	})
}