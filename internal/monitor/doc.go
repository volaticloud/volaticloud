/*
Package monitor provides distributed monitoring and status management for trading bots and backtests.

# Architecture Overview

The monitor package implements a distributed monitoring system that periodically checks bot status,
fetches trading metrics from Freqtrade, and manages backtest lifecycle. It supports both single-instance
and distributed multi-instance deployments using etcd for coordination.

	┌──────────────────────────────────────────────────────────┐
	│                     Monitor Manager                       │
	│  ┌────────────┐  ┌────────────┐  ┌─────────────────┐   │
	│  │ BotMonitor │  │  Backtest  │  │  RunnerMonitor  │   │
	│  │            │  │  Monitor   │  │                 │   │
	│  └────────────┘  └────────────┘  └─────────────────┘   │
	│         │               │                  │             │
	│         └───────────────┴──────────────────┘             │
	│                         │                                │
	│                  ┌──────▼──────┐                        │
	│                  │ Coordinator │                        │
	│                  └──────┬──────┘                        │
	│                         │                                │
	│                  ┌──────▼──────┐                        │
	│                  │  Registry   │                        │
	│                  └──────┬──────┘                        │
	└─────────────────────────┼────────────────────────────────┘
	                          │
	                    ┌─────▼─────┐
	                    │   etcd    │
	                    └───────────┘

# Component Responsibilities

Manager:
  - Orchestrates all monitoring workers (bot, backtest, runner)
  - Manages lifecycle (start/stop) of all components
  - Configures intervals and distributed coordination
  - Handles both single-instance and distributed modes

BotMonitor:
  - Monitors bot status every 30 seconds (configurable)
  - Fetches trading metrics from Freqtrade API
  - Syncs trades from Freqtrade to database (incremental)
  - Universal connection strategy (container IP + localhost fallback)
  - Updates database with status and performance metrics
  - Only monitors bots assigned via consistent hashing

BacktestMonitor:
  - Checks running backtests for completion
  - Fetches and parses backtest results
  - Extracts typed summary (profit, trades, win rate, etc.)
  - Auto-cleanup containers after result capture
  - Handles both completed and failed backtests

Coordinator:
  - Distributes bot monitoring across multiple instances
  - Uses consistent hashing (hash(botID) % instanceCount)
  - Watches for instance changes (joins/leaves)
  - Signals reassignment when topology changes
  - Single-instance mode: monitors all bots

Registry:
  - Registers instance in etcd with lease-based heartbeats
  - Maintains instance metadata (ID, hostname, start time)
  - Watches for other instance registrations
  - Auto-reestablishes lease on connection loss
  - 15-second lease TTL, 10-second heartbeat interval

# Usage Patterns

## Single Instance Mode (No etcd)

For development or small deployments where a single server monitors all bots:

	manager, err := monitor.NewManager(monitor.Config{
		DatabaseClient:  entClient,
		MonitorInterval: 30 * time.Second,
		// No EtcdEndpoints = single instance mode
	})
	if err != nil {
		log.Fatal(err)
	}

	ctx := context.Background()
	if err := manager.Start(ctx); err != nil {
		log.Fatal(err)
	}
	defer manager.Stop(ctx)

## Distributed Mode (With etcd)

For production deployments with multiple servers and load distribution:

	manager, err := monitor.NewManager(monitor.Config{
		DatabaseClient:        entClient,
		EtcdEndpoints:         []string{"localhost:2379"},
		MonitorInterval:       30 * time.Second,
		RunnerMonitorInterval: 5 * time.Minute,
		HeartbeatInterval:     10 * time.Second,
		LeaseTTL:              15,
	})
	if err != nil {
		log.Fatal(err)
	}

	ctx := context.Background()
	if err := manager.Start(ctx); err != nil {
		log.Fatal(err)
	}
	defer manager.Stop(ctx)

# Bot Status Monitoring

The BotMonitor performs the following checks every 30 seconds:

1. Query database for bots in active states (Running, Unhealthy, Stopped, Creating, Error)
2. Filter bots assigned to this instance via coordinator
3. For each assigned bot:
  - Get container status from runtime (Docker/Kubernetes)
  - Update bot status in database
  - If running and healthy: fetch Freqtrade metrics
  - Universal connection: try container IP, fallback to localhost

## Universal Connection Strategy

The monitor supports multiple deployment scenarios:

	Development (Host Machine):
	  - Container IP fails (not accessible from macOS/Windows host)
	  - Fallback to localhost:hostPort succeeds
	  - 2-second timeout on container IP attempt

	Docker Compose (Shared Network):
	  - Container IP succeeds immediately
	  - No fallback needed

	Kubernetes (Within Cluster):
	  - Container IP succeeds immediately
	  - No fallback needed

This automatic fallback ensures monitoring works across all environments without manual configuration.

# Backtest Monitoring

The BacktestMonitor handles one-time backtest jobs:

1. Query database for backtests in "running" status
2. For each running backtest:
  - Check container exit code and status
  - If completed: fetch results, parse summary, update database
  - If failed: capture logs, update error message
  - Auto-cleanup container after result capture

## Result Processing

When a backtest completes:

 1. Fetch result ZIP from container
 2. Extract JSON files (backtest-result.json, trades.json)
 3. Parse typed summary (20 key metrics)
 4. Store full result + summary in database
 5. Cleanup container automatically

## Summary Extraction

The monitor extracts typed summaries for GraphQL API:

	Typed Summary (20 fields):
	  - strategyName, totalTrades, wins, losses
	  - profitTotalAbs, profitTotalPercent
	  - winrate, profitFactor, expectancy
	  - maxDrawdown, maxDrawdownAbs
	  - firstTradeTimestamp, latestTradeTimestamp

	Full Result (JSON):
	  - Complete Freqtrade output (103+ fields)
	  - Available for advanced analysis

# Distributed Coordination

## Consistent Hashing

Bot assignments use consistent hashing for even distribution:

	hash := fnv64a(botID)
	assignedInstance := instances[hash % len(instances)]

Benefits:
  - Even load distribution across instances
  - Minimal reassignment when instances join/leave
  - Deterministic assignment (same bot → same instance)

## Instance Registry

Each instance registers in etcd with metadata:

	/volaticloud/instances/{instanceID} → {
		"instance_id": "hostname-1234567890",
		"hostname": "server1.example.com",
		"started_at": "2024-01-15T10:30:00Z",
		"last_heartbeat": "2024-01-15T10:35:42Z"
	}

Lease TTL: 15 seconds
Heartbeat: Every 10 seconds
Auto-reestablish: On connection loss

## Assignment Changes

When an instance joins or leaves:

1. Registry detects change via etcd watch
2. Coordinator updates instance list (sorted)
3. Signals assignment change to monitors
4. BotMonitor immediately rechecks all bots
5. New assignments take effect

# Configuration

## Config Fields

	DatabaseClient (*ent.Client):
	  Required. ENT client for querying and updating entities.

	EtcdEndpoints ([]string):
	  Optional. If empty, runs in single-instance mode.
	  Example: []string{"etcd1:2379", "etcd2:2379"}

	InstanceID (string):
	  Optional. Auto-generated if not provided.
	  Format: "{hostname}-{nanoseconds}"

	MonitorInterval (time.Duration):
	  Optional. Bot monitoring interval (default: 30s)

	RunnerMonitorInterval (time.Duration):
	  Optional. Runner data monitoring interval (default: 5m)

	HeartbeatInterval (time.Duration):
	  Optional. etcd heartbeat interval (default: 10s)

	LeaseTTL (int64):
	  Optional. etcd lease TTL in seconds (default: 15)

# Metrics Collection

## Freqtrade API Integration

The monitor fetches metrics from Freqtrade's REST API:

	Endpoint: /api/v1/profit
	Authentication: Basic auth (username/password from bot config)
	Connection: Container IP (2s timeout) → localhost:hostPort (fallback)

## Collected Metrics

Stored in BotMetrics entity (one-to-one with Bot):

	Profit Metrics:
	  - profit_closed_coin, profit_closed_percent
	  - profit_all_coin, profit_all_percent

	Trade Counts:
	  - trade_count, closed_trade_count
	  - winning_trades, losing_trades

	Performance:
	  - winrate (0.0-1.0)
	  - profit_factor (wins/losses ratio)
	  - expectancy (expected profit per trade)

	Risk:
	  - max_drawdown (percentage)
	  - max_drawdown_abs (absolute value)

	Best Performing:
	  - best_pair (symbol)
	  - best_rate (profit percentage)

	Timestamps:
	  - first_trade_timestamp (Unix → time.Time)
	  - latest_trade_timestamp (Unix → time.Time)
	  - fetched_at (last successful fetch)

## Upsert Strategy

Metrics use upsert pattern (update existing or create new):

 1. Query for existing BotMetrics by bot_id
 2. If exists: UpdateOneID with new values
 3. If not exists: Create with all fields
 4. Store fetched_at = time.Now()

# Trade Sync

The BotMonitor syncs trades from Freqtrade to the database for historical tracking.

## Sync Strategy

Incremental sync based on last_synced_trade_id:

 1. Get last synced trade ID from BotMetrics
 2. Fetch all trades from Freqtrade API (paginated)
 3. Filter trades: new trades (trade_id > last_synced) OR open trades
 4. Batch upsert using ON CONFLICT (bot_id, freqtrade_trade_id)
 5. Update last_synced_trade_id in BotMetrics

## Trade Fields

Stored in Trade entity (many-to-one with Bot):

	Core Fields:
	  - freqtrade_trade_id (unique per bot)
	  - pair (e.g., "BTC/USDT")
	  - is_open (true for active trades)
	  - strategy_name (strategy that opened trade)

	Timestamps:
	  - open_date, close_date
	  - timeframe (e.g., "1h", "4h")

	Prices:
	  - open_rate, close_rate
	  - amount, stake_amount

	Profit:
	  - profit_abs (absolute profit)
	  - profit_ratio (percentage as decimal)

	Exit:
	  - sell_reason (exit signal type)

	Raw Data:
	  - raw_data (full Freqtrade JSON for analytics)

## Batch Size

	TradeFetchBatchSize: 500 trades per API call
	Pagination continues until all trades fetched

## Future Alerting

Trade sync is designed for future alerting integration:

	TradeChange types:
	  - TradeChangeNewTrade: new trade opened
	  - TradeChangeTradeClosed: trade closed
	  - TradeChangeTradeUpdated: open trade profit updated

# Error Handling

## Bot Status Errors

	Container Not Found:
	  - Mark bot as "stopped" status
	  - Clear error message
	  - Only log on status change (not every check)

	Container/Network Error:
	  - Mark bot as "error" status
	  - Store error message
	  - Continue monitoring for automatic recovery
	  - Only log on status change (avoid spam during persistent issues)
	  - Log recovery when bot returns to running state

	Metrics Fetch Failed:
	  - Log error but don't fail status check
	  - Bot remains "running" status
	  - Metrics update skipped for this cycle

## Backtest Errors

	Container Exit Non-Zero:
	  - Mark backtest as "failed" status
	  - Capture logs for debugging
	  - Cleanup container automatically

	Result Parse Failed:
	  - Mark backtest as "completed" without results
	  - Store error message
	  - Cleanup container

	Cleanup Failed:
	  - Log warning but don't fail
	  - Results/status already saved
	  - Manual cleanup may be needed

## Distributed Errors

	etcd Connection Lost:
	  - Registry auto-reestablishes lease
	  - Heartbeat loop continues
	  - Instance re-registers automatically

	Instance Deregistered:
	  - Other instances detect via watch
	  - Reassign bots via consistent hashing
	  - Seamless failover

# Testing

## Unit Tests

Bot Monitor:
  - Status updates (running, stopped, error, unhealthy)
  - Metrics upsert (create vs update)
  - Error handling (container not found, API failures)

Coordinator:
  - Consistent hashing algorithm
  - Assignment distribution
  - Instance join/leave scenarios

Registry:
  - Instance registration/deregistration
  - Lease renewal and re-establishment
  - Watch for instance changes

## Integration Tests

Requires Docker for runtime integration:

	go test -v ./internal/monitor -run TestBotMonitor

Requires etcd for distributed tests:

	go test -v ./internal/monitor -run TestDistributed

# Remote Data Download

Historical data is downloaded on the runner's infrastructure (Docker host or K8s cluster),
not on the control plane. This enables data download even when the control plane runs in K8s.

## Architecture

	Control Plane (RunnerMonitor)
	    │
	    ├─ Generate presigned S3 URLs (download + upload)
	    ├─ Create DataDownloader via Factory
	    ├─ Start download task on runner
	    ├─ Poll status until completion
	    └─ Update database with S3 key

	Runner (Docker/K8s)
	    │
	    ├─ Download existing data from S3 (incremental)
	    ├─ Run freqtrade download-data
	    ├─ Package as tar.gz
	    └─ Upload to S3 via presigned URL

## Data Format

Data is stored as tar.gz archives (not zip) for compatibility with both Docker and K8s.
The freqtrade image has tar but may not have unzip.

## Download Phases

1. Pending - Task created but not started
2. Downloading - freqtrade download-data running
3. Packaging - Creating tar.gz archive
4. Uploading - Uploading to S3
5. Completed - Data ready for use

## S3 Integration

- Presigned GET URL for existing data (incremental updates)
- Presigned PUT URL for uploading new data
- URLs valid for 1 hour
- Data key format: runners/{runnerID}/data.tar.gz

# Files

	manager.go          - Monitor manager (orchestration)
	bot_monitor.go      - Bot status and metrics monitoring
	trade_sync.go       - Trade sync from Freqtrade to database
	backtest_monitor.go - Backtest lifecycle management
	coordinator.go      - Distributed bot assignment
	registry.go         - Instance registration in etcd
	runner_monitor.go   - Runner data monitoring
	data_download.go    - Remote data download orchestration
	data_packager.go    - tar.gz packing/unpacking utilities
	types.go            - Shared types and constants

# Related Packages

	internal/runner     - Runtime abstraction (Docker/Kubernetes)
	internal/freqtrade  - Freqtrade API client (auto-generated)
	internal/backtest   - Backtest result parsing and summary extraction
	internal/etcd       - etcd client wrapper
	internal/ent        - Database entities and queries

# References

  - ADR-0004: Runtime Abstraction Layer
  - internal/freqtrade/openapi.json (Freqtrade API spec)
  - cmd/server/main.go:155-171 (Manager initialization)
  - docs/adr/0007-kubernetes-deployment-strategy.md (Distributed deployment)
*/
package monitor
