# VolatiCloud - Architectural Patterns & Guidelines

## Core Principles

1. **Universal Abstraction** - Keep everything abstract and universal
2. **Minimal Schema** - Store only what cannot be derived from code
3. **Domain-Driven Design** - Clear domain boundaries, flat structure
4. **Context-Based DI** - Use Go context for dependency injection
5. **Single Config Field** - Use JSON for flexible configuration

---

## 1. Context-Based Dependency Injection

### Philosophy
Use Go's `context.Context` as the primary dependency injection mechanism. All services, loggers, database connections, and runtime implementations flow through the context.

### Pattern

```go
// Service initialization - returns new context with service
func InitLogger(ctx context.Context, config LogConfig) context.Context {
    logger := zerolog.New(os.Stdout).With().Timestamp().Logger()
    return context.WithValue(ctx, loggerKey, &logger)
}

func InitDatabase(ctx context.Context, dsn string) (context.Context, error) {
    client, err := ent.Open("postgres", dsn)
    if err != nil {
        return ctx, err
    }
    return context.WithValue(ctx, dbKey, client), nil
}

func InitRuntime(ctx context.Context, runtimeType string) (context.Context, error) {
    runtime, err := runtime.NewFactory().Create(runtimeType)
    if err != nil {
        return ctx, err
    }
    return context.WithValue(ctx, runtimeKey, runtime), nil
}

// Service retrieval - panics if missing (fail-fast)
func GetLogger(ctx context.Context) *zerolog.Logger {
    logger, ok := ctx.Value(loggerKey).(*zerolog.Logger)
    if !ok || logger == nil {
        panic("logger not found in context - did you forget to InitLogger?")
    }
    return logger
}

// Alternative: Return error instead of panic
func GetLoggerSafe(ctx context.Context) (*zerolog.Logger, error) {
    logger, ok := ctx.Value(loggerKey).(*zerolog.Logger)
    if !ok || logger == nil {
        return nil, errors.New("logger not found in context")
    }
    return logger, nil
}

func GetDB(ctx context.Context) *ent.Client {
    client, ok := ctx.Value(dbKey).(*ent.Client)
    if !ok || client == nil {
        panic("database client not found in context")
    }
    return client
}

func GetRuntime(ctx context.Context) runtime.Runtime {
    rt, ok := ctx.Value(runtimeKey).(runtime.Runtime)
    if !ok || rt == nil {
        panic("runtime not found in context")
    }
    return rt
}
```

### Context Keys
```go
package context

type contextKey string

const (
    loggerKey  contextKey = "logger"
    dbKey      contextKey = "database"
    runtimeKey contextKey = "runtime"
    configKey  contextKey = "config"
    tracerKey  contextKey = "tracer"
)
```

### Application Bootstrap

```go
// cmd/server/main.go
func main() {
    ctx := context.Background()

    // Initialize all services through context
    ctx = InitLogger(ctx, LogConfig{Level: "info"})
    ctx, err := InitDatabase(ctx, os.Getenv("DATABASE_URL"))
    if err != nil {
        log.Fatal(err)
    }
    defer GetDB(ctx).Close()

    ctx, err = InitRuntime(ctx, os.Getenv("RUNTIME_TYPE"))
    if err != nil {
        log.Fatal(err)
    }

    // Pass context to all handlers/services
    server := NewGraphQLServer(ctx)
    server.Start()
}
```

### Usage in Handlers

```go
func (r *mutationResolver) CreateBot(ctx context.Context, input CreateBotInput) (*ent.Bot, error) {
    // Get services from context
    logger := GetLogger(ctx)
    db := GetDB(ctx)
    runtime := GetRuntime(ctx)

    logger.Info().Str("bot_name", input.Name).Msg("creating bot")

    // Use services
    bot, err := db.Bot.Create().
        SetName(input.Name).
        Save(ctx)
    if err != nil {
        logger.Error().Err(err).Msg("failed to create bot")
        return nil, err
    }

    // Create runtime instance
    _, err = runtime.CreateBot(ctx, BotSpec{
        ID: bot.ID.String(),
        Name: bot.Name,
    })

    return bot, err
}
```

### Benefits
- ✅ No global variables
- ✅ Explicit dependencies
- ✅ Easy to test (mock context)
- ✅ Request-scoped values (tracing, auth)
- ✅ Fail-fast on missing dependencies

---

## 2. Domain-Driven Design (DDD)

### Project Structure

**IMPORTANT: Flat internal structure - NO nested subdirectories**

```
volaticloud/
├── cmd/
│   ├── server/
│   │   └── main.go              # Server entry point
│   └── worker/
│       └── main.go              # Worker entry point
│
├── internal/
│   ├── contextutil/             # Context utility functions
│   │   ├── keys.go              # Context keys
│   │   ├── logger.go            # Logger init/get
│   │   ├── database.go          # Database init/get
│   │   └── runtime.go           # Runtime init/get
│   │
│   ├── bot/                     # Bot domain
│   │   ├── service.go           # Bot business logic
│   │   ├── lifecycle.go         # Lifecycle operations
│   │   ├── config.go            # Config generation
│   │   └── metrics.go           # Metrics collection
│   │
│   ├── exchange/                # Exchange domain
│   │   ├── service.go           # Exchange operations
│   │   └── secrets.go           # Secret management
│   │
│   ├── strategy/                # Strategy domain
│   │   ├── service.go           # Strategy operations
│   │   └── validator.go         # Code validation
│   │
│   ├── backtest/                # Backtest domain
│   │   ├── service.go           # Backtest orchestration
│   │   └── executor.go          # Execution logic
│   │
│   ├── hyperopt/                # HyperOpt domain
│   │   ├── service.go           # HyperOpt orchestration
│   │   └── executor.go          # Execution logic
│   │
│   ├── trade/                   # Trade domain
│   │   ├── service.go           # Trade operations
│   │   └── sync.go              # Sync from freqtrade
│   │
│   ├── runtime/                 # Runtime abstraction (NO subdirs for implementations)
│   │   ├── interface.go         # Runtime interface
│   │   ├── factory.go           # Factory pattern
│   │   ├── docker.go            # Docker implementation
│   │   ├── kubernetes.go        # Kubernetes implementation
│   │   └── local.go             # Local implementation
│   │
│   ├── freqtrade/               # Freqtrade client
│   │   ├── client.go            # HTTP client
│   │   ├── models.go            # API models
│   │   └── api.go               # API methods
│   │
│   ├── config/                  # Configuration
│   │   ├── loader.go            # Load config
│   │   ├── validator.go         # Validate config
│   │   └── types.go             # Config types
│   │
│   ├── crypto/                  # Cryptography
│   │   ├── encryption.go        # AES encryption
│   │   └── keys.go              # Key management
│   │
│   ├── worker/                  # Background workers
│   │   ├── status_monitor.go   # Status monitoring
│   │   ├── trade_sync.go        # Trade sync
│   │   ├── runtime_manager.go  # Runtime management
│   │   ├── backtest.go          # Backtest execution
│   │   └── hyperopt.go          # HyperOpt execution
│   │
│   ├── auth/                    # Authentication
│   │   ├── jwt.go               # JWT handling
│   │   └── middleware.go        # Auth middleware
│   │
│   └── enum/                    # Enums and constants
│       ├── exchange.go          # Exchange enum
│       ├── runtime.go           # Runtime type enum
│       └── status.go            # Status enums
│
├── ent/
│   ├── schema/
│   │   ├── exchange.go
│   │   ├── exchangesecret.go
│   │   ├── strategy.go
│   │   ├── bot.go
│   │   ├── backtest.go
│   │   ├── hyperopt.go
│   │   └── trade.go
│   └── ...                      # Generated code
│
├── graph/
│   ├── schema.graphqls          # GraphQL schema
│   ├── resolver.go              # Resolver root
│   └── *.resolvers.go           # Generated resolvers
│
├── templates/
│   └── freqtrade/
│       └── base_config.json
│
├── Makefile
├── go.mod
├── go.sum
├── README.md
├── PLAN.md
└── ARCHITECTURE.md              # This file
```

### Key Principles

1. **One level deep** - No `internal/runtime/docker/client.go`, use `internal/runtime/docker.go`
2. **Domain per directory** - Each domain (bot, exchange, strategy) gets ONE directory
3. **Service per domain** - Each domain has a `service.go` with business logic
4. **Flat runtime** - All runtime implementations in `internal/runtime/*.go`
5. **Clear boundaries** - Domains don't import each other directly (use interfaces)

---

## 3. ENT + GQLGen Integration

### Overview
Use ENT's built-in GQLGen integration to automatically generate GraphQL types from ENT schemas. Bind GraphQL types to ENT types to avoid duplication.

### Configuration

**gqlgen.yml**
```yaml
# Let ENT generate the GraphQL schema
schema:
  - graph/schema.graphqls
  - ent.graphql              # Generated by ENT

exec:
  filename: graph/generated.go
  package: graph

model:
  filename: graph/models_gen.go
  package: graph

resolver:
  layout: follow-schema
  dir: graph
  package: graph
  filename_template: "{name}.resolvers.go"

# Bind ENT types to GraphQL types
models:
  # Reuse ENT types
  Bot:
    model: volaticloud/ent.Bot

  Exchange:
    model: volaticloud/ent.Exchange

  Strategy:
    model: volaticloud/ent.Strategy

  Backtest:
    model: volaticloud/ent.Backtest

  HyperOpt:
    model: volaticloud/ent.HyperOpt

  Trade:
    model: volaticloud/ent.Trade

  # Reuse ENT enums
  BotStatus:
    model: volaticloud/ent/bot.Status

  RuntimeType:
    model: volaticloud/ent/bot.RuntimeType

  ExchangeType:
    model: volaticloud/ent/exchange.Name

  # Connection types generated by ENT
  BotConnection:
    model: volaticloud/ent.BotConnection

  StrategyConnection:
    model: volaticloud/ent.StrategyConnection

# Autobind common types
autobind:
  - volaticloud/ent
  - volaticloud/ent/bot
  - volaticloud/ent/exchange
  - volaticloud/ent/strategy
  - volaticloud/ent/backtest
  - volaticloud/ent/hyperopt
  - volaticloud/ent/trade
```

### ENT Schema Annotations

```go
// ent/schema/bot.go
package schema

import (
    "entgo.io/contrib/entgql"
    "entgo.io/ent"
    "entgo.io/ent/schema"
    "entgo.io/ent/schema/edge"
    "entgo.io/ent/schema/field"
)

type Bot struct {
    ent.Schema
}

func (Bot) Annotations() []schema.Annotation {
    return []schema.Annotation{
        entgql.QueryField(),           // Enable GraphQL query
        entgql.Mutations(entgql.MutationCreate()), // Enable create mutation
    }
}

func (Bot) Fields() []ent.Field {
    return []ent.Field{
        field.String("name").
            Annotations(entgql.OrderField("NAME")), // Enable ordering by name
        field.Enum("status").
            Values("creating", "running", "stopped", "error").
            Annotations(entgql.Skip(entgql.SkipMutationCreateInput)), // Don't expose in create input
        field.JSON("config", map[string]interface{}{}).
            Optional(),
    }
}

func (Bot) Edges() []ent.Edge {
    return []ent.Edge{
        edge.From("exchange", Exchange.Type).
            Ref("bots").
            Unique().
            Required().
            Annotations(entgql.Bind()), // Bind in GraphQL
        edge.From("strategy", Strategy.Type).
            Ref("bots").
            Unique().
            Required().
            Annotations(entgql.Bind()),
        edge.To("trades", Trade.Type).
            Annotations(entgql.RelayConnection()), // Relay-style pagination
    }
}
```

### Generate GraphQL Schema

```bash
# Generate ENT code with GraphQL annotations
go generate ./ent

# Generate GraphQL resolvers
go run github.com/99designs/gqlgen generate
```

### Custom Resolvers

```go
// graph/bot.resolvers.go
package graph

import (
    "context"
    "volaticloud/ent"
)

func (r *mutationResolver) CreateBot(ctx context.Context, input ent.CreateBotInput) (*ent.Bot, error) {
    logger := contextutil.GetLogger(ctx)
    db := contextutil.GetDB(ctx)
    runtime := contextutil.GetRuntime(ctx)

    // Validate input
    if input.Name == "" {
        return nil, errors.New("bot name is required")
    }

    // Create bot in database
    bot, err := db.Bot.Create().
        SetInput(input).  // ENT-generated input setter
        Save(ctx)
    if err != nil {
        return nil, err
    }

    // Create runtime instance
    _, err = runtime.CreateBot(ctx, BotSpec{
        ID: bot.ID.String(),
        Name: bot.Name,
        Config: bot.Config,
    })
    if err != nil {
        // Rollback database change
        db.Bot.DeleteOneID(bot.ID).ExecX(ctx)
        return nil, err
    }

    logger.Info().Str("bot_id", bot.ID.String()).Msg("bot created")
    return bot, nil
}
```

### Benefits
- ✅ No duplicate type definitions
- ✅ Type safety between ENT and GraphQL
- ✅ Automatic pagination (Relay connections)
- ✅ Automatic filtering and ordering
- ✅ Less boilerplate code

---

## 4. Makefile Specification

### Makefile

```makefile
.PHONY: help setup generate build build-all clean test lint dev worker

# Default target
.DEFAULT_GOAL := help

# Variables
BINARY_SERVER=bin/server
BINARY_WORKER=bin/worker
GO=go
GOFLAGS=-v
LDFLAGS=-ldflags "-s -w"

## help: Display this help message
help:
	@echo "Available targets:"
	@awk 'BEGIN {FS = ":.*##"; printf "\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Setup

## setup: Install dependencies and tools
setup:
	@echo "Installing dependencies..."
	$(GO) mod download
	$(GO) mod tidy
	@echo "Installing tools..."
	$(GO) install entgo.io/ent/cmd/ent@latest
	$(GO) install github.com/99designs/gqlgen@latest
	@echo "Setup complete!"

##@ Code Generation

## generate: Generate all code (ENT + GraphQL)
generate:
	@echo "Generating ENT code..."
	$(GO) generate ./ent
	@echo "Generating GraphQL code..."
	$(GO) run github.com/99designs/gqlgen generate
	@echo "Running go generate..."
	$(GO) generate ./...
	@echo "Code generation complete!"

##@ Build

## build-server: Build server binary
build-server: generate
	@echo "Building server..."
	$(GO) build $(GOFLAGS) $(LDFLAGS) -o $(BINARY_SERVER) ./cmd/server
	@echo "Server built: $(BINARY_SERVER)"

## build-worker: Build worker binary
build-worker: generate
	@echo "Building worker..."
	$(GO) build $(GOFLAGS) $(LDFLAGS) -o $(BINARY_WORKER) ./cmd/worker
	@echo "Worker built: $(BINARY_WORKER)"

## build-all: Build all binaries
build-all: build-server build-worker
	@echo "All binaries built successfully!"

## clean: Remove built binaries
clean:
	@echo "Cleaning..."
	rm -rf bin/
	@echo "Clean complete!"

##@ Development

## dev: Run server in development mode
dev: generate
	@echo "Starting server in development mode..."
	$(GO) run ./cmd/server

## worker: Run background workers
worker: generate
	@echo "Starting workers..."
	$(GO) run ./cmd/worker

##@ Testing

## test: Run tests
test:
	@echo "Running tests..."
	$(GO) test -v -race -coverprofile=coverage.out ./...
	$(GO) tool cover -html=coverage.out -o coverage.html
	@echo "Tests complete! Coverage report: coverage.html"

## test-short: Run short tests (skip integration)
test-short:
	@echo "Running short tests..."
	$(GO) test -v -short ./...

## lint: Run linters
lint:
	@echo "Running linters..."
	golangci-lint run ./...
	@echo "Linting complete!"

##@ Database

## db-migrate: Run database migrations
db-migrate:
	@echo "Running migrations..."
	$(GO) run ./cmd/migrate
	@echo "Migrations complete!"

## db-reset: Reset database (WARNING: Deletes all data)
db-reset:
	@echo "Resetting database..."
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		$(GO) run ./cmd/migrate --reset; \
		echo "Database reset complete!"; \
	else \
		echo "Aborted."; \
	fi

## db-seed: Seed database with test data
db-seed:
	@echo "Seeding database..."
	$(GO) run ./cmd/seed
	@echo "Seeding complete!"

##@ Docker

## docker-build: Build Docker images
docker-build:
	@echo "Building Docker images..."
	docker build -t volaticloud/freqtrade:latest -f docker/freqtrade/Dockerfile .
	docker build -t volaticloud/control-plane:latest -f docker/control-plane/Dockerfile .
	@echo "Docker images built!"

## docker-up: Start development services (PostgreSQL, Redis)
docker-up:
	@echo "Starting development services..."
	docker compose up -d
	@echo "Services started!"

## docker-down: Stop development services
docker-down:
	@echo "Stopping development services..."
	docker compose down
	@echo "Services stopped!"

## docker-logs: View Docker logs
docker-logs:
	docker compose logs -f

##@ Utilities

## fmt: Format code
fmt:
	@echo "Formatting code..."
	$(GO) fmt ./...
	@echo "Formatting complete!"

## vet: Run go vet
vet:
	@echo "Running go vet..."
	$(GO) vet ./...
	@echo "Vet complete!"

## mod-tidy: Tidy go.mod
mod-tidy:
	@echo "Tidying go.mod..."
	$(GO) mod tidy
	@echo "Tidy complete!"

## check: Run all checks (fmt, vet, lint, test)
check: fmt vet lint test
	@echo "All checks passed!"
```

### Usage

```bash
# Display help
make help

# Setup project
make setup

# Generate code
make generate

# Build all binaries
make build-all

# Development
make dev          # Run server
make worker       # Run workers

# Testing
make test         # Run all tests
make lint         # Run linters

# Docker
make docker-up    # Start PostgreSQL
make docker-down  # Stop services
```

---

## 5. Configuration Philosophy

### Universal Config Pattern

All entities use a single `config` JSON field for flexibility:

```go
// Bot config example
{
  "max_open_trades": 3,
  "stake_amount": 100,
  "pairs": ["BTC/USDT", "ETH/USDT"],
  "timeframe": "5m",
  "dry_run": true,
  "resource_limits": {
    "memory": "512MB",
    "cpu": "0.5"
  }
}

// Backtest config example
{
  "starting_balance": 10000,
  "fee": 0.001,
  "enable_protections": true,
  "max_open_trades": 5
}

// HyperOpt config example
{
  "hyperopt_loss": "SharpeHyperOptLoss",
  "hyperopt_random_state": 42,
  "hyperopt_min_trades": 10
}
```

### Benefits
- ✅ No schema changes for new config options
- ✅ Forward/backward compatible
- ✅ Easy to extend
- ✅ User can override anything
- ✅ Universal pattern across all entities

---

## Summary

**Core Architectural Decisions:**

1. ✅ **Context-based DI** - All services through context, fail-fast
2. ✅ **Flat DDD structure** - One level deep, clear domains
3. ✅ **ENT + GQLGen binding** - No duplicate types, type safety
4. ✅ **Makefile automation** - `make build-all` handles everything
5. ✅ **Universal config JSON** - One field, maximum flexibility
6. ✅ **Exchange enum** - Type-safe exchange selection
7. ✅ **Secrets table** - Flexible credential storage

**Document Version:** 1.0
**Last Updated:** 2025-10-13
