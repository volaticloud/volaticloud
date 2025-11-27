# Strategy Versioning Pattern

## Problem

How do you manage trading strategy evolution while ensuring:

- Backtest results remain valid over time (reproducibility)
- Running bots aren't affected by strategy updates (safety)
- Complete history of changes for compliance (audit trail)
- Users consciously decide when to upgrade bots (explicit control)

## Solution

Use immutable versioning with copy-on-write semantics. Every strategy update creates a new immutable version linked to its parent, preserving complete lineage and preventing unexpected behavior changes.

## Implementation

### 1. Define ENT Schema with Versioning Fields

```go
// internal/ent/schema/strategy.go
func (Strategy) Fields() []ent.Field {
    return []ent.Field{
        field.String("name").
            NotEmpty().
            Comment("Strategy name (not unique across versions)"),
        field.Int("version_number").
            Default(1).
            Comment("Auto-incremented version number"),
        field.Bool("is_latest").
            Default(true).
            Comment("Only one version per name can be latest"),
        field.UUID("parent_id", uuid.UUID{}).
            Optional().
            Nillable().
            Comment("Parent strategy ID for versioning chain"),
        field.Text("code").
            Comment("Python strategy code (immutable after creation)"),
    }
}

func (Strategy) Edges() []ent.Edge {
    return []ent.Edge{
        // Self-referential edge for version chain
        edge.To("parent", Strategy.Type).
            Unique().
            Field("parent_id").
            From("children").
            Comment("Parent strategy for versioning (v1 → v2 → v3)"),
        // One-to-one with backtest
        edge.To("backtest", Backtest.Type).
            Unique().
            Comment("Strategy can have at most one backtest"),
        // Bots using this strategy version
        edge.To("bots", Bot.Type),
    }
}

func (Strategy) Indexes() []ent.Index {
    return []ent.Index{
        // Ensure unique version numbers per strategy name
        index.Fields("name", "version_number").Unique(),
    }
}
```

### 2. Implement Transaction Helper

```go
// internal/graph/tx.go
package graph

import (
    "context"
    "volaticloud/internal/ent"
)

func WithTx(ctx context.Context, client *ent.Client,
    fn func(tx *ent.Tx) error) error {

    tx, err := client.Tx(ctx)
    if err != nil {
        return err
    }

    // Panic recovery with rollback
    defer func() {
        if v := recover(); v != nil {
            tx.Rollback()
            panic(v)
        }
    }()

    // Execute function in transaction
    if err := fn(tx); err != nil {
        if rerr := tx.Rollback(); rerr != nil {
            return fmt.Errorf("rolling back transaction: %w", rerr)
        }
        return err
    }

    // Commit transaction
    return tx.Commit()
}
```

### 3. Implement UpdateStrategy with Versioning

```go
// internal/graph/schema.resolvers.go
func (r *mutationResolver) UpdateStrategy(ctx context.Context,
    id uuid.UUID, input ent.UpdateStrategyInput) (*ent.Strategy, error) {

    // Load existing strategy
    existingStrategy, err := r.client.Strategy.Get(ctx, id)
    if err != nil {
        return nil, fmt.Errorf("strategy not found: %w", err)
    }

    var newStrategy *ent.Strategy

    // Create new version in transaction (atomic operation)
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

        return nil // Commit
    })

    if err != nil {
        return nil, err
    }

    return newStrategy, nil
}
```

### 4. Auto-Version on Backtest Creation

```go
// internal/graph/schema.resolvers.go
func (r *mutationResolver) CreateBacktest(ctx context.Context,
    input ent.CreateBacktestInput) (*ent.Backtest, error) {

    strategyID := input.StrategyID

    // Check if strategy already has a backtest
    existingStrategy, _ := r.client.Strategy.Query().
        Where(strategy.ID(strategyID)).
        WithBacktest().  // One-to-one relationship
        Only(ctx)

    // Auto-version if strategy already tested
    if existingStrategy != nil && existingStrategy.Edges.Backtest != nil {
        newVersion, err := r.createStrategyVersion(ctx, existingStrategy)
        if err != nil {
            return nil, fmt.Errorf("auto-versioning strategy: %w", err)
        }
        strategyID = newVersion.ID
    }

    // Create backtest with (possibly new) strategy ID
    return r.client.Backtest.Create().
        SetStrategyID(strategyID).
        SetConfig(input.Config).
        Save(ctx)
}

// Helper function to create strategy version
func (r *mutationResolver) createStrategyVersion(ctx context.Context,
    existing *ent.Strategy) (*ent.Strategy, error) {

    var newVersion *ent.Strategy

    err := WithTx(ctx, r.client, func(tx *ent.Tx) error {
        // Mark old as not latest
        if err := tx.Strategy.UpdateOne(existing).
            SetIsLatest(false).
            Exec(ctx); err != nil {
            return err
        }

        // Create new version (same code, new ID)
        newVersion, err = tx.Strategy.Create().
            SetName(existing.Name).
            SetCode(existing.Code).
            SetParentID(existing.ID).
            SetVersionNumber(existing.VersionNumber + 1).
            SetIsLatest(true).
            SetOwnerID(existing.OwnerID).
            Save(ctx)

        return err
    })

    return newVersion, err
}
```

### 5. Add Custom Queries

```graphql
# internal/graph/schema.graphqls
extend type Query {
  # Get only latest versions (dashboard default)
  latestStrategies(first: Int): [Strategy!]! @injectEntClient

  # Get all versions of a strategy
  strategyVersions(name: String!): [Strategy!]! @injectEntClient
}
```

```go
// internal/graph/schema.resolvers.go
func (r *queryResolver) LatestStrategies(ctx context.Context,
    first *int) ([]*ent.Strategy, error) {

    client := MustGetEntClientFromContext(ctx)

    query := client.Strategy.Query().
        Where(strategy.IsLatest(true)).
        Order(ent.Desc(strategy.FieldCreatedAt))

    if first != nil {
        query = query.Limit(*first)
    }

    return query.All(ctx)
}

func (r *queryResolver) StrategyVersions(ctx context.Context,
    name string) ([]*ent.Strategy, error) {

    client := MustGetEntClientFromContext(ctx)

    return client.Strategy.Query().
        Where(strategy.Name(name)).
        Order(ent.Desc(strategy.FieldVersionNumber)).
        All(ctx)
}
```

## Benefits

1. **Reproducibility**: Backtests remain valid forever (strategy code immutable)
2. **Safety**: Running bots never experience unexpected behavior changes
3. **Audit Trail**: Complete history of all strategy changes
4. **Concurrent Use**: Multiple users/bots can use different versions simultaneously
5. **Explicit Upgrades**: Users choose when to upgrade bots to new versions
6. **Transaction Safety**: Version creation is atomic (all-or-nothing)

## Trade-offs

### Pros

- True immutability (versions never change)
- Safe for concurrent use
- Complete version history
- Clear parent-child lineage

### Cons

- More database rows (one per version)
- Queries need `is_latest=true` filter
- Users must manually upgrade bots
- Old versions accumulate (archiving needed)

## Common Patterns

### Querying Latest Versions

```go
// Get latest strategy by name
latestStrategy, err := client.Strategy.Query().
    Where(
        strategy.Name("MyStrategy"),
        strategy.IsLatest(true),
    ).
    Only(ctx)
```

### Tracing Version History

```go
// Get complete version chain
func getVersionHistory(ctx context.Context, client *ent.Client,
    strategyName string) ([]*ent.Strategy, error) {

    return client.Strategy.Query().
        Where(strategy.Name(strategyName)).
        Order(ent.Asc(strategy.FieldVersionNumber)).
        All(ctx)
}
```

### Upgrading Bot to Latest Strategy

```go
// internal/bot/upgrade.go
func UpgradeBotStrategy(ctx context.Context, client *ent.Client,
    botID uuid.UUID) error {

    // Load bot with current strategy
    bot, err := client.Bot.Query().
        Where(bot.ID(botID)).
        WithStrategy().
        Only(ctx)
    if err != nil {
        return err
    }

    // Find latest version of strategy
    latestStrategy, err := client.Strategy.Query().
        Where(
            strategy.Name(bot.Edges.Strategy.Name),
            strategy.IsLatest(true),
        ).
        Only(ctx)
    if err != nil {
        return err
    }

    // Update bot to use latest strategy
    return client.Bot.UpdateOne(bot).
        SetStrategy(latestStrategy).
        Exec(ctx)
}
```

### Preventing Concurrent Latest Flags

The unique index on `(name, version_number)` ensures only one version per number. To ensure only one `is_latest=true` per name, use application logic in transactions (as shown in implementation).

## Testing

```go
// internal/graph/strategy_versioning_test.go
func TestUpdateStrategy_CreatesNewVersion(t *testing.T) {
    client := setupTestClient(t)
    defer client.Close()

    // Create v1
    v1 := client.Strategy.Create().
        SetName("TestStrategy").
        SetCode("# v1 code").
        SaveX(context.Background())

    assert.Equal(t, 1, v1.VersionNumber)
    assert.True(t, v1.IsLatest)

    // Update to v2
    v2 := updateStrategy(v1.ID, "# v2 code")

    assert.Equal(t, 2, v2.VersionNumber)
    assert.True(t, v2.IsLatest)
    assert.Equal(t, v1.ID, *v2.ParentID)

    // Verify v1 is no longer latest
    v1Reloaded := client.Strategy.GetX(context.Background(), v1.ID)
    assert.False(t, v1Reloaded.IsLatest)
}

func TestCreateBacktest_AutoVersionsWhenBacktestExists(t *testing.T) {
    client := setupTestClient(t)
    defer client.Close()

    // Create strategy and backtest
    strategy := client.Strategy.Create().
        SetName("TestStrategy").
        SetCode("# code").
        SaveX(context.Background())

    backtest1 := client.Backtest.Create().
        SetStrategy(strategy).
        SetConfig(map[string]interface{}{}).
        SaveX(context.Background())

    // Create second backtest (should auto-version)
    backtest2, err := createBacktest(strategy.ID, map[string]interface{}{})
    require.NoError(t, err)

    // Verify new version was created
    assert.NotEqual(t, backtest1.StrategyID, backtest2.StrategyID)

    newStrategy := client.Strategy.GetX(context.Background(), backtest2.StrategyID)
    assert.Equal(t, 2, newStrategy.VersionNumber)
}
```

## Related Patterns

- [Transaction Management](transactions.md) - Atomic version creation
- [ENT ORM Integration](ent-orm-integration.md) - Schema design
- [Resolver Testing](resolver-testing.md) - Testing versioning logic

## References

- [ADR-0003: Strategy Immutable Versioning](../adr/0003-strategy-immutable-versioning.md)
- `internal/ent/schema/strategy.go` - Strategy schema with versioning fields
- `internal/graph/tx.go` (WithTx function) - Transaction helper
- `internal/graph/schema.resolvers.go` (UpdateStrategy, CreateBacktest) - Versioning implementation
- `internal/graph/strategy_versioning_test.go` - Comprehensive tests
