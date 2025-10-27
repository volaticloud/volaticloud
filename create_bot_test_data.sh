#!/bin/bash

# Create Bot Test Data Script
set -e

API_URL="http://localhost:8080/query"

echo "=== Creating Test Data for Bot ==="
echo ""

# 1. Create Exchange
echo "1. Creating Exchange (Binance Test)..."
EXCHANGE_RESULT=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { createExchange(input: { name: binance, testMode: true }) { id name } }"
  }')
echo "$EXCHANGE_RESULT" | python3 -m json.tool
EXCHANGE_ID=$(echo "$EXCHANGE_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['createExchange']['id'])")
echo "Exchange ID: $EXCHANGE_ID"
echo ""

# 2. Create Strategy
echo "2. Creating Strategy..."
STRATEGY_RESULT=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { createStrategy(input: { name: \"Test Strategy\", description: \"Simple test strategy\", code: \"# Simple freqtrade strategy\\nclass TestStrategy:\\n    pass\" }) { id name } }"
  }')
echo "$STRATEGY_RESULT" | python3 -m json.tool
STRATEGY_ID=$(echo "$STRATEGY_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['createStrategy']['id'])")
echo "Strategy ID: $STRATEGY_ID"
echo ""

# 3. Create BotRuntime with Docker config
echo "3. Creating BotRuntime (Docker)..."
RUNTIME_RESULT=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { createBotRuntime(input: { name: \"Docker Runtime\", type: docker }) { id name type } }"
  }')
echo "$RUNTIME_RESULT" | python3 -m json.tool
RUNTIME_ID=$(echo "$RUNTIME_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['createBotRuntime']['id'])")
echo "Runtime ID: $RUNTIME_ID"
echo ""

echo "=== IDs for Bot Creation ==="
echo "EXCHANGE_ID=$EXCHANGE_ID"
echo "STRATEGY_ID=$STRATEGY_ID"
echo "RUNTIME_ID=$RUNTIME_ID"
echo ""
echo "Save these IDs for the next step!"
