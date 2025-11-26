# Resolver Testing Pattern

## Problem

How do you test GraphQL resolvers when:
- Resolvers depend on database clients, external APIs, and context values
- Tests need to be fast and isolated (no external dependencies)
- Setup requires creating test databases and fixtures
- Multiple test scenarios need consistent infrastructure

## Solution

Use table-driven tests with in-memory SQLite database, helper functions for test setup, and mock clients for external dependencies. Create reusable test infrastructure that all tests can share.

## Implementation

### 1. Test Infrastructure Setup

```go
// internal/graph/resolver_test.go
package graph

import (
    "context"
    "testing"
    "volaticloud/internal/ent"
    "volaticloud/internal/ent/enttest"
    _ "github.com/mattn/go-sqlite3"
)

// setupTestResolver creates a test resolver with in-memory database
func setupTestResolver(t *testing.T) *Resolver {
    // Create in-memory SQLite database
    opts := []enttest.Option{
        enttest.WithOptions(ent.Log(t.Log)),
    }

    client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1", opts...)
    t.Cleanup(func() { client.Close() })

    // Run migrations
    if err := client.Schema.Create(context.Background()); err != nil {
        t.Fatalf("failed creating schema: %v", err)
    }

    return &Resolver{
        client: client,
    }
}

// Helper functions
func ctx() context.Context {
    return context.Background()
}

func ptr[T any](v T) *T {
    return &v
}
```

### 2. Table-Driven Test Pattern

```go
// internal/graph/bot_test.go
func TestCreateBot(t *testing.T) {
    tests := []struct {
        name    string
        input   ent.CreateBotInput
        setup   func(*ent.Client) // Optional: create prerequisite data
        wantErr bool
        errMsg  string
        assert  func(*testing.T, *ent.Bot) // Optional: custom assertions
    }{
        {
            name: "valid bot",
            input: ent.CreateBotInput{
                Name: "TestBot",
                Mode: enum.BotModeDryRun,
                Config: map[string]interface{}{
                    "stake_currency": "USDT",
                    "stake_amount":   100.0,
                },
            },
            setup: func(client *ent.Client) {
                // Create required strategy
                client.Strategy.Create().
                    SetName("TestStrategy").
                    SetCode("# code").
                    SaveX(ctx())
            },
            wantErr: false,
            assert: func(t *testing.T, bot *ent.Bot) {
                assert.Equal(t, "TestBot", bot.Name)
                assert.Equal(t, enum.BotModeDryRun, bot.Mode)
            },
        },
        {
            name: "invalid config - missing stake_currency",
            input: ent.CreateBotInput{
                Name:   "TestBot",
                Config: map[string]interface{}{},
            },
            wantErr: true,
            errMsg:  "stake_currency",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            resolver := setupTestResolver(t)

            // Run setup if provided
            if tt.setup != nil {
                tt.setup(resolver.client)
            }

            // Execute mutation
            bot, err := resolver.Mutation().CreateBot(ctx(), tt.input)

            // Assert error expectations
            if tt.wantErr {
                require.Error(t, err)
                if tt.errMsg != "" {
                    assert.Contains(t, err.Error(), tt.errMsg)
                }
                return
            }

            // Assert success
            require.NoError(t, err)
            require.NotNil(t, bot)

            // Run custom assertions if provided
            if tt.assert != nil {
                tt.assert(t, bot)
            }
        })
    }
}
```

### 3. Mock External Dependencies

```go
// internal/keycloak/mock.go
package keycloak

type MockUMAClient struct {
    RegisterResourceFunc   func(context.Context, RegisterResourceRequest) (*RegisterResourceResponse, error)
    DeleteResourceFunc     func(context.Context, string) error
    RequestPermissionFunc  func(context.Context, PermissionRequest) (*PermissionResponse, error)
}

func (m *MockUMAClient) RegisterResource(ctx context.Context,
    req RegisterResourceRequest) (*RegisterResourceResponse, error) {
    if m.RegisterResourceFunc != nil {
        return m.RegisterResourceFunc(ctx, req)
    }
    return &RegisterResourceResponse{ID: "mock-resource-id"}, nil
}

func (m *MockUMAClient) DeleteResource(ctx context.Context, id string) error {
    if m.DeleteResourceFunc != nil {
        return m.DeleteResourceFunc(ctx, id)
    }
    return nil
}

func (m *MockUMAClient) RequestPermission(ctx context.Context,
    req PermissionRequest) (*PermissionResponse, error) {
    if m.RequestPermissionFunc != nil {
        return m.RequestPermissionFunc(ctx, req)
    }
    return &PermissionResponse{Granted: true}, nil
}
```

### 4. Test with Context Injection

```go
func TestCreateBot_WithUMAClient(t *testing.T) {
    resolver := setupTestResolver(t)

    // Create mock UMA client
    mockUMA := &keycloak.MockUMAClient{
        RegisterResourceFunc: func(ctx context.Context, req keycloak.RegisterResourceRequest) (*keycloak.RegisterResourceResponse, error) {
            assert.Equal(t, "TestBot", req.Name)
            assert.Equal(t, "bot", req.Type)
            return &keycloak.RegisterResourceResponse{ID: "test-resource-id"}, nil
        },
    }

    // Inject into context
    ctx := context.Background()
    ctx = graph.SetEntClientInContext(ctx, resolver.client)
    ctx = graph.SetUMAClientInContext(ctx, mockUMA)
    ctx = graph.SetUserContext(ctx, "test-user-id")

    // Execute mutation
    bot, err := resolver.Mutation().CreateBot(ctx, ent.CreateBotInput{
        Name: "TestBot",
        Mode: enum.BotModeDryRun,
    })

    require.NoError(t, err)
    assert.NotNil(t, bot)
}
```

### 5. Test Fixtures

```go
// internal/graph/fixtures_test.go
package graph

// createTestStrategy creates a strategy for testing
func createTestStrategy(t *testing.T, client *ent.Client, name string) *ent.Strategy {
    return client.Strategy.Create().
        SetName(name).
        SetCode("# test code").
        SaveX(ctx())
}

// createTestBot creates a bot for testing
func createTestBot(t *testing.T, client *ent.Client, name string) *ent.Bot {
    strategy := createTestStrategy(t, client, "TestStrategy")

    return client.Bot.Create().
        SetName(name).
        SetMode(enum.BotModeDryRun).
        SetStrategy(strategy).
        SetConfig(map[string]interface{}{
            "stake_currency": "USDT",
            "stake_amount":   100.0,
        }).
        SaveX(ctx())
}
```

### 6. Integration Tests

```go
func TestBotLifecycle_Integration(t *testing.T) {
    resolver := setupTestResolver(t)
    ctx := graph.SetEntClientInContext(context.Background(), resolver.client)

    // Create strategy
    strategy := createTestStrategy(t, resolver.client, "TestStrategy")

    // Create bot
    bot, err := resolver.Mutation().CreateBot(ctx, ent.CreateBotInput{
        Name:       "TestBot",
        Mode:       enum.BotModeDryRun,
        StrategyID: strategy.ID,
    })
    require.NoError(t, err)

    // Update bot
    updatedBot, err := resolver.Mutation().UpdateBot(ctx, bot.ID, ent.UpdateBotInput{
        Name: ptr("UpdatedBot"),
    })
    require.NoError(t, err)
    assert.Equal(t, "UpdatedBot", updatedBot.Name)

    // Query bot
    bots, err := resolver.Query().Bots(ctx, ptr(10), nil, nil, nil, nil)
    require.NoError(t, err)
    assert.Len(t, bots.Edges, 1)

    // Delete bot
    deletedID, err := resolver.Mutation().DeleteBot(ctx, bot.ID)
    require.NoError(t, err)
    assert.Equal(t, bot.ID, deletedID)

    // Verify deletion
    bots, err = resolver.Query().Bots(ctx, nil, nil, nil, nil, nil)
    require.NoError(t, err)
    assert.Len(t, bots.Edges, 0)
}
```

## Benefits

1. **Fast**: In-memory SQLite database
2. **Isolated**: Each test gets fresh database
3. **Repeatable**: No external dependencies
4. **Comprehensive**: Test full resolver logic including validation
5. **Type-Safe**: Uses generated ENT types
6. **Maintainable**: Reusable test infrastructure

## Trade-offs

### Pros
- Fast test execution (in-memory)
- Complete isolation between tests
- Easy to mock external dependencies
- Full control over test data

### Cons
- SQLite behavior differs from PostgreSQL
- Mock complexity for external APIs
- Setup overhead for complex scenarios
- Foreign key constraints require careful ordering

## Common Patterns

### Subtests for Variations

```go
func TestUpdateStrategy(t *testing.T) {
    resolver := setupTestResolver(t)
    strategy := createTestStrategy(t, resolver.client, "Test")

    t.Run("update code", func(t *testing.T) {
        updated, err := resolver.Mutation().UpdateStrategy(ctx(), strategy.ID, ent.UpdateStrategyInput{
            Code: "# new code",
        })
        require.NoError(t, err)
        assert.Equal(t, "# new code", updated.Code)
    })

    t.Run("increments version", func(t *testing.T) {
        reloaded, _ := resolver.client.Strategy.Get(ctx(), strategy.ID)
        assert.Equal(t, 2, reloaded.VersionNumber)
    })
}
```

### Parallel Tests

```go
func TestQueries(t *testing.T) {
    t.Parallel() // Run all subtests in parallel

    t.Run("GetBots", func(t *testing.T) {
        t.Parallel()
        resolver := setupTestResolver(t)
        // Test logic...
    })

    t.Run("GetStrategies", func(t *testing.T) {
        t.Parallel()
        resolver := setupTestResolver(t)
        // Test logic...
    })
}
```

### Error Injection

```go
func TestCreateBot_ExternalAPIFailure(t *testing.T) {
    resolver := setupTestResolver(t)

    // Mock that returns error
    mockUMA := &keycloak.MockUMAClient{
        RegisterResourceFunc: func(ctx context.Context, req keycloak.RegisterResourceRequest) (*keycloak.RegisterResourceResponse, error) {
            return nil, fmt.Errorf("external API error")
        },
    }

    ctx := graph.SetUMAClientInContext(context.Background(), mockUMA)

    _, err := resolver.Mutation().CreateBot(ctx, ent.CreateBotInput{
        Name: "TestBot",
    })

    require.Error(t, err)
    assert.Contains(t, err.Error(), "external API error")

    // Verify database rollback
    count, _ := resolver.client.Bot.Query().Count(ctx)
    assert.Equal(t, 0, count)
}
```

## Running Tests

```bash
# Run all tests
go test ./internal/graph -v

# Run specific test
go test ./internal/graph -v -run TestCreateBot

# Run with coverage
go test ./internal/graph -cover -coverprofile=coverage.out

# View coverage
go tool cover -html=coverage.out
```

## Coverage Goals

- **Resolver Functions**: 100% coverage
- **Validation Logic**: 100% coverage
- **Error Paths**: All error conditions tested
- **Edge Cases**: Nil values, empty strings, boundary conditions

## Best Practices

1. **Test One Thing**: Each test should verify one behavior
2. **Clear Names**: Test names should describe what they verify
3. **Arrange-Act-Assert**: Follow AAA pattern consistently
4. **Fast Tests**: Keep test execution under 1 second
5. **No Randomness**: Tests should be deterministic
6. **Clean Setup**: Use `t.Cleanup()` for resource cleanup

## Related Patterns

- [Dependency Injection](dependency-injection.md) - Context injection in tests
- [Transaction Management](transactions.md) - Testing transactional logic
- [Mock Generation](mocking.md) - Creating mock clients

## References

- ENT Testing: https://entgo.io/docs/testing/
- `internal/graph/resolver_test.go` - Test infrastructure
- `internal/graph/*_test.go` - Resolver tests
- `internal/graph/fixtures_test.go` - Test fixtures
- Go Testing Documentation: https://pkg.go.dev/testing
