/*
Package graph provides GraphQL API implementation using gqlgen with ENT ORM integration.

# Architecture Overview

The graph package implements VolatiCloud's GraphQL API, serving as the bridge between frontend
clients and backend services. It uses gqlgen for schema-first GraphQL code generation and
integrates tightly with ENT ORM for type-safe database operations.

	┌──────────────────────────────────────────────────────┐
	│              GraphQL Client (Dashboard)              │
	└────────────────────┬─────────────────────────────────┘
	                     │ HTTP POST /query
	              ┌──────▼──────┐
	              │  Middleware │
	              │  (Auth, DI) │
	              └──────┬──────┘
	                     │
	              ┌──────▼──────┐
	              │   gqlgen    │
	              │  Generated  │
	              └──────┬──────┘
	                     │
	     ┌───────────────┼───────────────┐
	     │               │               │
	┌────▼────┐    ┌────▼────┐    ┌────▼────┐
	│ Query   │    │Mutation │    │ Entity  │
	│Resolvers│    │Resolvers│    │Resolvers│
	└────┬────┘    └────┬────┘    └────┬────┘
	     │               │               │
	     └───────────────┼───────────────┘
	                     │
	              ┌──────▼──────┐
	              │ ENT Client  │
	              └──────┬──────┘
	                     │
	              ┌──────▼──────┐
	              │  PostgreSQL │
	              └─────────────┘

# Core Components

## Resolver

The Resolver struct provides dependency injection for all GraphQL operations:

	type Resolver struct {
		client    *ent.Client            // Database client
		auth      *auth.KeycloakClient   // Authentication client
		umaClient keycloak.UMAClientInterface // Authorization client
	}

All resolver methods receive dependencies via this struct, following
context-based dependency injection pattern (ADR-0001).

## Code Generation

The package uses gqlgen for automatic code generation:

	Generated Files (DO NOT EDIT):
	  - generated.go: GraphQL server implementation
	  - ent.resolvers.go: ENT-generated entity resolvers

	Manual Files (EDIT FREELY):
	  - resolver.go: Resolver struct and dependencies
	  - schema.resolvers.go: Custom query/mutation implementations
	  - directives.go: Custom directive implementations
	  - helpers.go: Helper functions for building specs
	  - tx.go: Transaction helper utilities

## Schema Integration

ENT ORM generates GraphQL schema automatically:

	Schema Flow:
	  1. Define ENT schema (internal/ent/schema/*.go)
	  2. Run `go generate` → generates internal/graph/ent.graphql
	  3. gqlgen merges ent.graphql + schema.graphqls
	  4. gqlgen generates resolvers and types
	  5. Implement custom resolver methods

This ensures single source of truth for database and API schemas (ADR-0002).

# Dependency Injection

## Context-Based Pattern

Dependencies flow through context.Context, not global variables or constructors:

### Middleware Setup (cmd/server/main.go):

	injectClientsMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			ctx = graph.SetEntClientInContext(ctx, entClient)
			ctx = graph.SetUMAClientInContext(ctx, umaClient)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}

### Directive Usage (directives.go):

	func (d *Directives) InjectEntClient(ctx context.Context, obj interface{},
		next graphql.Resolver) (interface{}, error) {

		entClient := MustGetEntClientFromContext(ctx)
		// Use entClient in child resolvers...
		return next(ctx)
	}

Benefits:
  - No global state
  - Request-scoped dependencies
  - Works with gqlgen's code generation
  - Type-safe context keys (private struct types)

## Private Context Keys

Context keys use private struct types to prevent collisions:

	type entClientCtxKey struct{}
	type umaClientCtxKey struct{}

	func SetEntClientInContext(ctx context.Context, client *ent.Client) context.Context {
		return context.WithValue(ctx, entClientCtxKey{}, client)
	}

This ensures only this package can set/get these values.

# GraphQL Directives

Custom directives extend GraphQL functionality:

## @injectEntClient

Injects ENT client into resolver context:

	type Query {
	  bots(first: Int, after: Cursor): BotConnection! @injectEntClient
	}

Ensures all child resolvers have access to database client.

## @injectUMAClient

Injects Keycloak UMA client for authorization:

	type Mutation {
	  createBot(input: CreateBotInput!): Bot! @injectUMAClient
	}

Used for resource-based authorization checks.

## @authorized

Enforces authorization checks using Keycloak UMA:

	type Mutation {
	  deleteBot(id: ID!): ID! @authorized(resource: "bot", permission: "bot:delete")
	}

Flow:
 1. Extract resource ID from mutation args
 2. Request permission token from Keycloak
 3. If granted: proceed to resolver
 4. If denied: return 403 Forbidden error

# Transaction Management

Database transactions ensure atomicity for multi-step operations:

## WithTx Helper

Transaction wrapper with automatic rollback:

	func WithTx(ctx context.Context, client *ent.Client,
		fn func(tx *ent.Tx) error) error {

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
			tx.Rollback()
			return err
		}

		return tx.Commit()
	}

## Usage Example (Strategy Versioning):

	err := WithTx(ctx, r.client, func(tx *ent.Tx) error {
		// Mark old version as not latest
		if err := tx.Strategy.UpdateOne(existingStrategy).
			SetIsLatest(false).
			Exec(ctx); err != nil {
			return err
		}

		// Create new version
		newStrategy, err = tx.Strategy.Create().
			SetName(existingStrategy.Name).
			SetCode(input.Code).
			SetParentID(existingStrategy.ID).
			SetVersionNumber(existingStrategy.VersionNumber + 1).
			SetIsLatest(true).
			Save(ctx)

		return err // Commit or rollback
	})

Benefits:
  - Automatic rollback on error
  - Panic recovery
  - Follows ENT best practices
  - Prevents partial state

# Helper Functions

## BotSpec Builder

buildBotSpec creates runner.BotSpec from Bot entity:

	Three-Layer Config Architecture:
	  1. ExchangeConfig (config.exchange.json)
	  2. StrategyConfig (config.strategy.json)
	  3. Config (config.bot.json)

Freqtrade merges them via:

	freqtrade trade \
	  --config /freqtrade/config/config.exchange.json \
	  --config /freqtrade/config/config.strategy.json \
	  --config /freqtrade/config/config.bot.json \
	  --strategy MyStrategy

Critical Features:
  - NO config merging in Go (Freqtrade handles it)
  - Auto-injects dry_run field based on bot mode
  - Deep copies bot config to prevent mutation
  - Validates exchange config via JSON schema

## BacktestSpec Builder

backtest.BuildSpec creates runner.BacktestSpec from Backtest entity (see internal/backtest/spec.go):

	Backtest Configuration:
	  - Strategy code and config
	  - Timerange (e.g., "20240101-20241101")
	  - Pair list (e.g., ["BTC/USDT", "ETH/USDT"])
	  - Stake amount and currency
	  - Entry/exit pricing

## Config Validation

validateFreqtradeConfig ensures required Freqtrade fields:

	Required Fields:
	  - stake_currency (string)
	  - stake_amount (number)
	  - exit_pricing (object with price_side, use_order_book, order_book_top)
	  - entry_pricing (object with price_side, use_order_book, order_book_top)

validateExchangeConfig validates against Freqtrade JSON schema:

	Uses official schema from:
	  https://schema.freqtrade.io/schema.json

# Strategy Versioning

Immutable strategy versioning ensures reproducibility (ADR-0003):

## Auto-Versioning Triggers:

	updateStrategy Mutation:
	  1. Load existing strategy
	  2. Start transaction
	  3. Mark old version as is_latest=false
	  4. Create new version with incremented version_number
	  5. Commit (or rollback on error)

	createBacktest Mutation:
	  1. Check if strategy has existing backtests
	  2. If yes: auto-create new version first
	  3. Use new version ID for backtest
	  4. Ensures backtest doesn't mutate tested strategy

## Query Patterns:

	latestStrategies:
	  - Returns only strategies with is_latest=true
	  - Default dashboard view

	strategyVersions(name: String!):
	  - Returns all versions for given strategy name
	  - Ordered by version_number descending

## Critical Implementation Detail:

Strategy has a one-to-one relationship with Backtest:

	edge.To("backtest", Backtest.Type).
		Unique().
		Comment("Strategy can have at most one backtest (one-to-one)")

Always use the singular edge when checking for existing backtest:

	existingStrategy, _ := r.client.Strategy.Query().
		Where(strategy.ID(strategyID)).
		WithBacktest().  // CORRECT - singular
		Only(ctx)

	if existingStrategy.Edges.Backtest != nil {
		// Strategy already has a backtest
	}

# Schema Validation

## Freqtrade JSON Schema Integration

Bot and exchange configs validated against official Freqtrade schema:

### Implementation (schema_validator.go):

	Schema Loading:
	  - Fetches from https://schema.freqtrade.io/schema.json
	  - Caches in memory (fetched once per server lifecycle)

	Validation:
	  - Uses github.com/xeipuuv/gojsonschema
	  - Returns descriptive error messages
	  - Filters to relevant fields (exchange validation only shows exchange errors)

### Usage:

	validateFreqtradeConfigWithSchema(config):
	  - Validates complete bot config
	  - Called in updateBot mutation

	exchange.ValidateConfigWithSchema(config):
	  - Validates exchange config only
	  - Wraps partial config in minimal Freqtrade structure
	  - Filters errors to exchange-related fields

Benefits:
  - Automatic validation against Freqtrade requirements
  - Clear error messages from schema
  - No manual validation code to maintain
  - Always up-to-date with Freqtrade changes

# Keycloak Integration

## Resource Registration Hooks

Automatic UMA resource registration for authorization:

### Entity Lifecycle Hooks (keycloak_hooks.go):

	On Create:
	  - Register resource in Keycloak UMA
	  - Store resource_id in entity
	  - Set owner permissions

	On Update:
	  - Update resource metadata

	On Delete:
	  - Deregister resource from Keycloak

### Supported Entities:

  - Bot: "bot" resource type
  - Exchange: "exchange" resource type
  - Strategy: "strategy" resource type
  - Backtest: "backtest" resource type

### Permission Patterns:

	bot:view   - Read bot details
	bot:update - Modify bot configuration
	bot:delete - Remove bot
	bot:start  - Start/stop bot operations

## Authorization Flow:

 1. User makes GraphQL request
 2. @authorized directive intercepts
 3. Extract resource ID from args
 4. Request permission token from Keycloak
 5. Keycloak checks policies and permissions
 6. If granted: proceed, If denied: 403 error

## Self-Healing Scope Synchronization:

The SyncResourceScopes function provides automatic scope synchronization with
deduplication and cooldown to prevent thundering herd and infinite retry loops.

### Architecture (permission_helpers.go):

```
Concurrent Requests for same resource:

	Request 1 → LoadOrStore(resourceID, doneCh) → First! → Sync → Close(doneCh)
	Request 2 → LoadOrStore(resourceID, doneCh) → Wait on existing channel
	Request 3 → LoadOrStore(resourceID, doneCh) → Wait on existing channel
	...
	Request N → All wait → All return when first completes

Cooldown on failure:

	Sync fails → Store(resourceID, timestamp) → Block retries for 5 minutes
	Sync succeeds → Delete(resourceID) → Clear cooldown

```

### Deduplication:

Uses sync.Map to ensure only ONE sync operation per resource ID at a time:

  - First goroutine creates channel and performs sync
  - Concurrent goroutines wait on the same channel
  - All goroutines return when sync completes
  - Map entry cleaned up after completion

### Cooldown Period:

Tracks failed sync attempts to prevent infinite retry loops:

  - On sync failure: stores timestamp with 5-minute cooldown
  - Subsequent attempts blocked until cooldown expires
  - On sync success: clears cooldown entry
  - Prevents API hammering when Keycloak is unavailable

### Usage in Resolvers:

	hasPermission, err := umaClient.CheckPermission(ctx, token, resourceID, scope)
	if authz.ShouldTriggerSelfHealing(hasPermission, err) {
	    // Sync with automatic deduplication and cooldown
	    if syncErr := SyncResourceScopes(ctx, client, resourceID); syncErr != nil {
	        log.Printf("Self-healing failed: %v", syncErr)
	    }
	    // Retry permission check
	    hasPermission, err = umaClient.CheckPermission(ctx, token, resourceID, scope)
	}

### Concurrency Properties:

  - Thread-safe using sync.Map primitives
  - 10 concurrent requests → 1 sync call (verified by tests)
  - Context cancellation support for graceful shutdown
  - No goroutine leaks (channels closed, map cleaned up)

# Error Handling

## GraphQL Error Format:

	{
	  "errors": [{
	    "message": "missing required Freqtrade config fields: [stake_currency]",
	    "path": ["updateBot"],
	    "extensions": {
	      "code": "VALIDATION_ERROR"
	    }
	  }]
	}

## Common Error Patterns:

	Validation Errors:
	  - Invalid config format
	  - Missing required fields
	  - Type mismatches

	Authorization Errors:
	  - 401 Unauthorized (no token)
	  - 403 Forbidden (no permission)

	Database Errors:
	  - Constraint violations
	  - Foreign key errors
	  - Transaction rollbacks

## Error Propagation:

Errors from helper functions propagate to GraphQL error response:

	if err := validateFreqtradeConfig(input.Config); err != nil {
		return nil, err // Becomes GraphQL error
	}

gqlgen automatically wraps errors with path and extensions.

# Testing

## Test Infrastructure (resolver_test.go, test_setup_test.go):

	Setup:
	  - In-memory SQLite database
	  - Fresh schema migration
	  - Test data fixtures

	Helpers:
	  - setupTestResolver() - Creates resolver with test ENT client
	  - ptr() - Helper for pointer fields
	  - ctx() - Creates context
	  - Mock Keycloak clients

## Test Coverage:

	Resolver Tests:
	  - Query resolvers: 100%
	  - Mutation resolvers: 97%
	  - Total: 91.9% (excluding generated code)

	Test Categories:
	  - CRUD operations for all entities
	  - Strategy versioning logic
	  - Config validation
	  - Authorization integration
	  - Transaction rollback scenarios

## Running Tests:

	# All tests with coverage
	make test

	# Specific resolver tests
	go test -v ./internal/graph -run TestCreateBot

	# Coverage report
	make coverage

# Usage Patterns

## Creating a Bot:

	mutation CreateBot($input: CreateBotInput!) {
	  createBot(input: $input) {
	    id
	    name
	    status
	    containerID
	  }
	}

Variables:

	{
	  "input": {
	    "name": "My Trading Bot",
	    "exchangeID": "...",
	    "strategyID": "...",
	    "botRunnerID": "...",
	    "mode": "DRY_RUN",
	    "freqtradeVersion": "stable",
	    "config": {
	      "stake_currency": "USDT",
	      "stake_amount": 100,
	      "max_open_trades": 3,
	      "entry_pricing": {
	        "price_side": "same",
	        "use_order_book": false
	      },
	      "exit_pricing": {
	        "price_side": "same",
	        "use_order_book": false
	      }
	    }
	  }
	}

## Querying Bots with Filters:

	query GetBots($first: Int, $where: BotWhereInput) {
	  bots(first: $first, where: $where) {
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
	    pageInfo {
	      hasNextPage
	      endCursor
	    }
	  }
	}

Variables:

	{
	  "first": 10,
	  "where": {
	    "status": "RUNNING"
	  }
	}

## Strategy Versioning:

	# Get latest versions only
	query GetLatestStrategies {
	  latestStrategies {
	    id
	    name
	    versionNumber
	    isLatest
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

# Files

	resolver.go                     - Resolver struct and dependency injection
	generated.go                    - gqlgen generated server (DO NOT EDIT)
	ent.resolvers.go                - ENT generated entity resolvers (DO NOT EDIT)
	schema.resolvers.go             - Custom query/mutation implementations
	directives.go                   - Custom directive implementations
	tx.go                           - Transaction helper utilities
	helpers.go                      - BotSpec/BacktestSpec builders
	strategy_helpers.go             - Strategy versioning logic
	schema_validator.go             - Freqtrade JSON schema validation
	keycloak_hooks.go               - UMA resource registration hooks

	resolver_test.go                - Test infrastructure setup
	test_setup_test.go              - Test helpers and fixtures
	test_helpers_test.go            - Test utility functions
	test_mocks_test.go              - Mock implementations
	helpers_test.go                 - Helper function tests (100% coverage)
	strategy_versioning_test.go     - Strategy versioning tests (100% coverage)
	directives_test.go              - Directive tests
	authorization_integration_test.go - Full authorization flow tests

# Schema Files

	schema/
	  ent.graphql                   - ENT generated schema (DO NOT EDIT)
	  schema.graphqls               - Custom types and extensions

# Related Packages

	internal/ent                    - Database ORM and entities
	internal/auth                   - Keycloak authentication
	internal/keycloak               - Keycloak UMA authorization
	internal/runner                 - Bot runtime abstraction
	internal/monitor                - Bot monitoring
	internal/backtest               - Backtest result processing

# References

  - ADR-0001: Context-Based Dependency Injection
  - ADR-0002: ENT ORM with GraphQL Integration
  - ADR-0003: Strategy Immutable Versioning
  - gqlgen Documentation: https://gqlgen.com/
  - ENT GraphQL Integration: https://entgo.io/docs/graphql/
  - GraphQL Spec: https://spec.graphql.org/
*/
package graph
