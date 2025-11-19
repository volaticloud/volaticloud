# VolatiCloud Project Notes

## Git Rules

1. **Never add Claude ad into the commit message**

## Project Structure

Project follows Go best practices with `internal` directory pattern:
- `internal/ent/` - ENT ORM schemas and generated code
- `internal/graph/` - GraphQL schemas and resolvers
- `cmd/server/` - Server entrypoint
- `internal/enum/` - Custom enum types with GraphQL marshalers

All imports use `volaticloud/internal/ent` and `volaticloud/internal/graph`.

## GraphQL Implementation

Successfully integrated ENT ORM with GraphQL using gqlgen.

### Key Configuration

1. **ENT GraphQL Extension** (`internal/ent/entc.go`):
   - Uses `entgql.NewExtension()` with schema generator
   - Generates schema to `../graph/ent.graphql`
   - Integrates with gqlgen via `../../gqlgen.yml`

2. **gqlgen Configuration** (`gqlgen.yml`):
   - Schema files: `internal/graph/schema.graphqls` (custom scalars) and `internal/graph/ent.graphql` (generated)
   - Time scalar mapped to `github.com/99designs/gqlgen/graphql.Time` (NOT `time.Time`)
   - Autobind all ENT packages for automatic type mapping
   - Node interface mapped to `volaticloud/internal/ent.Noder`

3. **Build Process**:
   ```bash
   make generate  # Runs ENT generation + gqlgen generation
   make build     # Builds the binary
   ```

### GraphQL API Endpoints

Server runs on port 8080 by default:
- GraphQL Playground: `http://localhost:8080/`
- GraphQL API: `http://localhost:8080/query`
- Health Check: `http://localhost:8080/health`

### Available Queries

- `exchanges` - List all exchanges
- `bots` - List all trading bots with `where` filters (e.g., `bots(where: {id: $id}, first: 1)`)
- `strategies` - List all strategies
- `backtests` - List all backtests
- `trades` - List all trades
- `node(id: ID!)` - Fetch single node by ID
- `nodes(ids: [ID!]!)` - Fetch multiple nodes by IDs

All list queries support:
- Relay-style pagination with `first`, `last`, `after`, `before` arguments
- ENT where filters enabled via `entgql.WithWhereInputs(true)` in entc.go

### Available Mutations

All entities support full CRUD operations:

**Exchange:**
- `createExchange(input: CreateExchangeInput!)` - Create new exchange with typed config
- `updateExchange(id: ID!, input: UpdateExchangeInput!)` - Update exchange
- `deleteExchange(id: ID!)` - Delete exchange

Exchange configs are stored directly in the Exchange entity using typed configs via gqlgen autobind (see internal/exchange/config.go)

**Strategy:**
- `createStrategy(input: CreateStrategyInput!)` - Create trading strategy
- `updateStrategy(id: ID!, input: UpdateStrategyInput!)` - Update strategy (creates new version)
- `deleteStrategy(id: ID!)` - Delete strategy

**Strategy Queries:**
- `latestStrategies` - List only the latest versions of strategies (default dashboard view)
- `strategyVersions(name: String!)` - Get all versions of a strategy by name

### Strategy Versioning

**Updated: 2025-11-07** - Implemented immutable strategy versioning with auto-versioning on updates and backtest creation.

Strategies use an immutable versioning system where updates create new versions rather than modifying existing strategies. This ensures:
- Immutable snapshots for reproducibility
- Safe backtest history (strategies can't change after backtesting)
- Explicit bot upgrades (bots stay on their strategy version)
- Complete version lineage tracking

**Architecture:**

1. **Linear Parent-Child Versioning**: Each strategy version points to its parent via `parent_id`, creating a version chain (v1 → v2 → v3)

2. **Version Fields**:
   - `parent_id` (UUID, nullable) - Points to parent version (null for v1)
   - `version_number` (int) - Auto-incremented version number
   - `is_latest` (bool) - Only one version per strategy name can be latest
   - Unique index on (name, version_number)

3. **Auto-Versioning Triggers**:
   - **On updateStrategy**: Always creates new version with incremented version_number
   - **On createBacktest**: If strategy already has backtest(s), creates new version first

4. **Behavior**:
   - `createStrategy`: Creates v1 with `version_number=1`, `is_latest=true`
   - `updateStrategy`: Marks old version as `is_latest=false`, creates new version with incremented number
   - `createBacktest`: Checks if strategy has existing backtests, auto-versions if needed
   - Bots stay pinned to their strategy version (no automatic upgrades)

5. **Transaction Handling** (`internal/graph/tx.go`):
   - **Fixed: 2025-11-11** - `updateStrategy` now uses database transactions to ensure atomicity
   - All strategy update operations wrapped in `WithTx` helper following ENT best practices
   - Transaction flow:
     1. Load existing strategy
     2. Mark old version as `is_latest=false`
     3. Create new version with incremented `version_number`
     4. Save new version (triggers validation hooks)
   - **Rollback behavior**: If validation fails at step 4, entire transaction rolls back
   - **Critical fix**: Prevents bug where validation errors left all strategies with `is_latest=0`
   - Uses panic recovery and proper error wrapping per ENT documentation
   - See `internal/graph/tx.go:23` for `WithTx` helper implementation
   - See `internal/graph/schema.resolvers.go:67` for `UpdateStrategy` implementation

**GraphQL Queries:**
```graphql
# Get only latest versions (dashboard default)
query GetLatestStrategies {
  latestStrategies(first: 50) {
    edges {
      node {
        id
        name
        versionNumber
        isLatest
        code
      }
    }
  }
}

# Get all versions of a strategy
query GetStrategyVersions($name: String!) {
  strategyVersions(name: $name) {
    id
    versionNumber
    isLatest
    createdAt
    bots { totalCount }
    backtests { totalCount }
  }
}
```

**Important Implementation Details:**

**Schema Edge Configuration** (`internal/ent/schema/strategy.go`):
- Strategy has TWO edges to Backtest:
  1. `backtest` (singular, one-to-one) - line 67-69
  2. `backtests` (plural, one-to-many) - line 71-72
- Backtest schema only references the **plural** edge: `.Ref("backtests")`
- **Always use the plural edge (`WithBacktests()`)** when checking for existing backtests
- The singular edge is never populated and will always be nil

**Mutation Behavior** (`internal/graph/schema.resolvers.go:514-548`):
```go
// CreateBacktest checks plural edge for auto-versioning
existingStrategy, _ := r.client.Strategy.Query().
    Where(strategy.ID(strategyID)).
    WithBacktests().  // Uses plural edge
    Only(ctx)

if len(existingStrategy.Edges.Backtests) > 0 {
    // Auto-create new version
    newVersion, _ := r.createStrategyVersion(ctx, existingStrategy)
    strategyID = newVersion.ID
}
```

**Test Coverage** (`internal/graph/strategy_versioning_test.go`):
- 8 tests covering all versioning scenarios
- 100% test coverage on versioning logic
- Key tests:
  - `TestUpdateStrategy_CreatesNewVersion` - Verifies version creation
  - `TestCreateBacktest_AutoVersionsWhenBacktestExists` - Tests auto-versioning
  - `TestLatestStrategies_ReturnsOnlyLatest` - Validates latest-only queries
  - `TestStrategyVersions_ReturnsAllVersionsByName` - Tests version history

**Dashboard Integration:**
- `StrategiesList.tsx` - Shows only latest versions with version badges
- `StrategyDetail.tsx` - Displays version history with expandable section
- Version badges show current version number (e.g., "v2")
- "Latest" indicator for current version
- Version history table with navigation to older versions

**Bot:**
- `createBot(input: CreateBotInput!)` - Create trading bot
- `updateBot(id: ID!, input: UpdateBotInput!)` - Update bot
- `deleteBot(id: ID!)` - Delete bot

**Backtest:**
- `createBacktest(input: CreateBacktestInput!)` - Create backtest task
- `updateBacktest(id: ID!, input: UpdateBacktestInput!)` - Update backtest
- `deleteBacktest(id: ID!)` - Delete backtest

**Trade:**
- `createTrade(input: CreateTradeInput!)` - Create trade record
- `updateTrade(id: ID!, input: UpdateTradeInput!)` - Update trade
- `deleteTrade(id: ID!)` - Delete trade

### Typed Config Pattern (Exchange & Runner)

For entities that need dynamic, type-safe configuration (like Exchange and BotRunner), we use the gqlgen autobind pattern:

1. **Define Go structs** in a dedicated package (e.g., `internal/exchange/config.go`):
   ```go
   type BinanceConfigInput struct {
       APIKey    string `json:"api_key"`
       APISecret string `json:"api_secret"`
   }

   type ExchangeConfigInput struct {
       Binance   *BinanceConfigInput `json:"binance,omitempty"`
       Coinbase  *PassphraseExchangeConfigInput `json:"coinbase,omitempty"`
       // ... other exchanges
   }
   ```

2. **Add to gqlgen autobind** in `gqlgen.yml`:
   ```yaml
   autobind:
     - volaticloud/internal/exchange
   ```

3. **Define matching GraphQL types** in `schema.graphqls`:
   ```graphql
   input BinanceConfigInput {
     apiKey: String!
     apiSecret: String!
   }

   input ExchangeConfigInput {
     binance: BinanceConfigInput
     coinbase: PassphraseExchangeConfigInput
     # ... other exchanges
   }
   ```

4. **Use in ENT schema** with custom type annotation:
   ```go
   field.JSON("config", map[string]interface{}{}).
       Optional().
       Annotations(
           entgql.Type("ExchangeConfigInput"),
           entgql.Skip(entgql.SkipType),
       )
   ```

5. **Create conversion helper** (e.g., `internal/graph/exchange_config.go`) to convert typed input to map for storage

6. **Implement config resolvers** in `ent.resolvers.go` to handle CreateInput and UpdateInput config fields

This pattern provides:
- Type-safe configs in both backend and frontend
- Dynamic forms in the UI based on selected type
- Validation at compile time
- No manual GraphQL type writing needed

### Important Notes

- JSON fields in ENT schemas require `entgql.Skip()` annotations with custom type
- All ENT enum types need GraphQL marshaling methods (`MarshalGQL`/`UnmarshalGQL`)
- GraphQL resolvers are mostly auto-generated by ENT - minimal manual implementation needed
- Config resolvers must be manually implemented to convert typed inputs to maps
- Database defaults to SQLite at `./data/volaticloud.db`

## Testing

The project has comprehensive test coverage for GraphQL resolvers.

### Running Tests

```bash
make test         # Run all tests with coverage report
make coverage     # Run tests and open HTML coverage report in browser
```

### Test Structure

- `internal/graph/*_test.go` - GraphQL resolver tests for each entity
- `internal/graph/resolver_test.go` - Test infrastructure setup
- `internal/graph/test_helpers.go` - Helper functions for tests

### Test Coverage

**Real Test Coverage: 91.9%** (excluding all generated code and schema definitions)

Current GraphQL resolver coverage:
- Query resolvers: 100% (6/8 tested - Node/Nodes intentionally excluded)
- Mutation resolvers: 97% (17/18 at 100% - CreateBacktest uses ENT client directly)

Coverage reports are generated automatically:
- `coverage.out` - Raw coverage data (includes all code)
- `coverage.filtered.out` - Filtered coverage (excludes generated code)
- `coverage.html` - Interactive HTML report (based on filtered data)

The test command automatically filters out:
- All ENT-generated entity files
- All CRUD operation files (*_create.go, *_update.go, *_delete.go, *_query.go)
- GraphQL generated code (generated.go)
- ENT schema definitions (schema/*.go)
- Enum marshaling code
- Server main.go

This gives you accurate coverage metrics for your actual business logic and resolvers.

### Writing Tests

Use the test infrastructure in `resolver_test.go`:
```go
func TestMyEntity(t *testing.T) {
    resolver := setupTestResolver(t)
    mutationResolver := resolver.Mutation()
    queryResolver := resolver.Query()

    // Use ptr() helper for pointer fields
    // Use ctx() helper for context
}
```

### Troubleshooting

If generation fails:
1. Ensure all JSON fields have `entgql.Skip()` annotations
2. Check that enum types implement GraphQL marshalers
3. Verify `graph/model/models.go` placeholder exists
4. Confirm Time scalar uses `github.com/99designs/gqlgen/graphql.Time`

## React Dashboard

A modern React dashboard is available in the `dashboard/` directory.

### Tech Stack
- React 19 + TypeScript
- Vite for fast development
- Material-UI (MUI) v7 for UI components
- Apollo Client for GraphQL integration
- GraphQL Code Generator for type-safe queries
- React Router v7 for navigation

### Getting Started

```bash
cd dashboard
npm install
npm run codegen  # Generate GraphQL types (requires backend server running)
npm run dev      # Start development server
```

Dashboard runs on http://localhost:5173

### Architecture

**Per-Component Code Generation:**
GraphQL operations are generated next to their component files:
- GraphQL files: `src/components/*/[feature].graphql` (e.g., `bots.graphql`, `backtests.graphql`)
- Generated hooks: `src/components/*/[feature].generated.ts` (co-located with components)
- Shared types: `src/generated/types.ts` (centralized base types)
- Codegen config: `codegen.ts` uses **near-operation-file preset** with local schema files

**Important**: The codegen uses local schema files (`internal/graph/ent.graphql` and `internal/graph/schema.graphqls`) instead of HTTP introspection. This approach:
1. Avoids authentication issues (backend requires auth for all requests including introspection)
2. Works offline without requiring the server to be running
3. Guarantees schema consistency with the backend

**Workflow after schema changes:**
```bash
# Backend changes
make generate  # Regenerate ENT and GraphQL schemas

# Frontend codegen (no server required)
cd dashboard
npm run codegen  # Uses local schema files from ../internal/graph/
```

**Usage Example:**
```typescript
// Import from co-located generated file
import { useGetBotsQuery, useStartBotMutation } from './bots.generated';

const { data, loading } = useGetBotsQuery({ variables: { first: 10 } });
const [startBot] = useStartBotMutation();
```

All GraphQL operation files use the `.graphql` extension. Generated `.generated.ts` files are git-ignored.

### Responsive Layout

**Mobile-First Design:**
The dashboard features a fully responsive layout that works on mobile, tablet, and desktop:

**Components:**
- `Logo` (`src/components/shared/Logo.tsx`) - Reusable logo component with gradient text
  - Supports `variant` (full/icon) and `size` (small/medium/large) props
  - Used in both Sidebar and Header
- `Sidebar` (`src/components/Layout/Sidebar.tsx`) - Responsive navigation drawer
  - Desktop: Permanent drawer (always visible)
  - Mobile: Temporary drawer (swipeable, triggered by menu button)
  - Auto-closes after navigation on mobile
- `Header` (`src/components/Layout/Header.tsx`) - App bar with actions
  - Shows hamburger menu button on mobile
  - Displays logo on mobile, hidden on desktop (sidebar shows it)
  - Theme toggle, notifications, and settings buttons
- `DashboardLayout` (`src/components/Layout/DashboardLayout.tsx`) - Main layout container
  - Manages mobile drawer open/close state
  - Responsive padding and spacing

**Responsive Breakpoints:**
- `xs` (0-599px): Mobile - temporary drawer, compact spacing
- `sm` (600px+): Desktop - permanent drawer, full spacing

### Key Features
- Dark/Light mode toggle
- Fully responsive layout (mobile, tablet, desktop)
- Type-safe GraphQL queries with generated React hooks
- Component-based architecture with reusable components
- Modern gradient logo design

See `dashboard/README.md` for detailed documentation.

## Bot Runtime and Freqtrade Configuration

### Bot Lifecycle

Bots run in Docker containers with Freqtrade. The lifecycle is:

1. **Create Bot** - Creates container and generates config files in `/tmp/volaticloud-configs/{botID}/`
2. **Start Bot** - Starts the container (reuses existing config files)
3. **Stop Bot** - Stops the container (keeps config files)
4. **Delete Bot** - Removes container and cleans up config files

**Important**: Config files are generated during bot creation, not on start. To apply config changes, you must delete and recreate the bot.

### Config File Generation

The system generates three layered config files for each bot:

1. `config.exchange.json` - Exchange credentials and pair whitelist
2. `config.strategy.json` - Strategy-specific settings (optional)
3. `config.bot.json` - Bot-specific overrides (with dry_run field auto-injected)

Config files are automatically mounted as read-only volumes into the Freqtrade container.

### Automatic dry_run Field Injection

**Fixed in helpers.go** - The `buildBotSpec` function automatically adds the `dry_run` field based on bot mode:

```go
// Prepare bot config and ensure dry_run field is set
botConfig := b.Config
if botConfig == nil {
    botConfig = make(map[string]interface{})
}

// Add dry_run field based on bot mode
botConfig["dry_run"] = (b.Mode == enum.BotModeDryRun)
```

This ensures Freqtrade always receives the required `dry_run` field.

### Bot Config Validation

**Implemented in helpers.go** - The `validateFreqtradeConfig` function validates bot configurations before creation or update:

```go
// Required fields:
- stake_currency (string)
- stake_amount (number)
- exit_pricing (object with price_side, use_order_book, order_book_top)
- entry_pricing (object with price_side, use_order_book, order_book_top)
```

Validation runs on:
- `createBot` mutation - Validates before database save
- `updateBot` mutation - Validates config changes

**Error Handling:**
- GraphQL errors are returned with descriptive messages
- Apollo Client automatically provides errors to dashboard via `error.message`
- No additional dashboard code needed for error display

**Example Complete Bot Config:**
```json
{
  "stake_currency": "USDT",
  "stake_amount": 10,
  "dry_run_wallet": 1000,
  "timeframe": "5m",
  "max_open_trades": 3,
  "unfilledtimeout": { "entry": 10, "exit": 30 },
  "exit_pricing": {
    "price_side": "other",
    "use_order_book": true,
    "order_book_top": 1,
    "price_last_balance": 0.0
  },
  "entry_pricing": {
    "price_side": "other",
    "use_order_book": true,
    "order_book_top": 1,
    "price_last_balance": 0.0,
    "check_depth_of_market": { "enabled": false, "bids_to_ask_delta": 1 }
  },
  "order_types": {
    "entry": "limit",
    "exit": "limit",
    "stoploss": "market",
    "stoploss_on_exchange": false,
    "stoploss_on_exchange_interval": 60
  },
  "order_time_in_force": { "entry": "GTC", "exit": "GTC" },
  "pairlists": [{ "method": "StaticPairList" }],
  "exchange": {
    "pair_whitelist": ["BTC/USDT", "ETH/USDT", "BNB/USDT"]
  }
}
```

### Testing Bot Flow

Test commands saved in /tmp/:
- `create_simple_strategy.graphql` - Creates SimpleTestStrategy
- `create_valid_bot.graphql` - Creates bot with required fields only
- `create_complete_bot.graphql` - Creates bot with all Freqtrade fields
- `start_working_bot.graphql` - Starts bot by ID

Always ensure:
1. Exchange has valid credentials in config
2. Strategy name matches the Python class name
3. Bot mode is set correctly (dry_run or live)
4. Bot config includes all required Freqtrade fields (validated automatically)

## Backtesting and Historical Data

### Data Download and Format

**Default Data Format**: JSON (configured in `internal/monitor/data_download.go:174`)

Data is downloaded using the `download-data` command with the following defaults:
- Format: `json` (for transparency and debugging)
- Directory structure: `/freqtrade/user_data/data/{exchange}/{tradingMode}/`
  - Example: `/freqtrade/user_data/data/okx/spot/ETH_USDT-1m.json`
- Trading mode subdirectories are automatically created based on `tradingMode` config

**Why JSON Format:**
- Human-readable for debugging and data inspection
- Transparent - can easily verify downloaded historical data
- Backtesting explicitly configured to use JSON via `--data-format-ohlcv json` command flag
- Strategy configs automatically set `dataformat_ohlcv: "json"` (see `internal/graph/helpers.go:188`)

**Data Download Configuration:**
```go
// internal/monitor/data_download.go:174
args := []string{
    "download-data",
    "--exchange", exchange,
    "--pairs", pairsPattern,
    "--days", days,
    "--data-format-ohlcv", "json",  // JSON for transparency
    "--trading-mode", tradingMode,   // Creates spot/futures subdirectory
}
```

### Backtesting

Backtests run in one-time Docker containers (non-persistent) that:
1. Mount the data volume (`volaticloud-freqtrade-data`)
2. Use downloaded historical data
3. Execute the strategy against historical candles
4. Generate performance metrics

**Parallel Backtest Volume Mount Strategy:**

**Updated: 2025-11-18** - Implemented mount-based strategy for parallel backtesting support.

Each backtest gets an isolated workspace while sharing historical data:

```
Architecture:
  --userdir /freqtrade/user_data/{backtestID}
      ↓
  Freqtrade auto-resolves data as: {userdir}/data/
      ↓
  Mount shared data to: /freqtrade/user_data/{backtestID}/data/
```

**Implementation** (`internal/runner/docker_backtest.go:122-138`):
```go
mounts := []mount.Mount{
    {
        Type:     mount.TypeVolume,
        Source:   configPaths.volumeName,
        Target:   "/freqtrade/user_data",
        ReadOnly: false, // Must be writable for results
    },
    {
        Type:   mount.TypeVolume,
        Source: "volaticloud-freqtrade-data",
        // Mount shared data to backtest-specific data directory
        // When using --userdir, Freqtrade looks for data at {userdir}/data/
        Target: fmt.Sprintf("/freqtrade/user_data/%s/data", spec.ID),
    },
}
```

**Command Structure** (`internal/runner/docker_backtest.go:549-558`):
```go
cmd := []string{"backtesting"}
cmd = append(cmd, "--strategy", spec.StrategyName)
// Use --userdir to isolate each backtest's results (logs, backtest_results)
// Freqtrade automatically resolves data directory as {userdir}/data/
cmd = append(cmd, "--userdir", fmt.Sprintf("/freqtrade/user_data/%s", spec.ID))
cmd = append(cmd, "--data-format-ohlcv", "json")
// NO --datadir flag - Freqtrade automatic resolution handles it
```

**Benefits:**
- ✅ **Parallel Support**: Each backtest has isolated userdir, no path conflicts
- ✅ **Shared Data**: All backtests access same historical data volume (single download)
- ✅ **Clean Architecture**: Mount-based strategy, not config-based
- ✅ **Automatic Resolution**: No --datadir override needed, Freqtrade handles it
- ✅ **Workspace Isolation**: Configs, results, logs are per-backtest

**Test Coverage:** 100% on `buildBacktestCommand` function
- Test file: `internal/runner/docker_backtest_mount_test.go`
- 7 comprehensive tests covering mount strategy, parallel isolation, and path alignment

**Backtest Configuration:**
```json
{
  "timeframe": "1h",
  "timerange": "20240101-20241101",
  "pairs": ["BTC/USDT"],
  "stake_amount": 100,
  "stake_currency": "USDT",
  "max_open_trades": 3,
  "entry_pricing": { "price_side": "same", "use_order_book": false },
  "exit_pricing": { "price_side": "same", "use_order_book": false }
}
```

**Key Implementation Files:**
- `internal/runner/docker_backtest.go` - Backtest execution
- `internal/graph/helpers.go:buildBacktestSpec()` - Config preparation
- `internal/monitor/backtest_monitor.go` - Automatic container cleanup
- Volume mount ensures data access without manual path configuration

**Container Lifecycle:**
- Backtest containers use `AutoRemove: false` to allow result retrieval after completion
- The backtest monitor automatically cleans up containers after results are saved
- Monitor runs every 30 seconds and calls `DeleteBacktest()` after status changes to completed/failed
- Manual cleanup: `docker ps -a --filter "label=volaticloud.task.type=backtest" --format "{{.ID}}" | xargs docker rm -f`

**Data Mount Strategy:**
**Updated: 2025-11-18** - Simplified data mounting to use Freqtrade's default location.

Backtests mount the data volume to Freqtrade's default data directory:
- Mount: `volaticloud-freqtrade-data` → `/freqtrade/user_data/data`
- No `--datadir` override needed - uses Freqtrade's natural data discovery
- Automatic directory structure: `/freqtrade/user_data/data/{exchange}/{trading_mode}/`
- Command flag: `--data-format-ohlcv json` for explicit format specification

This approach ensures Freqtrade finds data files without custom path configuration:
```go
// internal/runner/docker_backtest.go:124-136 (volume mount)
mounts := []mount.Mount{
    {
        Type:   mount.TypeVolume,
        Source: "volaticloud-freqtrade-data",
        Target: "/freqtrade/user_data/data", // Default location
    },
}

// internal/runner/docker_backtest.go:538-556 (command builder)
cmd := []string{
    "backtesting",
    "--strategy", strategyName,
    "--userdir", fmt.Sprintf("/freqtrade/user_data/%s", backtestID),
    "--data-format-ohlcv", "json",  // Explicit format
    // No --datadir override - uses default location
}
```

### Backtest Result Types (Hybrid Approach)

**Problem:** Freqtrade backtest results contain 103+ fields. Defining all fields in GraphQL schema creates maintenance overhead.

**Solution:** Hybrid type system combining typed summaries with flexible JSON.

**Architecture:**
```
Freqtrade Result (ZIP) → Parse JSON → Extract Summary → Store Both
                                           ↓
                              summary (typed) + result (full JSON)
                                           ↓
                              GraphQL serves both fields
                                           ↓
                              Dashboard uses typed helpers
```

**Backend Components:**

1. **Go Struct** (`internal/backtest/summary.go`):
   ```go
   type BacktestSummary struct {
       StrategyName    string   `json:"strategyName"`
       TotalTrades     int      `json:"totalTrades"`
       Wins            int      `json:"wins"`
       Losses          int      `json:"losses"`
       ProfitTotalAbs  float64  `json:"profitTotalAbs"`
       // ... 15 more key metrics
   }
   ```

2. **GraphQL Type** (`internal/graph/schema.graphqls`):
   ```graphql
   # Mapped to internal/backtest.BacktestSummary via gqlgen autobind
   type BacktestSummary {
     strategyName: String!
     totalTrades: Int!
     # ... fields match Go struct
   }

   extend type Backtest {
     summary: BacktestSummary  # Typed access
     result: Map                # Full JSON
   }
   ```

3. **Auto-Extraction** (`internal/monitor/backtest_monitor.go`):
   - When backtest completes, `ExtractSummaryFromResult()` parses full JSON
   - Extracts 20 key metrics into typed `BacktestSummary`
   - Stores both `summary` (typed) and `result` (full JSON) in database

4. **GraphQL Resolver** (`internal/graph/ent.resolvers.go`):
   ```go
   func (r *backtestResolver) Summary(ctx context.Context, obj *ent.Backtest) (*backtest.BacktestSummary, error) {
       // Deserialize summary map to typed struct
       // Returns nil if no summary available (not an error)
   }
   ```

**Frontend Components:**

1. **TypeScript Interfaces** (`dashboard/src/types/freqtrade.ts`):
   ```typescript
   export interface FreqtradeBacktestResult {
     strategy: Record<string, StrategyResult>;  // Dynamic strategy name
   }

   export interface StrategyResult {
     total_trades: number;
     trades: Trade[];
     // ... 100+ fields documented
   }

   // Helper functions
   export function extractStrategyData(result: any): StrategyResult | null
   export function extractTrades(result: any): Trade[]
   ```

2. **Usage in Components** (`dashboard/src/components/Backtests/BacktestDetail.tsx`):
   ```typescript
   import { extractStrategyData, extractTrades } from '../../types/freqtrade';

   // Type-safe extraction
   const strategyData = extractStrategyData(backtest.result);
   const trades = extractTrades(backtest.result);

   // Access metrics safely
   const totalTrades = strategyData?.total_trades || 0;
   ```

**Benefits:**
- ✅ **Type safety** for common metrics via `BacktestSummary`
- ✅ **Flexibility** for advanced use cases via full `result` JSON
- ✅ **No schema overhead** - only 20 fields vs 103
- ✅ **Future-proof** - Freqtrade changes won't break backend
- ✅ **Auto-mapping** - gqlgen autobind connects Go struct to GraphQL type
- ✅ **Single source of truth** - Go struct JSON tags define field names

**Test Coverage:**
- `internal/backtest/summary_test.go` - 96.4% coverage
- 11 test cases covering extraction, type conversion, edge cases

**Important Notes:**
- gqlgen is **schema-first**: GraphQL types must be manually defined
- `autobind` feature only **maps** types, doesn't **generate** them
- This is standard practice for gqlgen projects
- Full result JSON remains available for power users

---

## Testing & Code Quality

### Running Tests

```bash
# Run all tests with coverage
make test

# Run specific test file
go test -v ./internal/graph -run TestValidateFreqtradeConfig

# Run with coverage for specific package
go test -v ./internal/graph -cover -coverprofile=coverage.out

# View coverage details
go tool cover -func=coverage.out

# Generate HTML coverage report
go tool cover -html=coverage.out -o coverage.html
```

### Test Coverage

**Validation Functions (`internal/graph/helpers.go`):** 100%
- ✅ `validateFreqtradeConfig` - 17 test cases
- ✅ `extractExchangeCredentials` - 12 test cases
- ✅ `buildBotSpec` - 6 test cases

**Test File:** `internal/graph/helpers_test.go`

**Data Download Functions (`internal/monitor/data_download.go`):** 100%
- ✅ Command builder logic - 4 config scenarios (spot, futures, defaults, type handling)
- ✅ Feather format validation - Critical regression test
- ✅ Docker volume constants
- ✅ Trading mode defaults
- ✅ Days type conversion (int/float64)

**Test File:** `internal/monitor/data_download_test.go`

**Backtest Summary Functions (`internal/backtest/summary.go`):** 96.4%
- ✅ `ExtractSummaryFromResult` - 11 test scenarios
- ✅ Type conversion helpers (getInt, getFloat, getFloatPtr, getString)
- ✅ Edge cases: nil/empty results, invalid timestamps, type conversions
- ✅ Multiple strategies handling
- ✅ Optional fields (nil vs zero values)

**Test File:** `internal/backtest/summary_test.go`

**Key Test Categories:**
1. **Missing Required Fields** - Validates all required field checks
2. **Invalid Types** - Ensures type validation works (string/number/object)
3. **Nested Object Validation** - Validates exit_pricing and entry_pricing structures
4. **Config Mutation** - Regression test for map mutation bug
5. **Edge Cases** - Nil configs, empty strings, invalid credentials

### Known Issues (See TODO.md for complete list)

**Critical (Fixed):**
- ✅ Config mutation bug in `buildBotSpec` - FIXED (2025-10-23)

**Pending:**
- ⏳ Range validation for numeric fields (stake_amount > 0)
- ⏳ Enhanced credential validation (detect placeholders)
- ⏳ Container cleanup on DB failures
- ⏳ Prevent config updates on running bots

See `/TODO.md` for complete issue tracking and sprint planning.

### Code Analysis

**Full Analysis Report:** `/tmp/code_analysis_report.md`

**Summary of Issues:**
- Total Issues: 19
- Critical: 3 (1 fixed, 2 pending)
- High: 2
- Medium: 7
- Low: 7

**Running Code Analysis:**
```bash
# View comprehensive analysis
cat /tmp/code_analysis_report.md

# View TODO list
cat TODO.md
```

### Writing New Tests

When adding new validation or helper functions, follow the test pattern in `helpers_test.go`:

```go
func TestYourFunction(t *testing.T) {
    tests := []struct {
        name    string
        input   YourInputType
        wantErr bool
        errMsg  string
    }{
        {
            name:    "descriptive test case name",
            input:   ...,
            wantErr: true,
            errMsg:  "expected error substring",
        },
        // More test cases...
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result, err := YourFunction(tt.input)
            if tt.wantErr {
                assert.Error(t, err)
                if tt.errMsg != "" {
                    assert.Contains(t, err.Error(), tt.errMsg)
                }
            } else {
                assert.NoError(t, err)
                // Assert on result...
            }
        })
    }
}
```

### Continuous Integration

Before committing:
1. Run `make test` - Ensure all tests pass
2. Run `make coverage` - Check coverage hasn't decreased
3. Review TODO.md - Update any completed tasks
4. Run linters if configured

### Best Practices

1. **100% Coverage Goal** - Aim for 100% coverage on business logic
2. **Table-Driven Tests** - Use test tables for multiple scenarios
3. **Regression Tests** - Add tests for every bug fix
4. **Error Path Testing** - Test all error conditions
5. **Edge Case Coverage** - Test nil, empty, boundary values
## JSON Schema Validation

**Updated: 2025-10-27** - Implemented automatic JSON schema validation using the official Freqtrade schema.

### Implementation

Configs are validated against the official Freqtrade JSON schema from `https://schema.freqtrade.io/schema.json`.

**Files:**
- `internal/graph/schema_validator.go` - Bot config validation
- `internal/exchange/validator.go` - Exchange config validation
- `internal/ent/schema/exchange_hooks.go` - ENT hooks for exchange validation
- Uses `github.com/xeipuuv/gojsonschema` library

**Validation happens:**

**Bot Configs:**
- `updateBot` mutation - Validates config changes using `validateFreqtradeConfigWithSchema()`
- Validates against complete Freqtrade schema

**Exchange Configs:**
- `createExchange` mutation - Validates via ENT hooks
- `updateExchange` mutation - Validates via ENT hooks
- Uses `exchange.ValidateConfigWithSchema()` which validates exchange-specific fields
- Wraps config in minimal Freqtrade structure for schema validation
- Filters validation errors to only show exchange-related issues

**Benefits:**
1. Automatic validation against official Freqtrade requirements
2. Schema is fetched once and cached
3. Clear, descriptive error messages from the schema
4. No manual validation code to maintain
5. ENT hooks ensure validation happens before database save

**Architecture:**
- Exchange configs are validated at the ENT layer via hooks
- Bot configs are validated at the resolver layer
- Both use the same underlying Freqtrade JSON schema
- Exchange validation wraps partial config to satisfy schema requirements

## Bot Monitoring and Metrics

**Updated: 2025-10-30** - Implemented universal connection strategy for bot monitoring across all deployment scenarios.

### Architecture

The monitor system periodically checks bot status and fetches metrics from Freqtrade API:

**Components:**
- `internal/monitor/bot_monitor.go` - Core monitoring logic
- `internal/monitor/coordinator.go` - Distributed coordination via etcd
- `internal/freqtrade/bot_client.go` - Freqtrade REST API client

**Monitor Interval:** 30 seconds (configurable)

### Universal Connection Strategy

**Problem:** Container IPs not accessible from host on macOS/Windows Docker Desktop

**Solution:** Implemented fallback mechanism with automatic detection:

```go
// Try container IP first (2-second timeout)
if status.IPAddress != "" {
    containerCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
    client := freqtrade.NewBotClientFromContainerIP(status.IPAddress, apiPort, ...)
    profit, err = client.GetProfit(containerCtx)
    if err == nil {
        goto processMetrics  // Success!
    }
    log.Printf("Container IP (%s) failed, trying localhost fallback", status.IPAddress)
}

// Fallback to localhost:hostPort
if status.HostPort > 0 {
    localhostURL := fmt.Sprintf("http://localhost:%d", status.HostPort)
    client := freqtrade.NewBotClient(localhostURL, ...)
    profit, err = client.GetProfit(ctx)
    if err == nil {
        log.Printf("Successfully connected via localhost:%d", status.HostPort)
        goto processMetrics  // Success!
    }
}
```

**Deployment Scenarios Supported:**
- ✅ Development on host machine (localhost fallback works)
- ✅ Docker Compose with shared network (container IP works)
- ✅ Kubernetes within cluster (container IP works)
- ✅ Mixed deployments (automatic detection and fallback)

**Benefits:**
- No manual configuration needed per environment
- Fast failure with 2-second timeout on container IP
- Detailed logging for debugging connection issues
- Graceful degradation if one method fails

### Metrics Collection

**Fetched from Freqtrade `/api/v1/profit` endpoint:**

- Profit metrics (closed/all, coin/percent/fiat)
- Trade counts (total/closed/open)
- Performance metrics (win rate, profit factor, expectancy)
- Drawdown metrics (max drawdown, absolute drawdown)
- Trade timing (first trade, latest trade timestamps)
- Best performing pair

**Database Storage:**
- Metrics stored in `bot_metrics` table (one-to-one with bots)
- Upsert operation (updates existing or creates new)
- Timestamps converted from Unix to `time.Time`
- `fetched_at` field tracks last successful fetch

### Dashboard Integration

**Bot Detail Page:** `dashboard/src/components/Bots/BotDetail.tsx`
- Real-time updates via Apollo polling (10 seconds)
- Comprehensive bot information display
- Control buttons (Start/Stop/Restart/Delete)
- Recent trades table

**BotMetrics Component:** `dashboard/src/components/Bots/BotMetrics.tsx`

**Smart State Handling:**
1. **Bot Not Running**: Info alert explaining metrics require running bot
2. **Fetching Metrics**: Skeleton loaders with "Fetching" alert
3. **Metrics Available**: 7 professional metric cards with icons

**Metric Cards:**
- Total Profit (trending indicator)
- Closed Profit
- Total Trades (breakdown)
- Win Rate (W/L ratio)
- Best Pair
- Max Drawdown (red warning)
- Profit Factor + Expectancy

### GraphQL Integration

**Query with ENT Where Filters:**
```graphql
query GetBot($id: ID!) {
  bots(where: {id: $id}, first: 1) {
    edges {
      node {
        id
        name
        status
        metrics {
          profitAllCoin
          profitAllPercent
          tradeCount
          winrate
          # ... all other fields
        }
      }
    }
  }
}
```

**Benefits:**
- Uses ENT's built-in where filters (enabled via `entgql.WithWhereInputs(true)`)
- No custom resolvers needed
- Type-safe queries with generated TypeScript hooks

## Freqtrade API Client Generation

**Updated: 2025-10-30** - Configured OpenAPI generator to use int64 for all integer types.

### Problem

Freqtrade returns Unix timestamps in milliseconds (>2.1 billion) which overflow int32:

```
json: cannot unmarshal number 1761743045808 into Go struct field
_Profit.bot_start_timestamp of type int32
```

### Solution

Updated Makefile to configure OpenAPI generator with type mapping:

```makefile
generate-freqtrade:
	@docker run --rm -v $${PWD}:/local openapitools/openapi-generator-cli generate \
		-i /local/internal/freqtrade/openapi.json \
		-g go \
		-o /local/internal/freqtrade \
		--package-name freqtrade \
		--additional-properties=withGoMod=false,enumClassPrefix=true \
		--type-mappings=integer=int64 \
		--openapi-normalizer SET_TAGS_FOR_ALL_OPERATIONS=freqtrade
```

**Key Addition:** `--type-mappings=integer=int64`

### Benefits

1. ✅ **No Manual Edits**: Generated code is correct by default
2. ✅ **Future-Proof**: Regeneration maintains int64 types
3. ✅ **Proper Timestamps**: Handles large Unix millisecond timestamps
4. ✅ **Type Safety**: All integer fields consistently use int64

### Regeneration

```bash
make generate-freqtrade  # Regenerate Freqtrade client
make generate            # Regenerate all (ENT + GraphQL + Freqtrade)
make build               # Rebuild binary
```

**Important:** Never manually edit files in `internal/freqtrade/` - they are generated. Update the OpenAPI spec or generator config instead.

### Timestamp Handling

**In Go Code:**
```go
// Timestamps are now int64
profit.BotStartTimestamp      // int64 (milliseconds since epoch)
profit.FirstTradeTimestamp    // int64
profit.LatestTradeTimestamp   // int64

// Convert to time.Time for database
if profit.FirstTradeTimestamp != 0 {
    t := time.Unix(int64(profit.FirstTradeTimestamp), 0)
    firstTradeTime = &t
}
```

**In Database:** Stored as `time.Time` in ENT entities

---

## Backend Deployment

**Updated: 2025-11-14** - Implemented production-ready Kubernetes deployment using Nixys Universal Chart.

### Overview

The backend is deployed to VKE (Vultr Kubernetes Engine) with:
- **Container Registry**: GitHub Container Registry (GHCR)
- **Helm Chart**: [Nixys Universal Chart](https://github.com/nixys/nxs-universal-chart)
- **CI/CD**: GitHub Actions for build & deploy
- **Database**: Managed PostgreSQL (Vultr)
- **Ingress**: Nginx Ingress Controller with Let's Encrypt TLS
- **Monitoring**: Health checks, HPA, PDB, Prometheus-ready

### Infrastructure Components

**Already Deployed:**
- ✅ VKE Cluster (2+ nodes)
- ✅ Ingress Nginx Controller
- ✅ Cert-manager with Let's Encrypt
- ✅ Keycloak (OIDC authentication)
- ✅ OLM (Operator Lifecycle Manager)

**Backend Stack:**
- Docker multi-stage build (Go 1.24 + Alpine)
- Kubernetes Deployment (2-10 replicas via HPA)
- Database migrations (Helm pre-install hook)
- TLS/HTTPS (cert-manager)
- Rolling updates (zero-downtime)

### Directory Structure

```
deployments/backend/
├── values.yaml          # Helm values for Nixys Universal Chart
└── README.md            # Deployment documentation

.github/workflows/
├── docker-build.yml     # Build & push Docker images
└── deploy-backend.yml   # Deploy to Kubernetes
```

### Docker Build

**Dockerfile:** Multi-stage build with Alpine
- Build stage: Go 1.24 with CGO support (for SQLite in development)
- Runtime stage: Alpine 3.x with non-root user
- Health check: `wget http://localhost:8080/health`
- Size: ~30MB compressed

**GitHub Workflow:** `.github/workflows/docker-build.yml`
- **Trigger**: Push to main (Go code changes)
- **Registry**: `ghcr.io/volaticloud/volaticloud`
- **Tags**: `latest`, `main-<sha>`, semver
- **Platforms**: linux/amd64, linux/arm64
- **Cache**: GitHub Actions cache for faster builds

**Build Command:**
```bash
docker build -t ghcr.io/volaticloud/volaticloud:latest .
```

### Kubernetes Deployment

**Helm Chart:** Nixys Universal Chart (generic, production-ready)
- **Repo**: `https://registry.nixys.io/chartrepo/public`
- **Why Nixys**: Comprehensive features, multiple ingress controllers, extraDeploy for custom resources

**Key Features:**
1. **Horizontal Pod Autoscaler**: 2-10 replicas based on CPU (70%) and memory (80%)
2. **Health Probes**: Liveness (10s interval) and Readiness (5s interval) on `/health`
3. **Pod Disruption Budget**: Ensures min 1 replica during disruptions
4. **Security**: Non-root user (UID 1000), dropped capabilities
5. **Affinity**: Pods spread across nodes for high availability
6. **Resources**: 250m CPU / 256Mi RAM (requests), 1000m CPU / 512Mi RAM (limits)

**GitHub Workflow:** `.github/workflows/deploy-backend.yml`
- **Trigger**: Push to main (deployment config changes), manual dispatch
- **Environment**: `prod` (requires approval)
- **Steps**:
  1. Validate Helm values
  2. Create namespace & database secret
  3. Run database migrations (pre-install hook)
  4. Deploy with Helm (atomic rollback on failure)
  5. Verify deployment health
  6. Run post-deployment tests

### Database Migrations

**Strategy:** Automatic on server startup (100% GitOps)

**Updated: 2025-11-14** - Migrations now run automatically when the server starts, eliminating the need for separate migration jobs or commands.

Migrations run automatically before accepting connections:
```go
// cmd/server/main.go:132-135
// Run auto migration
if err := client.Schema.Create(ctx); err != nil {
    return fmt.Errorf("failed creating schema resources: %w", err)
}
```

**Behavior:**
- Runs on every server startup
- Executes before HTTP server starts
- Uses ENT auto-migration (`client.Schema.Create`)
- Idempotent (safe to run multiple times)
- Pod fails if migration fails (automatic Kubernetes retry)
- Zero-downtime: Readiness probe prevents traffic during migration

**Timeline:**
1. Container starts → Binary runs
2. Database connection established
3. Auto-migration executes
4. HTTP server starts
5. Readiness probe succeeds
6. Traffic routes to pod

**Benefits:**
- ✅ No separate migration jobs needed
- ✅ No manual migration commands
- ✅ 100% GitOps (just deploy, migrations happen automatically)
- ✅ Zero-downtime deployments (Kubernetes waits for readiness)
- ✅ Automatic rollback if migration fails

### Configuration

**Environment Variables:**
```bash
VOLATICLOUD_HOST=0.0.0.0
VOLATICLOUD_PORT=8080
VOLATICLOUD_DATABASE=postgresql://user:pass@host:5432/db?sslmode=require
VOLATICLOUD_MONITOR_INTERVAL=30s
VOLATICLOUD_ETCD_ENDPOINTS=  # Optional for distributed mode
```

**Kubernetes Secrets:**
Database credentials stored in `volaticloud-db-secret`:
- `host` - PostgreSQL hostname:port
- `database` - Database name
- `username` - Database user
- `password` - Database password

Created automatically by GitHub Actions during deployment.

### Deployment Commands

**Local Testing:**
```bash
# Add Nixys Helm repo
helm repo add nixys https://registry.nixys.io/chartrepo/public
helm repo update

# Validate Helm values
helm template volaticloud-backend nixys/nxs-universal-chart \
  -f deployments/backend/values.yaml \
  --dry-run --debug

# Lint chart
helm lint nixys/nxs-universal-chart \
  -f deployments/backend/values.yaml
```

**Deploy to Kubernetes:**
```bash
# Deploy via GitHub Actions (recommended)
gh workflow run deploy-backend.yml

# Manual deploy
helm upgrade --install volaticloud-backend nixys/nxs-universal-chart \
  --namespace volaticloud \
  --create-namespace \
  -f deployments/backend/values.yaml \
  --set image.tag=main-abc1234 \
  --wait --timeout 10m --atomic
```

**Verify Deployment:**
```bash
# Check pods
kubectl get pods -n volaticloud -l app=volaticloud-backend

# Check service
kubectl get svc -n volaticloud

# Check ingress
kubectl get ingress -n volaticloud

# View logs
kubectl logs -n volaticloud -l app=volaticloud-backend --tail=100 -f

# Test health endpoint
curl https://api.volaticloud.com/health
```

**Rollback:**
```bash
# Automatic rollback on failure (--atomic flag)
# Or manual rollback
helm rollback volaticloud-backend -n volaticloud
```

### CI/CD Pipeline

**Build Pipeline:** `docker-build.yml`
1. Checkout code
2. Set up Docker Buildx
3. Log in to GHCR
4. Extract metadata (tags)
5. Build & push multi-arch image
6. Cache layers for faster builds

**Deploy Pipeline:** `deploy-backend.yml`
1. Validate Helm values
2. Configure kubeconfig
3. Create namespace & secrets
4. Deploy with Helm
5. Verify deployment
6. Post-deployment tests
7. Auto-rollback on failure

**Deployment Flow:**
```
Push to main → GitHub Actions
  ↓
Build Docker image → GHCR
  ↓
Trigger deployment → Validate
  ↓
Run migrations (Job) → Deploy (Deployment)
  ↓
Health checks → Traffic routing
  ↓
Success ✓ / Rollback ✗
```

### Monitoring & Observability

**Health Endpoints:**
- `/health` - Health check (200 OK)
- `/` - GraphQL Playground
- `/query` - GraphQL API

**Probes:**
- Liveness: Initial 10s, period 10s, timeout 3s, threshold 3
- Readiness: Initial 5s, period 5s, timeout 3s, threshold 3

**Prometheus Integration:**
Pods annotated for scraping:
```yaml
podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "8080"
  prometheus.io/path: /metrics
```

**Logging:**
```bash
# View logs
kubectl logs -n volaticloud -l app=volaticloud-backend --tail=100

# Follow logs
kubectl logs -n volaticloud -l app=volaticloud-backend -f

# View events
kubectl get events -n volaticloud --sort-by='.lastTimestamp'
```

### Scaling

**Auto-scaling (HPA):**
- Min replicas: 2
- Max replicas: 10
- CPU target: 70%
- Memory target: 80%

**Manual scaling:**
```bash
kubectl scale deployment volaticloud-backend -n volaticloud --replicas=5
```

### Security

**Container Security:**
- Non-root user (UID 1000)
- Read-only root filesystem (where possible)
- Dropped ALL capabilities
- No privilege escalation

**Network Security:**
- TLS/HTTPS only (cert-manager + Let's Encrypt)
- ClusterIP service (internal only)
- Ingress for external access

**Secrets Management:**
- Database credentials in Kubernetes Secrets
- Secrets created by CI/CD (not in git)
- Environment variable injection

### Troubleshooting

**Common Issues:**

1. **Pods CrashLoopBackOff**: Check logs and health endpoint
2. **Migration fails**: Check database connectivity and credentials
3. **Ingress not working**: Check cert-manager and DNS
4. **HPA not scaling**: Check metrics-server installation

**Debug Commands:**
```bash
# Pod status
kubectl describe pod <pod-name> -n volaticloud

# View events
kubectl get events -n volaticloud --sort-by='.lastTimestamp'

# Test database connection
kubectl run -it --rm psql-test --image=postgres:14 --restart=Never -- \
  psql -h <host> -U volaticloud -d volaticloud

# Check HPA
kubectl get hpa -n volaticloud
kubectl describe hpa volaticloud-backend -n volaticloud
```

### Documentation

Comprehensive documentation available:
- `deployments/backend/README.md` - Full deployment guide
- `deployments/README.md` - Infrastructure overview
- `deployments/PRE_DEPLOYMENT_CHECKLIST.md` - Pre-deployment checklist

### Next Steps

After backend deployment:
1. Configure DNS (api.volaticloud.com → VKE LoadBalancer)
2. Deploy frontend dashboard
3. Set up monitoring (Prometheus/Grafana)
4. Configure alerting
5. Enable continuous deployment

---

## Authentication and Authorization

**Updated: 2025-11-19** - Implemented mandatory Keycloak authentication with UMA 2.0 resource-level authorization.

### Overview

The system uses a multi-layered security model:
1. **JWT Authentication** (via Keycloak OIDC) - Validates user identity
2. **GraphQL Directives** (`@isAuthenticated`, `@hasScope`) - Declarative authorization
3. **UMA 2.0 Resource Management** - Fine-grained permissions for strategies
4. **Database Ownership** - Fast local checks before hitting Keycloak

**Keycloak is MANDATORY** in all environments (development, staging, production). The server will not start without proper Keycloak configuration.

### Architecture Components

**Authentication Layer:**
- `internal/auth/keycloak.go` - OIDC provider, JWT verifier, token validation
- `internal/auth/middleware.go` - HTTP middleware for JWT validation
- `internal/auth/context.go` - User context helpers (extract UserID, RawToken from JWT claims)

**Authorization Layer:**
- `internal/keycloak/uma_client.go` - UMA 2.0 resource management (create/delete resources, check permissions)
- `internal/graph/keycloak_hooks.go` - Transaction-safe hooks for syncing ENT entities with Keycloak resources
- `internal/graph/directives.go` - GraphQL directive handlers for authorization checks

**GraphQL Integration:**
- `internal/graph/schema.graphqls` - Directive definitions (`@isAuthenticated`, `@hasScope`)
- `gqlgen.yml` - Directive configuration (`skip_runtime: false`)
- `internal/graph/resolver.go` - Resolver with injected auth and UMA clients

### Configuration

**Required Environment Variables:**
```bash
VOLATICLOUD_KEYCLOAK_URL=https://keycloak.volaticloud.com
VOLATICLOUD_KEYCLOAK_REALM=volaticloud
VOLATICLOUD_KEYCLOAK_CLIENT_ID=volaticloud-api
VOLATICLOUD_KEYCLOAK_CLIENT_SECRET=<secret>
```

**Validation:** Server validates all Keycloak config at startup and fails if any are missing:
```go
// cmd/server/main.go:203-205
if keycloakConfig.URL == "" || keycloakConfig.ClientID == "" || keycloakConfig.ClientSecret == "" {
	return fmt.Errorf("Keycloak configuration is required (URL, ClientID, ClientSecret must be set)")
}
```

**Example .env:**
```bash
VOLATICLOUD_KEYCLOAK_URL=https://keycloak.volaticloud.com
VOLATICLOUD_KEYCLOAK_REALM=volaticloud
VOLATICLOUD_KEYCLOAK_CLIENT_ID=volaticloud-api
VOLATICLOUD_KEYCLOAK_CLIENT_SECRET=your-client-secret-here
```

### JWT Authentication Flow

**1. User Login (Frontend):**
```typescript
// Dashboard uses Keycloak.js for login
const keycloak = new Keycloak({
  url: 'https://keycloak.volaticloud.com',
  realm: 'volaticloud',
  clientId: 'volaticloud-frontend'
});

await keycloak.init({ onLoad: 'login-required' });
```

**2. GraphQL Request with JWT:**
```typescript
// Apollo Client includes JWT in Authorization header
const authLink = setContext((_, { headers }) => ({
  headers: {
    ...headers,
    authorization: keycloak.token ? `Bearer ${keycloak.token}` : "",
  }
}));
```

**3. Backend Validates JWT:**
```go
// internal/auth/middleware.go:44-65
func RequireAuth(client *KeycloakClient) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract Bearer token from Authorization header
			token := extractToken(r.Header.Get("Authorization"))

			// Verify JWT signature and claims
			userCtx, err := client.VerifyToken(r.Context(), token)
			if err != nil {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// Inject user context into request
			ctx := SetUserContext(r.Context(), userCtx)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
```

**4. User Context Available:**
```go
// internal/auth/context.go:17-20
type UserContext struct {
	UserID   string // sub claim from JWT
	Email    string // email claim
	RawToken string // Original JWT for UMA requests
}
```

### GraphQL Directives

**Directive Definitions** (`internal/graph/schema.graphqls`):
```graphql
directive @isAuthenticated on FIELD_DEFINITION
directive @hasScope(resourceArg: String!, scope: String!) on FIELD_DEFINITION
```

**Applied to Mutations:**
```graphql
type Mutation {
  createStrategy(input: CreateStrategyInput!): Strategy!
    @isAuthenticated

  updateStrategy(id: ID!, input: UpdateStrategyInput!): Strategy!
    @hasScope(resourceArg: "id", scope: "edit")

  deleteStrategy(id: ID!): ID!
    @hasScope(resourceArg: "id", scope: "delete")
}
```

**Directive Handlers:**

**@isAuthenticated** (`internal/graph/directives.go:15-24`):
```go
func IsAuthenticatedDirective(ctx context.Context, obj interface{}, next graphql.Resolver) (interface{}, error) {
	// Check if user context exists (set by middleware)
	_, err := auth.GetUserContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("authentication required: %w", err)
	}

	// User is authenticated, proceed with resolver
	return next(ctx)
}
```

**@hasScope** (`internal/graph/directives.go:28-78`):
```go
func HasScopeDirective(
	ctx context.Context,
	obj interface{},
	next graphql.Resolver,
	resourceArg string, // e.g., "id"
	scope string,       // e.g., "edit", "delete"
) (interface{}, error) {
	// 1. Get authenticated user from context
	userCtx, err := auth.GetUserContext(ctx)

	// 2. Extract resource ID from GraphQL field arguments
	fc := graphql.GetFieldContext(ctx)
	resourceID := fc.Args[resourceArg].(string)

	// 3. Get UMA client and ENT client from context
	umaClient := GetUMAClientFromContext(ctx)
	client := GetEntClientFromContext(ctx).(*ent.Client)

	// 4. Check permission via UMA
	hasPermission, err := VerifyStrategyPermission(
		ctx, client, umaClient, resourceID, userCtx.RawToken, scope
	)

	if !hasPermission {
		return nil, fmt.Errorf("insufficient permissions: missing '%s' scope on resource %s", scope, resourceID)
	}

	// Permission granted, proceed with resolver
	return next(ctx)
}
```

### UMA 2.0 Resource Management

**Resource Lifecycle:**

**1. Create Strategy → Create Keycloak Resource:**
```go
// internal/graph/keycloak_hooks.go:18-62
func CreateStrategyWithResource(
	ctx context.Context,
	client *ent.Client,
	umaClient *keycloak.UMAClient,
	mutation *ent.StrategyCreate,
) (*ent.Strategy, error) {
	// Database-first approach with transaction
	var strategy *ent.Strategy
	err := WithTx(ctx, client, func(tx *ent.Tx) error {
		// 1. Create Strategy in database
		strategy, err = mutation.Save(ctx)

		// 2. Create Keycloak resource
		resourceName := fmt.Sprintf("Strategy: %s (v%d)", strategy.Name, strategy.VersionNumber)
		err = umaClient.CreateResource(ctx, strategy.ID.String(), resourceName, StrategyScopes)
		if err != nil {
			// Rollback transaction on failure
			return fmt.Errorf("failed to create Keycloak resource (transaction will rollback): %w", err)
		}

		// 3. Create permission policy for owner
		err = umaClient.CreatePermission(ctx, strategy.ID.String(), strategy.OwnerID)

		return nil
	})

	return strategy, nil
}
```

**2. Delete Strategy → Delete Keycloak Resource:**
```go
// internal/graph/keycloak_hooks.go:66-95
func DeleteStrategyWithResource(
	ctx context.Context,
	client *ent.Client,
	umaClient *keycloak.UMAClient,
	strategyID string,
) error {
	// 1. Delete from database first
	err = client.Strategy.DeleteOneID(id).Exec(ctx)

	// 2. Attempt to delete Keycloak resource (best effort)
	if umaClient != nil {
		err = umaClient.DeleteResource(ctx, strategyID)
		if err != nil {
			// Log but don't fail - database deletion already succeeded
			log.Printf("Warning: Strategy %s deleted from database but Keycloak cleanup failed: %v", strategyID, err)
		}
	}

	return nil
}
```

**Available Scopes** (`internal/graph/keycloak_hooks.go:14`):
```go
var StrategyScopes = []string{"view", "edit", "backtest", "delete"}
```

### UMA Permission Checking

**Flow:**
1. User makes GraphQL request with JWT
2. `@hasScope` directive extracts resource ID from arguments
3. Directive calls `VerifyStrategyPermission` with user's JWT
4. UMA client requests RPT (Requesting Party Token) from Keycloak
5. Keycloak evaluates policies and returns permission decision
6. Directive allows/denies request based on result

**Permission Check** (`internal/keycloak/uma_client.go:102-123`):
```go
func (u *UMAClient) CheckPermission(ctx context.Context, userToken, resourceID, scope string) (bool, error) {
	// Request permission using UMA Protection API
	// Format: resource#scope (e.g., "uuid#edit")
	permission := fmt.Sprintf("%s#%s", resourceID, scope)

	// Request RPT (Requesting Party Token) with permission
	rpt, err := u.client.GetRequestingPartyToken(ctx, userToken, u.realm, gocloak.RequestingPartyTokenOptions{
		Permissions: &[]string{permission},
		Audience:    gocloak.StringP(u.clientID),
	})

	if err != nil {
		// If error is "access_denied", user doesn't have permission
		if IsAccessDenied(err) {
			return false, nil
		}
		return false, fmt.Errorf("failed to check permission: %w", err)
	}

	// If we got an RPT, user has permission
	return rpt != nil && rpt.AccessToken != "", nil
}
```

### Transaction Safety

**Database-First Approach:**
- Strategy is created in database FIRST within a transaction
- Keycloak resource is created SECOND within the same transaction
- If Keycloak fails, entire transaction rolls back
- Ensures database and Keycloak stay in sync

**Transaction Helper** (`internal/graph/tx.go`):
```go
func WithTx(ctx context.Context, client *ent.Client, fn func(tx *ent.Tx) error) error {
	tx, err := client.Tx(ctx)
	if err != nil {
		return err
	}

	defer func() {
		if v := recover(); v != nil {
			tx.Rollback()
			panic(v)
		}
	}()

	if err := fn(tx); err != nil {
		if rerr := tx.Rollback(); rerr != nil {
			err = fmt.Errorf("%w: rolling back transaction: %v", err, rerr)
		}
		return err
	}

	return tx.Commit()
}
```

### Context Injection

**Middleware** (`cmd/server/main.go:247-256`):
```go
// Middleware to inject ENT and UMA clients into context for GraphQL directives
injectClientsMiddleware := func(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		// Inject ENT client
		ctx = graph.SetEntClientInContext(ctx, client)
		// Inject UMA client (always available)
		ctx = graph.SetUMAClientInContext(ctx, umaClient)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
```

**Route Setup** (`cmd/server/main.go:260-263`):
```go
// GraphQL routes - Keycloak authentication required for all requests
router.With(auth.OptionalAuth(keycloakClient), injectClientsMiddleware).Handle("/", playground.Handler("GraphQL Playground", "/query"))
router.With(auth.RequireAuth(keycloakClient), injectClientsMiddleware).Handle("/query", srv)
```

### Strategy Ownership

**Owner Field** (`internal/ent/schema/strategy.go`):
```go
field.String("owner_id").
	NotEmpty().
	Comment("User ID (Keycloak sub) of the strategy owner")
```

**Set on Creation** (`internal/graph/schema.resolvers.go:29-42`):
```go
func (r *mutationResolver) CreateStrategy(ctx context.Context, input ent.CreateStrategyInput) (*ent.Strategy, error) {
	// Extract owner_id from user context (injected by @isAuthenticated directive)
	userCtx, err := auth.GetUserContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("user context not found: %w", err)
	}

	// Create mutation with owner_id
	mutation := r.client.Strategy.Create().
		SetInput(input).
		SetOwnerID(userCtx.UserID)

	// Create strategy with Keycloak resource sync
	return CreateStrategyWithResource(ctx, r.client, r.umaClient, mutation)
}
```

**Fast Ownership Check** (`internal/graph/keycloak_hooks.go:98-111`):
```go
func VerifyStrategyOwnership(ctx context.Context, client *ent.Client, strategyID, userID string) (bool, error) {
	id, err := uuid.Parse(strategyID)
	strategy, err := client.Strategy.Get(ctx, id)
	return strategy.OwnerID == userID, nil
}
```

### Security Best Practices

**1. Defense in Depth:**
- JWT validation at HTTP layer (middleware)
- Permission checks at GraphQL layer (directives)
- Ownership validation at resolver layer (fast local check)
- UMA authorization at Keycloak (authoritative)

**2. Fail-Safe Defaults:**
- All mutations require authentication by default
- Sensitive mutations require explicit scopes
- Missing UMA client = authorization denied
- Missing Keycloak config = server won't start

**3. Transaction Integrity:**
- Database-first approach with rollback on Keycloak failure
- Ensures consistency between database and authorization server
- Prevents orphaned resources in either system

**4. Least Privilege:**
- Resource owners have all scopes by default
- Other users must be explicitly granted permissions
- Fine-grained scopes (view, edit, backtest, delete)
- Owner-managed access enabled for delegation

### Testing

**Test Coverage:**
- `internal/auth/middleware_test.go` - JWT validation (pending)
- `internal/graph/authorization_test.go` - Directive and permission checks (pending)

**Manual Testing:**
```graphql
# 1. Create strategy (authenticated user becomes owner)
mutation {
  createStrategy(input: {
    name: "TestStrategy"
    code: "..."
  }) {
    id
    name
    ownerID
  }
}

# 2. Try to update (requires edit scope)
mutation {
  updateStrategy(id: "uuid", input: { code: "..." }) {
    id
  }
}

# 3. Try to delete (requires delete scope)
mutation {
  deleteStrategy(id: "uuid")
}
```

### Troubleshooting

**Common Issues:**

1. **"Keycloak configuration is required"**
   - Solution: Set all required environment variables (URL, ClientID, ClientSecret)

2. **"authentication required"**
   - Solution: Include valid JWT in Authorization header (`Bearer <token>`)

3. **"insufficient permissions: missing 'edit' scope"**
   - Solution: Ensure user has permission via Keycloak policies or owns the resource

4. **"UMA client not available - authorization required"**
   - Solution: Server misconfiguration - UMA client should always be initialized

**Debug Commands:**
```bash
# Check Keycloak connectivity
curl https://keycloak.volaticloud.com/auth/realms/volaticloud/.well-known/openid-configuration

# Decode JWT
echo "<token>" | cut -d. -f2 | base64 -d | jq

# Check server logs for auth errors
kubectl logs -n volaticloud -l app=volaticloud-backend | grep -i "auth\|keycloak\|uma"
```

### Future Enhancements

**Planned:**
- Permission sharing UI (allow users to grant access to their strategies)
- Role-based access control (admin, power-user, read-only)
- Audit logging for permission changes
- Permission caching for performance
- Batch permission checks for list queries

**Keycloak Policies (TODO):**
Currently using owner-managed access (`OwnerManagedAccess: true`) with stub permission creation. Full policy implementation requires:
- User-based policies (grant access to specific users)
- Group-based policies (grant access to groups)
- Role-based policies (grant access by role)
- Time-based policies (temporary access)

See `internal/keycloak/uma_client.go:128-136` for CreatePermission stub.

