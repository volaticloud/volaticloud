package graph

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	strategyent "volaticloud/internal/ent/strategy"
	"volaticloud/internal/enum"
)

// TestAuthorizationIntegration_IsAuthenticated tests @isAuthenticated directive
func TestAuthorizationIntegration_IsAuthenticated(t *testing.T) {
	env := Setup(t)
	defer env.Cleanup()

	userID := uuid.NewString()
	groupID := uuid.NewString()

	mutation := `
		mutation CreateStrategy($input: CreateStrategyInput!) {
			createStrategy(input: $input) {
				id
				name
			}
		}
	`

	t.Run("Authenticated_Success", func(t *testing.T) {
		ctx := env.WithAuth(userID, groupID, nil)
		var resp struct {
			CreateStrategy struct {
				ID   string
				Name string
			}
		}

		err := env.GraphQL.Post(mutation, &resp,
			AddVariable("input", map[string]interface{}{
				"name":    "TestStrategy",
				"code":    "# Test strategy code",
				"config":  MinimalFreqtradeConfig(), // Required field
				"ownerID": groupID,
			}),
			WithContext(ctx),
		)

		require.NoError(t, err)
		assert.NotEmpty(t, resp.CreateStrategy.ID)
		assert.Equal(t, "TestStrategy", resp.CreateStrategy.Name)
	})

	t.Run("Unauthenticated_Failure", func(t *testing.T) {
		ctx := env.WithoutAuth()
		var resp struct {
			CreateStrategy struct {
				ID   string
				Name string
			}
		}

		err := env.GraphQL.Post(mutation, &resp,
			AddVariable("input", map[string]interface{}{
				"name":    "TestStrategy",
				"code":    "# Test strategy code",
				"config":  MinimalFreqtradeConfig(), // Required field
				"ownerID": groupID,
			}),
			WithContext(ctx),
		)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "authentication required")
	})
}

// TestAuthorizationIntegration_HasScope tests @hasScope directive
func TestAuthorizationIntegration_HasScope(t *testing.T) {
	env := Setup(t)
	defer env.Cleanup()

	userID := uuid.NewString()
	groupID := uuid.NewString()

	// Create a strategy first
	strategy, err := env.Client.Strategy.Create().
		SetName("TestStrategy").
		SetCode("# Test code").
		SetConfig(MinimalFreqtradeConfig()).
		SetOwnerID(groupID).
		SetVersionNumber(1).
		SetIsLatest(true).
		Save(env.Context)
	require.NoError(t, err)

	mutation := `
		mutation UpdateStrategy($id: ID!, $input: UpdateStrategyInput!) {
			updateStrategy(id: $id, input: $input) {
				id
				name
			}
		}
	`

	t.Run("WithPermission_Success", func(t *testing.T) {
		// Grant edit permission
		permissions := map[string][]string{
			strategy.ID.String(): {"edit", "view"},
		}

		ctx := env.WithAuth(userID, groupID, permissions)
		var resp struct {
			UpdateStrategy struct {
				ID   string
				Name string
			}
		}

		err := env.GraphQL.Post(mutation, &resp,
			AddVariable("id", strategy.ID.String()),
			AddVariable("input", map[string]interface{}{
				"name": "UpdatedStrategy",
				"code": "# Updated code",
			}),
			WithContext(ctx),
		)

		require.NoError(t, err)
		assert.Equal(t, "UpdatedStrategy", resp.UpdateStrategy.Name)
	})

	t.Run("WithoutPermission_Failure", func(t *testing.T) {
		// Only grant view permission (missing edit)
		permissions := map[string][]string{
			strategy.ID.String(): {"view"},
		}

		ctx := env.WithAuth(userID, groupID, permissions)
		var resp struct {
			UpdateStrategy struct {
				ID   string
				Name string
			}
		}

		err := env.GraphQL.Post(mutation, &resp,
			AddVariable("id", strategy.ID.String()),
			AddVariable("input", map[string]interface{}{
				"name": "UpdatedStrategy",
				"code": "# Updated code",
			}),
			WithContext(ctx),
		)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "insufficient permissions")
		assert.Contains(t, err.Error(), "edit")
	})
}

// TestAuthorizationIntegration_DeleteOperation tests delete operations with @hasScope
func TestAuthorizationIntegration_DeleteOperation(t *testing.T) {
	env := Setup(t)
	defer env.Cleanup()

	userID := uuid.NewString()
	groupID := uuid.NewString()

	mutation := `
		mutation DeleteStrategy($id: ID!) {
			deleteStrategy(id: $id)
		}
	`

	t.Run("WithDeletePermission_Success", func(t *testing.T) {
		// Create strategy
		strategy, err := env.Client.Strategy.Create().
			SetName("TestStrategy").
			SetCode("# Test code").
			SetConfig(MinimalFreqtradeConfig()).
			SetOwnerID(groupID).
			SetVersionNumber(1).
			SetIsLatest(true).
			Save(env.Context)
		require.NoError(t, err)

		// Grant delete permission
		permissions := map[string][]string{
			strategy.ID.String(): {"delete", "view"},
		}

		ctx := env.WithAuth(userID, groupID, permissions)
		var resp struct {
			DeleteStrategy bool
		}

		err = env.GraphQL.Post(mutation, &resp,
			AddVariable("id", strategy.ID.String()),
			WithContext(ctx),
		)

		require.NoError(t, err)
		assert.True(t, resp.DeleteStrategy)

		// Verify strategy is deleted
		exists, err := env.Client.Strategy.Query().Where(strategyent.IDEQ(strategy.ID)).Exist(env.Context)
		require.NoError(t, err)
		assert.False(t, exists, "Strategy should be deleted")
	})

	t.Run("WithoutDeletePermission_Failure", func(t *testing.T) {
		// Create strategy
		strategy, err := env.Client.Strategy.Create().
			SetName("TestStrategy2").
			SetCode("# Test code").
			SetConfig(MinimalFreqtradeConfig()).
			SetOwnerID(groupID).
			SetVersionNumber(1).
			SetIsLatest(true).
			Save(env.Context)
		require.NoError(t, err)

		// Only grant view permission
		permissions := map[string][]string{
			strategy.ID.String(): {"view"},
		}

		ctx := env.WithAuth(userID, groupID, permissions)
		var resp struct {
			DeleteStrategy bool
		}

		err = env.GraphQL.Post(mutation, &resp,
			AddVariable("id", strategy.ID.String()),
			WithContext(ctx),
		)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "insufficient permissions")

		// Verify strategy still exists
		exists, err := env.Client.Strategy.Query().Where(strategyent.IDEQ(strategy.ID)).Exist(env.Context)
		require.NoError(t, err)
		assert.True(t, exists, "Strategy should not be deleted")
	})
}

// TestAuthorizationIntegration_MultiEntity tests authorization across different entity types
func TestAuthorizationIntegration_MultiEntity(t *testing.T) {
	env := Setup(t)
	defer env.Cleanup()

	userID := uuid.NewString()
	groupID := uuid.NewString()

	t.Run("Exchange_CRUD_WithPermissions", func(t *testing.T) {
		// Create exchange
		createMutation := `
			mutation CreateExchange($input: CreateExchangeInput!) {
				createExchange(input: $input) {
					id
					name
				}
			}
		`

		ctx := env.WithAuth(userID, groupID, nil)
		var createResp struct {
			CreateExchange struct {
				ID   string
				Name string
			}
		}

		err := env.GraphQL.Post(createMutation, &createResp,
			AddVariable("input", map[string]interface{}{
				"name":    "Binance",
				"ownerID": groupID,
				"config": map[string]interface{}{
					"name":              "binance",
					"key":               "test_api_key",
					"secret":            "test_api_secret",
					"ccxt_config":       map[string]interface{}{},
					"ccxt_async_config": map[string]interface{}{},
				},
			}),
			WithContext(ctx),
		)

		require.NoError(t, err)
		assert.NotEmpty(t, createResp.CreateExchange.ID)
		assert.Equal(t, "Binance", createResp.CreateExchange.Name)
		exchangeID := createResp.CreateExchange.ID

		// Update exchange with permission
		permissions := map[string][]string{
			exchangeID: {"edit", "view"},
		}

		updateMutation := `
			mutation UpdateExchange($id: ID!, $input: UpdateExchangeInput!) {
				updateExchange(id: $id, input: $input) {
					id
					name
				}
			}
		`

		ctx = env.WithAuth(userID, groupID, permissions)
		var updateResp struct {
			UpdateExchange struct {
				ID   string
				Name string
			}
		}

		err = env.GraphQL.Post(updateMutation, &updateResp,
			AddVariable("id", exchangeID),
			AddVariable("input", map[string]interface{}{
				"name": "Updated Binance",
			}),
			WithContext(ctx),
		)

		require.NoError(t, err)
		assert.Equal(t, "Updated Binance", updateResp.UpdateExchange.Name)
	})

	t.Run("Bot_Lifecycle_WithPermissions", func(t *testing.T) {
		// Create required dependencies first
		exchange, err := env.Client.Exchange.Create().
			SetName("TestExchange").
			SetOwnerID(groupID).
			SetConfig(map[string]interface{}{
				"name":              "binance",
				"key":               "test_key",
				"secret":            "test_secret",
				"ccxt_config":       map[string]interface{}{},
				"ccxt_async_config": map[string]interface{}{},
			}).
			Save(env.Context)
		require.NoError(t, err)

		strategy, err := env.Client.Strategy.Create().
			SetName("TestStrategy").
			SetCode("# Test code").
			SetConfig(MinimalFreqtradeConfig()).
			SetOwnerID(groupID).
			SetVersionNumber(1).
			SetIsLatest(true).
			Save(env.Context)
		require.NoError(t, err)

		runner, err := env.Client.BotRunner.Create().
			SetName("TestRunner").
			SetType(enum.RunnerDocker).
			SetConfig(map[string]interface{}{
				"host": "unix:///var/run/docker.sock",
			}).
			SetOwnerID(groupID).
			Save(env.Context)
		require.NoError(t, err)

		// Create bot
		createMutation := `
			mutation CreateBot($input: CreateBotInput!) {
				createBot(input: $input) {
					id
					name
					mode
				}
			}
		`

		ctx := env.WithAuth(userID, groupID, nil)
		var createResp struct {
			CreateBot struct {
				ID   string
				Name string
				Mode string
			}
		}

		err = env.GraphQL.Post(createMutation, &createResp,
			AddVariable("input", map[string]interface{}{
				"name":             "TestBot",
				"exchangeID":       exchange.ID.String(),
				"strategyID":       strategy.ID.String(),
				"runnerID":         runner.ID.String(),
				"mode":             "dry_run",
				"freqtradeVersion": "2025.10",
				"ownerID":          groupID,
				"config":           MinimalFreqtradeConfig(),
			}),
			WithContext(ctx),
		)

		require.NoError(t, err)
		assert.NotEmpty(t, createResp.CreateBot.ID)
		assert.Equal(t, "dry_run", createResp.CreateBot.Mode)
	})
}

// TestAuthorizationIntegration_ListQueries tests authorization on list queries
func TestAuthorizationIntegration_ListQueries(t *testing.T) {
	env := Setup(t)
	defer env.Cleanup()

	userID := uuid.NewString()
	group1ID := uuid.NewString()
	group2ID := uuid.NewString()

	// Create strategies in both groups
	_, err := env.Client.Strategy.Create().
		SetName("Group1Strategy").
		SetCode("# Group 1 code").
		SetConfig(MinimalFreqtradeConfig()).
		SetOwnerID(group1ID).
		SetVersionNumber(1).
		SetIsLatest(true).
		Save(env.Context)
	require.NoError(t, err)

	_, err = env.Client.Strategy.Create().
		SetName("Group2Strategy").
		SetCode("# Group 2 code").
		SetConfig(MinimalFreqtradeConfig()).
		SetOwnerID(group2ID).
		SetVersionNumber(1).
		SetIsLatest(true).
		Save(env.Context)
	require.NoError(t, err)

	query := `
		query GetStrategies($ownerID: String) {
			strategies(first: 10, where: {ownerID: $ownerID}) {
				edges {
					node {
						id
						name
						ownerID
					}
				}
			}
		}
	`

	t.Run("FilterByGroup1_ReturnsOnlyGroup1Strategies", func(t *testing.T) {
		ctx := env.WithAuth(userID, group1ID, nil)
		var resp struct {
			Strategies struct {
				Edges []struct {
					Node struct {
						ID      string
						Name    string
						OwnerID string
					}
				}
			}
		}

		err := env.GraphQL.Post(query, &resp,
			AddVariable("ownerID", group1ID),
			WithContext(ctx),
		)

		require.NoError(t, err)
		require.Len(t, resp.Strategies.Edges, 1)
		assert.Equal(t, "Group1Strategy", resp.Strategies.Edges[0].Node.Name)
		assert.Equal(t, group1ID, resp.Strategies.Edges[0].Node.OwnerID)
	})

	t.Run("FilterByGroup2_ReturnsOnlyGroup2Strategies", func(t *testing.T) {
		ctx := env.WithAuth(userID, group2ID, nil)
		var resp struct {
			Strategies struct {
				Edges []struct {
					Node struct {
						ID      string
						Name    string
						OwnerID string
					}
				}
			}
		}

		err := env.GraphQL.Post(query, &resp,
			AddVariable("ownerID", group2ID),
			WithContext(ctx),
		)

		require.NoError(t, err)
		require.Len(t, resp.Strategies.Edges, 1)
		assert.Equal(t, "Group2Strategy", resp.Strategies.Edges[0].Node.Name)
		assert.Equal(t, group2ID, resp.Strategies.Edges[0].Node.OwnerID)
	})

	t.Run("AuthenticatedQuery_ReturnsResults", func(t *testing.T) {
		ctx := env.WithAuth(userID, group1ID, nil)
		var resp struct {
			Strategies struct {
				Edges []struct {
					Node struct {
						ID      string
						Name    string
						OwnerID string
					}
				}
			}
		}

		// Authenticated query with filter should succeed
		err := env.GraphQL.Post(query, &resp,
			AddVariable("ownerID", group1ID),
			WithContext(ctx),
		)

		// Should succeed and return group1 strategies
		require.NoError(t, err)
		assert.Len(t, resp.Strategies.Edges, 1)
	})
}

// TestAuthorizationIntegration_InvalidResourceID tests error handling for invalid resource IDs
func TestAuthorizationIntegration_InvalidResourceID(t *testing.T) {
	env := Setup(t)
	defer env.Cleanup()

	userID := uuid.NewString()
	groupID := uuid.NewString()

	mutation := `
		mutation UpdateStrategy($id: ID!, $input: UpdateStrategyInput!) {
			updateStrategy(id: $id, input: $input) {
				id
				name
			}
		}
	`

	t.Run("InvalidUUID_Failure", func(t *testing.T) {
		ctx := env.WithAuth(userID, groupID, nil)
		var resp struct {
			UpdateStrategy struct {
				ID   string
				Name string
			}
		}

		err := env.GraphQL.Post(mutation, &resp,
			AddVariable("id", "not-a-uuid"),
			AddVariable("input", map[string]interface{}{
				"name": "UpdatedStrategy",
				"code": "# Updated code",
			}),
			WithContext(ctx),
		)

		require.Error(t, err)
		// Error should indicate invalid ID
	})

	t.Run("NonExistentResource_Failure", func(t *testing.T) {
		nonExistentID := uuid.NewString()
		permissions := map[string][]string{
			nonExistentID: {"edit", "view"},
		}

		ctx := env.WithAuth(userID, groupID, permissions)
		var resp struct {
			UpdateStrategy struct {
				ID   string
				Name string
			}
		}

		err := env.GraphQL.Post(mutation, &resp,
			AddVariable("id", nonExistentID),
			AddVariable("input", map[string]interface{}{
				"name": "UpdatedStrategy",
				"code": "# Updated code",
			}),
			WithContext(ctx),
		)

		require.Error(t, err)
		// Error should indicate resource not found
	})
}

// TestAuthorizationIntegration_ListQueryIsolation tests that list queries properly filter by ownerID
func TestAuthorizationIntegration_ListQueryIsolation(t *testing.T) {
	env := Setup(t)
	defer env.Cleanup()

	userID := uuid.NewString()
	groupAID := uuid.NewString()
	groupBID := uuid.NewString()

	// Create strategies in both groups
	_, err := env.Client.Strategy.Create().
		SetName("GroupAStrategy").
		SetCode("# Group A code").
		SetConfig(MinimalFreqtradeConfig()).
		SetOwnerID(groupAID).
		SetVersionNumber(1).
		SetIsLatest(true).
		Save(env.Context)
	require.NoError(t, err)

	_, err = env.Client.Strategy.Create().
		SetName("GroupBStrategy").
		SetCode("# Group B code").
		SetConfig(MinimalFreqtradeConfig()).
		SetOwnerID(groupBID).
		SetVersionNumber(1).
		SetIsLatest(true).
		Save(env.Context)
	require.NoError(t, err)

	query := `
		query GetStrategies($ownerID: String) {
			strategies(first: 10, where: {ownerID: $ownerID}) {
				edges {
					node {
						id
						name
						ownerID
					}
				}
			}
		}
	`

	t.Run("FilterByGroupA_ReturnsOnlyGroupAStrategies", func(t *testing.T) {
		ctx := env.WithAuth(userID, groupAID, nil)
		var resp struct {
			Strategies struct {
				Edges []struct {
					Node struct {
						ID      string
						Name    string
						OwnerID string
					}
				}
			}
		}

		err := env.GraphQL.Post(query, &resp,
			AddVariable("ownerID", groupAID),
			WithContext(ctx),
		)

		require.NoError(t, err)
		require.Len(t, resp.Strategies.Edges, 1)
		assert.Equal(t, "GroupAStrategy", resp.Strategies.Edges[0].Node.Name)
		assert.Equal(t, groupAID, resp.Strategies.Edges[0].Node.OwnerID)
	})

	t.Run("FilterByGroupB_ReturnsOnlyGroupBStrategies", func(t *testing.T) {
		ctx := env.WithAuth(userID, groupBID, nil)
		var resp struct {
			Strategies struct {
				Edges []struct {
					Node struct {
						ID      string
						Name    string
						OwnerID string
					}
				}
			}
		}

		err := env.GraphQL.Post(query, &resp,
			AddVariable("ownerID", groupBID),
			WithContext(ctx),
		)

		require.NoError(t, err)
		require.Len(t, resp.Strategies.Edges, 1)
		assert.Equal(t, "GroupBStrategy", resp.Strategies.Edges[0].Node.Name)
		assert.Equal(t, groupBID, resp.Strategies.Edges[0].Node.OwnerID)
	})
}

// TestAuthorizationIntegration_MissingViewPermission tests that view permission is required for read operations
func TestAuthorizationIntegration_MissingViewPermission(t *testing.T) {
	env := Setup(t)
	defer env.Cleanup()

	userID := uuid.NewString()
	groupID := uuid.NewString()

	// Create strategy
	strategy, err := env.Client.Strategy.Create().
		SetName("TestStrategy").
		SetCode("# Test code").
		SetConfig(MinimalFreqtradeConfig()).
		SetOwnerID(groupID).
		SetVersionNumber(1).
		SetIsLatest(true).
		Save(env.Context)
	require.NoError(t, err)

	// Use a list query with where filter (like the other successful tests)
	query := `
		query GetStrategy($id: ID!) {
			strategies(where: {id: $id}, first: 1) {
				edges {
					node {
						id
						name
						code
					}
				}
			}
		}
	`

	t.Run("NoPermissions_ReadFailure", func(t *testing.T) {
		// User has no permissions at all
		ctx := env.WithAuth(userID, groupID, nil)
		var resp struct {
			Strategies struct {
				Edges []struct {
					Node struct {
						ID   string
						Name string
						Code string
					}
				}
			}
		}

		err := env.GraphQL.Post(query, &resp,
			AddVariable("id", strategy.ID.String()),
			WithContext(ctx),
		)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "insufficient permissions")
	})

	t.Run("OnlyEditPermission_ReadFailure", func(t *testing.T) {
		// User has edit permission but missing view permission
		permissions := map[string][]string{
			strategy.ID.String(): {"edit"}, // Missing "view"
		}

		ctx := env.WithAuth(userID, groupID, permissions)
		var resp struct {
			Strategies struct {
				Edges []struct {
					Node struct {
						ID   string
						Name string
						Code string
					}
				}
			}
		}

		err := env.GraphQL.Post(query, &resp,
			AddVariable("id", strategy.ID.String()),
			WithContext(ctx),
		)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "insufficient permissions")
		assert.Contains(t, err.Error(), "view")
	})

	t.Run("ViewPermission_ReadSuccess", func(t *testing.T) {
		// User has view permission
		permissions := map[string][]string{
			strategy.ID.String(): {"view"},
		}

		ctx := env.WithAuth(userID, groupID, permissions)
		var resp struct {
			Strategies struct {
				Edges []struct {
					Node struct {
						ID   string
						Name string
						Code string
					}
				}
			}
		}

		err := env.GraphQL.Post(query, &resp,
			AddVariable("id", strategy.ID.String()),
			WithContext(ctx),
		)

		require.NoError(t, err)
		require.Len(t, resp.Strategies.Edges, 1)
		assert.Equal(t, strategy.ID.String(), resp.Strategies.Edges[0].Node.ID)
		assert.Equal(t, "TestStrategy", resp.Strategies.Edges[0].Node.Name)
	})
}

// TestAuthorizationIntegration_ForbiddenOperations tests forbidden operations on Exchange and Bot entities
func TestAuthorizationIntegration_ForbiddenOperations(t *testing.T) {
	env := Setup(t)
	defer env.Cleanup()

	userID := uuid.NewString()
	groupID := uuid.NewString()

	t.Run("Exchange_Update_WithoutPermission", func(t *testing.T) {
		// Create exchange
		exchange, err := env.Client.Exchange.Create().
			SetName("TestExchange").
			SetOwnerID(groupID).
			SetConfig(map[string]interface{}{
				"name":              "binance",
				"key":               "test_key",
				"secret":            "test_secret",
				"ccxt_config":       map[string]interface{}{},
				"ccxt_async_config": map[string]interface{}{},
			}).
			Save(env.Context)
		require.NoError(t, err)

		// Try to update without permission
		ctx := env.WithAuth(userID, groupID, nil)
		var resp struct {
			UpdateExchange struct {
				ID   string
				Name string
			}
		}

		updateMutation := `
			mutation UpdateExchange($id: ID!, $input: UpdateExchangeInput!) {
				updateExchange(id: $id, input: $input) {
					id
					name
				}
			}
		`

		err = env.GraphQL.Post(updateMutation, &resp,
			AddVariable("id", exchange.ID.String()),
			AddVariable("input", map[string]interface{}{
				"name": "Updated Exchange",
			}),
			WithContext(ctx),
		)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "insufficient permissions")
	})

	t.Run("Bot_Delete_WithoutPermission", func(t *testing.T) {
		// Create required dependencies
		exchange, err := env.Client.Exchange.Create().
			SetName("TestExchange").
			SetOwnerID(groupID).
			SetConfig(map[string]interface{}{
				"name":              "binance",
				"key":               "test_key",
				"secret":            "test_secret",
				"ccxt_config":       map[string]interface{}{},
				"ccxt_async_config": map[string]interface{}{},
			}).
			Save(env.Context)
		require.NoError(t, err)

		strategy, err := env.Client.Strategy.Create().
			SetName("TestStrategy").
			SetCode("# Test code").
			SetConfig(MinimalFreqtradeConfig()).
			SetOwnerID(groupID).
			SetVersionNumber(1).
			SetIsLatest(true).
			Save(env.Context)
		require.NoError(t, err)

		runner, err := env.Client.BotRunner.Create().
			SetName("TestRunner").
			SetType(enum.RunnerDocker).
			SetConfig(map[string]interface{}{
				"host": "unix:///var/run/docker.sock",
			}).
			SetOwnerID(groupID).
			Save(env.Context)
		require.NoError(t, err)

		// Create bot
		bot, err := env.Client.Bot.Create().
			SetName("TestBot").
			SetExchange(exchange).
			SetStrategy(strategy).
			SetRunner(runner).
			SetMode(enum.BotModeDryRun).
			SetFreqtradeVersion("2025.10").
			SetOwnerID(groupID).
			SetConfig(MinimalFreqtradeConfig()).
			Save(env.Context)
		require.NoError(t, err)

		// Try to delete without permission (only view)
		permissions := map[string][]string{
			bot.ID.String(): {"view"},
		}

		ctx := env.WithAuth(userID, groupID, permissions)
		var resp struct {
			DeleteBot bool
		}

		deleteMutation := `
			mutation DeleteBot($id: ID!) {
				deleteBot(id: $id)
			}
		`

		err = env.GraphQL.Post(deleteMutation, &resp,
			AddVariable("id", bot.ID.String()),
			WithContext(ctx),
		)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "insufficient permissions")
		assert.Contains(t, err.Error(), "delete")
	})
}
