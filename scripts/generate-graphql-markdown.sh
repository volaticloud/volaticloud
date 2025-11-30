#!/bin/bash
# Generate GraphQL API Documentation (Markdown)
# Uses graphql-markdown via npx (no installation needed)

set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
GRAPHQL_ENDPOINT="${1:-http://localhost:8080/query}"
OUTPUT_FILE="${2:-docs/api/graphql/schema.md}"

echo -e "${BLUE}GraphQL Markdown Generator${NC}"
echo "====================================="
echo "Endpoint: ${GRAPHQL_ENDPOINT}"
echo "Output: ${OUTPUT_FILE}"
echo ""

# Create output directory if needed
mkdir -p "$(dirname "${OUTPUT_FILE}")"

# Check if server is running
echo -e "${BLUE}Checking GraphQL endpoint...${NC}"
if ! curl -s -f -o /dev/null "${GRAPHQL_ENDPOINT}"; then
    echo -e "${YELLOW}⚠ Warning: GraphQL endpoint not accessible${NC}"
    echo "Please ensure the server is running on ${GRAPHQL_ENDPOINT}"
    exit 1
fi

echo -e "${GREEN}✓ Endpoint accessible${NC}"
echo ""

# Generate markdown using graphql-markdown via npx
echo -e "${BLUE}Generating markdown documentation...${NC}"

npx --yes graphql-markdown "${GRAPHQL_ENDPOINT}" \
    > "${OUTPUT_FILE}"

echo -e "${GREEN}✓ Documentation generated successfully${NC}"
echo "Output: ${OUTPUT_FILE}"
echo ""
echo "View the documentation:"
echo "  cat ${OUTPUT_FILE}"
