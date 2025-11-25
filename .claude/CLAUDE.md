# VolatiCloud Project Notes

## Git Rules

1. **Never add Claude ad into the commit message**

## Project Structure

```
internal/
├── auth/          # JWT authentication, middleware, context
├── authz/         # Authorization (UMA scopes, resource CRUD, permissions)
├── backtest/      # Backtest domain (spec building, result summary)
├── bot/           # Bot domain (spec building, config validation)
├── db/            # Database utilities (transactions)
├── ent/           # ENT ORM schemas and generated code
├── enum/          # Custom enum types with GraphQL marshalers
├── exchange/      # Exchange domain (config validation)
├── freqtrade/     # Generated Freqtrade API client
├── graph/         # GraphQL resolvers (THIN LAYER - see DDD below)
├── keycloak/      # Keycloak UMA client
├── monitor/       # Bot and backtest monitoring
├── runner/        # Container orchestration (Docker, K8s)
├── strategy/      # Strategy domain (versioning)
└── utils/         # Shared utilities
```

## Domain-Driven Design (DDD) - MANDATORY

**All business logic MUST be in domain packages under `internal/{domain}/`.**
**The `internal/graph/` package is a THIN LAYER - only GraphQL resolvers.**

### Rules

1. **NO business logic in `internal/graph/`** - Resolvers only call domain functions
2. **Domain packages are independent** - No circular imports, no `graph` imports
3. **Each domain owns its logic** - Validation, spec building, lifecycle operations

### Domain Package Reference

| Package | Responsibility | Key Functions |
|---------|---------------|---------------|
| `authz` | Authorization, UMA resources | `CreateStrategyWithResource`, `VerifyPermission` |
| `bot` | Bot lifecycle, config | `BuildSpec`, `ValidateFreqtradeConfig`, `GenerateSecureConfig` |
| `backtest` | Backtest execution | `BuildSpec`, `ExtractSummaryFromResult` |
| `strategy` | Strategy versioning | `CreateVersion`, `Coalesce` |
| `exchange` | Exchange config | `ValidateConfigWithSchema` |
| `db` | Database utilities | `WithTx` |

### Adding New Business Logic

```go
// WRONG - logic in resolver
func (r *mutationResolver) CreateBot(...) {
    if config["stake_amount"] == nil { return nil, err }  // NO!
}

// CORRECT - logic in domain package
// internal/bot/config.go
func ValidateConfig(config map[string]interface{}) error { ... }

// internal/graph/schema.resolvers.go
func (r *mutationResolver) CreateBot(...) {
    if err := bot.ValidateConfig(input.Config); err != nil { return nil, err }
}
```

### Code Review Checklist

- [ ] No business logic in `internal/graph/` resolvers
- [ ] New logic is in appropriate domain package
- [ ] Domain package has no `internal/graph/` imports
- [ ] Functions are exported and documented

## GraphQL Implementation

Successfully integrated ENT ORM with GraphQL using gqlgen.

### Key Configuration

1. **ENT GraphQL Extension** (`internal/ent/entc.go`) - Uses `entgql.NewExtension()`, generates schema to `../graph/ent.graphql`
2. **gqlgen Configuration** (`gqlgen.yml`) - Time scalar uses `github.com/99designs/gqlgen/graphql.Time`, autobind all ENT packages
3. **Build**: `make generate` (ENT + gqlgen), `make build` (binary)

### API Endpoints

- GraphQL Playground: `http://localhost:8080/`
- GraphQL API: `http://localhost:8080/query`
- Health Check: `http://localhost:8080/health`

### Strategy Versioning

**Architecture:**
- Immutable versioning: updates create new versions
- Linear parent-child chain: v1 → v2 → v3 via `parent_id`
- Auto-versioning on `updateStrategy` and `createBacktest`
- Transaction-safe with rollback (`internal/graph/tx.go`)
- Bots stay pinned to their strategy version

**Key Fields:**
- `parent_id` (UUID) - Points to parent version
- `version_number` (int) - Auto-incremented
- `is_latest` (bool) - Only one per strategy name

**Schema Edge:** Always use plural edge `WithBacktests()` for checking existing backtests, not singular edge

**Queries:**
- `latestStrategies` - Latest versions only (dashboard default)
- `strategyVersions(name: String!)` - All versions by name

### Typed Config Pattern

For dynamic configs (Exchange, BotRunner):
1. Define Go structs in dedicated package (e.g., `internal/exchange/config.go`)
2. Add to gqlgen autobind in `gqlgen.yml`
3. Define matching GraphQL types in `schema.graphqls`
4. Use ENT JSON field with `entgql.Type()` and `entgql.Skip()`
5. Create conversion helpers for typed input → map storage

## Testing

```bash
make test         # Run all tests with coverage
make coverage     # Open HTML coverage report
```

**Coverage:** 91.9% (excluding generated code)
- Query resolvers: 100%
- Mutation resolvers: 97%

**Test Structure:**
- `internal/graph/*_test.go` - Resolver tests
- `internal/graph/resolver_test.go` - Test infrastructure
- Uses `setupTestResolver(t)` helper

**Key Coverage:**
- Validation functions: 100% (`helpers_test.go`)
- Data download: 100% (`data_download_test.go`)
- Backtest summary: 96.4% (`summary_test.go`)

## React Dashboard

**Tech Stack:** React 19 + TypeScript, Vite, MUI v7, Apollo Client, React Router v7

**Setup:**
```bash
cd dashboard
npm install
npm run codegen  # Generate GraphQL types (uses local schema files)
npm run dev      # Start on http://localhost:5173
```

**Architecture:**
- Per-component code generation with near-operation-file preset
- GraphQL files: `src/components/*/[feature].graphql`
- Generated hooks: `src/components/*/[feature].generated.ts`
- Codegen uses local schema files from `../internal/graph/` (no server required)

**Features:**
- Fully responsive (mobile/tablet/desktop)
- Dark/Light mode toggle
- Type-safe GraphQL queries

## Bot Runtime and Freqtrade

### Lifecycle

1. **Create Bot** - Creates container, generates config files
2. **Start Bot** - Starts container (reuses configs)
3. **Stop Bot** - Stops container (keeps configs)
4. **Delete Bot** - Removes container and configs

**Config files:** `/tmp/volaticloud-configs/{botID}/`
- `config.exchange.json` - Exchange credentials
- `config.strategy.json` - Strategy settings
- `config.bot.json` - Bot overrides (dry_run auto-injected)

**Important:** Config changes require delete + recreate

### Config Validation

`validateFreqtradeConfig` validates required fields:
- `stake_currency`, `stake_amount`, `exit_pricing`, `entry_pricing`
- Runs on `createBot` and `updateBot`
- Also validated against official Freqtrade JSON schema (`schema.freqtrade.io`)

## Backtesting

**Data Format:** JSON (configured in `internal/monitor/data_download.go:174`)
- Directory: `/freqtrade/user_data/data/{exchange}/{tradingMode}/`
- Why JSON: Human-readable, transparent, easy debugging

**Parallel Backtest Strategy:**
- Each backtest gets isolated userdir: `/freqtrade/user_data/{backtestID}`
- Shared data mounted to: `/freqtrade/user_data/{backtestID}/data/`
- No path conflicts, workspace isolation
- Test coverage: 100% (`docker_backtest_mount_test.go`)

**Container Lifecycle:**
- Backtest containers use `AutoRemove: false`
- Monitor auto-cleans after results saved (every 30s)

**Result Types - Hybrid Approach:**
- Typed `BacktestSummary` (20 key metrics) via `internal/backtest/summary.go`
- Full JSON result (103+ fields) for advanced use
- GraphQL serves both: `summary` (typed) + `result` (JSON)
- Frontend uses helpers in `dashboard/src/types/freqtrade.ts`

## Bot Monitoring

**Architecture:**
- `internal/monitor/bot_monitor.go` - Core monitoring
- `internal/monitor/coordinator.go` - Distributed coordination (etcd)
- `internal/freqtrade/bot_client.go` - REST API client
- Monitor interval: 30 seconds

**Universal Connection Strategy:**
- Try container IP first (2s timeout)
- Fallback to localhost:hostPort
- Works across all deployment scenarios

**Metrics:** Fetched from Freqtrade `/api/v1/profit`:
- Profit metrics (closed/all, coin/percent/fiat)
- Trade counts, win rate, profit factor
- Drawdown, best pair, trade timing

**Dashboard:** Real-time updates via Apollo polling (10s)

## Freqtrade API Client

**OpenAPI Generator Config:**
- Uses `--type-mappings=integer=int64` to handle large Unix timestamps
- Never manually edit `internal/freqtrade/` - they are generated
- Regenerate: `make generate-freqtrade`

## Backend Deployment

**Infrastructure:**
- VKE (Vultr Kubernetes Engine)
- Container Registry: GitHub Container Registry (GHCR)
- Helm Chart: Nixys Universal Chart
- Database: Managed PostgreSQL
- Ingress: Nginx + Let's Encrypt TLS

**Key Features:**
- HPA: 2-10 replicas (CPU 70%, Memory 80%)
- Health probes on `/health`
- Pod Disruption Budget (min 1 replica)
- Auto-migrations on server startup (ENT `client.Schema.Create`)
- Zero-downtime deployments

**CI/CD:**
- `.github/workflows/docker-build.yml` - Build & push Docker images
- `.github/workflows/deploy-backend.yml` - Deploy to Kubernetes

**Environment Variables:**
```bash
VOLATICLOUD_HOST=0.0.0.0
VOLATICLOUD_PORT=8080
VOLATICLOUD_DATABASE=postgresql://...
VOLATICLOUD_MONITOR_INTERVAL=30s
VOLATICLOUD_ETCD_ENDPOINTS=  # Optional
```

See `deployments/backend/README.md` for full deployment guide.

## Authentication and Authorization

**Updated: 2025-11-21** - Multi-entity authorization (Strategy, Bot, Exchange, BotRunner) with Keycloak UMA 2.0

### Architecture

**Security Layers:**
1. **JWT Authentication** (Keycloak OIDC) - Validates identity
2. **GraphQL Directives** (`@isAuthenticated`, `@hasScope`) - Declarative authz
3. **UMA 2.0 Resource Management** - Fine-grained permissions
4. **Database Ownership** - Fast local checks

**Keycloak is MANDATORY** in all environments. Server won't start without proper configuration.

**Components:**
- `internal/auth/keycloak.go` - OIDC provider, JWT verifier
- `internal/auth/middleware.go` - HTTP middleware for JWT validation
- `internal/auth/context.go` - User context helpers
- `internal/keycloak/uma_client.go` - UMA 2.0 resource management
- `internal/graph/keycloak_hooks.go` - Transaction-safe hooks for resource sync
- `internal/graph/directives.go` - GraphQL directive handlers

### Configuration

**Required Environment Variables:**
```bash
VOLATICLOUD_KEYCLOAK_URL=https://keycloak.volaticloud.com
VOLATICLOUD_KEYCLOAK_REALM=volaticloud
VOLATICLOUD_KEYCLOAK_CLIENT_ID=volaticloud-api
VOLATICLOUD_KEYCLOAK_CLIENT_SECRET=<secret>
```

Server validates config at startup and fails if missing (`cmd/server/main.go:203-205`).

### Authentication Flow

1. User logs in via Keycloak.js (frontend)
2. Frontend includes JWT in Authorization header: `Bearer <token>`
3. Backend middleware (`auth.RequireAuth`) validates JWT signature and claims
4. User context injected into request with `UserID`, `Email`, `RawToken`

### GraphQL Directives

**@isAuthenticated** - Checks user context exists
```graphql
type Mutation {
  createStrategy(input: CreateStrategyInput!): Strategy! @isAuthenticated
}
```

**@hasScope** - Checks UMA permission
```graphql
type Mutation {
  updateStrategy(id: ID!, input: UpdateStrategyInput!): Strategy!
    @hasScope(resourceArg: "id", scope: "edit")

  deleteStrategy(id: ID!): ID!
    @hasScope(resourceArg: "id", scope: "delete")
}
```

**Available Scopes per Entity:**

| Entity | Scopes |
|--------|--------|
| Strategy | `view`, `edit`, `backtest`, `delete` |
| Bot | `view`, `run`, `stop`, `delete`, `edit` |
| Exchange | `view`, `edit`, `delete` |
| BotRunner | `view`, `edit`, `delete`, `make-public` |

**Scope definitions:** `internal/graph/keycloak_hooks.go:11-17`

### UMA 2.0 Resource Management

**Resource Lifecycle (All Entities):**

All entities (Strategy, Bot, Exchange, BotRunner) follow the same pattern:

**Create Entity with Resource:**
1. Database-first approach within transaction
2. Create entity in ENT
3. Create Keycloak resource with entity-specific scopes
4. Create permission policy for owner
5. If Keycloak fails, entire transaction rolls back

**Hooks:**
- `CreateStrategyWithResource` - Strategies with backtest scope
- `CreateBotWithResource` - Bots with run/stop scopes
- `CreateExchangeWithResource` - Exchanges
- `CreateBotRunnerWithResource` - Runners with make-public scope

See `internal/graph/keycloak_hooks.go`

**Delete Entity with Resource:**
1. Delete from database first
2. Attempt Keycloak cleanup (best effort)
3. Log warning if Keycloak fails (database deletion succeeded)

**Hooks:**
- `DeleteStrategyWithResource`
- `DeleteBotWithResource`
- `DeleteExchangeWithResource`
- `DeleteBotRunnerWithResource`

**Permission Check (Generic):**
- `@hasScope` directive extracts resource ID from GraphQL args
- Generic `verifyResourcePermission()` auto-detects entity type (`internal/graph/directives.go:29-65`)
- Calls entity-specific verify function (e.g., `VerifyBotPermission`)
- UMA client requests RPT from Keycloak
- Directive allows/denies based on result

**Verify Functions:**
- `VerifyStrategyPermission`, `VerifyStrategyOwnership`
- `VerifyBotPermission`, `VerifyBotOwnership`
- `VerifyExchangePermission`, `VerifyExchangeOwnership`
- `VerifyBotRunnerPermission`, `VerifyBotRunnerOwnership`

Implementation: `internal/keycloak/uma_client.go:102-123`

### Transaction Safety

**Database-First Approach:**
- Strategy created in database FIRST within transaction
- Keycloak resource created SECOND within same transaction
- If Keycloak fails, entire transaction rolls back
- Ensures database and Keycloak stay in sync

Transaction helper: `internal/graph/tx.go`

### Resource Ownership

**Owner Field:** `owner_id` (Group ID/Organization) on all entities
- Set during entity creation from authenticated user
- All entities (Strategy, Bot, Exchange, BotRunner) have `owner_id` field
- Fast ownership checks: `Verify{Entity}Ownership` in `keycloak_hooks.go`
- Resource owners have all scopes by default

**ENT Schema Definition:**
```go
field.String("owner_id").
    NotEmpty().
    Comment("Group ID (organization) that owns this entity")
```

### Security Best Practices

1. **Defense in Depth:** JWT validation → GraphQL directives → UMA authorization
2. **Fail-Safe Defaults:** All mutations require auth, sensitive ops require explicit scopes
3. **Transaction Integrity:** Rollback on Keycloak failure prevents orphaned resources
4. **Least Privilege:** Explicit permission grants required, fine-grained scopes

### Context Injection

Middleware injects ENT and UMA clients into context (`cmd/server/main.go:247-256`):
- Keycloak authentication required for all `/query` requests
- Optional auth for GraphQL Playground (`/`)
- ENT and UMA clients available to directives

### Troubleshooting

**Common Issues:**
- "Keycloak configuration is required" → Set all env vars
- "authentication required" → Include valid JWT in Authorization header
- "insufficient permissions" → Ensure user has permission or owns resource

**Debug:**
```bash
# Check Keycloak connectivity
curl https://keycloak.volaticloud.com/auth/realms/volaticloud/.well-known/openid-configuration

# Decode JWT
echo "<token>" | cut -d. -f2 | base64 -d | jq

# Check logs
kubectl logs -n volaticloud -l app=volaticloud-backend | grep -i "auth\|keycloak\|uma"
```

### Future Enhancements

- Permission sharing UI
- Role-based access control
- Audit logging
- Permission caching
- Batch permission checks for list queries

Full policy implementation (user/group/role/time-based) - see `internal/keycloak/uma_client.go:128-136`

---

## Quick Reference

**Commands:**
```bash
# Development
make generate     # Regenerate all (ENT + GraphQL + Freqtrade)
make build        # Build binary
make test         # Run tests with coverage
make dev          # Run development server

# Dashboard
cd dashboard && npm run codegen && npm run dev

# Docker
docker build -t ghcr.io/volaticloud/volaticloud:latest .

# Kubernetes
helm upgrade --install volaticloud-backend nixys/nxs-universal-chart \
  -f deployments/backend/values.yaml --namespace volaticloud
```

**Key Files:**
- `internal/graph/schema.graphqls` - GraphQL schema
- `internal/ent/schema/` - ENT schemas
- `gqlgen.yml` - GraphQL codegen config
- `Makefile` - Build commands
- `cmd/server/main.go` - Server entrypoint