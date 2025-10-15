package graph

import (
	"anytrade/internal/ent"
	"anytrade/internal/enum"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTradeMutations(t *testing.T) {
	resolver := setupTestResolver(t)
	mutationResolver := resolver.Mutation()

	// Create dependencies
	exchange, err := mutationResolver.CreateExchange(ctx(), ent.CreateExchangeInput{
		Name:     enum.ExchangeBinance,
		TestMode: ptr(true),
	})
	require.NoError(t, err)

	strategy, err := mutationResolver.CreateStrategy(ctx(), ent.CreateStrategyInput{
		Name:        "Trade Strategy",
		Description: ptr("For trades"),
		Code:        "print('trade')",
	})
	require.NoError(t, err)

	bot, err := mutationResolver.CreateBot(ctx(), ent.CreateBotInput{
		Name:       "Trade Bot",
		Status:     ptr(enum.BotStatusRunning),
		ExchangeID: exchange.ID,
		StrategyID: strategy.ID,
	})
	require.NoError(t, err)

	t.Run("CreateTrade", func(t *testing.T) {
		openDate := time.Now().Add(-1 * time.Hour)
		input := ent.CreateTradeInput{
			FreqtradeTradeID: 12345,
			Pair:             "BTC/USDT",
			OpenDate:         openDate,
			OpenRate:         50000.0,
			Amount:           0.1,
			StakeAmount:      5000.0,
			BotID:            bot.ID,
		}

		trade, err := mutationResolver.CreateTrade(ctx(), input)
		require.NoError(t, err)
		assert.NotNil(t, trade)
		assert.Equal(t, 12345, trade.FreqtradeTradeID)
		assert.Equal(t, "BTC/USDT", trade.Pair)
		assert.Equal(t, 50000.0, trade.OpenRate)
		assert.Equal(t, 0.1, trade.Amount)
		assert.Equal(t, 5000.0, trade.StakeAmount)
		assert.Equal(t, bot.ID, trade.BotID)
	})

	t.Run("UpdateTrade", func(t *testing.T) {
		// Create trade first
		openDate := time.Now().Add(-2 * time.Hour)
		input := ent.CreateTradeInput{
			FreqtradeTradeID: 67890,
			Pair:             "ETH/USDT",
			OpenDate:         openDate,
			OpenRate:         3000.0,
			Amount:           1.0,
			StakeAmount:      3000.0,
			BotID:            bot.ID,
		}
		trade, err := mutationResolver.CreateTrade(ctx(), input)
		require.NoError(t, err)

		// Update it
		closeRate := 3100.0
		closeDate := time.Now()
		updateInput := ent.UpdateTradeInput{
			CloseRate: &closeRate,
			CloseDate: &closeDate,
		}
		updated, err := mutationResolver.UpdateTrade(ctx(), trade.ID, updateInput)
		require.NoError(t, err)
		assert.Equal(t, &closeRate, updated.CloseRate)
		assert.NotNil(t, updated.CloseDate)
		assert.Equal(t, trade.ID, updated.ID)
	})

	t.Run("DeleteTrade", func(t *testing.T) {
		// Create trade first
		openDate := time.Now().Add(-30 * time.Minute)
		input := ent.CreateTradeInput{
			FreqtradeTradeID: 11111,
			Pair:             "XRP/USDT",
			OpenDate:         openDate,
			OpenRate:         0.5,
			Amount:           1000.0,
			StakeAmount:      500.0,
			BotID:            bot.ID,
		}
		trade, err := mutationResolver.CreateTrade(ctx(), input)
		require.NoError(t, err)

		// Delete it
		deleted, err := mutationResolver.DeleteTrade(ctx(), trade.ID)
		require.NoError(t, err)
		assert.True(t, deleted)
	})
}

func TestTradeQueries(t *testing.T) {
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
		Name:        "Query Strategy",
		Description: ptr("For queries"),
		Code:        "print('query')",
	})
	require.NoError(t, err)

	bot, err := mutationResolver.CreateBot(ctx(), ent.CreateBotInput{
		Name:       "Query Bot",
		Status:     ptr(enum.BotStatusRunning),
		ExchangeID: exchange.ID,
		StrategyID: strategy.ID,
	})
	require.NoError(t, err)

	// Create test trades
	openDate := time.Now().Add(-1 * time.Hour)
	trades := []ent.CreateTradeInput{
		{FreqtradeTradeID: 1, Pair: "BTC/USDT", OpenDate: openDate, OpenRate: 50000.0, Amount: 0.1, StakeAmount: 5000.0, BotID: bot.ID},
		{FreqtradeTradeID: 2, Pair: "ETH/USDT", OpenDate: openDate, OpenRate: 3000.0, Amount: 1.0, StakeAmount: 3000.0, BotID: bot.ID},
		{FreqtradeTradeID: 3, Pair: "XRP/USDT", OpenDate: openDate, OpenRate: 0.5, Amount: 1000.0, StakeAmount: 500.0, BotID: bot.ID},
	}

	for _, input := range trades {
		_, err := mutationResolver.CreateTrade(ctx(), input)
		require.NoError(t, err)
	}

	t.Run("QueryTrades", func(t *testing.T) {
		first := 10
		result, err := queryResolver.Trades(ctx(), nil, &first, nil, nil)
		require.NoError(t, err)
		assert.NotNil(t, result)
		assert.GreaterOrEqual(t, result.TotalCount, 3)
	})

	t.Run("QueryTradesWithPagination", func(t *testing.T) {
		first := 2
		result, err := queryResolver.Trades(ctx(), nil, &first, nil, nil)
		require.NoError(t, err)
		assert.LessOrEqual(t, len(result.Edges), 2)

		if result.PageInfo.HasNextPage {
			cursor := result.PageInfo.EndCursor
			result2, err := queryResolver.Trades(ctx(), cursor, &first, nil, nil)
			require.NoError(t, err)
			assert.NotNil(t, result2)
		}
	})
}