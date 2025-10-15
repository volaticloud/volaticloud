package graph

import (
	"anytrade/internal/ent"
	"anytrade/internal/enum"
	"testing"

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

	t.Run("CreateBot", func(t *testing.T) {
		input := ent.CreateBotInput{
			Name:       "My Trading Bot",
			Status:     ptr(enum.BotStatusStopped),
			ExchangeID: exchange.ID,
			StrategyID: strategy.ID,
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

	// Create test bots
	bots := []ent.CreateBotInput{
		{Name: "Bot 1", Status: ptr(enum.BotStatusStopped), ExchangeID: exchange.ID, StrategyID: strategy.ID},
		{Name: "Bot 2", Status: ptr(enum.BotStatusRunning), ExchangeID: exchange.ID, StrategyID: strategy.ID},
		{Name: "Bot 3", Status: ptr(enum.BotStatusError), ExchangeID: exchange.ID, StrategyID: strategy.ID},
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