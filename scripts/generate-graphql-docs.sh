#!/bin/bash

# GraphQL Documentation Generator
# Generates Markdown documentation from GraphQL schema via introspection
# Usage: ./scripts/generate-graphql-docs.sh [server-url] [output-file]

set -e

# Configuration
SERVER_URL="${1:-http://localhost:8080/query}"
OUTPUT_FILE="${2:-docs/api/graphql/schema.md}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Generating GraphQL Documentation...${NC}"

# Check if server is running
if ! curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL" | grep -q "200\|400"; then
    echo -e "${YELLOW}Warning: GraphQL server not responding at $SERVER_URL${NC}"
    echo "Please start the server with: ./bin/volaticloud server"
    exit 1
fi

# Create output directory
mkdir -p "$(dirname "$OUTPUT_FILE")"

# GraphQL introspection query
INTROSPECTION_QUERY='{
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      kind
      name
      description
      fields(includeDeprecated: true) {
        name
        description
        args {
          name
          description
          type {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
        type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
            }
          }
        }
        isDeprecated
        deprecationReason
      }
      inputFields {
        name
        description
        type {
          kind
          name
          ofType {
            kind
            name
          }
        }
      }
      interfaces {
        name
      }
      enumValues(includeDeprecated: true) {
        name
        description
        isDeprecated
        deprecationReason
      }
      possibleTypes {
        name
      }
    }
    directives {
      name
      description
      locations
      args {
        name
        description
        type {
          kind
          name
        }
      }
    }
  }
}'

# Fetch schema via introspection
echo "Fetching schema from $SERVER_URL..."
SCHEMA_JSON=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"query\":$(echo "$INTROSPECTION_QUERY" | jq -Rs .)}" \
  "$SERVER_URL")

# Check for errors
if echo "$SCHEMA_JSON" | jq -e '.errors' > /dev/null 2>&1; then
    echo -e "${YELLOW}Error fetching schema:${NC}"
    echo "$SCHEMA_JSON" | jq '.errors'
    exit 1
fi

# Generate Markdown documentation
cat > "$OUTPUT_FILE" <<EOF
# GraphQL API Documentation

> Auto-generated from schema introspection
> Generated: $(date)
> Server: $SERVER_URL

## Table of Contents

- [Queries](#queries)
- [Mutations](#mutations)
- [Types](#types)
- [Input Types](#input-types)
- [Enums](#enums)
- [Scalars](#scalars)

---

EOF

# Extract Query operations
echo "" >> "$OUTPUT_FILE"
echo "## Queries" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "$SCHEMA_JSON" | jq -r '
  .data.__schema.types[] |
  select(.name == "Query") |
  .fields[] |
  "### `\(.name)`\n\n" +
  (if .description then "\(.description)\n\n" else "" end) +
  "**Arguments:**\n\n" +
  (if (.args | length) > 0 then
    (.args | map("- `\(.name)`: \(.type.name // .type.ofType.name // .type.ofType.ofType.name)\(.if .description then " - \(.description)" else "" end)") | join("\n"))
  else
    "No arguments"
  end) +
  "\n\n" +
  "**Returns:** `\(.type.name // .type.ofType.name // .type.ofType.ofType.name)`\n\n" +
  "---\n\n"
' >> "$OUTPUT_FILE" 2>/dev/null || echo "No queries found" >> "$OUTPUT_FILE"

# Extract Mutation operations
echo "" >> "$OUTPUT_FILE"
echo "## Mutations" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "$SCHEMA_JSON" | jq -r '
  .data.__schema.types[] |
  select(.name == "Mutation") |
  .fields[] |
  "### `\(.name)`\n\n" +
  (if .description then "\(.description)\n\n" else "" end) +
  "**Arguments:**\n\n" +
  (if (.args | length) > 0 then
    (.args | map("- `\(.name)`: \(.type.name // .type.ofType.name // .type.ofType.ofType.name)\(.if .description then " - \(.description)" else "" end)") | join("\n"))
  else
    "No arguments"
  end) +
  "\n\n" +
  "**Returns:** `\(.type.name // .type.ofType.name // .type.ofType.ofType.name)`\n\n" +
  "---\n\n"
' >> "$OUTPUT_FILE" 2>/dev/null || echo "No mutations found" >> "$OUTPUT_FILE"

# Extract Object Types
echo "" >> "$OUTPUT_FILE"
echo "## Types" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "$SCHEMA_JSON" | jq -r '
  .data.__schema.types[] |
  select(.kind == "OBJECT" and (.name | startswith("__") | not) and .name != "Query" and .name != "Mutation") |
  "### `\(.name)`\n\n" +
  (if .description then "\(.description)\n\n" else "" end) +
  (if .fields then
    "**Fields:**\n\n" +
    (.fields | map("- `\(.name)`: \(.type.name // .type.ofType.name // .type.ofType.ofType.name)\(.if .description then " - \(.description)" else "" end)") | join("\n")) +
    "\n\n"
  else "" end) +
  "---\n\n"
' >> "$OUTPUT_FILE" 2>/dev/null || echo "No object types found" >> "$OUTPUT_FILE"

# Extract Input Types
echo "" >> "$OUTPUT_FILE"
echo "## Input Types" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "$SCHEMA_JSON" | jq -r '
  .data.__schema.types[] |
  select(.kind == "INPUT_OBJECT") |
  "### `\(.name)`\n\n" +
  (if .description then "\(.description)\n\n" else "" end) +
  (if .inputFields then
    "**Fields:**\n\n" +
    (.inputFields | map("- `\(.name)`: \(.type.name // .type.ofType.name // .type.ofType.ofType.name)\(.if .description then " - \(.description)" else "" end)") | join("\n")) +
    "\n\n"
  else "" end) +
  "---\n\n"
' >> "$OUTPUT_FILE" 2>/dev/null || echo "No input types found" >> "$OUTPUT_FILE"

# Extract Enums
echo "" >> "$OUTPUT_FILE"
echo "## Enums" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "$SCHEMA_JSON" | jq -r '
  .data.__schema.types[] |
  select(.kind == "ENUM" and (.name | startswith("__") | not)) |
  "### `\(.name)`\n\n" +
  (if .description then "\(.description)\n\n" else "" end) +
  (if .enumValues then
    "**Values:**\n\n" +
    (.enumValues | map("- `\(.name)`\(.if .description then " - \(.description)" else "" end)") | join("\n")) +
    "\n\n"
  else "" end) +
  "---\n\n"
' >> "$OUTPUT_FILE" 2>/dev/null || echo "No enums found" >> "$OUTPUT_FILE"

# Extract Scalars
echo "" >> "$OUTPUT_FILE"
echo "## Scalars" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "The following scalar types are used in the API:" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "$SCHEMA_JSON" | jq -r '
  .data.__schema.types[] |
  select(.kind == "SCALAR" and (.name | startswith("__") | not)) |
  "- `\(.name)`\(.if .description then " - \(.description)" else "" end)"
' >> "$OUTPUT_FILE" 2>/dev/null || echo "No custom scalars found" >> "$OUTPUT_FILE"

# Add footer
cat >> "$OUTPUT_FILE" <<'EOF'

---

## Usage Examples

### Queries

#### Fetch Bots

```graphql
query GetBots {
  bots(first: 10) {
    edges {
      node {
        id
        name
        status
        mode
        createdAt
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

#### Fetch Single Bot with Metrics

```graphql
query GetBot($id: ID!) {
  bots(where: {id: $id}, first: 1) {
    edges {
      node {
        id
        name
        status
        metrics {
          profitAllPercent
          tradeCount
          winrate
        }
      }
    }
  }
}
```

### Mutations

#### Create Bot

```graphql
mutation CreateBot($input: CreateBotInput!) {
  createBot(input: $input) {
    id
    name
    status
    containerID
  }
}
```

Variables:
```json
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
      "max_open_trades": 3
    }
  }
}
```

#### Start Bot

```graphql
mutation StartBot($id: ID!) {
  startBot(id: $id) {
    id
    status
  }
}
```

---

## Authentication

All GraphQL requests require JWT authentication via Bearer token:

```bash
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"query": "{ bots { edges { node { id name } } } }"}'
```

## Pagination

List queries use Relay-style cursor pagination:

- `first`: Number of items to fetch
- `after`: Cursor to start after
- `last`: Number of items from end
- `before`: Cursor to end before

## Filtering

ENT-powered where filters available on all entities:

```graphql
bots(where: {status: RUNNING, mode: LIVE}) {
  edges {
    node {
      id
      name
    }
  }
}
```

---

*This documentation was automatically generated from the GraphQL schema.*
EOF

echo -e "${GREEN}✓ GraphQL documentation generated: $OUTPUT_FILE${NC}"
echo "View the documentation at: $OUTPUT_FILE"
