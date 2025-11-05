#!/bin/bash

# Test Bot Lifecycle Script
set -e

API_URL="http://localhost:8080/query"

echo "=== Testing Bot Lifecycle ==="
echo ""

# 1. Check existing data
echo "1. Checking existing exchanges..."
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ exchanges { edges { node { id name } } } }"}' | python3 -m json.tool
echo ""

echo "2. Checking existing strategies..."
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ strategies { edges { node { id name } } } }"}' | python3 -m json.tool
echo ""

echo "3. Checking existing bot runtimes..."
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ botRuntimes { edges { node { id name type } } } }"}' | python3 -m json.tool
echo ""

echo "4. Checking existing bots..."
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ bots { edges { node { id name status containerID } } } }"}' | python3 -m json.tool
echo ""
