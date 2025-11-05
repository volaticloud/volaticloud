#!/bin/bash

# Test Backtest Flow
# This script creates test data and runs a backtest

API="http://localhost:8080/query"

echo "=== Testing Backtest Flow ==="
echo ""

# 1. Create Strategy
echo "1. Creating strategy..."
STRATEGY_RESPONSE=$(curl -s -X POST $API \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { createStrategy(input: { name: \"BacktestStrategy\", code: \"class BacktestStrategy(IStrategy):\\n    minimal_roi = {\\\"0\\\": 0.10}\\n    stoploss = -0.10\\n    timeframe = \\\"5m\\\"\", version: \"1.0\", description: \"Test strategy\" }) { id name } }"
  }')

STRATEGY_ID=$(echo $STRATEGY_RESPONSE | jq -r '.data.createStrategy.id')
echo "✓ Strategy created: $STRATEGY_ID"
echo ""

# 2. Create Runner
echo "2. Creating Docker runner..."
RUNNER_RESPONSE=$(curl -s -X POST $API \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { createBotRunner(input: { name: \"Local Docker\", type: docker, config: { docker: { host: \"unix:///var/run/docker.sock\" } } }) { id name type } }"
  }')

RUNNER_ID=$(echo $RUNNER_RESPONSE | jq -r '.data.createBotRunner.id')
echo "✓ Runner created: $RUNNER_ID"
echo ""

# 3. Create Backtest
echo "3. Creating backtest..."
BACKTEST_RESPONSE=$(curl -s -X POST $API \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"mutation { createBacktest(input: { strategyID: \\\"$STRATEGY_ID\\\", runnerID: \\\"$RUNNER_ID\\\", status: pending, config: { pairs: [\\\"BTC/USDT\\\", \\\"ETH/USDT\\\"], timeframe: \\\"5m\\\", stake_amount: 100, stake_currency: \\\"USDT\\\", max_open_trades: 3, start_date: \\\"2024-01-01\\\", end_date: \\\"2024-01-07\\\", freqtrade_version: \\\"stable\\\", data_source: \\\"download\\\" } }) { id status config } }\"
  }")

BACKTEST_ID=$(echo $BACKTEST_RESPONSE | jq -r '.data.createBacktest.id')
BACKTEST_STATUS=$(echo $BACKTEST_RESPONSE | jq -r '.data.createBacktest.status')
echo "✓ Backtest created: $BACKTEST_ID (status: $BACKTEST_STATUS)"
echo ""

# 4. Run Backtest
echo "4. Running backtest..."
RUN_RESPONSE=$(curl -s -X POST $API \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"mutation { runBacktest(id: \\\"$BACKTEST_ID\\\") { id status containerID errorMessage } }\"
  }")

echo "Response:"
echo $RUN_RESPONSE | jq '.'

# Check for errors
ERROR=$(echo $RUN_RESPONSE | jq -r '.errors // empty')
if [ ! -z "$ERROR" ]; then
  echo ""
  echo "❌ Error running backtest:"
  echo $RUN_RESPONSE | jq '.errors'
  exit 1
fi

CONTAINER_ID=$(echo $RUN_RESPONSE | jq -r '.data.runBacktest.containerID')
NEW_STATUS=$(echo $RUN_RESPONSE | jq -r '.data.runBacktest.status')

echo ""
echo "✓ Backtest started: Container $CONTAINER_ID (status: $NEW_STATUS)"
echo ""

# 5. Query current status
echo "5. Checking backtest status..."
STATUS_RESPONSE=$(curl -s -X POST $API \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"query { node(id: \\\"$BACKTEST_ID\\\") { ... on Backtest { id status containerID errorMessage } } }\"
  }")

echo $STATUS_RESPONSE | jq '.data.node'
echo ""

echo "=== Test completed successfully ==="
echo ""
echo "IDs for manual testing:"
echo "Strategy ID: $STRATEGY_ID"
echo "Runner ID: $RUNNER_ID"
echo "Backtest ID: $BACKTEST_ID"
echo "Container ID: $CONTAINER_ID"