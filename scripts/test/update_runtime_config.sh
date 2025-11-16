#!/bin/bash

# Update BotRuntime with Docker Config
set -e

RUNTIME_ID="ddbc9be1-b53d-41b8-83fb-ebc45fdb1c8b"

echo "Updating BotRuntime with Docker config..."

# Use SQLite directly to update the config
sqlite3 ./data/volaticloud.db <<EOF
UPDATE bot_runtimes
SET config = '{"host":"unix:///var/run/docker.sock"}'
WHERE id = '$RUNTIME_ID';
EOF

echo "✓ BotRuntime config updated"
echo ""

# Verify the update
echo "Verifying config..."
sqlite3 ./data/volaticloud.db "SELECT id, name, type, config FROM bot_runtimes WHERE id = '$RUNTIME_ID';"
