# Dashboard Architecture

## Design Principles

### 1. Separation of Concerns
- **Pages** = Thin route handlers (no logic, just routing)
- **Components** = Reusable, domain-specific UI components (with logic)
- **GraphQL** = Co-located with components that use them

### 2. Component Reusability
All components are designed to be reusable across multiple pages or contexts.

### 3. Domain-Based Organization
Components are organized by business domain (Bots, Exchanges, Strategies, etc.), not by technical role.

## Directory Structure

```
src/
├── components/                    # All reusable components
│   ├── Layout/                   # Layout components (Sidebar, Header)
│   │   ├── DashboardLayout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── layout.graphql       # GraphQL queries for layout
│   │   └── layout.generated.tsx # Generated hooks
│   │
│   ├── shared/                   # Shared utility components
│   │   ├── LoadingSpinner.tsx
│   │   ├── ErrorAlert.tsx
│   │   └── ...
│   │
│   ├── Dashboard/                # Dashboard domain components
│   │   ├── Dashboard.tsx
│   │   ├── SummaryCard.tsx
│   │   ├── RecentActivity.tsx
│   │   ├── dashboard.graphql
│   │   └── dashboard.generated.tsx
│   │
│   ├── Bots/                     # Bots domain components
│   │   ├── BotsList.tsx         # Main list component
│   │   ├── BotCard.tsx          # Individual bot card
│   │   ├── BotDetail.tsx        # Bot detail view
│   │   ├── BotForm.tsx          # Create/Edit form
│   │   ├── BotStatusChip.tsx    # Status indicator
│   │   ├── bots.graphql
│   │   └── bots.generated.tsx
│   │
│   ├── Exchanges/                # Exchanges domain components
│   │   ├── ExchangesList.tsx
│   │   ├── ExchangeCard.tsx
│   │   ├── ExchangeForm.tsx
│   │   ├── SecretForm.tsx
│   │   ├── exchanges.graphql
│   │   └── exchanges.generated.tsx
│   │
│   ├── Strategies/               # Strategies domain components
│   │   ├── StrategiesList.tsx
│   │   ├── StrategyEditor.tsx
│   │   ├── strategies.graphql
│   │   └── strategies.generated.tsx
│   │
│   ├── Backtests/                # Backtests domain components
│   │   ├── BacktestsList.tsx
│   │   ├── BacktestForm.tsx
│   │   ├── BacktestResults.tsx
│   │   ├── backtests.graphql
│   │   └── backtests.generated.tsx
│   │
│   ├── Trades/                   # Trades domain components
│   │   ├── TradesList.tsx
│   │   ├── TradeDetail.tsx
│   │   ├── TradeChart.tsx
│   │   ├── trades.graphql
│   │   └── trades.generated.tsx
│   │
│   └── Runtimes/                 # Runtimes domain components
│       ├── RuntimesList.tsx
│       ├── RuntimeForm.tsx
│       ├── runtimes.graphql
│       └── runtimes.generated.tsx
│
├── pages/                         # Thin route handlers ONLY
│   ├── Dashboard/
│   │   └── DashboardPage.tsx     # Just: <Dashboard />
│   ├── Bots/
│   │   ├── BotsPage.tsx          # Just: <BotsList />
│   │   └── BotDetailPage.tsx     # Just: <BotDetail id={params.id} />
│   ├── Exchanges/
│   │   └── ExchangesPage.tsx     # Just: <ExchangesList />
│   └── ...
│
├── graphql/                       # GraphQL infrastructure
│   └── client.ts                  # Apollo Client setup
│
├── generated/                     # Shared types only
│   └── types.ts                   # Base GraphQL types
│
├── theme/                         # Theme configuration
│   └── theme.ts
│
└── App.tsx                        # App shell & routing
```

## Component Flow

```
User navigates → Page (route handler) → Component (reusable UI)
                                              ↓
                                        GraphQL hook (.generated)
                                              ↓
                                        Apollo Client
                                              ↓
                                        Backend API
```

## Example: Bots Feature

### Page Level (Thin)
```typescript
// pages/Bots/BotsPage.tsx
import { BotsList } from '../../components/Bots/BotsList';

export const BotsPage = () => {
  return <BotsList />;
};
```

### Component Level (Reusable)
```typescript
// components/Bots/BotsList.tsx
import { useGetBotsQuery } from './bots.generated';
import { BotCard } from './BotCard';

export const BotsList = ({ limit = 50 }) => {
  const { data, loading } = useGetBotsQuery({
    variables: { first: limit }
  });

  return (
    <Grid>
      {data?.bots?.edges?.map(edge => (
        <BotCard key={edge.node.id} bot={edge.node} />
      ))}
    </Grid>
  );
};
```

### Sub-Component (Reusable)
```typescript
// components/Bots/BotCard.tsx
import { Card } from '@mui/material';

export const BotCard = ({ bot }) => {
  return (
    <Card>
      <h3>{bot.name}</h3>
      <BotStatusChip status={bot.status} />
    </Card>
  );
};
```

## Benefits

### ✅ Component Reusability
- `BotsList` can be used in:
  - `/bots` page (full list)
  - Dashboard (recent bots)
  - Strategy detail (bots using this strategy)
  - Exchange detail (bots on this exchange)

### ✅ Clear Separation
- **Pages** = "What route shows what?"
- **Components** = "How does this feature work?"
- **GraphQL** = "What data do we need?"

### ✅ Easy Testing
- Test components in isolation
- Mock GraphQL with `MockBacktestRunner`
- No routing concerns in component tests

### ✅ Scalability
- Add new features by adding components
- Pages remain thin and simple
- Components can be composed

## GraphQL Co-location

Each component directory contains:
1. Component files (`.tsx`)
2. GraphQL queries (`.graphql`)
3. Generated hooks (`.generated.tsx`)

```
components/Bots/
├── BotsList.tsx              # Uses: useGetBotsQuery
├── BotDetail.tsx             # Uses: useGetBotQuery
├── BotForm.tsx               # Uses: useCreateBotMutation
├── bots.graphql              # Defines all queries/mutations
└── bots.generated.tsx        # Auto-generated hooks
```

## Adding a New Feature

1. **Create component directory**
   ```bash
   mkdir src/components/NewFeature
   ```

2. **Create GraphQL file**
   ```graphql
   # components/NewFeature/newFeature.graphql
   query GetItems {
     items { id name }
   }
   ```

3. **Run codegen**
   ```bash
   npm run codegen
   ```

4. **Create component**
   ```typescript
   // components/NewFeature/ItemsList.tsx
   import { useGetItemsQuery } from './newFeature.generated';

   export const ItemsList = () => {
     const { data } = useGetItemsQuery();
     return <div>{data?.items.map(...)}</div>;
   };
   ```

5. **Create page (if needed)**
   ```typescript
   // pages/NewFeature/NewFeaturePage.tsx
   import { ItemsList } from '../../components/NewFeature/ItemsList';

   export const NewFeaturePage = () => <ItemsList />;
   ```

6. **Add route**
   ```typescript
   // App.tsx
   <Route path="items" element={<NewFeaturePage />} />
   ```

## Anti-Patterns to Avoid

### ❌ DON'T: Put logic in pages
```typescript
// ❌ Bad: Logic in page
export const BotsPage = () => {
  const { data } = useGetBotsQuery();
  const [filter, setFilter] = useState('');
  // ... lots of logic
  return <div>...</div>;
};
```

```typescript
// ✅ Good: Logic in component
export const BotsPage = () => {
  return <BotsList />;  // Component handles everything
};
```

### ❌ DON'T: Put components in pages directory
```
pages/Bots/
├── BotsPage.tsx
├── BotCard.tsx        # ❌ Wrong place
└── BotForm.tsx        # ❌ Wrong place
```

```
components/Bots/       # ✅ Correct
├── BotsList.tsx
├── BotCard.tsx
└── BotForm.tsx

pages/Bots/
└── BotsPage.tsx       # Only route handler
```

### ❌ DON'T: Import components from other domains directly
```typescript
// ❌ Bad: Cross-domain coupling
import { BotCard } from '../Bots/BotCard';
import { ExchangeBadge } from '../Exchanges/ExchangeBadge';
```

```typescript
// ✅ Good: Use shared components or props
import { Card } from '../shared/Card';
// Or: Pass data as props from parent
```

## Summary

- **Pages** = Routing only
- **Components** = Reusable UI + Logic
- **GraphQL** = Co-located with components
- **Domain-based** = Organized by business feature
- **Composable** = Small components that work together
