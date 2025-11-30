# GraphQL Code Generation Pattern

## Problem

How do you maintain type-safe GraphQL operations in both backend and frontend while:

- Keeping schemas in sync across services
- Generating type-safe resolvers and hooks
- Avoiding manual type definitions
- Supporting schema-first development

## Solution

Use schema-first code generation with gqlgen (backend) and GraphQL Code Generator (frontend). Backend generates resolvers from schema, frontend generates TypeScript types and hooks from operations.

## Implementation

### Backend: gqlgen Schema-First Generation

#### 1. Define GraphQL Schema

```graphql
# internal/graph/schema.graphqls
scalar Map
scalar Time

extend type Query {
  latestStrategies(first: Int): [Strategy!]! @injectEntClient
}

extend type Mutation {
  updateBot(id: ID!, input: UpdateBotInput!): Bot!
    @injectEntClient
    @injectUMAClient
}

input UpdateBotInput {
  name: String
  config: Map
  mode: BotMode
}
```

#### 2. Configure gqlgen

```yaml
# gqlgen.yml
schema:
  - internal/graph/schema.graphqls
  - internal/graph/ent.graphql  # ENT-generated

exec:
  filename: internal/graph/generated.go
  package: graph

model:
  filename: internal/graph/model/models.go
  package: model

resolver:
  layout: follow-schema
  dir: internal/graph
  package: graph
  filename_template: "{name}.resolvers.go"

autobind:
  - volaticloud/internal/ent
  - volaticloud/internal/enum
  - volaticloud/internal/backtest

models:
  Node:
    model: volaticloud/internal/ent.Noder
  Map:
    model: map[string]interface{}
  Time:
    model: github.com/99designs/gqlgen/graphql.Time

directives:
  injectEntClient:
    skip_runtime: false
  injectUMAClient:
    skip_runtime: false
```

#### 3. Generate Backend Code

```bash
# Run code generation
go run github.com/99designs/gqlgen generate

# Or via Makefile
make generate
```

#### 4. Implement Custom Resolvers

```go
// internal/graph/schema.resolvers.go
func (r *mutationResolver) UpdateBot(ctx context.Context,
    id uuid.UUID, input ent.UpdateBotInput) (*ent.Bot, error) {

    // Custom business logic
    if err := bot.ValidateConfig(input.Config); err != nil {
        return nil, err
    }

    return r.client.Bot.UpdateOneID(id).
        SetInput(input).
        Save(ctx)
}
```

### Frontend: GraphQL Code Generator with Near-Operation-File

#### 1. Configure Code Generator

```typescript
// dashboard/codegen.ts
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: [
    '../internal/graph/ent.graphql',
    '../internal/graph/schema.graphqls'
  ],
  documents: 'src/**/*.graphql',
  generates: {
    // Centralized base types
    './src/generated/types.ts': {
      plugins: [
        'typescript',
        'typescript-operations'
      ]
    },
    // Per-component hooks (near-operation-file)
    './src/': {
      preset: 'near-operation-file',
      presetConfig: {
        extension: '.generated.ts',
        baseTypesPath: 'generated/types.ts'
      },
      plugins: [
        'typescript-operations',
        'typescript-react-apollo'
      ],
      config: {
        withHooks: true,
        withComponent: false,
        withHOC: false
      }
    }
  }
};

export default config;
```

#### 2. Define GraphQL Operations

```graphql
# src/components/Bots/bots.graphql
query GetBots($first: Int, $where: BotWhereInput) {
  bots(first: $first, where: $where) {
    edges {
      node {
        id
        name
        status
        mode
        metrics {
          profitAllPercent
          tradeCount
        }
      }
    }
  }
}

mutation StartBot($id: ID!) {
  startBot(id: $id) {
    id
    status
  }
}
```

#### 3. Generate TypeScript Code

```bash
cd dashboard
npm run codegen
```

This generates:

- `src/generated/types.ts` - Base TypeScript types
- `src/components/Bots/bots.generated.ts` - Component-specific hooks

#### 4. Use Generated Hooks

```typescript
// src/components/Bots/BotsList.tsx
import { useGetBotsQuery, useStartBotMutation } from './bots.generated';

export function BotsList() {
  const { data, loading, error } = useGetBotsQuery({
    variables: { first: 10 }
  });

  const [startBot] = useStartBotMutation({
    refetchQueries: ['GetBots']
  });

  const handleStart = (id: string) => {
    startBot({ variables: { id } });
  };

  if (loading) return <Loading />;
  if (error) return <Error message={error.message} />;

  return (
    <div>
      {data?.bots.edges.map(({ node: bot }) => (
        <BotCard
          key={bot.id}
          bot={bot}
          onStart={() => handleStart(bot.id)}
        />
      ))}
    </div>
  );
}
```

## Benefits

1. **Type Safety**: Full type safety from GraphQL schema to TypeScript
2. **Auto-Completion**: IDE auto-complete for all GraphQL operations
3. **Co-Location**: GraphQL operations live next to components
4. **Compile-Time Errors**: Schema mismatches caught at compile time
5. **Reduced Boilerplate**: No manual type definitions needed
6. **Schema Evolution**: Regenerate after schema changes to catch breaking changes

## Trade-offs

### Pros

- Complete type safety across stack
- Automated synchronization of types
- Developer experience (auto-complete, errors)
- Reduced manual work

### Cons

- Build step required after schema changes
- Generated files can be large
- Learning curve for configuration
- Schema must be accessible to codegen

## Common Patterns

### Backend Patterns

#### Custom Directives

```graphql
directive @injectEntClient on FIELD_DEFINITION
directive @authorized(resource: String!, permission: String!) on FIELD_DEFINITION

type Query {
  bots: [Bot!]! @injectEntClient @authorized(resource: "bot", permission: "bot:view")
}
```

#### Custom Scalars

```graphql
scalar Map
scalar Time

type Bot {
  config: Map!
  createdAt: Time!
}
```

```yaml
# gqlgen.yml
models:
  Map:
    model: map[string]interface{}
  Time:
    model: github.com/99designs/gqlgen/graphql.Time
```

### Frontend Patterns

#### Query with Variables

```graphql
query GetBot($id: ID!) {
  bots(where: {id: $id}, first: 1) {
    edges {
      node {
        id
        name
        ...BotDetails
      }
    }
  }
}

fragment BotDetails on Bot {
  status
  mode
  config
  metrics {
    profitAllPercent
  }
}
```

#### Mutation with Optimistic Response

```typescript
const [updateBot] = useUpdateBotMutation({
  optimisticResponse: {
    updateBot: {
      __typename: 'Bot',
      id: botId,
      name: newName
    }
  }
});
```

#### Polling for Real-Time Updates

```typescript
const { data } = useGetBotQuery({
  variables: { id: botId },
  pollInterval: 5000  // Poll every 5 seconds
});
```

## Workflow

### After Schema Changes

**Backend:**

```bash
# 1. Update ENT schema
vim internal/ent/schema/bot.go

# 2. Generate ENT + GraphQL
make generate

# 3. Rebuild binary
make build
```

**Frontend:**

```bash
# 1. Regenerate types (reads local schema files)
cd dashboard
npm run codegen

# 2. Fix TypeScript errors
npm run type-check
```

### Schema Evolution

1. Make backward-compatible schema changes
2. Regenerate both backend and frontend
3. Deploy backend first
4. Deploy frontend (uses new types)
5. Remove deprecated fields after frontend migration

## Related Patterns

- [ENT ORM Integration](ent-orm-integration.md) - Schema generation from ENT
- [Dependency Injection](dependency-injection.md) - Custom directive implementation
- [Resolver Testing](resolver-testing.md) - Testing generated resolvers

## References

- [ADR-0005: Per-Component GraphQL Codegen](../adr/0005-per-component-graphql-codegen.md)
- gqlgen Documentation: https://gqlgen.com/
- GraphQL Code Generator: https://the-guild.dev/graphql/codegen
- `gqlgen.yml` - Backend configuration
- `dashboard/codegen.ts` - Frontend configuration
- `internal/graph/generated.go` - Generated backend code
- `dashboard/src/generated/` - Generated frontend types
