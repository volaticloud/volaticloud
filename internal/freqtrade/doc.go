/*
Package freqtrade provides a Go client for the Freqtrade REST API.

# Overview

This package contains both auto-generated API client code and manual wrapper code
for interacting with Freqtrade trading bots. Freqtrade is a cryptocurrency trading
bot framework that exposes a REST API for monitoring and control.

# Architecture

The package is organized into two categories:

**Auto-Generated Files** (DO NOT EDIT):
  - api_freqtrade.go       - Main API client with all endpoint methods
  - client.go              - HTTP client and request execution
  - configuration.go       - Client configuration struct
  - model_*.go             - Data models for requests/responses (90+ files)

**Manual Files** (Safe to Edit):
  - bot_client.go          - High-level wrapper with authentication
  - config_validator.go    - Freqtrade config validation helpers
  - response.go            - Custom response types
  - utils.go               - Utility functions
  - doc.go                 - This documentation file

# Code Generation

The auto-generated code is created from the official Freqtrade OpenAPI specification
using the OpenAPI Generator tool. This ensures type-safe API clients that stay in
sync with the Freqtrade API.

## Regenerating the Client

To regenerate the client after updating the OpenAPI spec:

	make generate-freqtrade

Or run the full code generation pipeline (ENT + GraphQL + Freqtrade):

	make generate

The generation process:
 1. Reads openapi.json from internal/freqtrade/openapi.json
 2. Runs openapitools/openapi-generator-cli in Docker
 3. Generates Go code with int64 type mappings (for Unix millisecond timestamps)
 4. Cleans up generated test files and docs (we maintain our own)
 5. Formats the generated Go code with gofmt

## Important Configuration

The Makefile configures the generator with critical settings:

	--type-mappings=integer=int64

This ensures all integer fields use int64 instead of int32, which is essential
for handling Freqtrade's Unix timestamps in milliseconds (values > 2.1 billion).

Without this mapping, you'll get JSON unmarshaling errors like:

	cannot unmarshal number 1761743045808 into Go struct field of type int32

# Obtaining and Updating the OpenAPI Specification

## Current Specification

The current OpenAPI spec (v0.1.0) is located at:

	internal/freqtrade/openapi.json

## Updating to a New Freqtrade Version

Freqtrade does not publish official OpenAPI specs in a central registry. You must
extract the spec from a running Freqtrade instance:

**Method 1: From Running Freqtrade Instance**

	# Start Freqtrade with API enabled
	docker run -d -p 8080:8080 freqtradeorg/freqtrade:stable --api-server

	# Fetch the OpenAPI spec
	curl http://localhost:8080/docs/openapi.json > internal/freqtrade/openapi.json

	# Regenerate the client
	make generate-freqtrade

**Method 2: Extract from Freqtrade Source**

	# Clone Freqtrade repository
	git clone https://github.com/freqtrade/freqtrade.git
	cd freqtrade

	# The OpenAPI spec is generated dynamically by FastAPI
	# Start the server and fetch the spec as shown in Method 1

**Method 3: View Official API Docs**

Freqtrade's API documentation is available at:

	https://www.freqtrade.io/en/stable/rest-api/

The spec is embedded in their running instances but not published separately.

## Version Compatibility

When updating the OpenAPI spec to a new Freqtrade version:
 1. Check breaking changes in Freqtrade release notes
 2. Update openapi.json with the new spec
 3. Run make generate-freqtrade
 4. Review generated code for breaking changes
 5. Update manual wrapper code (bot_client.go, etc.) if needed
 6. Run tests: make test
 7. Update this doc.go with the new version number

# Integration with VolatiCloud

## Bot Monitoring

The BotClient wrapper is used by the bot monitor to fetch metrics:

	// internal/monitor/bot_monitor.go
	client := freqtrade.NewBotClient(baseURL, username, password)
	profit, err := client.GetProfit(ctx)

See internal/monitor/bot_monitor.go for full integration example.

## Configuration Validation

Bot configurations are validated against Freqtrade's requirements before
being stored in the database:

	// internal/graph/helpers.go
	if err := validateFreqtradeConfig(config); err != nil {
		return fmt.Errorf("invalid config: %w", err)
	}

JSON schema validation is performed using the official Freqtrade schema:

	https://schema.freqtrade.io/schema.json

See internal/graph/schema_validator.go for implementation.

## ENT Integration

Freqtrade configs are stored in ENT entities as JSON fields:

	// internal/ent/schema/bot.go
	field.JSON("config", map[string]interface{}{}).Optional()

The config is validated before storage and passed to Docker containers
at bot creation time.

## GraphQL Integration

Freqtrade metrics are exposed via GraphQL queries:

	query GetBotMetrics($id: ID!) {
		bots(where: {id: $id}, first: 1) {
			edges {
				node {
					id
					name
					metrics {
						profitAllCoin
						profitAllPercent
						tradeCount
						winrate
					}
				}
			}
		}
	}

Metrics are fetched from the Freqtrade API and stored in the bot_metrics table.

# Usage Examples

## Basic Client Usage

	import "volaticloud/internal/freqtrade"

	// Create authenticated client
	client := freqtrade.NewBotClient(
		"http://localhost:8080",
		"username",
		"password",
	)

	// Fetch profit metrics
	profit, err := client.GetProfit(ctx)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Total profit: %.2f %s\n",
		profit.ProfitAllCoin, profit.StakeCurrency)

## Connection Strategies

The client supports multiple connection strategies for different deployment scenarios:

**Container IP (Kubernetes/Docker Compose)**

	client := freqtrade.NewBotClientFromContainerIP(
		"172.17.0.5",  // Container IP
		8080,          // API port
		"username",
		"password",
	)

**Localhost (Development)**

	client := freqtrade.NewBotClient(
		"http://localhost:8080",
		"username",
		"password",
	)

The bot monitor implements automatic fallback:
 1. Try container IP with 2-second timeout
 2. If failed, fall back to localhost:hostPort
 3. Log connection method for debugging

See internal/monitor/bot_monitor.go for the universal connection strategy.

## Fetching Bot Status

	status, err := client.GetStatus(ctx)
	if err != nil {
		log.Fatal(err)
	}

	for _, trade := range status {
		fmt.Printf("Open trade: %s at %.2f\n",
			trade.Pair, trade.OpenRate)
	}

## Health Check

	if err := client.Ping(ctx); err != nil {
		log.Fatal("Freqtrade API unreachable:", err)
	}

# Type Safety

All API requests and responses are strongly typed. For example:

	type Profit struct {
		ProfitAllCoin       float64  `json:"profit_all_coin"`
		ProfitAllPercent    float64  `json:"profit_all_percent"`
		TradeCount          int64    `json:"trade_count"`
		FirstTradeTimestamp int64    `json:"first_trade_timestamp"`  // Unix milliseconds
		LatestTradeTimestamp int64   `json:"latest_trade_timestamp"` // Unix milliseconds
		// ... 20+ more fields
	}

The generated models include proper JSON tags and type mappings, ensuring correct
serialization/deserialization of all Freqtrade API responses.

# Error Handling

The client provides detailed error messages:

	profit, err := client.GetProfit(ctx)
	if err != nil {
		// Error includes HTTP status codes and API error messages
		log.Printf("Failed to fetch profit: %v", err)
		return err
	}

All API methods check:
  - HTTP status codes (expecting 200 OK)
  - Network errors
  - JSON unmarshaling errors

# Testing

The package includes validation tests for config structure:

	go test -v ./internal/freqtrade -run TestValidateFreqtradeConfig

Integration tests use the bot monitor's universal connection strategy to
test against real Freqtrade instances in Docker.

# Maintenance

## When to Regenerate

Regenerate the client when:
 1. Upgrading to a new Freqtrade version
 2. New API endpoints are added
 3. Request/response models change
 4. Bug fixes in the OpenAPI spec

## DO NOT Edit Generated Files

The following files are auto-generated and will be overwritten:
  - api_freqtrade.go
  - client.go
  - configuration.go
  - model_*.go

Instead:
  - Update openapi.json
  - Regenerate with make generate-freqtrade
  - Add custom logic in bot_client.go or new manual files

## Safe to Edit

These files contain manual wrapper code:
  - bot_client.go - Add new convenience methods here
  - config_validator.go - Add validation logic
  - response.go - Add custom response types
  - utils.go - Add helper functions

# Related Documentation

- Freqtrade API Docs: https://www.freqtrade.io/en/stable/rest-api/
- Freqtrade JSON Schema: https://schema.freqtrade.io/schema.json
- OpenAPI Generator: https://openapi-generator.tech/
- Bot Monitor: internal/monitor/bot_monitor.go
- Config Validation: internal/graph/schema_validator.go

# Version History

- v0.1.0 (Current): Initial OpenAPI spec from Freqtrade stable
*/
package freqtrade
