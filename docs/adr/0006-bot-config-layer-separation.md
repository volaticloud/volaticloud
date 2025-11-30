# 0006. Bot Configuration Layer Separation

Date: 2025-10-23

## Status

Accepted

## Context and Problem Statement

Freqtrade bots require complex configuration covering multiple concerns:

- **Exchange settings**: API credentials, pair whitelist, trading mode (spot/futures)
- **Strategy parameters**: Strategy-specific settings (e.g., RSI period, stop-loss %)
- **Bot-specific overrides**: Stake amount, max open trades, dry_run mode

**The Problem:** If all configuration is in a single file:

1. **Credentials leak**: Storing exchange secrets in bot config exposes them to strategy developers
2. **Config duplication**: Multiple bots using same exchange duplicate credentials
3. **Update cascades**: Changing exchange API key requires updating all bot configs
4. **No inheritance**: Cannot define strategy defaults that bots can override
5. **Security risk**: Committing bot configs to git exposes API keys

How do we separate concerns while maintaining Freqtrade compatibility?

## Decision Drivers

- **Separation of concerns**: Exchange, strategy, and bot configs should be independent
- **DRY principle**: Exchange credentials shared across bots
- **Security**: Sensitive credentials isolated from bot configs
- **Inheritance**: Strategy defaults with bot-level overrides
- **Freqtrade compatibility**: Must work with standard Freqtrade config loading
- **Read-only mounting**: Configs mounted read-only in containers (security)

## Considered Options

### Option 1: Single Monolithic Config File

All configuration in one `config.json` file per bot.

**Pros:**

- Simple - one file to manage
- Standard Freqtrade approach

**Cons:**

- **Credentials duplicated** across all bots
- **Update explosion** - changing API key requires editing N configs
- **Security risk** - secrets mixed with bot config
- No strategy defaults (must repeat everything)

### Option 2: Environment Variables

Store exchange credentials in environment variables, bot config in files.

**Pros:**

- Credentials not in files
- Standard 12-factor app approach

**Cons:**

- **Freqtrade doesn't support env vars well** - requires custom wrapper
- Hard to manage multiple exchanges
- No clear separation between strategy and bot settings

### Option 3: Layered Config Files with Merge Strategy

Three separate config files merged by Freqtrade's native `--config` flag.

**Pros:**

- **Clear separation**: Exchange, strategy, bot configs separate
- **DRY**: One exchange config, many bots
- **Security**: Sensitive credentials isolated
- **Freqtrade native**: Uses standard `--config` flag (no custom code)
- **Inheritance**: Bot overrides strategy defaults
- **Read-only**: All configs mounted read-only (immutable)

**Cons:**

- Three files instead of one (acceptable trade-off)
- Must understand Freqtrade config merging rules

## Decision Outcome

Chosen option: **Layered Config Files with Merge Strategy**, because it:

1. **Separates concerns** - Exchange, strategy, bot configs independent
2. **Reduces duplication** - One exchange config shared by all bots
3. **Improves security** - Credentials isolated and never committed
4. **Enables inheritance** - Strategy defaults + bot overrides
5. **Uses Freqtrade native features** - No custom config loading needed
6. **Read-only mounts** - Immutable configs in containers

### Consequences

**Positive:**

- Exchange API keys changed once, affects all bots automatically
- Strategy authors define sensible defaults
- Bot owners override only what they need
- Credentials never committed to git
- Clean separation enables role-based access (exchange admins ≠ strategy devs ≠ bot operators)

**Negative:**

- Three config files per bot (vs one monolithic file)
- Must understand Freqtrade's config merging precedence

**Neutral:**

- Freqtrade merges configs in order: later files override earlier ones
- Config generation happens at bot creation time (not runtime)

## Implementation

### Architecture

**Config Layer Stack:**

```
1. config.exchange.json        (shared across all bots using same exchange)
   ├─ API credentials
   ├─ Pair whitelist
   └─ Trading mode

2. config.strategy.json         (shared across all bots using same strategy)
   ├─ Strategy parameters
   ├─ Entry/exit pricing
   └─ Order types

3. config.bot.json              (unique per bot)
   ├─ dry_run flag (auto-injected based on bot mode)
   ├─ Stake amount
   ├─ Max open trades
   └─ Bot-specific overrides

Freqtrade merge: exchange < strategy < bot (bot wins conflicts)
```

**Freqtrade Command:**

```bash
freqtrade trade \
  --config /freqtrade/config/config.exchange.json \
  --config /freqtrade/config/config.strategy.json \
  --config /freqtrade/config/config.bot.json \
  --strategy MyStrategy
```

### Key Files

**Config Generation:**

- `internal/bot/spec.go` - Generates all three config layers
- `internal/exchange/` - Extracts exchange credentials and pair whitelist
- `internal/strategy/` - Extracts strategy parameters (future enhancement)

**Config Validation:**

- `internal/bot/config.go:ValidateFreqtradeConfig()` - Validates required fields
- `internal/exchange/validator.go` - Validates exchange configs against JSON schema

**Dockerfile:**

- Config files mounted read-only: `-v /tmp/volaticloud-configs/{botID}:/freqtrade/config:ro`

### Example Configs

**1. config.exchange.json (shared)**

```json
{
  "exchange": {
    "name": "binance",
    "key": "your-api-key-here",
    "secret": "your-secret-here",
    "ccxt_config": {"enableRateLimit": true},
    "pair_whitelist": ["BTC/USDT", "ETH/USDT", "BNB/USDT"]
  },
  "trading_mode": "spot"
}
```

**2. config.strategy.json (shared)**

```json
{
  "strategy": "MyStrategy",
  "entry_pricing": {
    "price_side": "other",
    "use_order_book": true,
    "order_book_top": 1
  },
  "exit_pricing": {
    "price_side": "other",
    "use_order_book": true,
    "order_book_top": 1
  },
  "order_types": {
    "entry": "limit",
    "exit": "limit",
    "stoploss": "market"
  },
  "timeframe": "5m"
}
```

**3. config.bot.json (unique, with auto-injected dry_run)**

```json
{
  "dry_run": true,
  "stake_currency": "USDT",
  "stake_amount": 100,
  "max_open_trades": 3,
  "dry_run_wallet": 1000
}
```

### Automatic dry_run Injection

**Critical Feature:** The `dry_run` field is automatically injected based on bot mode.

**Implementation** (`internal/bot/spec.go`):

```go
func BuildSpec(ctx context.Context, input CreateBotInput, exchange Exchange, strategy Strategy) (BotSpec, error) {
    // Prepare bot config
    botConfig := input.Config
    if botConfig == nil {
        botConfig = make(map[string]interface{})
    }

    // Auto-inject dry_run based on bot mode (CRITICAL)
    botConfig["dry_run"] = (input.Mode == enum.BotModeDryRun)

    // Generate configs
    exchangeConfig := extractExchangeConfig(exchange)
    strategyConfig := extractStrategyConfig(strategy)  // Future

    return BotSpec{
        ID:             input.ID,
        ExchangeConfig: exchangeConfig,
        StrategyConfig: strategyConfig,
        BotConfig:      botConfig,
        // ...
    }
}
```

### Config Lifecycle

**1. Bot Creation:**

```
User creates bot (GraphQL mutation)
    ↓
BuildSpec generates three configs
    ↓
Write to /tmp/volaticloud-configs/{botID}/
    ├─ config.exchange.json
    ├─ config.strategy.json
    └─ config.bot.json
    ↓
Create Docker container with volume mount (read-only)
```

**2. Bot Start:**

```
Freqtrade starts with --config flags (3 files)
    ↓
Freqtrade merges: exchange < strategy < bot
    ↓
Bot runs with final merged config
```

**3. Config Update:**

```
IMPORTANT: Config files generated at creation time
    ↓
To apply config changes:
  1. Delete bot (removes container + configs)
  2. Recreate bot (generates new configs)
    ↓
Reason: Immutable infrastructure pattern
```

## Validation

### How to Verify This Decision

1. **File separation**: Verify three separate JSON files created per bot
2. **Merge order**: Confirm bot.json values override strategy.json
3. **dry_run injection**: Verify dry_run field matches bot mode
4. **Read-only mount**: Container cannot modify config files
5. **Credential isolation**: Exchange config separate from bot config

### Automated Tests

```bash
# Verify config generation
go test -v ./internal/bot -run TestBuildSpec

# Verify dry_run injection
go test -v ./internal/bot -run TestDryRunInjection

# Verify config validation
go test -v ./internal/bot -run TestValidateFreqtradeConfig

# Verify config file creation
docker exec volaticloud-bot-{id} ls /freqtrade/config/
# Should show: config.exchange.json config.strategy.json config.bot.json
```

### Success Metrics

- ✅ 100% of bots use three-layer config structure
- ✅ Zero API key duplication across bots
- ✅ dry_run field never set manually (always auto-injected)
- ✅ Config files mounted read-only in containers

## References

- [Freqtrade Configuration](https://www.freqtrade.io/en/stable/configuration/)
- [12-Factor App: Config](https://12factor.net/config)
- [Immutable Infrastructure](https://www.hashicorp.com/resources/what-is-mutable-vs-immutable-infrastructure)
- Implementation: `internal/bot/spec.go`, `internal/exchange/`, `internal/strategy/`
- Validation: `internal/bot/config.go:ValidateFreqtradeConfig()`
