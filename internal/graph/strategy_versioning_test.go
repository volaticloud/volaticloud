package graph

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"volaticloud/internal/ent"
	backtestent "volaticloud/internal/ent/backtest"
	"volaticloud/internal/ent/enttest"
	strategyent "volaticloud/internal/ent/strategy"
	"volaticloud/internal/enum"

	_ "github.com/mattn/go-sqlite3"
)

// setupTestResolver creates a test resolver with an in-memory database
func setupTestResolver(t *testing.T) (*Resolver, *ent.Client) {
	// Create an in-memory SQLite database for testing
	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")

	// Create a resolver with the test client
	resolver := &Resolver{client: client}

	return resolver, client
}

// defaultTestConfig returns a minimal valid strategy config for testing
func defaultTestConfig() map[string]interface{} {
	return map[string]interface{}{
		"stake_currency": "USDT",
		"exchange": map[string]interface{}{
			"name": "binance",
		},
	}
}

func TestUpdateStrategy_CreatesNewVersion(t *testing.T) {
	resolver, client := setupTestResolver(t)
	defer client.Close()

	ctx := context.Background()

	// Create initial strategy (v1)
	config := map[string]interface{}{
		"stake_currency": "USDT",
		"exchange": map[string]interface{}{
			"name": "binance",
		},
	}
	strategy, err := client.Strategy.Create().
		SetName("TestStrategy").
		SetDescription("Original description").
		SetCode("original code").
		SetConfig(config).
		SetVersionNumber(1).
		SetIsLatest(true).
		Save(ctx)
	require.NoError(t, err)
	require.Equal(t, 1, strategy.VersionNumber)
	require.True(t, strategy.IsLatest)

	// Update strategy (should create v2)
	newDescription := "Updated description"
	newCode := "updated code"
	updateInput := ent.UpdateStrategyInput{
		Description: &newDescription,
		Code:        &newCode,
	}

	updatedStrategy, err := resolver.Mutation().UpdateStrategy(ctx, strategy.ID, updateInput)
	require.NoError(t, err)

	// Verify new version was created
	assert.Equal(t, 2, updatedStrategy.VersionNumber)
	assert.Equal(t, newDescription, updatedStrategy.Description)
	assert.Equal(t, newCode, updatedStrategy.Code)
	assert.Equal(t, "TestStrategy", updatedStrategy.Name)
	assert.True(t, updatedStrategy.IsLatest)
	assert.NotNil(t, updatedStrategy.ParentID)
	assert.Equal(t, strategy.ID, *updatedStrategy.ParentID)

	// Verify old version is no longer latest
	oldStrategy, err := client.Strategy.Get(ctx, strategy.ID)
	require.NoError(t, err)
	assert.False(t, oldStrategy.IsLatest)
	assert.Equal(t, 1, oldStrategy.VersionNumber)
}

func TestUpdateStrategy_PreservesUnchangedFields(t *testing.T) {
	resolver, client := setupTestResolver(t)
	defer client.Close()

	ctx := context.Background()

	// Create initial strategy
	strategy, err := client.Strategy.Create().
		SetName("TestStrategy").
		SetDescription("Original description").
		SetCode("original code").
		SetConfig(defaultTestConfig()).
		Save(ctx)
	require.NoError(t, err)

	// Update only the code field
	newCode := "updated code"
	updateInput := ent.UpdateStrategyInput{
		Code: &newCode,
	}

	updatedStrategy, err := resolver.Mutation().UpdateStrategy(ctx, strategy.ID, updateInput)
	require.NoError(t, err)

	// Verify unchanged fields were preserved
	assert.Equal(t, "TestStrategy", updatedStrategy.Name)
	assert.Equal(t, "Original description", updatedStrategy.Description)
	assert.Equal(t, newCode, updatedStrategy.Code)
}

func TestUpdateStrategy_MultipleVersions(t *testing.T) {
	resolver, client := setupTestResolver(t)
	defer client.Close()

	ctx := context.Background()

	// Create initial strategy (v1)
	strategy, err := client.Strategy.Create().
		SetName("TestStrategy").
		SetCode("v1 code").
		SetConfig(defaultTestConfig()).
		Save(ctx)
	require.NoError(t, err)

	// Create v2
	code2 := "v2 code"
	v2, err := resolver.Mutation().UpdateStrategy(ctx, strategy.ID, ent.UpdateStrategyInput{
		Code: &code2,
	})
	require.NoError(t, err)
	assert.Equal(t, 2, v2.VersionNumber)

	// Create v3
	code3 := "v3 code"
	v3, err := resolver.Mutation().UpdateStrategy(ctx, v2.ID, ent.UpdateStrategyInput{
		Code: &code3,
	})
	require.NoError(t, err)
	assert.Equal(t, 3, v3.VersionNumber)

	// Verify version chain
	assert.NotNil(t, v2.ParentID)
	assert.Equal(t, strategy.ID, *v2.ParentID)
	assert.NotNil(t, v3.ParentID)
	assert.Equal(t, v2.ID, *v3.ParentID)

	// Verify only v3 is latest
	v1Check, _ := client.Strategy.Get(ctx, strategy.ID)
	v2Check, _ := client.Strategy.Get(ctx, v2.ID)
	v3Check, _ := client.Strategy.Get(ctx, v3.ID)

	assert.False(t, v1Check.IsLatest)
	assert.False(t, v2Check.IsLatest)
	assert.True(t, v3Check.IsLatest)
}

func TestCreateBacktest_ErrorsWhenBacktestExists(t *testing.T) {
	resolver, client := setupTestResolver(t)
	defer client.Close()

	ctx := context.Background()

	// Define backtest config that will be stored in the strategy
	backtestConfig := map[string]interface{}{
		"pairs":           []string{"BTC/USDT"},
		"timeframe":       "1h",
		"stake_currency":  "USDT",
		"stake_amount":    100.0,
		"max_open_trades": 3,
		"exchange": map[string]interface{}{
			"name":           "binance",
			"pair_whitelist": []string{"BTC/USDT"},
		},
		"pairlists": []map[string]interface{}{
			{"method": "StaticPairList"},
		},
		"exit_pricing": map[string]interface{}{
			"price_side":     "same",
			"use_order_book": false,
			"order_book_top": 1,
		},
		"entry_pricing": map[string]interface{}{
			"price_side":     "same",
			"use_order_book": false,
			"order_book_top": 1,
		},
	}

	// Create a strategy (v1) with config
	strategy, err := client.Strategy.Create().
		SetName("TestStrategy").
		SetCode("test code").
		SetConfig(backtestConfig).
		SetVersionNumber(1).
		SetIsLatest(true).
		Save(ctx)
	require.NoError(t, err)

	// Create a runner for backtests
	runnerConfig := map[string]interface{}{
		"docker": map[string]interface{}{
			"host": "unix:///var/run/docker.sock",
		},
	}
	runner, err := client.BotRunner.Create().
		SetName("TestRunner").
		SetType(enum.RunnerDocker).
		SetConfig(runnerConfig).
		Save(ctx)
	require.NoError(t, err)

	// Create first backtest directly in DB (bypass Docker execution)
	_, err = client.Backtest.Create().
		SetStrategyID(strategy.ID).
		SetRunnerID(runner.ID).
		SetStatus(enum.TaskStatusPending).
		Save(ctx)
	require.NoError(t, err)

	// Verify v1 now has a backtest
	strategyWithBacktest, err := client.Strategy.Query().
		Where(strategyent.IDEQ(strategy.ID)).
		WithBacktest().
		Only(ctx)
	require.NoError(t, err)
	assert.NotNil(t, strategyWithBacktest.Edges.Backtest)

	// Attempt to create second backtest - should auto-create new version
	backtest2Input := ent.CreateBacktestInput{
		StrategyID: strategy.ID,
		RunnerID:   runner.ID,
	}
	backtest2, err := resolver.Mutation().CreateBacktest(ctx, backtest2Input)

	// Should succeed by auto-creating new version
	require.NoError(t, err)
	assert.NotNil(t, backtest2)

	// Verify a new version was created
	versions, err := client.Strategy.Query().
		Where(strategyent.NameEQ(strategy.Name)).
		Order(ent.Asc(strategyent.FieldVersionNumber)).
		All(ctx)
	require.NoError(t, err)
	assert.Len(t, versions, 2, "should have created v2")

	// Verify v2 was created with correct attributes
	v2 := versions[1]
	assert.Equal(t, 2, v2.VersionNumber)
	assert.True(t, v2.IsLatest)
	assert.NotNil(t, v2.ParentID)
	assert.Equal(t, strategy.ID, *v2.ParentID)
	assert.Equal(t, strategy.Name, v2.Name)
	assert.Equal(t, strategy.Code, v2.Code)

	// Verify v1 is no longer latest
	v1Updated, err := client.Strategy.Get(ctx, strategy.ID)
	require.NoError(t, err)
	assert.False(t, v1Updated.IsLatest)

	// Verify the new backtest is associated with v2, not v1
	backtest2WithStrategy, err := client.Backtest.Query().
		Where(backtestent.IDEQ(backtest2.ID)).
		WithStrategy().
		Only(ctx)
	require.NoError(t, err)
	assert.Equal(t, v2.ID, backtest2WithStrategy.Edges.Strategy.ID, "backtest should be for v2")
}

func TestStrategyVersions_ReturnsAllVersionsByName(t *testing.T) {
	resolver, client := setupTestResolver(t)
	defer client.Close()

	ctx := context.Background()

	// Create Strategy A with 3 versions
	strategyA1, err := client.Strategy.Create().
		SetName("StrategyA").
		SetCode("A v1").
		SetConfig(defaultTestConfig()).
		SetVersionNumber(1).
		SetIsLatest(false).
		Save(ctx)
	require.NoError(t, err)

	strategyA2, err := client.Strategy.Create().
		SetName("StrategyA").
		SetCode("A v2").
		SetConfig(defaultTestConfig()).
		SetVersionNumber(2).
		SetIsLatest(false).
		SetParentID(strategyA1.ID).
		Save(ctx)
	require.NoError(t, err)

	strategyA3, err := client.Strategy.Create().
		SetName("StrategyA").
		SetCode("A v3").
		SetConfig(defaultTestConfig()).
		SetVersionNumber(3).
		SetIsLatest(true).
		SetParentID(strategyA2.ID).
		Save(ctx)
	require.NoError(t, err)

	// Create Strategy B (different name, should not be included)
	_, err = client.Strategy.Create().
		SetName("StrategyB").
		SetCode("B v1").
		SetConfig(defaultTestConfig()).
		SetVersionNumber(1).
		SetIsLatest(true).
		Save(ctx)
	require.NoError(t, err)

	// Query all versions of StrategyA
	versions, err := resolver.Query().StrategyVersions(ctx, "StrategyA")
	require.NoError(t, err)

	// Should return all 3 versions of StrategyA
	assert.Equal(t, 3, len(versions))

	// Verify versions are in ascending order
	assert.Equal(t, 1, versions[0].VersionNumber)
	assert.Equal(t, 2, versions[1].VersionNumber)
	assert.Equal(t, 3, versions[2].VersionNumber)

	// Verify all have correct name
	for _, v := range versions {
		assert.Equal(t, "StrategyA", v.Name)
	}

	// Verify IDs match
	assert.Equal(t, strategyA1.ID, versions[0].ID)
	assert.Equal(t, strategyA2.ID, versions[1].ID)
	assert.Equal(t, strategyA3.ID, versions[2].ID)
}

func TestStrategyVersions_EmptyForNonexistentStrategy(t *testing.T) {
	resolver, client := setupTestResolver(t)
	defer client.Close()

	ctx := context.Background()

	// Query versions for a strategy that doesn't exist
	versions, err := resolver.Query().StrategyVersions(ctx, "NonexistentStrategy")
	require.NoError(t, err)

	// Should return empty slice
	assert.Equal(t, 0, len(versions))
}

func TestUpdateStrategy_WithConfig(t *testing.T) {
	resolver, client := setupTestResolver(t)
	defer client.Close()

	ctx := context.Background()

	// Create initial strategy with config
	originalConfig := map[string]interface{}{
		"param1": "value1",
		"param2": 42,
	}
	strategy, err := client.Strategy.Create().
		SetName("TestStrategy").
		SetCode("test code").
		SetConfig(originalConfig).
		Save(ctx)
	require.NoError(t, err)

	// Update with new config
	newConfig := map[string]interface{}{
		"param1": "updated",
		"param3": true,
	}
	updateInput := ent.UpdateStrategyInput{
		Config: newConfig,
	}

	updatedStrategy, err := resolver.Mutation().UpdateStrategy(ctx, strategy.ID, updateInput)
	require.NoError(t, err)

	// Verify new version has updated config
	assert.Equal(t, newConfig, updatedStrategy.Config)
	assert.Equal(t, 2, updatedStrategy.VersionNumber)
}
