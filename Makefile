.PHONY: help setup dev test test-authz test-integration test-all coverage lint generate migrate clean build docs-generate docs-verify docs-quality e2e e2e-build e2e-run e2e-certs e2e-install-ca e2e-install-hosts

# Default target
help:
	@echo "VolatiCloud - Makefile Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make setup        - Install dependencies and initialize project"
	@echo "  make generate     - Generate ENT and GraphQL code"
	@echo ""
	@echo "Development:"
	@echo "  make dev             - Run server in development mode"
	@echo "  make build           - Build binary"
	@echo "  make test            - Run tests with coverage"
	@echo "  make test-authz      - Run authorization integration tests only"
	@echo "  make test-integration - Run integration tests with real Keycloak (requires Docker)"
	@echo "  make test-all        - Run all tests (unit + integration)"
	@echo "  make coverage        - Run tests and open HTML coverage report"
	@echo "  make lint            - Run linters"
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
	@echo "E2E Testing:"
	@echo "  make e2e              - Run fully containerized E2E tests (builds + runs)"
	@echo "  make e2e-build        - Build E2E Docker images only (cache for faster runs)"
	@echo "  make e2e-run          - Run E2E tests without rebuilding (fastest iteration)"
	@echo "  make e2e-setup        - Setup E2E environment (install CA + hosts entries)"
	@echo "  make e2e-certs        - Regenerate TLS certificates for E2E"
	@echo "  make e2e-install-ca   - Install CA certificate as trusted root (requires sudo)"
	@echo "  make e2e-install-hosts - Add required /etc/hosts entries (requires sudo)"
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
	@which npx > /dev/null || (echo "npx not installed. Please install Node.js." && exit 1)
	@echo "Applying OpenAPI overlay patches..."
	@npx openapi-format internal/freqtrade/openapi.json \
		--overlayFile internal/freqtrade/openapi-overlay.yaml \
		--json \
		-o internal/freqtrade/openapi-merged.json \
		> /dev/null 2>&1
	@docker run --rm --user $$(id -u):$$(id -g) -v $${PWD}:/local openapitools/openapi-generator-cli generate \
		-i /local/internal/freqtrade/openapi-merged.json \
		-g go \
		-o /local/internal/freqtrade \
		--package-name freqtrade \
		--additional-properties=withGoMod=false,enumClassPrefix=true,generateTests=false \
		--type-mappings=integer=int64 \
		--openapi-normalizer SET_TAGS_FOR_ALL_OPERATIONS=freqtrade \
		> /dev/null 2>&1
	@echo "Cleaning up generated files (removing tests and docs)..."
	@chmod -R u+w internal/freqtrade/test internal/freqtrade/docs internal/freqtrade/api internal/freqtrade/.openapi-generator 2>/dev/null || true
	@rm -rf internal/freqtrade/test internal/freqtrade/docs internal/freqtrade/api internal/freqtrade/.openapi-generator internal/freqtrade/.openapi-generator-ignore internal/freqtrade/.travis.yml internal/freqtrade/.gitignore internal/freqtrade/git_push.sh internal/freqtrade/README.md internal/freqtrade/openapi-merged.json 2>/dev/null || true
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

# Run integration tests with real Keycloak container (requires Docker)
test-integration:
	@echo "Running integration tests with Keycloak container..."
	@echo "Note: This requires Docker to be running."
	go test -v -race -tags=integration ./internal/graph/... -run TestIntegration
	@echo ""
	@echo "Integration tests complete!"

# Run all tests (unit + integration)
test-all: test test-integration
	@echo ""
	@echo "All tests complete!"

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

# Run fully containerized E2E tests (builds if needed)
e2e:
	@echo "Running containerized E2E tests..."
	@chmod +x scripts/e2e.sh
	@./scripts/e2e.sh

# Build E2E images only (useful to cache before running tests)
e2e-build:
	@echo "Building E2E Docker images..."
	@docker compose -f docker-compose.e2e.yml build

# Run E2E tests without rebuilding (faster for iterating)
e2e-run:
	@echo "Running E2E tests (no rebuild)..."
	@chmod +x scripts/e2e.sh
	@E2E_SKIP_BUILD=1 ./scripts/e2e.sh

# Setup E2E environment (install CA + hosts entries)
e2e-setup: e2e-install-ca e2e-install-hosts
	@echo ""
	@echo "E2E environment setup complete!"
	@echo "You can now run: make e2e"

# Generate TLS certificates for E2E testing
e2e-certs:
	@echo "Generating E2E TLS certificates..."
	@mkdir -p certs
	@openssl genrsa -out certs/ca.key 4096
	@openssl req -x509 -new -nodes -key certs/ca.key -sha256 -days 3650 \
		-out certs/ca.crt -config certs/openssl.cnf
	@openssl genrsa -out certs/server.key 2048
	@openssl req -new -key certs/server.key -out certs/server.csr \
		-config certs/openssl.cnf -reqexts server_req_ext \
		-subj "/C=US/ST=California/L=San Francisco/O=VolatiCloud/OU=Development/CN=*.volaticloud.loc"
	@openssl x509 -req -in certs/server.csr -CA certs/ca.crt -CAkey certs/ca.key -CAcreateserial \
		-out certs/server.crt -days 730 -sha256 \
		-extfile certs/openssl.cnf -extensions server_cert
	@openssl verify -CAfile certs/ca.crt certs/server.crt
	@echo "Certificates generated in certs/"

# Install CA certificate as trusted root
e2e-install-ca:
	@echo "Installing VolatiCloud E2E CA certificate..."
ifeq ($(shell uname),Darwin)
	@echo "Detected macOS - installing to System Keychain (requires sudo)..."
	@sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/ca.crt
	@echo "CA certificate installed. You may need to restart your browser."
else ifeq ($(shell uname),Linux)
	@echo "Detected Linux - installing to system trust store (requires sudo)..."
	@sudo cp certs/ca.crt /usr/local/share/ca-certificates/volaticloud-e2e-ca.crt
	@sudo update-ca-certificates
	@echo "CA certificate installed. For Chrome/Chromium, you may also need to import manually:"
	@echo "  chrome://settings/certificates -> Authorities -> Import -> certs/ca.crt"
else
	@echo "Unsupported OS. Please manually install certs/ca.crt as a trusted root CA."
endif

# Add required /etc/hosts entries
e2e-install-hosts:
	@echo "Checking /etc/hosts entries..."
	@if grep -q "console.volaticloud.loc" /etc/hosts; then \
		echo "Hosts entries already exist."; \
	else \
		echo "Adding hosts entries (requires sudo)..."; \
		echo "127.0.0.1 console.volaticloud.loc auth.volaticloud.loc" | sudo tee -a /etc/hosts > /dev/null; \
		echo "Hosts entries added."; \
	fi
