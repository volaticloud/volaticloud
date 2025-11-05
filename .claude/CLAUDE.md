# AnyTrade Project Notes

## Project Structure

Project follows Go best practices with `internal` directory pattern:
- `internal/ent/` - ENT ORM schemas and generated code
- `internal/graph/` - GraphQL schemas and resolvers
- `cmd/server/` - Server entrypoint
- `internal/enum/` - Custom enum types with GraphQL marshalers

All imports use `anytrade/internal/ent` and `anytrade/internal/graph`.

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
   - Node interface mapped to `anytrade/internal/ent.Noder`

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
- `updateStrategy(id: ID!, input: UpdateStrategyInput!)` - Update strategy
- `deleteStrategy(id: ID!)` - Delete strategy

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
     - anytrade/internal/exchange
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
- Database defaults to SQLite at `./data/anytrade.db`

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
npm run codegen  # Generate GraphQL types
npm run dev      # Start development server
```

Dashboard runs on http://localhost:5173

### Architecture

**Centralized Code Generation:**
All GraphQL operations are generated into a single centralized file:
- GraphQL files: `src/components/*/[feature].graphql` (e.g., `bots.graphql`, `backtests.graphql`)
- Generated hooks: `src/generated/graphql.ts` (centralized)
- Codegen config: `codegen.ts` uses **schema introspection** from `http://localhost:8080/query`

**Important**: The codegen fetches the schema from the running GraphQL server via introspection, NOT from the `internal/graph/ent.graphql` file. This means:
1. The backend server MUST be running on port 8080 before running `npm run codegen`
2. After regenerating backend schema with `make generate`, you MUST rebuild and restart the server
3. Then run `npm run codegen` to fetch the updated schema via introspection

**Workflow after schema changes:**
```bash
# Backend changes
make generate  # Regenerate ENT schema
make build     # Rebuild binary
./bin/anytrade server &  # Restart server

# Frontend codegen (requires server running)
cd dashboard
npm run codegen  # Fetches schema from http://localhost:8080/query
```

**Usage Example:**
```typescript
// Import from centralized generated file
import { useGetBotsQuery, useStartBotMutation } from '../../generated/graphql';

const { data, loading } = useGetBotsQuery({ variables: { first: 10 } });
const [startBot] = useStartBotMutation();
```

All GraphQL operation files use the `.graphql` extension. The generated file `src/generated/graphql.ts` is git-ignored.

### Key Features
- Dark/Light mode toggle
- Responsive Material-UI layout
- Type-safe GraphQL queries with generated React hooks
- Sidebar navigation
- Component-based architecture

See `dashboard/README.md` for detailed documentation.

## Bot Runtime and Freqtrade Configuration

### Bot Lifecycle

Bots run in Docker containers with Freqtrade. The lifecycle is:

1. **Create Bot** - Creates container and generates config files in `/tmp/anytrade-configs/{botID}/`
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

**Default Data Format**: Feather (configured in `internal/monitor/data_download.go:154`)

Data is downloaded using the `download-data` command with the following defaults:
- Format: `feather` (freqtrade's default, optimized for backtesting)
- Directory structure: `/freqtrade/user_data/data/{exchange}/{tradingMode}/`
  - Example: `/freqtrade/user_data/data/binance/spot/BTC_USDT-1h.feather`
- Trading mode subdirectories are automatically created based on `tradingMode` config

**Why Feather Format:**
- Freqtrade's default format for backtesting
- Faster loading and smaller file sizes compared to JSON
- Backtesting works seamlessly without requiring `dataformat_ohlcv` config

**Data Download Configuration:**
```go
// internal/monitor/data_download.go:148-156
args := []string{
    "download-data",
    "--exchange", exchange,
    "--pairs", pairsPattern,
    "--days", days,
    "--data-format-ohlcv", "feather",  // Default format
    "--trading-mode", tradingMode,      // Creates spot/futures subdirectory
}
```

### Backtesting

Backtests run in one-time Docker containers (non-persistent) that:
1. Mount the data volume (`anytrade-freqtrade-data`)
2. Use downloaded historical data
3. Execute the strategy against historical candles
4. Generate performance metrics

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
- Volume mount ensures data access without manual path configuration

**Data Format Compatibility:**
- Feather format (default): Works out-of-the-box
- JSON format: Requires adding `"dataformat_ohlcv": "json"` to backtest config

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

