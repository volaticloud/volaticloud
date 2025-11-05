# AnyTrade Platform - Implementation Plan

## Overview
AnyTrade is a control-plane platform for managing freqtrade trading bots. It provides centralized management of bot lifecycles, strategies, exchanges, backtesting, and hyperparameter optimization.

## Architecture

### Core Components
1. **Control Plane** - Main Go application with GraphQL API (handles all operations including monitoring, syncing, and execution)
2. **Runtime Abstraction Layer** - Pluggable runtime interface supporting multiple backends
3. **Runtime Implementations** - Docker (initial), Kubernetes (future), local process (dev)
4. **Database** - PostgreSQL for persistent storage

---

## Database Schema Design (ENT)

### 1. Exchange Entity
Stores exchange configuration.

**Fields:**
- `id` (UUID, primary key)
- `name` (enum) - Exchange name from ExchangeType enum (binance, kraken, etc.)
- `test_mode` (bool) - Use testnet/sandbox
- `config` (JSON) - Exchange-specific settings (rate limits, etc.)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Relationships:**
- `bots` (one-to-many) - Has many bots
- `secrets` (one-to-many) - Has many exchange secrets

**Notes:**
- Exchange name uses enum to ensure only supported exchanges
- All sensitive data stored in separate ExchangeSecret table
- Config stores non-sensitive settings only

---

### 1a. ExchangeSecret Entity
Stores exchange credentials in flexible key-value format.

**Fields:**
- `id` (UUID, primary key)
- `exchange_id` (UUID, foreign key) - Belongs to exchange
- `name` (string) - Secret name (api_key, api_secret, password, passphrase, etc.)
- `value` (string, encrypted) - Secret value (encrypted at rest)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Relationships:**
- `exchange` (many-to-one) - Belongs to one exchange

**Indexes:**
- `exchange_id + name` (unique) - One secret name per exchange

**Notes:**
- Flexible schema supports different exchange requirements
- Binance needs: api_key, api_secret
- Coinbase needs: api_key, api_secret, passphrase
- Kraken needs: api_key, api_secret (private key format)
- All values encrypted with AES-256-GCM
- Never log or expose decrypted values

**ExchangeType Enum:**
```go
type ExchangeType string

const (
    ExchangeBinance    ExchangeType = "binance"
    ExchangeBinanceUS  ExchangeType = "binanceus"
    ExchangeCoinbase   ExchangeType = "coinbase"
    ExchangeKraken     ExchangeType = "kraken"
    ExchangeKucoin     ExchangeType = "kucoin"
    ExchangeBybit      ExchangeType = "bybit"
    ExchangeOKX        ExchangeType = "okx"
    ExchangeBitfinex   ExchangeType = "bitfinex"
    // Add more as needed
)
```

---

### 2. Strategy Entity
Stores freqtrade strategy Python code.

**Fields:**
- `id` (UUID, primary key)
- `name` (string, unique) - Strategy name
- `description` (text) - Strategy description
- `code` (text) - Python strategy code (contains all strategy logic)
- `version` (string) - Strategy version
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Relationships:**
- `bots` (one-to-many) - Has many bots using this strategy
- `backtests` (one-to-many) - Has many backtests
- `hyperopts` (one-to-many) - Has many hyperopt runs

**Notes:**
- Keep schema minimal - all strategy parameters (timeframe, ROI, stoploss, indicators) are in the code itself
- Validate Python code syntax before saving
- Optionally extract strategy class name from code for validation
- Version control strategies (consider keeping history)

---

### 3. Bot Entity
Represents a running freqtrade bot instance.

**Fields:**
- `id` (UUID, primary key)
- `name` (string) - Bot display name
- `status` (enum) - creating, running, stopped, error, backtesting, hyperopt
- `mode` (enum) - dry-run, live
- `runtime_type` (enum) - docker, kubernetes, local
- `runtime_id` (string) - Runtime-specific identifier (container ID, pod name, process ID)
- `runtime_metadata` (JSON) - Runtime-specific metadata
- `api_url` (string) - Freqtrade API endpoint (http://localhost:8080)
- `api_username` (string) - Freqtrade API username
- `api_password` (string, encrypted) - Freqtrade API password
- `config` (JSON) - Bot-specific freqtrade config overrides
- `freqtrade_version` (string) - Freqtrade version (e.g., "2025.10")
- `last_seen_at` (timestamp) - Last successful health check
- `error_message` (text) - Last error message if status is error
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Relationships:**
- `exchange` (many-to-one) - Belongs to one exchange
- `strategy` (many-to-one) - Belongs to one strategy
- `trades` (one-to-many) - Has many trades

**Computed Fields:**
- `health_status` - Healthy if last_seen_at < 2 minutes ago
- `uptime` - Time since creation if running

**Notes:**
- Each bot runs in isolated runtime environment
- Runtime type determines which implementation to use
- API port assigned dynamically (8080-9000 range)
- Config JSON merged with exchange + strategy settings
- Store resource limits (CPU, memory) in config

---

### 4. Backtest Entity
Stores backtest execution results.

**Fields:**
- `id` (UUID, primary key)
- `status` (enum) - pending, running, completed, failed
- `start_date` (date) - Historical data start date
- `end_date` (date) - Historical data end date
- `timeframe` (string) - Candlestick timeframe
- `stake_amount` (float) - Stake amount per trade
- `stake_currency` (string) - Currency (USDT, BTC, etc.)
- `pairs` (JSON array) - List of trading pairs
- `results` (JSON) - Backtest results (profit, trades, metrics)
- `config` (JSON) - Backtest-specific configuration
- `runtime_id` (string) - Runtime identifier for backtest execution
- `log_output` (text) - Execution logs
- `error_message` (text) - Error if failed
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `completed_at` (timestamp)

**Relationships:**
- `strategy` (many-to-one) - Belongs to one strategy

**Results JSON Structure:**
```json
{
  "total_trades": 150,
  "profit_total": 0.0523,
  "profit_percentage": 5.23,
  "avg_profit": 0.35,
  "max_drawdown": 2.1,
  "sharpe_ratio": 1.8,
  "win_rate": 0.65,
  "best_pair": "BTC/USDT",
  "worst_pair": "ETH/USDT"
}
```

**Notes:**
- Run in isolated runtime environments (no network access needed)
- Download data first, then run backtest
- Store detailed trade list in results JSON
- Auto-cleanup runtime resources after completion

---

### 5. HyperOpt Entity
Stores hyperparameter optimization runs.

**Fields:**
- `id` (UUID, primary key)
- `status` (enum) - pending, running, completed, failed
- `epochs` (int) - Number of optimization epochs
- `start_date` (date) - Historical data start date
- `end_date` (date) - Historical data end date
- `timeframe` (string) - Candlestick timeframe
- `stake_amount` (float) - Stake amount per trade
- `stake_currency` (string) - Currency
- `pairs` (JSON array) - List of trading pairs
- `optimization_metric` (enum) - sharpe, profit, trades, drawdown
- `spaces` (JSON array) - Hyperopt spaces (buy, sell, roi, stoploss, trailing)
- `results` (JSON) - Best parameters found
- `config` (JSON) - HyperOpt-specific configuration
- `runtime_id` (string) - Runtime identifier for hyperopt execution
- `log_output` (text) - Execution logs
- `progress` (float) - Progress percentage (0-100)
- `error_message` (text) - Error if failed
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `completed_at` (timestamp)

**Relationships:**
- `strategy` (many-to-one) - Belongs to one strategy

**Results JSON Structure:**
```json
{
  "best_epoch": 87,
  "best_loss": -0.234,
  "best_profit": 12.45,
  "parameters": {
    "buy_rsi": 28,
    "sell_rsi": 72,
    "roi": {
      "0": 0.15,
      "30": 0.05,
      "60": 0.01
    },
    "stoploss": -0.08
  },
  "total_epochs": 100,
  "duration_seconds": 3600
}
```

**Notes:**
- Very CPU intensive, consider resource limits
- Allow cancellation of running hyperopt
- Store epoch progress for UI display
- Can take hours to complete

---

### 6. Trade Entity
Stores individual trades from bots (synced from freqtrade).

**Fields:**
- `id` (UUID, primary key)
- `freqtrade_trade_id` (int) - Original trade ID from freqtrade
- `pair` (string) - Trading pair (BTC/USDT)
- `is_open` (bool) - Trade open status
- `open_date` (timestamp) - Trade open time
- `close_date` (timestamp, nullable) - Trade close time
- `open_rate` (float) - Entry price
- `close_rate` (float, nullable) - Exit price
- `amount` (float) - Amount of coins
- `stake_amount` (float) - Stake in base currency
- `profit_abs` (float) - Absolute profit
- `profit_ratio` (float) - Profit percentage (0.05 = 5%)
- `sell_reason` (string) - Reason for selling (roi, stoploss, etc.)
- `strategy_name` (string) - Strategy used
- `timeframe` (string) - Timeframe used
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Relationships:**
- `bot` (many-to-one) - Belongs to one bot

**Indexes:**
- `bot_id + freqtrade_trade_id` (unique)
- `bot_id + is_open`
- `open_date`

**Notes:**
- Synced periodically from freqtrade API
- Keep historical trades even if bot deleted
- Use for profit/loss reporting and analytics

---

## Runtime Abstraction Layer

### Design Philosophy
The runtime layer is **pluggable and extensible**, allowing different execution backends without changing core business logic. Each runtime implements a common interface.

**Key Benefits:**
- ✅ **Flexibility:** Switch between Docker, Kubernetes, or local processes
- ✅ **Future-proof:** Add new runtime implementations without touching core code
- ✅ **Development:** Use local runtime for debugging, Docker for staging, K8s for production
- ✅ **Testing:** Easy to mock runtime interface for unit tests
- ✅ **Scalability:** Start with Docker, migrate to Kubernetes when needed

**Initial Implementation:** Docker + Local runtimes (Phase 1)
**Future:** Kubernetes runtime (Phase 2)

### Runtime Interface
```go
type Runtime interface {
    // Bot lifecycle
    CreateBot(ctx context.Context, spec BotSpec) (RuntimeInstance, error)
    StartBot(ctx context.Context, runtimeID string) error
    StopBot(ctx context.Context, runtimeID string) error
    RestartBot(ctx context.Context, runtimeID string) error
    DeleteBot(ctx context.Context, runtimeID string) error
    GetBotStatus(ctx context.Context, runtimeID string) (RuntimeStatus, error)

    // Backtest/HyperOpt execution
    RunBacktest(ctx context.Context, spec BacktestSpec) (RuntimeInstance, error)
    RunHyperopt(ctx context.Context, spec HyperoptSpec) (RuntimeInstance, error)

    // Health and monitoring
    HealthCheck(ctx context.Context, runtimeID string) (bool, error)
    GetLogs(ctx context.Context, runtimeID string) ([]string, error)

    // Resource management
    ListInstances(ctx context.Context) ([]RuntimeInstance, error)
    Cleanup(ctx context.Context, runtimeID string) error
}

type BotSpec struct {
    ID              string
    Name            string
    Image           string
    Config          map[string]interface{}
    Strategy        string
    Exchange        ExchangeConfig
    Resources       ResourceLimits
    ApiPort         int
}

type RuntimeInstance struct {
    ID              string
    Type            RuntimeType
    Status          string
    Metadata        map[string]string
    ApiURL          string
}

type RuntimeType string
const (
    RuntimeDocker     RuntimeType = "docker"
    RuntimeKubernetes RuntimeType = "kubernetes"
    RuntimeLocal      RuntimeType = "local"
)
```

---

## Runtime Implementations

### 1. Docker Runtime (Initial Implementation)

**Purpose:** Run bots in Docker containers on a single host

#### Bot Container Specification
```yaml
Image: freqtrade:2025.10
Volumes:
  - /data/{bot_id}/user_data:/freqtrade/user_data
  - /data/{bot_id}/config.json:/freqtrade/config.json:ro
Ports:
  - {dynamic_port}:8080
Environment:
  - FREQTRADE_API_USERNAME={generated}
  - FREQTRADE_API_PASSWORD={generated}
Labels:
  - anytrade.bot.id={bot_id}
  - anytrade.bot.name={bot_name}
  - anytrade.runtime=docker
  - anytrade.type=bot
Networks:
  - anytrade-network
Resources:
  Memory: 512MB (configurable)
  CPU: 0.5 cores (configurable)
```

#### Backtest Container Specification
```yaml
Image: freqtrade:2025.10
Volumes:
  - /data/backtests/{backtest_id}:/freqtrade/user_data
Command: backtesting --strategy {strategy_name} --config {config}
AutoRemove: true (cleanup after completion)
Labels:
  - anytrade.backtest.id={backtest_id}
  - anytrade.runtime=docker
  - anytrade.type=backtest
Resources:
  Memory: 2GB
  CPU: 2 cores
```

#### HyperOpt Container Specification
```yaml
Image: freqtrade:2025.10
Volumes:
  - /data/hyperopts/{hyperopt_id}:/freqtrade/user_data
Command: hyperopt --strategy {strategy_name} --epochs {epochs} --spaces {spaces}
AutoRemove: false (keep logs)
Labels:
  - anytrade.hyperopt.id={hyperopt_id}
  - anytrade.runtime=docker
  - anytrade.type=hyperopt
Resources:
  Memory: 4GB
  CPU: 4 cores (hyperopt is CPU intensive)
```

#### Naming Convention
- Bots: `anytrade-bot-{bot_name}-{short_id}`
- Backtests: `anytrade-backtest-{backtest_id}`
- HyperOpts: `anytrade-hyperopt-{hyperopt_id}`

#### Volume Management
- Persistent volumes per bot: `/var/lib/anytrade/data/bots/{bot_id}`
- Temporary volumes for backtests: `/var/lib/anytrade/data/backtests/{backtest_id}`
- Strategy files mounted read-only

#### Implementation Notes
- Use Docker SDK for Go (github.com/docker/docker)
- Connect to local Docker socket or remote Docker host
- Handle network creation and management
- Implement resource limits and quotas

---

### 2. Kubernetes Runtime (Future)

**Purpose:** Run bots in Kubernetes pods for scalability and orchestration

#### Bot Deployment Specification
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: anytrade-bot-{bot_id}
  labels:
    app: anytrade-bot
    bot-id: {bot_id}
spec:
  replicas: 1
  selector:
    matchLabels:
      bot-id: {bot_id}
  template:
    metadata:
      labels:
        bot-id: {bot_id}
    spec:
      containers:
      - name: freqtrade
        image: freqtrade:2025.10
        ports:
        - containerPort: 8080
        env:
        - name: FREQTRADE_API_USERNAME
          valueFrom:
            secretKeyRef:
              name: bot-{bot_id}-creds
              key: username
        - name: FREQTRADE_API_PASSWORD
          valueFrom:
            secretKeyRef:
              name: bot-{bot_id}-creds
              key: password
        volumeMounts:
        - name: config
          mountPath: /freqtrade/config.json
          subPath: config.json
        - name: data
          mountPath: /freqtrade/user_data
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
      volumes:
      - name: config
        configMap:
          name: bot-{bot_id}-config
      - name: data
        persistentVolumeClaim:
          claimName: bot-{bot_id}-data
---
apiVersion: v1
kind: Service
metadata:
  name: bot-{bot_id}
spec:
  selector:
    bot-id: {bot_id}
  ports:
  - port: 8080
    targetPort: 8080
```

#### Backtest Job Specification
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: anytrade-backtest-{backtest_id}
spec:
  template:
    spec:
      containers:
      - name: freqtrade
        image: freqtrade:2025.10
        command: ["freqtrade", "backtesting"]
        args: ["--strategy", "{strategy_name}", "--config", "/config/config.json"]
        volumeMounts:
        - name: config
          mountPath: /config
        - name: data
          mountPath: /freqtrade/user_data
        resources:
          requests:
            memory: "2Gi"
            cpu: "2000m"
      volumes:
      - name: config
        configMap:
          name: backtest-{backtest_id}-config
      - name: data
        emptyDir: {}
      restartPolicy: Never
  backoffLimit: 3
```

#### Implementation Notes
- Use Kubernetes client-go library
- Create ConfigMaps for configs
- Create Secrets for sensitive data
- Use Jobs for backtest/hyperopt
- Use Deployments for long-running bots
- Implement PVC for data persistence
- Support namespaces for multi-tenancy

---

### 3. Local Runtime (Development)

**Purpose:** Run bots as local processes for development and testing

#### Implementation
- Spawn freqtrade as child process
- Use temporary directories for data
- Assign random available ports
- Store process PID in runtime_id
- Simple to debug and develop

#### Process Management
```go
cmd := exec.Command("freqtrade", "trade", "--config", configPath)
cmd.Stdout = logWriter
cmd.Stderr = logWriter
err := cmd.Start()
runtimeID := strconv.Itoa(cmd.Process.Pid)
```

#### Notes
- Not recommended for production
- Useful for local development
- No isolation between bots
- Easy to debug

---

### Runtime Selection Strategy

**Default:** Docker runtime

**Selection logic:**
1. Check environment variable `ANYTRADE_RUNTIME` (docker, kubernetes, local)
2. Auto-detect: If running in k8s cluster → use Kubernetes runtime
3. Fall back to Docker runtime
4. Allow per-bot runtime override in config

**Configuration:**
```yaml
runtime:
  default: docker

  docker:
    socket: unix:///var/run/docker.sock
    network: anytrade-network
    data_path: /var/lib/anytrade/data

  kubernetes:
    namespace: anytrade
    kubeconfig: ~/.kube/config
    storage_class: standard

  local:
    data_path: ./data
    log_path: ./logs
```

### Health Check Strategy
- HTTP GET to `{api_url}/api/v1/ping` every 30 seconds
- Mark unhealthy if 3 consecutive failures
- Update `last_seen_at` on success
- Runtime-agnostic implementation

---

## Freqtrade Configuration Generation

### Base Template
```json
{
  "max_open_trades": 3,
  "stake_currency": "USDT",
  "stake_amount": "unlimited",
  "tradable_balance_ratio": 0.99,
  "fiat_display_currency": "USD",
  "dry_run": true,
  "cancel_open_orders_on_exit": false,
  "exchange": {},
  "pairlists": [
    {
      "method": "StaticPairList"
    }
  ],
  "api_server": {
    "enabled": true,
    "listen_ip_address": "0.0.0.0",
    "listen_port": 8080,
    "verbosity": "info",
    "enable_openapi": true,
    "jwt_secret_key": "{generated}",
    "CORS_origins": [],
    "username": "{from_bot}",
    "password": "{from_bot}"
  }
}
```

### Config Merge Order
1. Base template
2. Exchange-specific settings (from Exchange entity)
3. Strategy-specific settings (from Strategy entity)
4. Bot-specific overrides (from Bot.config JSON)

### Strategy File Deployment
- Write strategy Python code to `/user_data/strategies/{strategy_name}.py`
- Validate syntax before deployment
- Support multiple strategy files in same container

---

## GraphQL API Design

### Queries

```graphql
type Query {
  # Bots
  bots(
    filter: BotFilter
    orderBy: BotOrder
    first: Int
    after: String
  ): BotConnection!

  bot(id: ID!): Bot

  # Exchanges
  exchanges: [Exchange!]!
  exchange(id: ID!): Exchange

  # Strategies
  strategies(
    filter: StrategyFilter
    first: Int
    after: String
  ): StrategyConnection!

  strategy(id: ID!): Strategy

  # Backtests
  backtests(
    strategyId: ID
    filter: BacktestFilter
    orderBy: BacktestOrder
    first: Int
    after: String
  ): BacktestConnection!

  backtest(id: ID!): Backtest

  # HyperOpts
  hyperopts(
    strategyId: ID
    filter: HyperOptFilter
    first: Int
    after: String
  ): HyperOptConnection!

  hyperopt(id: ID!): HyperOpt

  # Trades
  trades(
    botId: ID!
    filter: TradeFilter
    orderBy: TradeOrder
    first: Int
    after: String
  ): TradeConnection!

  # Analytics
  botMetrics(botId: ID!): BotMetrics!
  strategyPerformance(strategyId: ID!): StrategyPerformance!
}
```

### Mutations

```graphql
type Mutation {
  # Exchange Management
  createExchange(input: CreateExchangeInput!): Exchange!
  updateExchange(id: ID!, input: UpdateExchangeInput!): Exchange!
  deleteExchange(id: ID!): Boolean!
  testExchangeConnection(id: ID!): ExchangeTestResult!

  # Strategy Management
  createStrategy(input: CreateStrategyInput!): Strategy!
  updateStrategy(id: ID!, input: UpdateStrategyInput!): Strategy!
  deleteStrategy(id: ID!): Boolean!
  validateStrategy(code: String!): StrategyValidationResult!

  # Bot Management
  createBot(input: CreateBotInput!): Bot!
  updateBot(id: ID!, input: UpdateBotInput!): Bot!
  deleteBot(id: ID!): Boolean!

  startBot(id: ID!): Bot!
  stopBot(id: ID!): Bot!
  restartBot(id: ID!): Bot!

  # Backtesting
  runBacktest(input: RunBacktestInput!): Backtest!
  cancelBacktest(id: ID!): Boolean!
  deleteBacktest(id: ID!): Boolean!

  # HyperOpt
  runHyperopt(input: RunHyperoptInput!): HyperOpt!
  cancelHyperopt(id: ID!): Boolean!
  deleteHyperopt(id: ID!): Boolean!

  # Trades
  syncTrades(botId: ID!): SyncTradesResult!
  closeTrade(botId: ID!, tradeId: Int!): Trade!
}
```

### Input Types

```graphql
input CreateBotInput {
  name: String!
  exchangeId: ID!
  strategyId: ID!
  mode: BotMode!
  config: BotConfigInput
  freqtradeVersion: String
}

input BotConfigInput {
  maxOpenTrades: Int
  stakeAmount: Float
  pairs: [String!]
  timeframe: String
  dryRun: Boolean
}

input RunBacktestInput {
  strategyId: ID!
  startDate: String!
  endDate: String!
  timeframe: String!
  stakeAmount: Float!
  stakeCurrency: String!
  pairs: [String!]!
  config: JSON
}

input RunHyperoptInput {
  strategyId: ID!
  epochs: Int!
  startDate: String!
  endDate: String!
  timeframe: String!
  stakeAmount: Float!
  stakeCurrency: String!
  pairs: [String!]!
  optimizationMetric: OptimizationMetric!
  spaces: [HyperoptSpace!]!
  config: JSON
}
```

---

## Background Workers

### 1. Status Monitor Worker
**Purpose:** Poll bot health and sync status

**Interval:** 30 seconds

**Logic:**
```
FOR each bot WHERE status IN (running, error):
  - GET {bot.api_url}/api/v1/ping
  - GET {bot.api_url}/api/v1/status
  - GET {bot.api_url}/api/v1/profit

  IF success:
    - Update bot.last_seen_at
    - Update bot.status = running
    - Clear bot.error_message
  ELSE:
    - Update bot.status = error
    - Set bot.error_message
    - Increment failure_count

  IF failure_count > 10:
    - Stop container
    - Notify user (future: webhooks/email)
```

### 2. Trade Sync Worker
**Purpose:** Sync trades from freqtrade to database

**Interval:** 60 seconds

**Logic:**
```
FOR each bot WHERE status = running:
  - GET {bot.api_url}/api/v1/trades

  FOR each trade in response:
    - Upsert Trade entity
    - Key: bot_id + freqtrade_trade_id
    - Update all fields if changed
```

### 3. Runtime Manager Worker
**Purpose:** Handle runtime lifecycle operations (runtime-agnostic)

**Queue:** Redis/Channel-based job queue

**Jobs:**
- `create_bot_runtime`
- `start_bot_runtime`
- `stop_bot_runtime`
- `restart_bot_runtime`
- `delete_bot_runtime`

**Logic:**
```
LISTEN for jobs:
  - Get runtime implementation from factory (Docker, K8s, Local)
  - Execute runtime operation via interface
  - Update Bot entity status
  - Store runtime_id and runtime_metadata
  - Handle errors gracefully
  - Retry on transient failures (max 3 attempts)
```

### 4. Backtest Worker
**Purpose:** Execute backtest jobs (runtime-agnostic)

**Queue:** Dedicated backtest queue

**Logic:**
```
FOR each backtest WHERE status = pending:
  1. Download historical data
  2. Write strategy file to storage
  3. Generate config file
  4. Get runtime implementation from factory
  5. Create runtime instance via Runtime.RunBacktest()
  6. Execute: freqtrade backtesting
  7. Stream logs to database
  8. Parse results JSON
  9. Update Backtest entity
  10. Cleanup runtime resources via Runtime.Cleanup()
```

### 5. HyperOpt Worker
**Purpose:** Execute hyperopt jobs (runtime-agnostic)

**Queue:** Dedicated hyperopt queue (limit concurrent jobs)

**Logic:**
```
FOR each hyperopt WHERE status = pending:
  1. Download historical data
  2. Write strategy file to storage
  3. Generate config file
  4. Get runtime implementation from factory
  5. Create runtime instance via Runtime.RunHyperopt()
  6. Execute: freqtrade hyperopt
  7. Stream logs and parse progress
  8. Update progress percentage
  9. Parse final results JSON
  10. Update HyperOpt entity
  11. Keep runtime resources for log inspection
```

**Concurrency:** Limit to 2 concurrent hyperopt jobs (CPU intensive)

---

## Security Implementation

### 1. Credential Encryption
**Algorithm:** AES-256-GCM

**Implementation:**
```go
// Encrypt sensitive fields in ENT hooks
func (e *Exchange) BeforeCreate(ctx context.Context) error {
    e.APIKey = encrypt(e.APIKey)
    e.APISecret = encrypt(e.APISecret)
    return nil
}

// Decrypt on read
func (e *Exchange) AfterFind(ctx context.Context) error {
    e.APIKey = decrypt(e.APIKey)
    e.APISecret = decrypt(e.APISecret)
    return nil
}
```

**Key Management:**
- Store master encryption key in environment variable: `ANYTRADE_ENCRYPTION_KEY`
- Generate per-installation during setup
- Never log decrypted credentials

### 2. GraphQL Authentication
**Method:** JWT Bearer tokens

**Flow:**
```
1. User authenticates → GET /auth/login
2. Server returns JWT token (expires in 24h)
3. Client includes header: Authorization: Bearer {token}
4. GraphQL middleware validates token
5. Attach user context to resolver
```

**Future:** Add user management, roles, permissions

### 3. Docker Security
**Measures:**
- Run containers as non-root user
- No privileged mode
- Read-only root filesystem where possible
- Resource limits (CPU, memory)
- Network isolation (internal docker network)
- No host network mode

### 4. Input Validation
**Critical validations:**
- Strategy code: Syntax check, no exec/eval, sandboxed execution
- Exchange name: Whitelist of supported exchanges
- API keys: Format validation before storage
- Config JSON: Schema validation
- SQL injection: Use parameterized queries (ENT handles this)
- GraphQL injection: Enable query complexity limits

---

## Technology Stack

### Core Dependencies
```
# Core
go 1.24

# ORM & Database
entgo.io/ent v0.13+
github.com/lib/pq (PostgreSQL driver)

# GraphQL
github.com/99designs/gqlgen v0.17+

# Runtime implementations
github.com/docker/docker v24+ (Docker runtime)
github.com/docker/go-connections
k8s.io/client-go v0.28+ (Kubernetes runtime)
k8s.io/apimachinery

# Crypto
golang.org/x/crypto

# Queue (choose one)
Option A: github.com/hibiken/asynq + github.com/redis/go-redis
Option B: Built-in channels (simpler, no Redis dependency)

# HTTP Client
github.com/go-resty/resty/v2

# Config
github.com/spf13/viper

# Logging
github.com/rs/zerolog

# Testing
github.com/stretchr/testify
```

### Database
**Recommended:** PostgreSQL 14+
- Production-ready
- JSON support for config fields
- Full-text search capabilities
- Strong consistency

**Alternative:** SQLite (development only)

---

## Project Structure

```
anytrade/
├── cmd/
│   └── server/
│       └── main.go              # Main server entry point (handles everything)
│
├── internal/                     # IMPORTANT: Flat structure - NO nested subdirectories
│   ├── contextutil/             # Context-based DI utilities
│   │   ├── keys.go              # Context keys
│   │   ├── logger.go            # Logger init/get
│   │   ├── database.go          # Database init/get
│   │   └── runtime.go           # Runtime init/get
│   │
│   ├── bot/                     # Bot domain
│   │   ├── service.go           # Bot business logic
│   │   ├── lifecycle.go         # Lifecycle operations
│   │   ├── config.go            # Config generation
│   │   └── metrics.go           # Metrics collection
│   │
│   ├── exchange/                # Exchange domain
│   │   ├── service.go           # Exchange operations
│   │   └── secrets.go           # Secret management
│   │
│   ├── strategy/                # Strategy domain
│   │   ├── service.go           # Strategy operations
│   │   └── validator.go         # Code validation
│   │
│   ├── backtest/                # Backtest domain
│   │   ├── service.go           # Backtest orchestration
│   │   └── executor.go          # Execution logic
│   │
│   ├── hyperopt/                # HyperOpt domain
│   │   ├── service.go           # HyperOpt orchestration
│   │   └── executor.go          # Execution logic
│   │
│   ├── trade/                   # Trade domain
│   │   ├── service.go           # Trade operations
│   │   └── sync.go              # Sync from freqtrade
│   │
│   ├── runtime/                 # Runtime abstraction - NO subdirs
│   │   ├── interface.go         # Runtime interface
│   │   ├── factory.go           # Factory pattern
│   │   ├── docker.go            # Docker implementation
│   │   ├── kubernetes.go        # Kubernetes implementation
│   │   └── local.go             # Local implementation
│   │
│   ├── freqtrade/               # Freqtrade HTTP client
│   │   ├── client.go            # HTTP client
│   │   ├── models.go            # API models
│   │   └── api.go               # API methods
│   │
│   ├── config/                  # Configuration management
│   │   ├── loader.go            # Load config
│   │   ├── validator.go         # Validate config
│   │   └── types.go             # Config types
│   │
│   ├── crypto/                  # Cryptography
│   │   ├── encryption.go        # AES encryption
│   │   └── keys.go              # Key management
│   │
│   ├── auth/                    # Authentication
│   │   ├── jwt.go               # JWT handling
│   │   └── middleware.go        # Auth middleware
│   │
│   └── enum/                    # Enums and constants
│       ├── exchange.go          # Exchange enum
│       ├── runtime.go           # Runtime type enum
│       └── status.go            # Status enums
│
├── ent/
│   ├── schema/
│   │   ├── bot.go
│   │   ├── exchange.go
│   │   ├── strategy.go
│   │   ├── backtest.go
│   │   ├── hyperopt.go
│   │   └── trade.go
│   └── ...                      # Generated ENT code
│
├── graph/
│   ├── schema.graphqls          # GraphQL schema
│   ├── schema.resolvers.go      # Generated resolvers
│   ├── resolver.go              # Resolver root
│   └── model/                   # GraphQL models
│
├── templates/
│   └── freqtrade/
│       ├── base_config.json     # Base freqtrade config
│       └── strategies/          # Example strategies
│
├── migrations/                  # Database migrations
│   ├── 001_initial.sql
│   └── ...
│
├── docker/
│   ├── freqtrade/
│   │   └── Dockerfile           # Custom freqtrade image
│   └── control-plane/
│       └── Dockerfile           # Control plane image
│
├── scripts/
│   ├── setup.sh                 # Initial setup script
│   └── generate.sh              # Code generation (ENT + GraphQL)
│
├── go.mod
├── go.sum
├── README.md
└── PLAN.md                      # This file
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [x] Project structure setup
- [ ] Initialize Go modules
- [ ] Install dependencies (ENT, gqlgen, docker SDK)
- [ ] PostgreSQL setup with Docker Compose
- [ ] ENT initialization and CLI setup
- [ ] Basic Makefile for common tasks

**Deliverable:** Empty project with dependencies ready

---

### Phase 2: Database Layer (Week 1-2)
- [ ] Define all ENT schemas (7 entities: Exchange, ExchangeSecret, Strategy, Bot, Backtest, HyperOpt, Trade)
- [ ] Add relationships and edges
- [ ] Implement encryption hooks for sensitive fields (ExchangeSecret, Bot API password)
- [ ] Generate ENT code
- [ ] Write database migrations
- [ ] Test schema with seed data

**Deliverable:** Working database layer with all entities

---

### Phase 3: Runtime Abstraction Layer (Week 2)
- [ ] Define Runtime interface
- [ ] Implement Runtime factory and selection logic
- [ ] Docker runtime implementation
  - [ ] Docker client wrapper
  - [ ] Container lifecycle functions (create, start, stop, delete)
  - [ ] Volume management
  - [ ] Network setup
- [ ] Local runtime implementation (for development)
- [ ] Health check implementation (runtime-agnostic)
- [ ] Custom freqtrade Dockerfile with API enabled
- [ ] Test runtime operations with Docker and Local

**Deliverable:** Working runtime abstraction with Docker and Local implementations

---

### Phase 4: Freqtrade API Client (Week 2-3)
- [ ] HTTP client with authentication
- [ ] Implement API endpoints:
  - `/api/v1/ping` (health)
  - `/api/v1/status` (bot status)
  - `/api/v1/profit` (profit metrics)
  - `/api/v1/trades` (trade list)
  - `/api/v1/stop` (stop bot)
- [ ] Error handling and retries
- [ ] Unit tests with mock server

**Deliverable:** Complete freqtrade API client

---

### Phase 5: Config Generation (Week 3)
- [ ] Base template loader
- [ ] Config merge logic
- [ ] Strategy file writer
- [ ] Validation
- [ ] Test with various configurations

**Deliverable:** Config generation system

---

### Phase 6: GraphQL API (Week 3-4)
- [ ] Initialize gqlgen
- [ ] Define GraphQL schema
- [ ] Generate resolvers
- [ ] Implement bot mutations (create, start, stop, restart, delete)
- [ ] Implement exchange CRUD
- [ ] Implement strategy CRUD
- [ ] Implement backtest mutations
- [ ] Implement hyperopt mutations
- [ ] Implement queries with pagination
- [ ] Add field resolvers for nested data

**Deliverable:** Full GraphQL API

---

### Phase 7: Background Workers (Week 4-5)
- [ ] Worker framework setup (asynq or channels)
- [ ] Status monitor worker
- [ ] Trade sync worker
- [ ] Runtime manager worker (runtime-agnostic)
- [ ] Backtest worker (runtime-agnostic)
- [ ] HyperOpt worker (runtime-agnostic)
- [ ] Worker graceful shutdown
- [ ] Test workers end-to-end with different runtimes

**Deliverable:** All background workers operational

---

### Phase 8: Security (Week 5)
- [ ] AES-256 encryption implementation
- [ ] Key management
- [ ] JWT authentication
- [ ] GraphQL auth middleware
- [ ] Input validation
- [ ] Security audit

**Deliverable:** Secure application

---

### Phase 9: Testing & Polish (Week 6)
- [ ] Unit tests (MANDATORY: 90%+ coverage)
- [ ] Integration tests
- [ ] End-to-end tests
- [ ] Error handling improvements
- [ ] Logging and observability
- [ ] Performance optimization

**Deliverable:** Production-ready code with 90%+ test coverage

---

### Phase 10: Documentation (Week 6)
- [ ] API documentation (GraphQL playground)
- [ ] README with setup instructions
- [ ] Architecture diagrams
- [ ] Deployment guide
- [ ] Example strategies

**Deliverable:** Complete documentation

---

## Open Questions

### 1. Database Choice
**Question:** PostgreSQL or SQLite for production?

**Recommendation:** PostgreSQL
- Better concurrency
- JSON support
- Production-ready
- Easy backup/restore

**Decision needed:** Confirm PostgreSQL

---

### 2. Queue System
**Question:** Redis + asynq or built-in Go channels?

**Option A: Redis + asynq**
- Pros: Persistent queue, distributed workers, retry logic
- Cons: Extra dependency, complexity

**Option B: Go channels**
- Pros: Simple, no dependencies, fast for single instance
- Cons: Not persistent, single instance only

**Recommendation:** Start with channels, migrate to Redis if needed

**Decision needed:** Confirm approach

---

### 3. Authentication
**Question:** Implement user management now or later?

**Options:**
- **Phase 1:** Single admin user, JWT with fixed secret
- **Phase 2:** Full user management with roles/permissions

**Recommendation:** Start with single user, add multi-user later

**Decision needed:** Confirm scope

---

### 4. Freqtrade Version Management
**Question:** Support multiple freqtrade versions?

**Options:**
- **Single version:** All bots use same freqtrade version (simpler)
- **Multi-version:** Each bot specifies version (flexible)

**Recommendation:** Start with single version, add multi-version support later

**Decision needed:** Confirm approach

---

### 5. Data Storage Location
**Question:** Where to store bot data volumes?

**Options:**
- `/var/lib/anytrade/data` (Linux standard)
- `./data` (relative to binary)
- Configurable path

**Recommendation:** Configurable with sensible default

**Decision needed:** Confirm location

---

### 6. Frontend
**Question:** Build web UI or CLI only?

**Out of scope for now** - Focus on backend API first

**Future:** React/Next.js web UI consuming GraphQL API

---

### 7. Kubernetes Runtime Priority
**Question:** Implement Kubernetes runtime in Phase 1 or defer to Phase 2?

**Options:**
- **Phase 1:** Implement alongside Docker (more upfront work)
- **Phase 2:** Start with Docker + Local, add K8s later (incremental)

**Recommendation:** Start with Docker + Local runtimes, add Kubernetes in Phase 2
- Proves the abstraction works
- Faster initial delivery
- K8s adds complexity (ConfigMaps, Secrets, PVCs, Services)

**Decision needed:** Confirm approach

---

## Success Metrics

### Functional Requirements
- [ ] Can create and manage bots via GraphQL API
- [ ] Bots run in isolated runtime environments (Docker/K8s/Local)
- [ ] Runtime abstraction allows switching between backends
- [ ] Status monitoring works reliably across all runtimes
- [ ] Trades sync from freqtrade API
- [ ] Backtests execute successfully
- [ ] HyperOpt runs complete successfully
- [ ] All credentials encrypted at rest

### Non-Functional Requirements
- [ ] API response time < 100ms (p95)
- [ ] Support 10+ concurrent bots
- [ ] Database queries optimized (N+1 avoided)
- [ ] Graceful error handling (no crashes)
- [ ] Comprehensive logging

---

## Next Steps

1. **Review this plan** - Confirm architecture and decisions
2. **Answer open questions** - Make key decisions
3. **Begin Phase 1** - Set up project foundation
4. **Iterate** - Build incrementally, test frequently

---

## Useful Commands (to be documented)

```bash
# Setup
make setup                 # Install dependencies
make migrate              # Run database migrations
make generate             # Generate ENT + GraphQL code

# Development
make dev                  # Run server in dev mode
make worker               # Run background workers
make test                 # Run tests
make lint                 # Run linters

# Docker
make docker-build         # Build freqtrade image
make docker-up            # Start PostgreSQL
make docker-down          # Stop all containers

# Database
make db-reset             # Reset database
make db-seed              # Seed test data
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-13
**Status:** Draft - Awaiting Review
