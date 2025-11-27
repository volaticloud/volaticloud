# Transaction Management Pattern

## Problem

How do you ensure atomicity for multi-step database operations when:

- Multiple related entities must be created/updated together
- Validation failures should rollback all changes
- Panics or errors should prevent partial state
- Code should be clean and reusable

## Solution

Use ENT's transaction API with a reusable `WithTx` helper that handles automatic rollback on errors and panic recovery. All related operations execute within a single atomic transaction.

## Implementation

### 1. Create Transaction Helper

```go
// internal/graph/tx.go
package graph

import (
    "context"
    "fmt"
    "volaticloud/internal/ent"
)

// WithTx wraps operations in a database transaction
// Automatically rolls back on error or panic
func WithTx(ctx context.Context, client *ent.Client,
    fn func(tx *ent.Tx) error) error {

    // Start transaction
    tx, err := client.Tx(ctx)
    if err != nil {
        return fmt.Errorf("starting transaction: %w", err)
    }

    // Panic recovery with rollback
    defer func() {
        if v := recover(); v != nil {
            tx.Rollback()
            panic(v) // Re-panic after rollback
        }
    }()

    // Execute function
    if err := fn(tx); err != nil {
        // Rollback on error
        if rerr := tx.Rollback(); rerr != nil {
            return fmt.Errorf("rolling back transaction: %w", rerr)
        }
        return err
    }

    // Commit transaction
    if err := tx.Commit(); err != nil {
        return fmt.Errorf("committing transaction: %w", err)
    }

    return nil
}
```

### 2. Use in Resolvers (Strategy Versioning Example)

```go
// internal/graph/schema.resolvers.go
func (r *mutationResolver) UpdateStrategy(ctx context.Context,
    id uuid.UUID, input ent.UpdateStrategyInput) (*ent.Strategy, error) {

    // Load existing strategy
    existingStrategy, err := r.client.Strategy.Get(ctx, id)
    if err != nil {
        return nil, err
    }

    var newStrategy *ent.Strategy

    // Execute in transaction
    err = WithTx(ctx, r.client, func(tx *ent.Tx) error {
        // Step 1: Mark old version as not latest
        if err := tx.Strategy.UpdateOne(existingStrategy).
            SetIsLatest(false).
            Exec(ctx); err != nil {
            return fmt.Errorf("marking old version: %w", err)
        }

        // Step 2: Create new version
        newStrategy, err = tx.Strategy.Create().
            SetName(existingStrategy.Name).
            SetCode(input.Code).
            SetParentID(existingStrategy.ID).
            SetVersionNumber(existingStrategy.VersionNumber + 1).
            SetIsLatest(true).
            SetOwnerID(existingStrategy.OwnerID).
            Save(ctx)

        if err != nil {
            return fmt.Errorf("creating new version: %w", err)
        }

        return nil // Success - commit
    })

    if err != nil {
        return nil, err
    }

    return newStrategy, nil
}
```

### 3. Multi-Entity Transaction (Bot with Keycloak Resource)

```go
func (r *mutationResolver) CreateBot(ctx context.Context,
    input ent.CreateBotInput) (*ent.Bot, error) {

    var bot *ent.Bot
    userID, _ := GetUserContext(ctx)

    // Database + external API in transaction
    err := WithTx(ctx, r.client, func(tx *ent.Tx) error {
        // Step 1: Create bot in database
        var err error
        bot, err = tx.Bot.Create().
            SetInput(input).
            SetOwnerID(userID).
            Save(ctx)
        if err != nil {
            return fmt.Errorf("creating bot: %w", err)
        }

        // Step 2: Register in Keycloak UMA
        umaClient, _ := GetUMAClientFromContext(ctx)
        _, err = umaClient.RegisterResource(ctx, keycloak.RegisterResourceRequest{
            Name:    bot.Name,
            Type:    "bot",
            OwnerID: userID,
        })
        if err != nil {
            // Rollback database changes
            return fmt.Errorf("registering UMA resource: %w", err)
        }

        return nil // Commit both operations
    })

    return bot, err
}
```

### 4. Nested Transactions (Not Recommended)

ENT doesn't support nested transactions. Use `tx.Client()` to reuse the transaction:

```go
err = WithTx(ctx, client, func(tx *ent.Tx) error {
    // Create bot
    bot, err := tx.Bot.Create().SetName("test").Save(ctx)
    if err != nil {
        return err
    }

    // Create related metrics using same transaction
    _, err = tx.BotMetrics.Create().
        SetBot(bot).
        SetProfitAllPercent(0).
        Save(ctx)

    return err
})
```

### 5. Transaction with External API Rollback

```go
func (r *mutationResolver) DeleteBot(ctx context.Context,
    id uuid.UUID) (uuid.UUID, error) {

    // Load bot first
    bot, err := r.client.Bot.Get(ctx, id)
    if err != nil {
        return uuid.Nil, err
    }

    // Keep resource ID for Keycloak deletion
    resourceID := bot.ResourceID

    // Delete from database in transaction
    err = WithTx(ctx, r.client, func(tx *ent.Tx) error {
        return tx.Bot.DeleteOneID(id).Exec(ctx)
    })

    if err != nil {
        return uuid.Nil, err
    }

    // Delete from Keycloak (best-effort, log errors)
    umaClient, _ := GetUMAClientFromContext(ctx)
    if err := umaClient.DeleteResource(ctx, resourceID); err != nil {
        // Log but don't fail (database is source of truth)
        log.Printf("failed to delete Keycloak resource: %v", err)
    }

    return id, nil
}
```

## Benefits

1. **Atomicity**: All operations succeed or all fail (no partial state)
2. **Panic Safety**: Automatic rollback on panics
3. **Error Handling**: Clean error propagation
4. **Reusable**: Single `WithTx` helper for all transactions
5. **Clear Intent**: Transaction boundaries are explicit
6. **ENT Best Practices**: Follows official ENT patterns

## Trade-offs

### Pros

- Guaranteed atomicity
- Simple API with helper function
- Automatic cleanup on errors
- Clear transaction scope

### Cons

- No nested transactions (ENT limitation)
- External API calls aren't transactional
- Performance overhead (locks, isolation)
- Deadlock risk if not careful

## Common Patterns

### Transaction Isolation Levels

ENT uses database defaults. For PostgreSQL, configure in DSN:

```go
dsn := "postgresql://user:pass@localhost/db?default_transaction_isolation=serializable"
client := ent.Open("postgres", dsn)
```

### Read-Only Transactions

```go
func getConsistentSnapshot(ctx context.Context, client *ent.Client) error {
    return WithTx(ctx, client, func(tx *ent.Tx) error {
        // All reads see consistent snapshot
        strategies, _ := tx.Strategy.Query().All(ctx)
        bots, _ := tx.Bot.Query().All(ctx)

        // Process data...
        return nil // Commit (releases locks)
    })
}
```

### Conditional Rollback

```go
err = WithTx(ctx, client, func(tx *ent.Tx) error {
    bot, err := tx.Bot.Create().SetName("test").Save(ctx)
    if err != nil {
        return err
    }

    // Conditional logic
    if bot.Mode == enum.BotModeLive {
        // Validate live mode requirements
        if !hasValidExchange(bot) {
            return fmt.Errorf("live mode requires valid exchange")
        }
    }

    return nil
})
```

### Batch Operations

```go
err = WithTx(ctx, client, func(tx *ent.Tx) error {
    // Create multiple entities in one transaction
    bulk := make([]*ent.BotCreate, len(inputs))
    for i, input := range inputs {
        bulk[i] = tx.Bot.Create().SetInput(input)
    }

    _, err := tx.Bot.CreateBulk(bulk...).Save(ctx)
    return err
})
```

## Testing

### Test Transaction Rollback

```go
func TestUpdateStrategy_RollbackOnError(t *testing.T) {
    client := setupTestClient(t)
    defer client.Close()

    ctx := context.Background()

    // Create strategy
    strategy := client.Strategy.Create().
        SetName("test").
        SetCode("# v1").
        SaveX(ctx)

    // Attempt update with validation error
    err := WithTx(ctx, client, func(tx *ent.Tx) error {
        // Mark old as not latest
        tx.Strategy.UpdateOne(strategy).
            SetIsLatest(false).
            ExecX(ctx)

        // Simulate validation error
        return fmt.Errorf("validation failed")
    })

    require.Error(t, err)

    // Verify rollback: strategy still has is_latest=true
    reloaded := client.Strategy.GetX(ctx, strategy.ID)
    assert.True(t, reloaded.IsLatest)
}
```

### Test Panic Recovery

```go
func TestWithTx_PanicRecovery(t *testing.T) {
    client := setupTestClient(t)
    defer client.Close()

    assert.Panics(t, func() {
        WithTx(context.Background(), client, func(tx *ent.Tx) error {
            tx.Bot.Create().SetName("test").SaveX(context.Background())
            panic("something went wrong")
        })
    })

    // Verify rollback: no bots created
    count := client.Bot.Query().CountX(context.Background())
    assert.Equal(t, 0, count)
}
```

### Test External API Failure

```go
func TestCreateBot_RollbackOnKeycloakError(t *testing.T) {
    client := setupTestClient(t)
    defer client.Close()

    // Mock UMA client that fails
    mockUMA := &keycloak.MockUMAClient{
        RegisterResourceFunc: func(ctx context.Context, req keycloak.RegisterResourceRequest) (*keycloak.RegisterResourceResponse, error) {
            return nil, fmt.Errorf("Keycloak unavailable")
        },
    }

    ctx := context.Background()
    ctx = graph.SetEntClientInContext(ctx, client)
    ctx = graph.SetUMAClientInContext(ctx, mockUMA)

    resolver := &mutationResolver{client: client}
    _, err := resolver.CreateBot(ctx, ent.CreateBotInput{
        Name: "test",
    })

    require.Error(t, err)
    assert.Contains(t, err.Error(), "Keycloak unavailable")

    // Verify database rollback
    count := client.Bot.Query().CountX(ctx)
    assert.Equal(t, 0, count)
}
```

## Best Practices

1. **Keep Transactions Short**: Minimize transaction duration to reduce lock contention
2. **Avoid User Input**: Don't wait for user input during transactions
3. **External APIs Last**: Call external APIs after database operations when possible
4. **Idempotent Operations**: Design operations to be retryable on deadlock
5. **Clear Error Messages**: Wrap errors with context about which step failed

## Anti-Patterns

### ❌ Long-Running Transactions

```go
// BAD: Holds locks for entire file upload
err = WithTx(ctx, client, func(tx *ent.Tx) error {
    bot, _ := tx.Bot.Create().Save(ctx)
    uploadLargeFile(bot.ID) // May take minutes!
    return tx.Bot.UpdateOne(bot).SetStatus("uploaded").Exec(ctx)
})
```

### ❌ Nested WithTx Calls

```go
// BAD: ENT doesn't support nested transactions
err = WithTx(ctx, client, func(tx *ent.Tx) error {
    // This will fail!
    return WithTx(ctx, client, func(tx2 *ent.Tx) error {
        return nil
    })
})
```

### ✅ Correct: Reuse Transaction

```go
// GOOD: Pass tx.Client() to helper functions
err = WithTx(ctx, client, func(tx *ent.Tx) error {
    return createBotWithMetrics(ctx, tx.Client(), input)
})

func createBotWithMetrics(ctx context.Context, client *ent.Client, input BotInput) error {
    bot, _ := client.Bot.Create().SetInput(input).Save(ctx)
    _, err := client.BotMetrics.Create().SetBot(bot).Save(ctx)
    return err
}
```

## Related Patterns

- [Strategy Versioning](strategy-versioning.md) - Uses transactions for atomic versioning
- [ENT ORM Integration](ent-orm-integration.md) - Transaction API
- [Resolver Testing](resolver-testing.md) - Testing transactional logic

## References

- ENT Transactions: https://entgo.io/docs/transactions/
- `internal/graph/tx.go` (WithTx function) - Transaction helper implementation
- `internal/graph/schema.resolvers.go` (UpdateStrategy, CreateBot) - Usage examples
- `internal/graph/strategy_versioning_test.go` - Transaction rollback tests
