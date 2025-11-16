#!/bin/sh
set -e

echo "Generating runtime configuration..."

# Extract environment variables starting with VOLATICLOUD__ into JSON
SYSTEM_ENV=$(jq -n 'env | with_entries(select(.key | startswith("VOLATICLOUD__")))')

# Read default config from static file (built into image)
DEFAULT_ENV=$(cat /srv/config.json)

# Merge: environment variables override defaults
FINAL_JSON=$(echo "$DEFAULT_ENV $SYSTEM_ENV" | jq -s add)

# Write merged config back to /srv/config.json
echo "$FINAL_JSON" > /srv/config.json

echo "Runtime configuration generated:"
cat /srv/config.json

# Execute the main command (Caddy)
exec "$@"
