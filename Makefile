.PHONY: help setup dev test test-authz coverage lint generate migrate clean build docs-generate docs-verify docs-quality

# Default target
help:
	@echo "VolatiCloud - Makefile Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make setup        - Install dependencies and initialize project"
	@echo "  make generate     - Generate ENT and GraphQL code"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Run server in development mode"
	@echo "  make build        - Build binary"
	@echo "  make test         - Run tests with coverage"
	@echo "  make test-authz   - Run authorization integration tests only"
	@echo "  make coverage     - Run tests and open HTML coverage report"
	@echo "  make lint         - Run linters"
	@echo ""
	@echo "Database:"
	@echo "  make db-reset     - Reset database (removes data/volaticloud.db)"
	@echo "                      Note: Migrations run automatically on server start"
	@echo ""
	@echo "Documentation:"
	@echo "  make docs-generate - Generate all documentation (ERD, dependencies)"
	@echo "  make docs-graphql  - Generate GraphQL markdown documentation"
	@echo "  make docs-lint     - Lint markdown files"
	@echo "  make docs-lint-fix - Fix markdown lint issues"
	@echo "  make docs-links    - Check markdown links"
	@echo "  make docs-verify   - Verify documentation structure"
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
	@echo "Formatting project Go files..."
	@find . -name '*.go' -not -path './.cache/*' -not -path './vendor/*' -exec gofmt -w {} +
	@echo "Code generation complete!"

# Run development server
dev:
	@echo "Starting development server..."
	go run ./cmd/server/main.go server

# Build binary
build:
	@echo "Building binary..."
	go build -o bin/volaticloud ./cmd/server/main.go
	@echo "Binary built: bin/volaticloud"

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

# Run authorization integration tests only
test-authz:
	@echo "Running authorization integration tests..."
	go test -v -race ./internal/graph -run TestAuthorization
	@echo ""
	@echo "Authorization integration tests complete!"

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

# Reset database
db-reset:
	@echo "Resetting database..."
	rm -f ./data/volaticloud.db
	@echo "Database reset complete! Schema will be created automatically on next server start."

# Clean generated files
clean:
	@echo "Cleaning generated files..."
	rm -f coverage.out coverage.filtered.out coverage.html
	rm -rf bin/
	@echo "Clean complete!"

# Generate documentation diagrams
docs-generate:
	@echo "Generating documentation..."
	@chmod +x scripts/generate-erd.sh scripts/generate-deps.sh
	@./scripts/generate-erd.sh
	@./scripts/generate-deps.sh
	@echo ""
	@echo "Documentation generated!"
	@echo "  - ERD: docs/diagrams/erd.md"
	@echo "  - Dependencies: docs/diagrams/dependencies.md"
	@echo ""
	@echo "Note: GraphQL docs require server running. Run:"
	@echo "  make docs-graphql"

# Generate GraphQL markdown documentation
docs-graphql:
	@echo "Generating GraphQL markdown documentation..."
	@chmod +x scripts/generate-graphql-markdown.sh
	@./scripts/generate-graphql-markdown.sh

# Lint markdown files
docs-lint:
	@echo "Linting markdown files..."
	@npx --yes markdownlint-cli2 "**/*.md"

# Fix markdown lint issues
docs-lint-fix:
	@echo "Fixing markdown lint issues..."
	@npx --yes markdownlint-cli2 --fix "**/*.md"

# Check markdown links
docs-links:
	@echo "Checking markdown links..."
	@find docs -name "*.md" -print0 | xargs -0 -n1 npx --yes markdown-link-check --config .markdown-link-check.json

# Verify documentation structure
docs-verify:
	@echo "Verifying documentation..."
	@chmod +x scripts/verify-docs.sh
	@./scripts/verify-docs.sh

# Check documentation coverage
docs-coverage:
	@echo "Checking documentation coverage..."
	@chmod +x scripts/check-doc-coverage.sh
	@./scripts/check-doc-coverage.sh

# Assess documentation quality
docs-quality:
	@echo "Assessing documentation quality..."
	@chmod +x scripts/assess-docs-quality.sh
	@./scripts/assess-docs-quality.sh
	@echo ""
	@echo "Detailed report: docs/quality-report.md"
