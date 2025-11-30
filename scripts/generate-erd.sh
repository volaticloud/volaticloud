#!/bin/bash

# Entity Relationship Diagram Generator
# Generates Mermaid ERD from ENT schema files
# Usage: ./scripts/generate-erd.sh [output-file]

set -e

# Output file (default: docs/diagrams/erd.md)
OUTPUT_FILE="${1:-docs/diagrams/erd.md}"
SCHEMA_DIR="internal/ent/schema"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Generating Entity Relationship Diagram...${NC}"

# Create output directory if it doesn't exist
mkdir -p "$(dirname "$OUTPUT_FILE")"

# Start Mermaid ERD
cat > "$OUTPUT_FILE" <<'EOF'
# Entity Relationship Diagram

This diagram is auto-generated from ENT schema files.
Last updated: $(date)

```mermaid
erDiagram
EOF

# Function to extract entity name from schema file
extract_entity_name() {
    local file=$1
    basename "$file" .go | awk '{for(i=1;i<=NF;i++){ $i=toupper(substr($i,1,1)) substr($i,2) }}1'
}

# Function to extract fields from schema
extract_fields() {
    local file=$1
    echo "    %% Fields from $file"

    # Extract field definitions between field.String(), field.Int(), etc.
    grep -E "field\.(String|Int|Float|Bool|Time|UUID|JSON|Enum|Bytes)" "$file" | \
        grep -v "//" | \
        sed -E 's/.*field\.(String|Int|Float|Bool|Time|UUID|JSON|Enum|Bytes)\("([^"]+)".*/    \2 \1/' | \
        while read -r line; do
            echo "$line"
        done
}

# Function to extract relationships
extract_relationships() {
    local file=$1
    local entity=$(extract_entity_name "$file")

    # Extract Edge definitions
    grep -E "edge\.(To|From)\(" "$file" | \
        grep -v "//" | \
        sed -E 's/.*edge\.(To|From)\("([^"]+)", ([^.]+)\..*/\1 \2 \3/' | \
        while read -r direction target_plural target_type; do
            # Convert plural to singular for better ERD
            target=$(echo "$target_plural" | sed 's/s$//')

            # Determine relationship type
            if echo "$file" | grep -q "Unique()"; then
                rel_type="||--||"  # One-to-one
            elif [[ "$direction" == "To" ]]; then
                rel_type="||--o{"  # One-to-many
            else
                rel_type="}o--||"  # Many-to-one
            fi

            echo "    $entity $rel_type $target : has"
        done
}

# Process all schema files
for schema_file in "$SCHEMA_DIR"/*.go; do
    # Skip non-schema files
    if [[ "$(basename "$schema_file")" =~ ^(directives|.*_hooks)\.go$ ]]; then
        continue
    fi

    entity=$(extract_entity_name "$schema_file")

    echo "  Processing $entity..."

    # Add entity to ERD
    echo "" >> "$OUTPUT_FILE"
    echo "    $entity {" >> "$OUTPUT_FILE"

    # Add fields
    grep -E "field\.(String|Int|Float|Bool|Time|UUID|JSON|Enum|Bytes)" "$schema_file" | \
        grep -v "//" | \
        sed -E 's/.*field\.(String|Int|Float|Bool|Time|UUID|JSON|Enum|Bytes)\("([^"]+)".*/        string \2/' | \
        sed 's/Int/int/' | \
        sed 's/Float/float/' | \
        sed 's/Bool/bool/' | \
        sed 's/Time/datetime/' | \
        sed 's/UUID/uuid/' | \
        sed 's/JSON/json/' | \
        sed 's/Enum/enum/' | \
        sed 's/Bytes/bytes/' >> "$OUTPUT_FILE"

    echo "    }" >> "$OUTPUT_FILE"
done

# Add relationships
echo "" >> "$OUTPUT_FILE"
echo "    %% Relationships" >> "$OUTPUT_FILE"

for schema_file in "$SCHEMA_DIR"/*.go; do
    # Skip non-schema files
    if [[ "$(basename "$schema_file")" =~ ^(directives|.*_hooks)\.go$ ]]; then
        continue
    fi

    entity=$(extract_entity_name "$schema_file")

    # Extract and add edges
    grep -E "edge\.(To|From)\(" "$schema_file" | \
        grep -v "//" | \
        while read -r line; do
            # Parse edge definition
            if [[ "$line" =~ edge\.To\(\"([^\"]+)\" ]]; then
                target_plural="${BASH_REMATCH[1]}"
                # Convert to PascalCase
                target=$(echo "$target_plural" | sed 's/s$//' | awk '{for(i=1;i<=NF;i++){ $i=toupper(substr($i,1,1)) substr($i,2) }}1')

                # Check if unique (one-to-one) or not (one-to-many)
                if echo "$line" | grep -q "Unique()"; then
                    echo "    $entity ||--|| $target : has" >> "$OUTPUT_FILE"
                else
                    echo "    $entity ||--o{ $target : has" >> "$OUTPUT_FILE"
                fi
            elif [[ "$line" =~ edge\.From\(\"([^\"]+)\" ]]; then
                source_singular="${BASH_REMATCH[1]}"
                # Convert to PascalCase
                source=$(echo "$source_singular" | awk '{for(i=1;i<=NF;i++){ $i=toupper(substr($i,1,1)) substr($i,2) }}1')

                echo "    $entity }o--|| $source : belongs-to" >> "$OUTPUT_FILE"
            fi
        done
done

# Close Mermaid block
cat >> "$OUTPUT_FILE" <<'EOF'
```

## Entity Descriptions

### Bot
Trading bot instance that executes a strategy on an exchange.

**Key Fields:**
- `name`: Bot name
- `mode`: Execution mode (DRY_RUN or LIVE)
- `status`: Current status (STOPPED, STARTING, RUNNING, STOPPING, FAILED)
- `container_id`: Docker container ID
- `resource_id`: Keycloak UMA resource ID for authorization

**Relationships:**
- Belongs to one Exchange
- Belongs to one Strategy
- Belongs to one Runner
- Has one BotMetrics
- Has many Trades

### Strategy
Trading strategy code and configuration. Supports immutable versioning.

**Key Fields:**
- `name`: Strategy name
- `code`: Python strategy code
- `config`: Strategy-specific configuration
- `version_number`: Version number (auto-incremented)
- `is_latest`: Whether this is the latest version
- `parent_id`: Parent version ID (for version chain)

**Relationships:**
- Has many Bots
- Has many Backtests
- Self-referential parent-child (version chain)

### Exchange
Exchange configuration and credentials.

**Key Fields:**
- `name`: Exchange name (e.g., "Binance", "Coinbase")
- `exchange_type`: Exchange type enum
- `config`: Exchange-specific configuration (API keys, etc.)
- `resource_id`: Keycloak UMA resource ID

**Relationships:**
- Has many Bots
- Has many Backtests

### Backtest
Backtest execution and results.

**Key Fields:**
- `status`: Backtest status (PENDING, RUNNING, COMPLETED, FAILED)
- `result`: Full Freqtrade backtest result JSON
- `summary`: Extracted summary with key metrics
- `container_id`: Docker container ID

**Relationships:**
- Belongs to one Strategy
- Belongs to one Exchange
- Belongs to one Runner

### Trade
Individual trade record from bot execution.

**Key Fields:**
- `pair`: Trading pair (e.g., "BTC/USDT")
- `profit_abs`: Absolute profit
- `profit_ratio`: Profit ratio
- `entry_order_status`: Entry order status
- `exit_order_status`: Exit order status

**Relationships:**
- Belongs to one Bot

### BotMetrics
Real-time metrics fetched from Freqtrade API.

**Key Fields:**
- `profit_all_coin`: Total profit in stake currency
- `profit_all_percent`: Total profit percentage
- `trade_count`: Total number of trades
- `winrate`: Win rate (0.0-1.0)
- `expectancy`: Expected profit per trade
- `max_drawdown`: Maximum drawdown

**Relationships:**
- Belongs to one Bot (one-to-one)

### Runner
Bot runner instance (Docker or Kubernetes).

**Key Fields:**
- `name`: Runner name
- `type`: Runner type (DOCKER, KUBERNETES, LOCAL)
- `endpoint`: Runner API endpoint
- `capacity`: Maximum bots this runner can handle

**Relationships:**
- Has many Bots
- Has many Backtests

## Notes

- All entities have standard fields: `id` (UUID), `created_at`, `updated_at`
- Strategy versioning uses parent-child relationships for version chains
- Keycloak UMA integration provides resource-based authorization
- Bot metrics are fetched periodically from Freqtrade API and stored separately
EOF

echo -e "${GREEN}✓ ERD generated: $OUTPUT_FILE${NC}"
echo "View the diagram by rendering the Mermaid syntax in GitHub or a Mermaid viewer."
