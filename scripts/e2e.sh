#!/bin/bash
set -euo pipefail

COMPOSE_FILE="docker-compose.e2e.yml"
PROFILES=""

# Enable stripe profile if API key is available
if [ -n "${STRIPE_API_KEY:-}" ]; then
  PROFILES="--profile stripe"
fi

cleanup() {
  echo "Tearing down E2E environment..."
  docker compose -f "$COMPOSE_FILE" $PROFILES --profile test down -v --remove-orphans
}
trap cleanup EXIT

# Build or skip based on E2E_SKIP_BUILD env var
BUILD_FLAG="--build"
if [ "${E2E_SKIP_BUILD:-}" = "1" ]; then
  BUILD_FLAG=""
  echo "Skipping image rebuild (E2E_SKIP_BUILD=1)"
fi

echo "Starting E2E services..."
docker compose -f "$COMPOSE_FILE" $PROFILES up -d $BUILD_FLAG --wait

echo "All services healthy. Running E2E tests..."
docker compose -f "$COMPOSE_FILE" --profile test run --rm playwright
