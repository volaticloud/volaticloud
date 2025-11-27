# VolatiCloud Dashboard

Modern React dashboard for VolatiCloud trading bot platform.

## Features

- **Material-UI (MUI)** - Modern, professional UI components
- **Apollo GraphQL** - Type-safe API integration with code generation
- **React Router** - Client-side routing
- **Dark Mode** - Toggle between light and dark themes
- **Responsive** - Mobile-friendly design

## Tech Stack

- React 19 + TypeScript
- Vite (fast build tool)
- Apollo Client for GraphQL
- MUI v7 (Material-UI)
- GraphQL Code Generator
- React Router v7

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- VolatiCloud Go server running on `http://localhost:8080`

### Installation

```bash
cd dashboard
npm install
```

### Development

1. **Start the Go server** (from project root):

   ```bash
   cd ..
   ./bin/volaticloud server
   ```

2. **Generate GraphQL types** (run this whenever schema changes):

   ```bash
   npm run codegen
   ```

3. **Start development server**:

   ```bash
   npm run dev
   ```

4. Open http://localhost:5173 in your browser

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run codegen` - Generate GraphQL types from schema
- `npm run codegen:watch` - Watch mode for GraphQL codegen
- `npm run lint` - Run ESLint

## Project Structure

```
dashboard/
├── src/
│   ├── components/              # All reusable components (domain-based)
│   │   ├── Layout/             # Layout components
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── layout.graphql
│   │   │   └── layout.generated.tsx
│   │   ├── shared/             # Shared utility components
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── ErrorAlert.tsx
│   │   ├── Dashboard/          # Dashboard components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── dashboard.graphql
│   │   │   └── dashboard.generated.tsx
│   │   ├── Bots/               # Bots components
│   │   │   ├── BotsList.tsx
│   │   │   ├── BotCard.tsx
│   │   │   ├── bots.graphql
│   │   │   └── bots.generated.tsx
│   │   ├── Exchanges/          # Exchange components
│   │   ├── Strategies/         # Strategy components
│   │   ├── Backtests/          # Backtest components
│   │   ├── Trades/             # Trade components
│   │   └── Runtimes/           # Runtime components
│   │
│   ├── pages/                  # Thin route handlers ONLY
│   │   ├── Dashboard/
│   │   │   └── DashboardPage.tsx   # Just: return <Dashboard />
│   │   ├── Bots/
│   │   │   └── BotsPage.tsx        # Just: return <BotsList />
│   │   └── Exchanges/
│   │       └── ExchangesPage.tsx   # Just: return <ExchangesList />
│   │
│   ├── graphql/
│   │   └── client.ts           # Apollo Client setup
│   ├── generated/              # Shared GraphQL types
│   │   └── types.ts
│   ├── theme/
│   │   └── theme.ts
│   └── App.tsx                 # Routing
│
├── codegen.ts
└── package.json
```

**Key Architecture Decisions:**

1. **Pages = Routes** - Only routing, no logic
2. **Components = Reusable** - All UI logic lives here
3. **Domain-based** - Organized by business feature (Bots, Exchanges, etc.)
4. **Co-located GraphQL** - Each component directory has its `.graphql` and `.generated.tsx`

## GraphQL Integration

Each component/page has its own `.graphql` file containing queries and mutations. The GraphQL Code Generator creates type-safe React hooks from these files.

### Example Usage

**Step 1:** Create a `.graphql` file in your component directory:

```graphql
# components/Bots/bots.graphql
query GetBots($first: Int) {
  bots(first: $first) {
    edges {
      node {
        id
        name
        status
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

**Step 2:** Run codegen to generate hooks next to your `.graphql` file:

```bash
npm run codegen
```

This creates `components/Bots/bots.generated.tsx` with type-safe hooks.

**Step 3:** Import and use the generated hooks in your component:

```typescript
// components/Bots/BotsList.tsx
import { useGetBotsQuery, useStartBotMutation } from './bots.generated';

export const BotsList = () => {
  // Fully type-safe query hook
  const { data, loading, error } = useGetBotsQuery({
    variables: { first: 10 }
  });

  // Fully type-safe mutation hook
  const [startBot] = useStartBotMutation();

  const handleStart = async (id: string) => {
    await startBot({ variables: { id } });
  };

  // TypeScript knows the exact shape of data.bots
  const bots = data?.bots?.edges?.map(e => e?.node) || [];

  return (
    <div>
      {bots.map(bot => (
        <div key={bot.id}>{bot.name}</div>
      ))}
    </div>
  );
};
```

**Benefits:**

- ✅ Type-safe hooks generated per component
- ✅ Co-located with component code
- ✅ No global imports needed
- ✅ Full IntelliSense support
- ✅ Automatic refetch and cache updates

## Environment Variables

Create a `.env` file (copy from `.env.example`):

```
VITE_GRAPHQL_URL=http://localhost:8080/query
```

## Features Roadmap

### Implemented

- ✅ Project setup with Vite + React + TypeScript
- ✅ Apollo Client configuration
- ✅ MUI theme with dark mode
- ✅ Dashboard layout (Sidebar, Header)
- ✅ GraphQL Code Generator setup
- ✅ Basic routing structure
- ✅ Placeholder pages for all sections

### TODO

- [ ] Implement Bots list with real data
- [ ] Bot detail page with metrics
- [ ] Bot lifecycle controls (start/stop/restart)
- [ ] Real-time bot status updates
- [ ] Exchange management UI
- [ ] API credentials form
- [ ] Strategy editor with syntax highlighting
- [ ] Backtest runner and results
- [ ] Trade history table with filtering
- [ ] Performance charts
- [ ] Runtime configuration UI

## Contributing

When adding new features:

1. Create GraphQL queries in component's `.graphql` file
2. Run `npm run codegen` to generate types
3. Use generated hooks in your components
4. Follow Material-UI design patterns
5. Ensure responsive design
