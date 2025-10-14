.PHONY: help setup dev test lint generate migrate clean build

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
	@echo "  make test         - Run tests"
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

# Generate ENT and GraphQL code
generate:
	@echo "Generating ENT code with GraphQL support..."
	go generate ./internal/ent
	@echo "Generating GraphQL resolvers..."
	go run github.com/99designs/gqlgen generate
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
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"

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
	rm -f coverage.out coverage.html
	rm -rf bin/
	@echo "Clean complete!"