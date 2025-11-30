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

## Additional Resources

- [ADR-0001: Context-Based Dependency Injection](../../adr/0001-context-based-dependency-injection.md)
- [ADR-0002: ENT ORM with GraphQL Integration](../../adr/0002-ent-orm-with-graphql.md)
- [Dashboard GraphQL Integration](../../../dashboard/README.md#graphql-integration)
