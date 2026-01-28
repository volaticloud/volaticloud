# 0020. Leverage Configuration System

Date: 2026-01-28

## Status

Accepted

## Context and Problem Statement

The Strategy Builder needs leverage configuration for futures trading. Users need flexible leverage that can adapt to market conditions, pair characteristics, and trade direction (long vs. short).

A simple static leverage value is insufficient for real-world futures trading, where traders commonly want:

- Different leverage for different trading pairs (e.g., 5x for BTC, 3x for altcoins)
- Adaptive leverage based on market volatility (e.g., lower leverage when ATR is high)
- Direction-specific leverage (e.g., higher leverage for shorts in a downtrend)
- Default fallback leverage when no specific rule matches

The system must integrate with the existing Strategy Builder UI and code generation pipeline.

## Decision Drivers

- **Reusability**: Leverage from existing condition and operand systems already built for signal logic
- **Expressiveness**: Support conditions based on indicators, price, trade context, and constants
- **Code generation**: Must generate valid Python code for Freqtrade's `leverage` callback
- **Consistency**: Same mental model as the signal builder (conditions + actions)
- **Futures-only**: Leverage configuration only applies when futures trading mode is enabled

## Considered Options

### Option 1: Static Leverage (Single Value)

A single numeric leverage value applied to all trades.

**Pros:**

- Simplest to implement
- Easy to understand
- Minimal UI changes

**Cons:**

- No flexibility for different market conditions
- Cannot differentiate by pair, direction, or volatility
- Insufficient for serious futures trading strategies

### Option 2: Per-Pair Configuration Map

A map of trading pair to leverage value (e.g., `{"BTC/USDT": 5, "ETH/USDT": 3}`).

**Pros:**

- Pair-specific leverage
- Straightforward to configure
- Simple code generation

**Cons:**

- Limited flexibility (only pair-based, no indicator or direction awareness)
- Static values that cannot adapt to changing market conditions
- Would require a separate UI pattern from the rest of the Strategy Builder

### Option 3: Indicator-Only Dynamic Leverage

Leverage calculated directly from indicator values (e.g., `leverage = 10 - RSI / 20`).

**Pros:**

- Dynamic and market-responsive
- Can adapt to volatility

**Cons:**

- Does not cover trade context (direction, pair)
- Complex expression syntax with no conditional logic
- Hard to reason about edge cases (what if the expression returns negative values?)
- Different paradigm from the condition-based signal builder

### Option 4: Rule-Based Leverage with Priority-Ordered Rules

A list of rules, each with an optional condition (using the existing `ConditionNode` system) and a leverage value. Rules are evaluated highest-priority-first; the first matching rule wins. A default (unconditional) rule serves as the fallback.

**Pros:**

- Reuses the existing condition and operand infrastructure
- Supports all condition types: indicators, price, trade context, constants
- Familiar pattern for users already using the signal builder
- Priority ordering gives deterministic, predictable behavior
- Default rule ensures a value is always returned
- Clean code generation using the same operand/condition codegen

**Cons:**

- More complex than static leverage
- Rule ordering matters (users must understand priority)
- Additional codegen paths for `IF_THEN_ELSE`, `CROSSOVER`, `CROSSUNDER` in leverage context

## Decision Outcome

Chosen option: **Rule-Based Leverage with Priority-Ordered Rules**, because it provides the flexibility required for real-world futures trading while reusing the existing condition and operand systems, maintaining consistency with the signal builder paradigm.

### Consequences

**Positive:**

- Reuses existing `ConditionNode`, `OperandNode`, and related types from the Strategy Builder
- Consistent UI and mental model across signal and leverage configuration
- Generates a clean Python `leverage` callback for Freqtrade
- Priority-ordered evaluation is deterministic and easy to debug
- Default rule guarantees a leverage value is always returned

**Negative:**

- Adds `IF_THEN_ELSE`, `CROSSOVER`, and `CROSSUNDER` support to leverage code generation
- Requires futures trading mode to be enabled (leverage config is ignored otherwise)
- Users must understand rule priority ordering

**Neutral:**

- Leverage rules are stored as part of the strategy definition (same versioning applies)
- The leverage callback is generated alongside existing signal callbacks

## Implementation

### Data Model

Each leverage rule contains:

- **priority** (`Int`): Evaluation order (highest first)
- **condition** (`ConditionNode`, optional): When this rule applies. If absent, the rule is unconditional (default/fallback)
- **leverage** (`OperandNode`): The leverage value to use. Can be a constant (e.g., `5.0`) or an expression

### Evaluation Logic

```
for rule in rules (sorted by priority descending):
    if rule.condition is None or evaluate(rule.condition):
        return rule.leverage
return default_leverage  # fallback if no unconditional rule exists
```

### Generated Python Code

The rule-based leverage configuration generates a Freqtrade `leverage` callback:

```python
def leverage(self, pair, current_time, current_rate, proposed_leverage,
             max_leverage, entry_tag, side, **kwargs):
    dataframe, _ = self.dp.get_analyzed_sub_dataframe(pair, self.timeframe)
    last_candle = dataframe.iloc[-1].squeeze()

    # Rule 1 (priority 10): Higher leverage in strong trends
    if last_candle['rsi_14'] > 70:
        return 5.0

    # Rule 2 (priority 5): Lower leverage for short positions
    if side == 'short':
        return 2.0

    # Default rule (priority 0): Fallback leverage
    return 3.0
```

### Key Files

- `internal/graph/schema.graphqls` - GraphQL types for leverage rules
- `internal/strategy/codegen/` - Python code generation for leverage callback
- `internal/strategy/codegen/types.go` - Type aliases for leverage rule structures
- `dashboard/src/components/StrategyBuilder/` - UI components for leverage rule configuration

### Type Definitions

Leverage types are defined in the GraphQL schema following the type synchronization pattern (see ADR-0011):

```graphql
input LeverageRuleInput {
  priority: Int!
  condition: ConditionNodeInput
  leverage: OperandNodeInput!
}
```

## Validation

### How to Verify This Decision

1. **Code generation**: Create a strategy with leverage rules and verify the generated Python `leverage` callback is correct
2. **Rule evaluation**: Verify that rules are evaluated in priority order and the first match wins
3. **Default fallback**: Verify that an unconditional rule always provides a fallback value
4. **Futures-only**: Verify that leverage configuration is only available when futures trading mode is enabled

## References

- [ADR-0011: Strategy UI Builder Architecture](0011-strategy-ui-builder.md) - Condition and operand system
- [ADR-0013: Long/Short Signal Support](0013-long-short-signal-support.md) - Trade direction context
- [ADR-0006: Bot Config Layer Separation](0006-bot-config-layer-separation.md) - Trading mode configuration
- [Freqtrade Leverage Callback](https://www.freqtrade.io/en/stable/strategy-callbacks/#leverage)
