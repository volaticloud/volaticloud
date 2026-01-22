# 0014. Backtest Configuration Layer Separation

Date: 2026-01-22

## Status

Accepted

## Context and Problem Statement

Backtesting in VolatiCloud runs historical simulations of trading strategies. Unlike live/paper bots, backtests:

1. **Don't need real exchange credentials** - Only the exchange name matters for historical data format
2. **Must always be dry runs** - No real trades should ever be possible
3. **Need timerange specification** - Start/end dates for the backtest period
4. **May override exchange** - Users might want to test a strategy on different exchanges

**The Problem:** Previously, backtests used only the strategy's config with minimal overrides:

1. **No exchange selection** - Users couldn't specify which exchange to backtest on
2. **Config confusion** - Strategy config mixed with backtest-specific settings
3. **Inconsistent with bots** - Bots use layered configs, backtests used monolithic approach
4. **Missing validation** - No backend validation of user-provided backtest config

How do we enable exchange selection and backtest overrides while maintaining consistency with the bot architecture?

## Decision Drivers

- **Consistency with bots**: Follow the same layered config pattern as ADR-0006
- **Exchange flexibility**: Allow backtest on any supported exchange
- **Safety**: Ensure dry_run is always enforced
- **Freqtrade compatibility**: Use native `--config` flag merging
- **Validation**: Backend validation of user-provided config
- **Simplicity**: Only two layers needed (no exchange credentials)

## Considered Options

### Option 1: Single Config File with Overrides

Merge all settings into one config file, applying user overrides at generation time.

**Pros:**

- Simple - one file
- No change to runner interface

**Cons:**

- **Hard to debug** - Can't see what came from where
- **No clear separation** - Strategy params mixed with backtest settings
- **Inconsistent** - Different pattern than bots

### Option 2: Three-Layer Config (Like Bots)

Use exchange + strategy + backtest config files like bot architecture.

**Pros:**

- Consistent with bot pattern
- Clear separation

**Cons:**

- **Unnecessary** - Backtests don't need exchange credentials
- **Over-engineered** - Exchange layer would be mostly empty
- **Complexity** - Three files for simpler requirements

### Option 3: Two-Layer Config (Strategy + Backtest)

Split into strategy config (from Strategy entity) and backtest config (user overrides).

**Pros:**

- **Clear separation**: Strategy params vs backtest settings
- **Consistent pattern**: Similar to bots but simpler
- **Exchange selection**: Backtest config contains exchange name
- **Safety**: dry_run forced in backtest config
- **Freqtrade native**: Uses standard `--config` flag

**Cons:**

- Two files instead of one (acceptable trade-off)

## Decision Outcome

Chosen option: **Two-Layer Config (Strategy + Backtest)**, because:

1. **Appropriate complexity** - Two layers match the actual separation of concerns
2. **Consistent with bots** - Same Freqtrade config merging mechanism
3. **Enables exchange selection** - Users can choose any supported exchange
4. **Enforces safety** - dry_run always true in backtest config

### Consequences

**Positive:**

- Users can select exchange when creating backtests
- Clear separation between strategy defaults and backtest overrides
- Backend validation rejects unsupported exchanges and dangerous settings
- Consistent architecture pattern across bots and backtests

**Negative:**

- Two config files per backtest (vs one previously)
- Slightly more complex config generation

**Neutral:**

- Freqtrade merges configs in order: strategy < backtest (backtest wins conflicts)
- Config generation happens at backtest creation time

## Implementation

### Architecture

**Config Layer Stack:**

```
1. config.strategy.json        (from Strategy.Config + system settings)
   ├─ Pair whitelist
   ├─ Timeframe
   ├─ Stake settings
   ├─ Entry/exit pricing
   ├─ Strategy-specific parameters
   ├─ dataformat_ohlcv: "json"   (system-enforced for data compatibility)
   └─ timerange                   (computed from start/end dates)

2. config.backtest.json        (from Backtest.Config + enforced settings)
   ├─ exchange.name            (user selected)
   └─ dry_run: true            (always enforced)

Freqtrade merge: strategy < backtest (backtest wins conflicts)
```

**Freqtrade Command:**

```bash
freqtrade backtesting \
  --config /freqtrade/user_data/{id}/config.strategy.json \
  --config /freqtrade/user_data/{id}/config.backtest.json \
  --strategy MyStrategy \
  --userdir /freqtrade/user_data
```

### Key Files

**Schema:**

- `internal/ent/schema/backtest.go:71` - Added `config` JSON field

**Types:**

- `internal/runner/backtest_types.go:17-30` - Split `Config` into `StrategyConfig` + `BacktestConfig`

**Config Generation:**

- `internal/graph/helpers.go:180` - `buildBacktestSpec()` generates both configs

**Validation:**

- `internal/backtest/validation.go` - `ValidateBacktestConfig()` validates user input
- `internal/graph/schema.resolvers.go` - Calls validation before creating backtest

**Runners:**

- `internal/docker/backtest.go` - Creates two config files, uses multiple `--config` flags
- `internal/kubernetes/backtest.go` - ConfigMap with two entries, updated job command

### BacktestSpec Type

```go
type BacktestSpec struct {
    ID           string
    StrategyName string
    StrategyCode string

    // Split configuration (like bots)
    StrategyConfig map[string]interface{} // From strategy.Config
    BacktestConfig map[string]interface{} // From backtest.Config (exchange, dry_run)

    FreqtradeVersion string
    Environment      map[string]string
    ResourceLimits   *ResourceLimits
    DataDownloadURL  string
}
```

### Config Generation (buildBacktestSpec)

```go
func buildBacktestSpec(bt *ent.Backtest) (*runner.BacktestSpec, error) {
    // Strategy config (pairs, timeframe, stake_amount, etc.)
    strategyConfig := make(map[string]interface{})
    for k, v := range strategy.Config {
        strategyConfig[k] = v
    }

    // Add timerange if dates provided
    if !bt.StartDate.IsZero() && !bt.EndDate.IsZero() {
        strategyConfig["timerange"] = fmt.Sprintf("%s-%s",
            bt.StartDate.Format("20060102"),
            bt.EndDate.Format("20060102"))
    }

    // Set data format to JSON (matching data download format)
    strategyConfig["dataformat_ohlcv"] = "json"

    // Backtest config (exchange, dry_run, overrides)
    backtestConfig := make(map[string]interface{})
    if bt.Config != nil {
        for k, v := range bt.Config {
            backtestConfig[k] = v
        }
    }
    backtestConfig["dry_run"] = true // ALWAYS true for backtests

    return &runner.BacktestSpec{
        ID:             bt.ID.String(),
        StrategyConfig: strategyConfig,
        BacktestConfig: backtestConfig,
        // ...
    }, nil
}
```

### Backend Validation

```go
// ValidateBacktestConfig validates the user-provided backtest configuration.
func ValidateBacktestConfig(config map[string]interface{}) error {
    if config == nil {
        return nil
    }

    // Validate exchange if provided
    if exchange, ok := config["exchange"].(map[string]interface{}); ok {
        if name, ok := exchange["name"].(string); ok {
            if !isValidExchange(name) {
                return fmt.Errorf("unsupported exchange: %s", name)
            }
        }
    }

    // Ensure dry_run cannot be set to false (safety)
    if dryRun, ok := config["dry_run"].(bool); ok && !dryRun {
        return fmt.Errorf("dry_run cannot be set to false for backtests")
    }

    // Validate pair_whitelist format if provided
    if pairWhitelist, ok := config["pair_whitelist"].([]interface{}); ok {
        for i, pair := range pairWhitelist {
            if err := validateTradingPair(pair.(string)); err != nil {
                return fmt.Errorf("pair_whitelist[%d]: %w", i, err)
            }
        }
    }

    return nil
}
```

### Supported Exchanges

```go
var SupportedExchanges = []string{
    "binance",
    "binanceus",
    "kraken",
    "kucoin",
    "bybit",
    "bitget",
    "gateio",
    "okx",
}
```

### Example Configs

**1. config.strategy.json (from Strategy entity + system settings)**

```json
{
  "stake_currency": "USDT",
  "stake_amount": 100,
  "pair_whitelist": ["BTC/USDT", "ETH/USDT"],
  "timeframe": "5m",
  "entry_pricing": {
    "price_side": "other"
  },
  "exit_pricing": {
    "price_side": "other"
  },
  "dataformat_ohlcv": "json",
  "timerange": "20240101-20240131"
}
```

**2. config.backtest.json (user selection + enforced settings)**

```json
{
  "exchange": {
    "name": "okx"
  },
  "dry_run": true
}
```

## Validation

### How to Verify This Decision

1. **File separation**: Verify two separate JSON files created per backtest
2. **Merge order**: Confirm backtest.json values override strategy.json
3. **dry_run enforcement**: Verify dry_run is always true regardless of user input
4. **Exchange validation**: Confirm unsupported exchanges are rejected
5. **Pair format validation**: Verify invalid pair formats are rejected

### Automated Tests

```bash
# Verify validation
go test -v ./internal/backtest/... -run TestValidateBacktestConfig

# Verify exchange whitelist
go test -v ./internal/backtest/... -run TestIsValidExchange

# Verify pair format validation
go test -v ./internal/backtest/... -run TestValidateTradingPair

# Verify config file creation (Docker)
docker exec volaticloud-backtest-{id} ls /freqtrade/user_data/{id}/
# Should show: config.strategy.json config.backtest.json
```

### Success Metrics

- Users can select exchange when creating backtests
- Unsupported exchanges are rejected with clear error message
- dry_run is always true in backtest config
- Trading pair format validation catches invalid pairs (e.g., "BTCUSDT" rejected, "BTC/USDT" accepted)

## References

- [ADR-0006: Bot Configuration Layer Separation](0006-bot-config-layer-separation.md) - Related pattern for bots
- [Freqtrade Configuration](https://www.freqtrade.io/en/stable/configuration/)
- [Freqtrade Backtesting](https://www.freqtrade.io/en/stable/backtesting/)
- Implementation: `internal/backtest/validation.go`, `internal/graph/helpers.go`
- Validation tests: `internal/backtest/validation_test.go`
