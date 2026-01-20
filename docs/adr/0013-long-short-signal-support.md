# ADR-0013: Long/Short Signal Support

## Status
Accepted

## Context
The strategy builder originally only supported long positions (buy low, sell high).
Many trading strategies require short selling capabilities, especially for:
- Hedging positions in volatile markets
- Profiting from bearish market conditions
- Implementing market-neutral strategies

We needed to add comprehensive long/short position support while maintaining:
- Full backwards compatibility with existing v1 strategies
- A clean, intuitive UI for defining entry/exit conditions per direction
- Optional auto-mirroring to reduce duplicate condition maintenance

## Decision

### Architecture: Nested SignalConfig Structure

We chose a nested structure with entry/exit conditions grouped per direction:

```
UIBuilderConfig
├── position_mode: LONG_ONLY | SHORT_ONLY | LONG_AND_SHORT
├── long: SignalConfig
│   ├── entry_conditions: ConditionNode
│   └── exit_conditions: ConditionNode
├── short: SignalConfig
│   ├── entry_conditions: ConditionNode
│   └── exit_conditions: ConditionNode
└── mirror_config: MirrorConfig (optional)
```

**Rationale:**
- Groups related conditions logically (entry/exit per direction)
- Allows independent configuration of long and short signals
- Supports mirror configuration to auto-generate opposite direction
- Clean separation of concerns in the UI

### Position Mode Enum

```graphql
enum PositionMode {
  LONG_ONLY      # Default - backwards compatible
  SHORT_ONLY     # Only short signals
  LONG_AND_SHORT # Both directions
}
```

**Rationale:**
- Explicit mode makes intent clear
- Default LONG_ONLY preserves existing behavior
- UI can conditionally show/hide tabs based on mode

### Auto-Mirror Feature

```graphql
input MirrorConfigInput {
  enabled: Boolean!
  source: StrategySignalDirection!  # LONG or SHORT
  invertComparisons: Boolean!       # gt → lt, etc.
  invertCrossovers: Boolean!        # crossover → crossunder
}
```

**Rationale:**
- Common pattern: short conditions are often inverted long conditions
- Reduces maintenance burden for symmetric strategies
- Optional - users can define independent conditions
- Granular control over what gets inverted

### Backwards Compatibility

V1 configs (flat `entry_conditions`/`exit_conditions`) are automatically migrated:

```go
func NormalizeUIBuilderConfig(config *UIBuilderConfig) *UIBuilderConfig {
    // If already v2 (has Long or Short), return unchanged
    if config.Long != nil || config.Short != nil {
        return config
    }

    // Migrate v1 → v2
    config.Version = 2
    config.PositionMode = PositionModeLongOnly
    config.Long = &SignalConfig{
        EntryConditions: config.EntryConditions,
        ExitConditions:  config.ExitConditions,
    }
    return config
}
```

## Code Generation

The strategy code generator produces different signals based on position mode:

| Mode | Signals Generated | `can_short` |
|------|-------------------|-------------|
| `LONG_ONLY` | `enter_long`, `exit_long` | `False` |
| `SHORT_ONLY` | `enter_short`, `exit_short` | `True` |
| `LONG_AND_SHORT` | All 4 signals | `True` |

## Alternatives Considered

### 1. Flat Structure with Signal Type Field
```json
{
  "signals": [
    { "direction": "LONG", "type": "entry", "conditions": {...} },
    { "direction": "LONG", "type": "exit", "conditions": {...} },
    { "direction": "SHORT", "type": "entry", "conditions": {...} }
  ]
}
```
**Rejected:** Array-based structure harder to validate and query. Nested structure is more explicit.

### 2. Separate Fields Without Nesting
```json
{
  "long_entry_conditions": {...},
  "long_exit_conditions": {...},
  "short_entry_conditions": {...},
  "short_exit_conditions": {...}
}
```
**Rejected:** More verbose, harder to add per-direction metadata in the future.

### 3. Single Entry/Exit with Direction Flag
```json
{
  "entry_conditions": {...},
  "exit_conditions": {...},
  "apply_to": ["LONG", "SHORT"],
  "invert_for_short": true
}
```
**Rejected:** Limits flexibility - many strategies have fundamentally different long/short conditions.

## Consequences

### Positive
- Clean UI with direction-specific tabs
- Independent control over long and short signals
- Convenient auto-mirror for symmetric strategies
- Full backwards compatibility with v1 configs
- Type-safe GraphQL schema

### Negative
- More complex config structure
- Need to maintain normalization logic
- Mirror logic adds complexity for edge cases

## Implementation Files

### Backend
- `internal/graph/schema.graphqls` - GraphQL types
- `internal/strategy/codegen/types.go` - Go type definitions
- `internal/strategy/codegen/normalize.go` - V1→V2 migration
- `internal/strategy/codegen/mirror.go` - Auto-invert logic
- `internal/strategy/codegen/strategy.go` - Code generation

### Frontend
- `dashboard/src/components/StrategyBuilder/types.ts` - TypeScript types
- `dashboard/src/components/StrategyBuilder/PositionModeSelector.tsx` - Mode selection
- `dashboard/src/components/StrategyBuilder/MirrorToggle.tsx` - Mirror config
- `dashboard/src/components/StrategyBuilder/SignalEditor.tsx` - Per-direction editor
- `dashboard/src/components/StrategyBuilder/StrategyBuilder.tsx` - Main component

## Related ADRs
- [ADR-0003](./0003-strategy-immutable-versioning.md) - Strategy versioning
- [ADR-0011](./0011-strategy-ui-builder.md) - UI Builder architecture
