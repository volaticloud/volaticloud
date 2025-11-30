#!/bin/bash

# Dependency Graph Generator
# Generates Mermaid diagram from Go module dependencies
# Usage: ./scripts/generate-deps.sh [output-file]

set -e

# Output file (default: docs/diagrams/dependencies.md)
OUTPUT_FILE="${1:-docs/diagrams/dependencies.md}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Generating Dependency Graph...${NC}"

# Create output directory
mkdir -p "$(dirname "$OUTPUT_FILE")"

# Get module name
MODULE_NAME=$(go list -m)

# Start Markdown file
cat > "$OUTPUT_FILE" <<EOF
# Go Module Dependencies

> Auto-generated dependency graph
> Generated: $(date)
> Module: $MODULE_NAME

## Dependency Overview

\`\`\`mermaid
graph TD
EOF

# Get direct dependencies only (simplified view)
echo "    %% Direct Dependencies" >> "$OUTPUT_FILE"

go list -m -json all | jq -r '
  select(.Main != true) |
  select(.Indirect != true) |
  "\(.Path)@\(.Version // "latest")"
' | while read -r dep; do
    # Sanitize for Mermaid (replace special characters)
    DEP_SAFE=$(echo "$dep" | sed 's/@/_at_/g' | sed 's/\//_/g' | sed 's/-/_/g' | sed 's/\./_/g')
    MODULE_SAFE=$(echo "$MODULE_NAME" | sed 's/\//_/g' | sed 's/-/_/g' | sed 's/\./_/g')

    # Extract package name (last part of path)
    DEP_NAME=$(echo "$dep" | awk -F'/' '{print $NF}' | cut -d'@' -f1)

    echo "    $MODULE_SAFE[\"$MODULE_NAME\"] --> $DEP_SAFE[\"$DEP_NAME\"]" >> "$OUTPUT_FILE"
done

# Close Mermaid block
cat >> "$OUTPUT_FILE" <<'EOF'
```

## Direct Dependencies

The following packages are direct dependencies of this project:

EOF

# List direct dependencies with versions
go list -m -json all | jq -r '
  select(.Main != true) |
  select(.Indirect != true) |
  "- **\(.Path)** - `\(.Version // "latest")`"
' >> "$OUTPUT_FILE"

# Add statistics
cat >> "$OUTPUT_FILE" <<EOF

## Statistics

\`\`\`
Total Dependencies: $(go list -m -json all | jq -s 'length - 1')
Direct Dependencies: $(go list -m -json all | jq -s '[.[] | select(.Indirect != true and .Main != true)] | length')
Indirect Dependencies: $(go list -m -json all | jq -s '[.[] | select(.Indirect == true)] | length')
\`\`\`

## Indirect Dependencies

<details>
<summary>View all indirect dependencies (transitive)</summary>

EOF

# List indirect dependencies
go list -m -json all | jq -r '
  select(.Indirect == true) |
  "- **\(.Path)** - `\(.Version // "latest")`"
' >> "$OUTPUT_FILE" || echo "No indirect dependencies found" >> "$OUTPUT_FILE"

cat >> "$OUTPUT_FILE" <<'EOF'

</details>

## Key Dependencies

### Web Framework & GraphQL

- **github.com/99designs/gqlgen** - GraphQL server code generation
- **github.com/go-chi/chi** - HTTP router

### Database & ORM

- **entgo.io/ent** - Entity framework with GraphQL integration
- **github.com/mattn/go-sqlite3** - SQLite driver (development)
- **github.com/lib/pq** - PostgreSQL driver (production)

### Authentication & Authorization

- **github.com/golang-jwt/jwt** - JWT token handling
- **github.com/Nerzal/gocloak** - Keycloak Go client

### Container Runtime

- **github.com/docker/docker** - Docker client
- **k8s.io/client-go** - Kubernetes client

### Distributed Coordination

- **go.etcd.io/etcd/client/v3** - etcd client for distributed locking

### Testing

- **github.com/stretchr/testify** - Testing assertions
- **github.com/vektra/mockery** - Mock generation

## Updating Dependencies

```bash
# Update all dependencies
go get -u ./...

# Update specific dependency
go get -u github.com/99designs/gqlgen

# Tidy module file
go mod tidy

# Verify dependencies
go mod verify

# View module graph
go mod graph
```

## Vulnerability Scanning

```bash
# Install govulncheck
go install golang.org/x/vuln/cmd/govulncheck@latest

# Scan for vulnerabilities
govulncheck ./...
```

---

*This dependency graph was automatically generated using `go list -m all`.*
EOF

echo -e "${GREEN}✓ Dependency graph generated: $OUTPUT_FILE${NC}"
echo "View the diagram at: $OUTPUT_FILE"
