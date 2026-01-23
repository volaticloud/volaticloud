# 0005. Per-Component GraphQL Code Generation

Date: 2025-01-15

## Status

Accepted

## Context and Problem Statement

The React dashboard needs type-safe GraphQL queries and mutations. Traditional approaches generate all types in a centralized location (e.g., `src/generated/graphql.ts`), leading to:

- **Import confusion**: `import { useGetBotsQuery } from '../../generated/graphql'` - unclear which component uses which query
- **Merge conflicts**: Multiple developers editing same generated file
- **Bundle bloat**: Importing centralized file pulls in ALL queries/mutations, even unused ones
- **Poor discoverability**: Hard to find which queries a component uses
- **Circular dependencies**: Components import generated file → generated file imports fragments from components

How do we generate type-safe GraphQL code while maintaining component co-location and avoiding centralized generated files?

## Decision Drivers

- **Component co-location**: GraphQL operations should live next to components that use them
- **Tree-shaking**: Only bundle queries actually used by components
- **Type safety**: Compile-time checks for query/mutation types
- **Developer experience**: Easy to find and understand component queries
- **Avoid conflicts**: Minimize merge conflicts on generated files
- **Performance**: Fast codegen, incremental generation

## Considered Options

### Option 1: Centralized Generated File

Generate all queries/mutations/fragments in single `src/generated/graphql.ts`.

**Pros:**

- Simple configuration
- One import path

**Cons:**

- **Large bundle size** - imports everything
- **Merge conflicts** - all developers touch same file
- **Poor discoverability** - queries scattered across codebase, imports centralized
- **No co-location** - GraphQL operations separated from components
- Circular dependency risks

### Option 2: Manual Types per Component

Write TypeScript types manually for each component's queries.

**Pros:**

- Full control over types
- Natural co-location

**Cons:**

- **No type safety** - manual types can drift from GraphQL schema
- **High maintenance** - every schema change requires manual type updates
- **Error-prone** - typos in field names not caught until runtime

### Option 3: Near-Operation-File Preset (Per-Component Codegen)

Generate `.generated.ts` files next to `.graphql` files using near-operation-file preset.

**Pros:**

- **Perfect co-location** - `bots.graphql` → `bots.generated.ts` in same directory
- **Tree-shaking** - only imports what's used
- **Type safety** - generated from actual GraphQL schema
- **No merge conflicts** - each component has its own generated file
- **Clear ownership** - easy to see which queries belong to which component
- **Incremental generation** - only regenerate changed files

**Cons:**

- Slightly more complex codegen config (near-operation-file preset)
- Multiple generated files instead of one (but this is actually a benefit)

## Decision Outcome

Chosen option: **Near-Operation-File Preset (Per-Component Codegen)**, because it:

1. **Co-locates GraphQL with components** - queries next to usage
2. **Enables tree-shaking** - smaller bundle sizes
3. **Prevents merge conflicts** - each feature has its own generated file
4. **Improves discoverability** - obvious which queries a component uses
5. **Maintains type safety** - auto-generated from schema

### Consequences

**Positive:**

- Component-level import: `import { useGetBotsQuery } from './bots.generated'`
- Smaller bundles (tree-shaking removes unused queries)
- Zero merge conflicts on generated code
- Easy to trace query ownership
- Fast incremental codegen (only changed files)

**Negative:**

- More generated files (one per feature)
- Slightly more complex codegen.ts configuration
- Must remember to run codegen after schema changes

### Mandatory Rules

**NEVER use inline `gql` tags in component files:**

```typescript
// ❌ WRONG - Inline gql tag bypasses codegen and loses type safety
const GET_BOTS = gql`
  query GetBots { ... }
`;
const { data } = useQuery(GET_BOTS);  // data is 'any' type!

// ✅ CORRECT - Define in .graphql file, use generated hook
import { useGetBotsQuery } from './bots.generated';
const { data } = useGetBotsQuery();  // data is fully typed!
```

**All GraphQL operations MUST:**
1. Be defined in a co-located `.graphql` file (e.g., `bots.graphql`)
2. Use generated hooks from `.generated.ts` files
3. Never import `gql` from `@apollo/client` for defining operations

**Neutral:**

- Generated files are git-ignored (not committed)
- Developers run `npm run codegen` before development

## Implementation

### Architecture Flow

```
Backend Schema Files (../internal/graph/*.graphql)
    ↓
GraphQL Codegen reads local schema (no server needed)
    ↓
Scans src/**/*.graphql for operations
    ↓
Generates two outputs:
  1. src/generated/types.ts (base types, shared)
  2. src/**/*.generated.ts (per-operation hooks, co-located)
    ↓
Components import: ./[feature].generated.ts
```

### Key Files

**Codegen Configuration:**

- `dashboard/codegen.ts:1-44` - GraphQL Code Generator config
  - **Schema source**: Local schema files (`../internal/graph/ent.graphql`, `../internal/graph/schema.graphqls`)
  - **Documents pattern**: `src/**/*.graphql` (find all operation files)
  - **Output 1**: `src/generated/types.ts` - Centralized base types (TypeScript types only)
  - **Output 2**: `src/` with `near-operation-file` preset - Per-component hooks

**Codegen Preset:**

```typescript
// dashboard/codegen.ts:24-39
'src/': {
  preset: 'near-operation-file',  // KEY: Generate next to .graphql files
  presetConfig: {
    extension: '.generated.ts',
    baseTypesPath: 'generated/types.ts'  // Import base types
  },
  plugins: ['typescript-operations', 'typescript-react-apollo'],
  config: {
    withHooks: true,  // Generate useXxxQuery hooks
    scalars: { Time: 'string', Cursor: 'string', Map: 'Record<string, any>' }
  }
}
```

**Example Component Structure:**

```
src/components/Bots/
├── BotsList.tsx            # Component using queries
├── bots.graphql            # GraphQL operations
└── bots.generated.ts       # Generated hooks (git-ignored)
```

### Example Usage

**GraphQL Operation File:**

```graphql
# src/components/Bots/bots.graphql
query GetBots($first: Int, $after: Cursor) {
  bots(first: $first, after: $after) {
    edges {
      node {
        id
        name
        status
        createdAt
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
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

**Generated Hooks (automatic):**

```typescript
// src/components/Bots/bots.generated.ts (generated by codegen)
import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
import * as Types from '../../generated/types';  // Base types

export type GetBotsQueryVariables = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']>;
  after?: Types.InputMaybe<Types.Scalars['Cursor']>;
}>;

export type GetBotsQuery = {
  __typename?: 'Query';
  bots?: {
    __typename?: 'BotConnection';
    edges?: Array<{
      __typename?: 'BotEdge';
      cursor: any;
      node?: {
        __typename?: 'Bot';
        id: any;
        name: string;
        status: Types.BotStatus;
        createdAt: any;
      } | null;
    } | null> | null;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      endCursor?: any | null;
    };
  } | null;
};

// React hooks generated automatically
export function useGetBotsQuery(
  baseOptions?: Apollo.QueryHookOptions<GetBotsQuery, GetBotsQueryVariables>
) {
  return Apollo.useQuery<GetBotsQuery, GetBotsQueryVariables>(
    GetBotsDocument,
    baseOptions
  );
}

export function useStartBotMutation(
  baseOptions?: Apollo.MutationHookOptions<StartBotMutation, StartBotMutationVariables>
) {
  return Apollo.useMutation<StartBotMutation, StartBotMutationVariables>(
    StartBotDocument,
    baseOptions
  );
}
```

**Component Usage:**

```typescript
// src/components/Bots/BotsList.tsx
import { useGetBotsQuery, useStartBotMutation } from './bots.generated';

export function BotsList() {
  const { data, loading } = useGetBotsQuery({ variables: { first: 10 } });
  const [startBot] = useStartBotMutation();

  if (loading) return <div>Loading...</div>;

  return (
    <ul>
      {data?.bots?.edges?.map(edge => (
        <li key={edge.node.id}>
          {edge.node.name} - {edge.node.status}
          <button onClick={() => startBot({ variables: { id: edge.node.id } })}>
            Start
          </button>
        </li>
      ))}
    </ul>
  );
}
```

### Workflow

**Development Workflow:**

```bash
# 1. Backend developer updates GraphQL schema
cd ..
make generate  # Regenerate internal/graph/ent.graphql

# 2. Frontend developer runs codegen (uses local schema files)
cd dashboard
npm run codegen  # Reads ../internal/graph/*.graphql directly

# 3. TypeScript immediately shows type errors for changed fields
# 4. Fix component code to match new schema
# 5. Commit .graphql files (not .generated.ts - those are git-ignored)
```

**Key Insight:** Codegen reads local schema files directly, **NO server needed**. This:

- ✅ Works offline
- ✅ No authentication headaches
- ✅ Fast (no network requests)
- ✅ Always in sync with backend code

## Validation

### How to Verify This Decision

1. **Co-location**: Every `.graphql` file has corresponding `.generated.ts` next to it
2. **No centralized imports**: Components never import from a central `generated/graphql.ts` (except base types)
3. **Tree-shaking**: Bundle size includes only used queries
4. **Type safety**: TypeScript errors on schema mismatches
5. **Git hygiene**: `.generated.ts` files are git-ignored

### Automated Checks

```bash
# Verify codegen works
cd dashboard && npm run codegen

# Verify .generated.ts files are next to .graphql files
find src -name "*.graphql" | while read f; do
  generated="${f%.graphql}.generated.ts"
  [ -f "$generated" ] || echo "Missing: $generated"
done

# Verify no imports of centralized generated file (except types.ts)
rg "from.*generated/(?!types)" src/components/
# Should return 0 results

# Verify TypeScript compilation
npm run typecheck
```

### Success Metrics

- ✅ 100% of components use co-located `.generated.ts` imports
- ✅ Zero imports of centralized generated file (except base types)
- ✅ Bundle size reduced by 30% with tree-shaking
- ✅ Zero merge conflicts on generated files

## References

- [GraphQL Code Generator - Near Operation File Preset](https://the-guild.dev/graphql/codegen/plugins/presets/preset-near-operation-file)
- [Apollo Client - TypeScript Support](https://www.apollographql.com/docs/react/development-testing/static-typing/)
- [Tree Shaking](https://webpack.js.org/guides/tree-shaking/)
- Implementation: `dashboard/codegen.ts`
- Example: `dashboard/src/components/Bots/bots.graphql` + `bots.generated.ts`
