# GraphQL API Documentation

This section is under construction. It will cover:

- GraphQL schema and types
- Query and mutation examples
- Subscription usage
- Authentication and authorization
- Error handling
- Best practices

For now, refer to the following resources:

- Graph Package Documentation (`internal/graph/doc.go`) - Detailed architecture and implementation
- GraphQL Schema (`internal/graph/schema.graphqls`) - Custom types and extensions
- ENT Generated Schema (`internal/graph/ent.graphql`) - Auto-generated entity types
- Resolver Implementation (`internal/graph/schema.resolvers.go`) - Query and mutation logic

## Quick Start

The GraphQL API is available at:

- **Endpoint**: `http://localhost:8080/query`
- **Playground**: `http://localhost:8080/` (development only)

### Example Query

```graphql
query GetBots {
  bots(first: 10, where: { status: RUNNING }) {
    edges {
      node {
        id
        name
        status
        metrics {
          profitAllPercent
          tradeCount
        }
      }
    }
  }
}
```

### Authentication

All API requests require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

See the Authentication Guide documentation for details on obtaining tokens.

## Strategy UI Builder API

### Preview Strategy Code

Generate Python code from a UI Builder configuration without saving.

```graphql
mutation PreviewStrategyCode($config: Map!, $className: String!) {
  previewStrategyCode(config: $config, className: $className) {
    success
    code
    error
  }
}
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `config` | Map! | Strategy configuration including `ui_builder` object |
| `className` | String! | Python class name for the generated strategy |

**Response:**

```typescript
type PreviewCodeResult {
  success: Boolean!
  code: String!      // Generated Python code (empty if error)
  error: String      // Error message (null if success)
}
```

**Example Variables:**

```json
{
  "className": "MyStrategy",
  "config": {
    "timeframe": "5m",
    "ui_builder": {
      "version": 1,
      "indicators": [
        { "id": "rsi_1", "type": "RSI", "params": { "period": 14 } }
      ],
      "entry_conditions": {
        "id": "root",
        "type": "AND",
        "children": [
          {
            "id": "cond_1",
            "type": "COMPARE",
            "left": { "type": "INDICATOR", "indicatorId": "rsi_1" },
            "operator": "lt",
            "right": { "type": "CONSTANT", "value": 30 }
          }
        ]
      },
      "exit_conditions": {
        "id": "exit_root",
        "type": "AND",
        "children": []
      },
      "parameters": {
        "stoploss": -0.10,
        "minimal_roi": { "0": 0.10 },
        "trailing_stop": false,
        "use_exit_signal": true
      },
      "callbacks": {}
    }
  }
}
```

**Security Notes:**

- Requires authentication (`@isAuthenticated` directive)
- Config size limited to 1MB to prevent DoS
- No code execution - only code generation

### UI Builder Enums

The following enums are available for UI Builder configurations:

| Enum | Values |
|------|--------|
| `ConditionNodeType` | AND, OR, NOT, IF_THEN_ELSE, COMPARE, CROSSOVER, CROSSUNDER, IN_RANGE |
| `OperandType` | CONSTANT, INDICATOR, PRICE, TRADE_CONTEXT, TIME, EXTERNAL, COMPUTED, CUSTOM |
| `ComparisonOperator` | eq, neq, gt, gte, lt, lte, in, not_in |
| `IndicatorType` | RSI, SMA, EMA, MACD, BB, STOCH, ATR, ADX, etc. |
| `PriceField` | open, high, low, close, volume, ohlc4, hlc3, hl2 |

See `internal/graph/schema.graphqls` for complete enum definitions.

## Additional Resources

- [ADR-0001: Context-Based Dependency Injection](../../adr/0001-context-based-dependency-injection.md)
- [ADR-0002: ENT ORM with GraphQL Integration](../../adr/0002-ent-orm-with-graphql.md)
- [ADR-0011: Strategy UI Builder](../../adr/0011-strategy-ui-builder.md)
- [Strategy Builder User Guide](../../features/strategy-builder.md)
- [Dashboard GraphQL Integration](../../../dashboard/README.md#graphql-integration)
