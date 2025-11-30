# GraphQL Code Generation Architecture

## Overview

This dashboard uses **per-component code generation** where each component's GraphQL queries/mutations generate type-safe React hooks **co-located** with the component.

## File Structure

```
pages/Bots/
├── BotsList.tsx              # Component implementation
├── bots.graphql              # GraphQL queries/mutations (source)
└── bots.generated.tsx        # Generated hooks (auto-generated)
```

## How It Works

### 1. Define GraphQL Operations

Create a `.graphql` file next to your component:

```graphql
# pages/Bots/bots.graphql
query GetBots($first: Int) {
  bots(first: $first) {
    edges {
      node {
        id
        name
        status
        exchange { name }
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

### 2. Run Code Generator

```bash
npm run codegen
```

This generates `pages/Bots/bots.generated.tsx` with:

- `useGetBotsQuery` - Type-safe query hook
- `useStartBotMutation` - Type-safe mutation hook
- Full TypeScript types for all fields

### 3. Use Generated Hooks

```typescript
// pages/Bots/BotsList.tsx
import { useGetBotsQuery, useStartBotMutation } from './bots.generated';

export const BotsList = () => {
  const { data, loading, error } = useGetBotsQuery({
    variables: { first: 10 }
  });

  const [startBot, { loading: starting }] = useStartBotMutation();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert error={error} />;

  const bots = data?.bots?.edges?.map(e => e?.node).filter(Boolean) || [];

  return (
    <div>
      {bots.map(bot => (
        <BotCard
          key={bot.id}
          bot={bot}
          onStart={() => startBot({ variables: { id: bot.id } })}
        />
      ))}
    </div>
  );
};
```

## Configuration

The code generator is configured in `codegen.ts`:

```typescript
{
  // Generate shared types
  './src/generated/types.ts': {
    plugins: ['typescript']
  },

  // Generate per-file hooks
  'src/': {
    preset: 'near-operation-file',
    presetConfig: {
      extension: '.generated.tsx',
      baseTypesPath: 'generated/types.ts'
    },
    plugins: [
      'typescript-operations',
      'typescript-react-apollo'
    ]
  }
}
```

## Benefits

### ✅ Co-location

- Generated code lives next to the component that uses it
- Easy to find and navigate
- Clear ownership

### ✅ Type Safety

- Full TypeScript types for all GraphQL operations
- IntelliSense for all fields
- Compile-time error checking

### ✅ No Import Path Issues

- Import from `'./component.generated'` - always relative
- No need for path aliases or complex imports

### ✅ Modularity

- Each component has its own generated file
- Changes to one component's queries don't affect others
- Easier to understand what data each component needs

### ✅ Git-Friendly

- All `*.generated.tsx` files are gitignored
- Generated fresh on each machine
- No merge conflicts in generated code

## File Locations

All generated files follow this pattern:

```
src/
├── components/
│   └── Layout/
│       ├── layout.graphql
│       └── layout.generated.tsx       ✨ Generated
├── pages/
│   ├── Dashboard/
│   │   ├── dashboard.graphql
│   │   └── dashboard.generated.tsx    ✨ Generated
│   ├── Bots/
│   │   ├── bots.graphql
│   │   └── bots.generated.tsx         ✨ Generated
│   ├── Exchanges/
│   │   ├── exchanges.graphql
│   │   └── exchanges.generated.tsx    ✨ Generated
│   └── ...
└── generated/
    └── types.ts                       ✨ Shared types
```

## Development Workflow

### Initial Setup

```bash
npm install
npm run codegen  # Generate all types
npm run dev      # Start dev server
```

### When Schema Changes

```bash
npm run codegen  # Regenerate all types
```

### Watch Mode (Auto-regenerate)

```bash
npm run codegen:watch  # In terminal 1
npm run dev            # In terminal 2
```

## Best Practices

### DO ✅

- Keep GraphQL queries focused and minimal
- Name queries descriptively (e.g., `GetBotsForList`, not just `GetBots`)
- Co-locate queries with the component that uses them
- Use fragments for reusable field selections
- Run codegen after any `.graphql` file changes

### DON'T ❌

- Don't manually edit `*.generated.tsx` files (they'll be overwritten)
- Don't commit generated files to git
- Don't create huge queries that fetch everything
- Don't share one `.graphql` file across multiple components
- Don't forget to run codegen before using new queries

## Troubleshooting

### "Cannot find module './component.generated'"

- Run `npm run codegen` to generate the file
- Make sure the `.graphql` file exists
- Check that the GraphQL server is running

### "Type 'undefined' is not assignable to..."

- The query might have failed to generate
- Check the console output from `npm run codegen`
- Ensure your GraphQL query is valid

### Duplicate Operation Names

- Each query/mutation must have a unique name
- Use descriptive names: `GetBotsForList`, `GetBotForDetail`, etc.
- Run `npm run codegen` to see which files have conflicts

## Example: Full Component

See `src/pages/Bots/BotsListWithData.tsx` for a complete example showing:

- Query usage with loading/error states
- Mutation usage with callbacks
- Type-safe data access
- Refetching after mutations
