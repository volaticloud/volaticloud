# Entity Relationship Diagram

This diagram is auto-generated from ENT schema files.
Last updated: $(date)

```mermaid
erDiagram

    Backtest {
        string id
        string status
        string result
        string summary
        string container_id
        string error_message
        string strategy_id
        string runner_id
        string created_at
        string updated_at
        string completed_at
        string start_date
        string end_date
    }

    Bot {
        string id
        string name
        string status
        string mode
        string container_id
        string config
        string secure_config
        string freqtrade_version
        string last_seen_at
        string exchange_id
        string strategy_id
        string runner_id
        string owner_id
        string created_at
        string updated_at
    }

    Bot_metrics {
        string id
        string bot_id
        string profit_closed_coin
        string profit_closed_percent
        string profit_all_coin
        string profit_all_percent
        string trade_count
        string closed_trade_count
        string open_trade_count
        string winning_trades
        string losing_trades
        string winrate
        string expectancy
        string profit_factor
        string max_drawdown
        string max_drawdown_abs
        string best_pair
        string best_rate
        string first_trade_timestamp
        string latest_trade_timestamp
        string fetched_at
        string updated_at
    }

    Exchange {
        string id
        string name
        string config
        string owner_id
        string created_at
        string updated_at
    }

    Runner {
        string id
        string name
        string type
        string config
        string data_is_ready
        string data_last_updated
        string data_download_status
        string data_download_progress
        string data_error_message
        string data_download_config
        string owner_id
        string created_at
        string updated_at
    }

    Strategy {
        string id
        string name
        string config
        string parent_id
        string is_latest
        string version_number
        string owner_id
        string created_at
        string updated_at
    }

    Trade {
        string id
        string freqtrade_trade_id
        string pair
        string is_open
        string open_date
        string close_date
        string open_rate
        string close_rate
        string amount
        string stake_amount
        string profit_abs
        string profit_ratio
        string sell_reason
        string strategy_name
        string timeframe
        string bot_id
        string created_at
        string updated_at
    }

    %% Relationships
    Backtest }o--|| Strategy : belongs-to
    Backtest }o--|| Runner : belongs-to
    Bot }o--|| Exchange : belongs-to
    Bot }o--|| Strategy : belongs-to
    Bot }o--|| Runner : belongs-to
    Bot ||--o{ Trade : has
    Bot ||--o{ Metric : has
    Bot_metrics }o--|| Bot : belongs-to
    Exchange ||--o{ Bot : has
    Runner ||--o{ Bot : has
    Runner ||--o{ Backtest : has
    Strategy ||--o{ Bot : has
    Strategy ||--o{ Backtest : has
    Strategy ||--o{ Parent : has
    Trade }o--|| Bot : belongs-to
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
