.PHONY: help setup dev test coverage lint generate migrate clean build

# Default target
help:
	@echo "AnyTrade - Makefile Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make setup        - Install dependencies and initialize project"
	@echo "  make generate     - Generate ENT and GraphQL code"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Run server in development mode"
	@echo "  make build        - Build binary"
	@echo "  make test         - Run tests with coverage"
	@echo "  make coverage     - Run tests and open HTML coverage report"
	@echo "  make lint         - Run linters"
	@echo ""
	@echo "Database:"
	@echo "  make migrate      - Run database migrations"
	@echo "  make db-reset     - Reset database (removes data/anytrade.db)"
	@echo ""
	@echo "Other:"
	@echo "  make clean        - Clean generated files and build artifacts"

# Setup project
setup:
	@echo "Installing Go dependencies..."
	go mod download
	go mod tidy
	@echo "Generating code..."
	$(MAKE) generate
	@echo "Setup complete!"

# Generate Freqtrade API client from OpenAPI spec (using Docker)
generate-freqtrade:
	@echo "Generating Freqtrade API client from OpenAPI spec..."
	@which docker > /dev/null || (echo "Docker not installed. Please install Docker." && exit 1)
	@docker run --rm --user $$(id -u):$$(id -g) -v $${PWD}:/local openapitools/openapi-generator-cli generate \
		-i /local/internal/freqtrade/openapi.json \
		-g go \
		-o /local/internal/freqtrade \
		--package-name freqtrade \
		--additional-properties=withGoMod=false,enumClassPrefix=true,generateTests=false \
		--type-mappings=integer=int64 \
		--openapi-normalizer SET_TAGS_FOR_ALL_OPERATIONS=freqtrade \
		> /dev/null 2>&1
	@echo "Cleaning up generated files (removing tests and docs)..."
	@chmod -R u+w internal/freqtrade/test internal/freqtrade/docs internal/freqtrade/api internal/freqtrade/.openapi-generator 2>/dev/null || true
	@rm -rf internal/freqtrade/test internal/freqtrade/docs internal/freqtrade/api internal/freqtrade/.openapi-generator internal/freqtrade/.openapi-generator-ignore internal/freqtrade/.travis.yml internal/freqtrade/.gitignore internal/freqtrade/git_push.sh internal/freqtrade/README.md 2>/dev/null || true
	@echo "Formatting generated Go files..."
	@gofmt -w internal/freqtrade/*.go
	@echo "Freqtrade client generated successfully!"

# Generate ENT and GraphQL code
generate: generate-freqtrade
	@echo "Generating ENT code with GraphQL support..."
	go generate ./internal/ent
	@echo "Generating GraphQL resolvers..."
	go run github.com/99designs/gqlgen generate
	@echo "Formatting all Go files..."
	@gofmt -w .
	@echo "Code generation complete!"

# Run development server
dev:
	@echo "Starting development server..."
	go run ./cmd/server/main.go server

# Build binary
build:
	@echo "Building binary..."
	go build -o bin/anytrade ./cmd/server/main.go
	@echo "Binary built: bin/anytrade"

# Run tests
test:
	@echo "Running tests..."
	go test -v -race -coverprofile=coverage.out ./...
	@echo ""
	@echo "Filtering generated code and schema definitions from coverage..."
	@grep -v -E "/(ent|graph)/.*_create\.go|/(ent|graph)/.*_update\.go|/(ent|graph)/.*_delete\.go|/(ent|graph)/.*_query\.go|/ent/(backtest|bot|exchange|exchangesecret|strategy|trade)\.go|/ent/(backtest|bot|exchange|exchangesecret|strategy|trade)/|/ent/client\.go|/ent/ent\.go|/ent/tx\.go|/ent/mutation\.go|/ent/runtime\.go|/ent/gql_.*\.go|/ent/migrate/|/ent/hook/|/ent/predicate/|/ent/enttest/|/ent/schema/|/graph/generated\.go|/graph/ent\.graphql|/enum/|cmd/server/main\.go" coverage.out > coverage.filtered.out || true
	go tool cover -html=coverage.filtered.out -o coverage.html
	@echo ""
	@echo "Tests complete!"
	@echo "Coverage report (excluding generated code): coverage.html"
	@echo ""
	@echo "=== Coverage Summary (Excluding Generated Code) ==="
	@go tool cover -func=coverage.filtered.out | tail -1
	@echo ""
	@echo "=== GraphQL Resolver Coverage ==="
	@go tool cover -func=coverage.filtered.out | grep -E "ent.resolvers.go|schema.resolvers.go" || echo "  No resolver data"
	@echo ""
	@echo "=== Schema Coverage ==="
	@go tool cover -func=coverage.filtered.out | grep "schema/" || echo "  No schema data"

# Run tests and open coverage report
coverage: test
	@echo "Opening coverage report in browser..."
	@if command -v open > /dev/null; then \
		open coverage.html; \
	elif command -v xdg-open > /dev/null; then \
		xdg-open coverage.html; \
	else \
		echo "Please open coverage.html manually"; \
	fi

# Run linters
lint:
	@echo "Running linters..."
	@which golangci-lint > /dev/null || (echo "golangci-lint not installed. Install it from https://golangci-lint.run/usage/install/" && exit 1)
	golangci-lint run --timeout=5m

# Run database migrations
migrate:
	@echo "Running database migrations..."
	go run ./cmd/server/main.go migrate

# Reset database
db-reset:
	@echo "Resetting database..."
	rm -f ./data/anytrade.db
	@echo "Database reset complete! Run 'make migrate' to recreate."

# Clean generated files
clean:
	@echo "Cleaning generated files..."
	rm -f coverage.out coverage.filtered.out coverage.html
	rm -rf bin/
	@echo "Clean complete!"