# 0003. Strategy Immutable Versioning

Date: 2025-11-07

## Status

Accepted

## Context and Problem Statement

Trading strategies in VolatiCloud are used by both bots (live trading) and backtests (historical simulation). Key challenges:

- **Reproducibility**: Backtests must remain valid over time (strategy code shouldn't change after testing)
- **Safety**: Live bots should not be affected by strategy updates made by other users/bots
- **Auditability**: Need complete history of strategy changes for compliance and debugging
- **Explicit upgrades**: Bot owners should consciously decide when to adopt new strategy versions

**The Core Problem:** If strategies are mutable, updating a strategy breaks:
1. Historical backtest results (strategy code changed, results no longer valid)
2. Running bots (code changes unexpectedly, behavior changes mid-execution)
3. Audit trails (can't determine which version caused what behavior)

How do we allow strategy evolution while preserving reproducibility and safety?

## Decision Drivers

- **Immutable snapshots**: Strategies must be immutable once created
- **Version lineage**: Clear parent-child relationship between versions
- **Auto-versioning triggers**: System should version automatically when needed
- **Explicit bot upgrades**: Bots stay pinned to their version (no automatic upgrades)
- **Transaction safety**: Version creation must be atomic (all-or-nothing)
- **Dashboard UX**: Users should see latest versions by default, with access to history

## Considered Options

### Option 1: Mutable Strategies with Snapshot on Backtest

Allow strategy updates in-place, create snapshot only when backtest runs.

**Pros:**
- Simple mental model
- Less database storage (only snapshots when needed)

**Cons:**
- **Breaks running bots** when strategy updated
- No complete version history
- Backtest-only snapshots miss other use cases
- Race condition: bot starts right before snapshot created

### Option 2: Soft Versioning with active_version Flag

Keep all versions, mark one as "active", others as "archived".

**Pros:**
- Simple queries (just filter active=true)
- Single entity ID for all versions

**Cons:**
- **Mutable active version** - can still be edited
- Complex logic to determine which version is "current"
- No clear parent-child relationship

### Option 3: Immutable Versioning with Linear Parent-Child Chain

Every update creates new immutable version with link to parent.

**Pros:**
- **True immutability** - versions never change after creation
- Clear lineage (v1 → v2 → v3 via parent_id)
- Safe for concurrent use (multiple bots can use different versions)
- Complete audit trail
- Auto-versioning on critical operations (backtest, update)
- Transaction-safe (version creation is atomic)

**Cons:**
- More database rows (each version is a separate row)
- Slightly more complex queries (need to filter is_latest=true for current version)
- Manual cleanup needed for very old versions (can be automated)

## Decision Outcome

Chosen option: **Immutable Versioning with Linear Parent-Child Chain**, because it:
1. **Guarantees reproducibility** - Strategies never change once created
2. **Protects running bots** - Bots stay on their version, unaffected by updates
3. **Preserves audit trail** - Complete history of all changes
4. **Enables safe concurrency** - Multiple users/bots can use different versions simultaneously
5. **Transaction-safe** - ENT transactions ensure atomicity

### Consequences

**Positive:**
- Backtest results remain valid forever (strategy code is immutable)
- Bots never experience unexpected behavior changes
- Complete version history for debugging and compliance
- Safe concurrent editing (users don't conflict)
- Explicit version selection (users choose when to upgrade)

**Negative:**
- Database storage increases (one row per version)
- Queries need `is_latest=true` filter for current versions
- Users must explicitly upgrade bots to new strategy versions

**Neutral:**
- Version number increments automatically (managed by system)
- Old versions can be archived/deleted after retention period

## Implementation

### Architecture Flow

**Update Strategy Flow:**
```
User requests updateStrategy
    ↓
Load existing strategy (current latest version)
    ↓
Transaction START
    ↓
Mark old version: is_latest = false
    ↓
Create new version:
  - new UUID
  - parent_id = old version ID
  - version_number = old + 1
  - is_latest = true
  - copy all fields (name, code, etc.)
    ↓
Save new version (triggers validation hooks)
    ↓
If validation fails → ROLLBACK entire transaction
    ↓
Transaction COMMIT
```

**Create Backtest Flow:**
```
User requests createBacktest(strategyID)
    ↓
Load strategy by ID
    ↓
Check if strategy has existing backtests
    ↓
If backtests exist:
    ↓
    Auto-create new version (same as updateStrategy)
    ↓
    Use new version ID for backtest
Else:
    ↓
    Use existing strategy ID
    ↓
Create backtest with strategy ID
```

### Key Files

**ENT Schema:**
- `internal/ent/schema/strategy.go:42-79` - Strategy versioning fields and edges
  - `parent_id` (UUID, nullable) - Points to parent version (null for v1)
  - `version_number` (int, default 1) - Auto-incremented version number
  - `is_latest` (bool, default true) - Only one version per strategy name is latest
  - Unique index on `(name, version_number)` prevents duplicates
  - Edge `parent` → self-referential relationship for version chain

**Transaction Helper:**
- `internal/graph/tx.go:23-53` - `WithTx` helper wraps operations in database transactions
  - Ensures atomicity: mark old version + create new version happen together
  - Auto-rollback on error or panic
  - Follows ENT best practices

**Resolver Implementation:**
- `internal/graph/schema.resolvers.go:67-110` - `UpdateStrategy` mutation
  - Loads existing strategy
  - Starts transaction via `WithTx`
  - Marks old version as `is_latest=false`
  - Creates new version with incremented `version_number`
  - Commits or rolls back atomically

**Auto-Versioning on Backtest:**
- `internal/graph/schema.resolvers.go` (`CreateBacktest` mutation)
  - Checks if strategy already has a backtest using `.WithBacktest()` (one-to-one relationship)
  - If backtest exists, calls `createStrategyVersion` to create new version first
  - Uses new version ID for backtest (prevents mutation of tested strategy)

**GraphQL Queries:**
- `internal/graph/schema.graphqls` - Custom queries for versioning
  - `latestStrategies` - Returns only latest versions (`is_latest=true`)
  - `strategyVersions(name: String!)` - Returns all versions for a strategy name

### Example Code

**UpdateStrategy Resolver (Transaction-Safe):**
```go
// internal/graph/schema.resolvers.go:67
func (r *mutationResolver) UpdateStrategy(ctx context.Context, id uuid.UUID,
    input ent.UpdateStrategyInput) (*ent.Strategy, error) {

    // Load existing strategy
    existingStrategy, err := r.client.Strategy.Get(ctx, id)
    if err != nil {
        return nil, err
    }

    var newStrategy *ent.Strategy
    // Transaction wraps mark-old + create-new
    err = graph.WithTx(ctx, r.client, func(tx *ent.Tx) error {
        // Mark old version as not latest
        if err := tx.Strategy.UpdateOne(existingStrategy).
            SetIsLatest(false).
            Exec(ctx); err != nil {
            return err
        }

        // Create new version with auto-incremented version_number
        newStrategy, err = tx.Strategy.Create().
            SetName(existingStrategy.Name).
            SetCode(input.Code).
            SetParentID(existingStrategy.ID).
            SetVersionNumber(existingStrategy.VersionNumber + 1).
            SetIsLatest(true).
            SetOwnerID(existingStrategy.OwnerID).
            Save(ctx)

        return err // Commit or rollback
    })

    return newStrategy, err
}
```

**Create Backtest with Auto-Versioning:**
```go
// internal/graph/schema.resolvers.go (CreateBacktest mutation)
func (r *mutationResolver) CreateBacktest(ctx context.Context,
    input ent.CreateBacktestInput) (*ent.Backtest, error) {

    strategyID := input.StrategyID

    // Check if strategy already has a backtest (one-to-one relationship)
    existingStrategy, _ := r.client.Strategy.Query().
        Where(strategy.ID(strategyID)).
        WithBacktest().  // Singular - one-to-one relationship
        Only(ctx)

    // Auto-version if strategy already tested
    if existingStrategy.Edges.Backtest != nil {
        newVersion, err := r.createStrategyVersion(ctx, existingStrategy)
        if err != nil {
            return nil, err
        }
        strategyID = newVersion.ID  // Use new version
    }

    // Create backtest with (possibly new) strategy ID
    return r.client.Backtest.Create().
        SetStrategyID(strategyID).
        SetConfig(input.Config).
        Save(ctx)
}
```

**GraphQL Queries:**
```graphql
# Get only latest versions (dashboard default)
query GetLatestStrategies {
  latestStrategies(first: 50) {
    edges {
      node {
        id
        name
        versionNumber
        isLatest
        code
      }
    }
  }
}

# Get all versions of a strategy
query GetStrategyVersions($name: String!) {
  strategyVersions(name: $name) {
    id
    versionNumber
    isLatest
    createdAt
    bots { totalCount }
    backtests { totalCount }
  }
}
```

### Critical Implementation Details

**Schema Edge Configuration (CRITICAL):**
```go
// internal/ent/schema/strategy.go (Edges function)
func (Strategy) Edges() []ent.Edge {
    return []ent.Edge{
        edge.To("bots", Bot.Type).
            Annotations(entgql.RelayConnection()),
        // One-to-one relationship with single backtest
        edge.To("backtest", Backtest.Type).
            Unique().
            Comment("Strategy can have at most one backtest (one-to-one)"),
    }
}
```

**IMPORTANT:** Strategy has a one-to-one relationship with Backtest. Each strategy can have at most one backtest.

**Always use `.WithBacktest()` (singular) when checking for existing backtest:**

```go
existingStrategy, _ := r.client.Strategy.Query().
    Where(strategy.ID(strategyID)).
    WithBacktest().  // Singular - loads the one-to-one backtest relationship
    Only(ctx)

if existingStrategy.Edges.Backtest != nil {
    // Strategy already has a backtest, create new version
}
```

## Validation

### How to Verify This Decision

1. **Immutability Test**: Update strategy → verify old version still exists unchanged
2. **Transaction Safety**: Cause validation error during update → verify no partial state
3. **Auto-versioning**: Create backtest twice → verify second creates new version
4. **Bot Isolation**: Update strategy → verify running bot unaffected
5. **Version History**: Check `strategyVersions` query returns complete lineage

### Automated Tests

```bash
# Run strategy versioning tests (100% coverage)
go test -v ./internal/graph -run TestStrategyVersioning

# Key test cases:
# - TestUpdateStrategy_CreatesNewVersion
# - TestCreateBacktest_AutoVersionsWhenBacktestExists
# - TestLatestStrategies_ReturnsOnlyLatest
# - TestStrategyVersions_ReturnsAllVersionsByName
# - TestUpdateStrategy_RollsBackOnValidationError
```

### Test Coverage

- `internal/graph/strategy_versioning_test.go` - 8 comprehensive tests
- 100% coverage on versioning logic
- Tests cover:
  - Version creation and incrementation
  - Transaction rollback on errors
  - Auto-versioning triggers
  - Query filtering (latest vs all versions)
  - Bot pinning to specific versions

## References

- [Immutable Infrastructure Pattern](https://www.hashicorp.com/resources/what-is-mutable-vs-immutable-infrastructure)
- [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html) - Related pattern for immutable history
- [ADR-0002: ENT ORM with GraphQL Integration](0002-ent-orm-with-graphql.md)
- Test Implementation: `internal/graph/strategy_versioning_test.go`
- Dashboard Integration: `dashboard/src/components/Strategies/StrategyDetail.tsx`
