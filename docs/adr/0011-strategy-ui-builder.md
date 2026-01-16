# 0011. Strategy UI Builder Architecture

Date: 2026-01-16

## Status

Accepted

## Context and Problem Statement

VolatiCloud needs a visual strategy builder that allows users to create trading strategies without writing Python code. The system must:

- Provide a no-code interface for building entry/exit conditions
- Support complex nested logic (AND, OR, NOT, IF-THEN-ELSE)
- Generate valid Freqtrade Python strategy code from visual configurations
- Support 20+ technical indicators with configurable parameters
- Enable advanced callbacks (custom stoploss, DCA, entry confirmation)

**The Problem:** How do we design a condition tree structure that is both expressive enough for complex trading strategies and simple enough to serialize/deserialize between frontend and backend while generating correct Python code?

## Decision Drivers

- **Type safety**: Discriminated unions for TypeScript and Go type narrowing
- **Extensibility**: Plugin-based architecture for future operand types and indicators
- **Industry alignment**: Follow patterns from JSON Logic, React Query Builder, and DMN
- **Code generation**: Tree structure must map directly to valid pandas/numpy Python code
- **Consistency**: Frontend and backend types must stay synchronized

## Considered Options

### Option 1: JSON Logic Format

Use the JSON Logic format where the operator is the key (e.g., `{"and": [...]}`).

**Pros:**

- Well-established standard
- Compact representation

**Cons:**

- Implicit typing makes TypeScript narrowing difficult
- No natural place for node metadata (id, label, disabled)
- Harder to extend with trading-specific operations

### Option 2: Explicit Type Field (Chosen)

Use an explicit `type` field on every node for discriminated unions (e.g., `{type: "AND", children: [...]}`).

**Pros:**

- TypeScript discriminated unions work naturally
- React Query Builder compatible patterns
- Easy to add metadata fields (id, label, disabled)
- Clear extension points for new node types

**Cons:**

- Slightly more verbose than JSON Logic
- Requires type guards in Go

### Option 3: Expression Language

Use a string-based expression language (e.g., `"RSI < 30 AND MACD > 0"`).

**Pros:**

- Familiar to traders
- Compact representation

**Cons:**

- Requires parser implementation
- Error messages harder to localize to UI elements
- Difficult to build visual editor for

## Decision Outcome

Chosen option: **Explicit Type Field**, because it:

1. Enables clean TypeScript discriminated unions
2. Follows React Query Builder patterns (industry standard)
3. Provides natural extension points for trading-specific nodes
4. Maps cleanly to Python code generation
5. Supports node-level metadata for UI features (disable, labels)

### Consequences

**Positive:**

- Full type safety in both TypeScript and Go
- Easy to add new node types (e.g., CROSSOVER, CROSSUNDER)
- Clean separation between condition tree and operand types
- Extensible operand system (CONSTANT, INDICATOR, PRICE, etc.)

**Negative:**

- Must keep frontend and backend types synchronized manually
- More verbose JSON representation

**Neutral:**

- Server-side code generation (backend generates Python)
- One-way conversion to code-only mode (no back-conversion)

## Implementation

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Indicator   │  │  Condition   │  │   Callback Builders  │  │
│  │   Library    │  │  Tree Editor │  │  (Stoploss, DCA...)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                            │                                    │
│                            ▼                                    │
│               ┌────────────────────────┐                        │
│               │   UIBuilderConfig      │                        │
│               │   (Nested JSON Tree)   │                        │
│               └────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼ GraphQL Mutation (previewStrategyCode)
┌─────────────────────────────────────────────────────────────────┐
│                        Backend (Go)                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Strategy Code Generator                      │  │
│  │  internal/strategy/codegen/                               │  │
│  │  - generator.go: Condition tree → Python expressions      │  │
│  │  - indicators.go: Indicator templates (RSI, MACD, etc.)   │  │
│  │  - types.go: Go structs matching TypeScript types         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                    │
│                            ▼                                    │
│               ┌────────────────────────┐                        │
│               │   Valid Python Code    │                        │
│               │   (Freqtrade Strategy) │                        │
│               └────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

### Condition Tree Structure

#### Node Types

| Node Type | Purpose | Generated Python |
|-----------|---------|------------------|
| AND | Logical conjunction | `(a) & (b) & (c)` |
| OR | Logical disjunction | `(a) \| (b) \| (c)` |
| NOT | Logical negation | `~(a)` |
| IF_THEN_ELSE | Conditional branching | `np.where(cond, then, else)` |
| COMPARE | Value comparison | `left op right` |
| CROSSOVER | Series crosses above | `qtpylib.crossed_above(a, b)` |
| CROSSUNDER | Series crosses below | `qtpylib.crossed_below(a, b)` |
| IN_RANGE | Range check | `(v >= min) & (v <= max)` |

#### Operand Types

| Operand Type | Purpose | Example |
|--------------|---------|---------|
| CONSTANT | Literal values | `30`, `"buy"`, `true` |
| INDICATOR | Technical indicator reference | `dataframe['rsi_1']` |
| PRICE | OHLCV data | `dataframe['close']` |
| TRADE_CONTEXT | Trade state (callbacks only) | `current_profit` |
| TIME | Time-based values | `dataframe['date'].dt.hour` |
| COMPUTED | Arithmetic operations | `(a + b) / c` |
| EXTERNAL | External data sources (future) | - |
| CUSTOM | Plugin operands (future) | - |

### Key Files

| File | Purpose |
|------|---------|
| `internal/strategy/codegen/types.go` | Go structs for condition tree |
| `internal/strategy/codegen/generator.go` | Condition → Python code |
| `internal/strategy/codegen/indicators.go` | Indicator code templates |
| `dashboard/src/components/StrategyBuilder/types.ts` | TypeScript types (must match Go) |
| `dashboard/src/components/StrategyBuilder/StrategyBuilder.tsx` | Main UI component |
| `dashboard/src/components/StrategyBuilder/ConditionNode.tsx` | Recursive tree editor |
| `dashboard/src/components/StrategyBuilder/CodePreview.tsx` | Generated code display |

### Type Synchronization

Frontend and backend types must be kept in sync manually:

```typescript
// dashboard/src/components/StrategyBuilder/types.ts
export type OperandType =
  | 'CONSTANT'
  | 'INDICATOR'
  | 'PRICE'
  | 'TRADE_CONTEXT'
  | 'TIME'
  | 'EXTERNAL'
  | 'COMPUTED'
  | 'CUSTOM';
```

```go
// internal/strategy/codegen/types.go
const (
    OperandTypeCONSTANT      OperandType = "CONSTANT"
    OperandTypeINDICATOR     OperandType = "INDICATOR"
    OperandTypePRICE         OperandType = "PRICE"
    OperandTypeTRADE_CONTEXT OperandType = "TRADE_CONTEXT"
    OperandTypeTIME          OperandType = "TIME"
    OperandTypeEXTERNAL      OperandType = "EXTERNAL"
    OperandTypeCOMPUTED      OperandType = "COMPUTED"
    OperandTypeCUSTOM        OperandType = "CUSTOM"
)
```

### Design Principles

1. **Only include implemented types**: Don't add placeholder types that return fake values
2. **Composability over special cases**: Provide building blocks (e.g., TIME.hour) instead of high-level abstractions (e.g., trading_session)
3. **Flexibility via COMPUTED operand**: Users can compose arithmetic expressions for calculated values
4. **Server-side generation**: Backend generates Python to ensure security and validation

## Validation

How to verify this decision is being followed:

1. **Type sync check**: Compare `types.ts` OperandType with `types.go` OperandType constants
2. **Code review**: New operand/node types must be added to both frontend and backend
3. **Test coverage**: Generator tests verify Python output for all node types
4. **No placeholders**: Types should not return hardcoded/fake values

## References

### Related ADRs

- [ADR-0002: ENT ORM with GraphQL](0002-ent-orm-with-graphql.md) - GraphQL schema patterns
- [ADR-0003: Strategy Immutable Versioning](0003-strategy-immutable-versioning.md) - Strategy versioning context

### External References

- [JSON Logic](https://jsonlogic.com/) - Inspiration for expression trees
- [React Query Builder](https://react-querybuilder.js.org/) - UI patterns reference
- [DMN (Decision Model and Notation)](https://www.omg.org/spec/DMN/) - Decision tree standards