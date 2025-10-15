package graph

import (
	"anytrade/internal/ent"
	"anytrade/internal/enum"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBacktestMutations(t *testing.T) {
	resolver := setupTestResolver(t)
	mutationResolver := resolver.Mutation()

	// Create dependency
	strategy, err := mutationResolver.CreateStrategy(ctx(), ent.CreateStrategyInput{
		Name:        "Test Strategy",
		Description: ptr("Test"),
		Code:        "print('test')",
	})
	require.NoError(t, err)

	t.Run("CreateBacktest", func(t *testing.T) {
		input := ent.CreateBacktestInput{
			StrategyID: strategy.ID,
		}
		backtest, err := mutationResolver.CreateBacktest(ctx(), input)
		require.NoError(t, err)
		assert.NotNil(t, backtest)
		assert.Equal(t, enum.TaskStatusPending, backtest.Status)
		assert.Equal(t, strategy.ID, backtest.StrategyID)
	})

	t.Run("UpdateBacktest", func(t *testing.T) {
		// Create backtest first
		input := ent.CreateBacktestInput{
			StrategyID: strategy.ID,
		}
		backtest, err := mutationResolver.CreateBacktest(ctx(), input)
		require.NoError(t, err)

		// Update it
		newStatus := enum.TaskStatusRunning
		updateInput := ent.UpdateBacktestInput{
			Status: &newStatus,
		}
		updated, err := mutationResolver.UpdateBacktest(ctx(), backtest.ID, updateInput)
		require.NoError(t, err)
		assert.Equal(t, enum.TaskStatusRunning, updated.Status)
		assert.Equal(t, backtest.ID, updated.ID)
	})

	t.Run("DeleteBacktest", func(t *testing.T) {
		// Create backtest first
		input := ent.CreateBacktestInput{
			StrategyID: strategy.ID,
		}
		backtest, err := mutationResolver.CreateBacktest(ctx(), input)
		require.NoError(t, err)

		// Delete it
		deleted, err := mutationResolver.DeleteBacktest(ctx(), backtest.ID)
		require.NoError(t, err)
		assert.True(t, deleted)
	})
}

func TestBacktestQueries(t *testing.T) {
	resolver := setupTestResolver(t)
	mutationResolver := resolver.Mutation()
	queryResolver := resolver.Query()

	// Create dependency
	strategy, err := mutationResolver.CreateStrategy(ctx(), ent.CreateStrategyInput{
		Name:        "Query Strategy",
		Description: ptr("For query tests"),
		Code:        "print('query')",
	})
	require.NoError(t, err)

	// Create test backtests
	for i := 0; i < 3; i++ {
		input := ent.CreateBacktestInput{
			StrategyID: strategy.ID,
		}
		_, err := mutationResolver.CreateBacktest(ctx(), input)
		require.NoError(t, err)
	}

	t.Run("QueryBacktests", func(t *testing.T) {
		first := 10
		result, err := queryResolver.Backtests(ctx(), nil, &first, nil, nil)
		require.NoError(t, err)
		assert.NotNil(t, result)
		assert.GreaterOrEqual(t, result.TotalCount, 3)
	})

	t.Run("QueryBacktestsWithPagination", func(t *testing.T) {
		first := 2
		result, err := queryResolver.Backtests(ctx(), nil, &first, nil, nil)
		require.NoError(t, err)
		assert.LessOrEqual(t, len(result.Edges), 2)

		if result.PageInfo.HasNextPage {
			cursor := result.PageInfo.EndCursor
			result2, err := queryResolver.Backtests(ctx(), cursor, &first, nil, nil)
			require.NoError(t, err)
			assert.NotNil(t, result2)
		}
	})
}
