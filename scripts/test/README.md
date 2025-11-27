# Test Scripts

This directory contains manual test scripts for testing various VolatiCloud features.

## Shell Scripts

- **`create_bot_test_data.sh`** - Creates test data for bot creation
- **`test_backtest_flow.sh`** - Tests the complete backtest workflow
- **`test_bot_create_and_start.sh`** - Tests bot creation and startup
- **`test_bot_lifecycle.sh`** - Tests bot lifecycle (create, start, stop, delete)
- **`test_bot_with_container.sh`** - Tests bot with Docker container integration
- **`update_runtime_config.sh`** - Updates runtime configuration

## Test Data (JSON)

- **`test_bot.json`** - Sample bot configuration
- **`test_botrunner.json`** - Sample bot runner configuration
- **`test_exchange.json`** - Sample exchange configuration
- **`test_strategy.json`** - Sample strategy configuration

## Usage

These scripts are meant for manual testing and development. They are not part of the automated test suite.

Example:

```bash
# Run from project root
./scripts/test/test_bot_lifecycle.sh
```

## Note

For automated tests, see:

- `internal/graph/*_test.go` - GraphQL resolver tests
- `internal/backtest/summary_test.go` - Backtest summary tests
- `internal/monitor/data_download_test.go` - Data download tests
