/*
Package usage provides resource usage tracking and billing for bots and backtests.

# Overview

The usage package implements a per-minute resource usage collection system for billing purposes.
It tracks CPU, memory, network I/O, and disk I/O metrics for running bots and backtests,
aggregates them into hourly/daily summaries, and provides cost calculation based on runner-specific rates.

# Architecture

```mermaid
flowchart TB

	subgraph Monitors["Resource Usage Flow"]
	    BM[BotMonitor]
	    BTM[BacktestMonitor]
	    DA[Docker/K8s Stats API]
	end

	subgraph Collection["Collection Layer"]
	    COL[Collector<br/>per-minute]
	    US[(Usage Samples<br/>7 days TTL)]
	end

	subgraph Aggregation["Aggregation Layer"]
	    AGG[Aggregator<br/>hourly worker]
	    HA[(Hourly<br/>Aggregations)]
	    DAA[(Daily<br/>Aggregations)]
	end

	subgraph Billing["Billing Layer"]
	    CALC[Calculator]
	end

	BM --> DA
	BTM --> DA
	DA --> COL
	COL --> US
	US --> AGG
	AGG --> HA
	AGG --> DAA
	HA --> CALC
	DAA --> CALC

```

# Runner-Based Billing Model

Billing is per-runner, controlled by two independent flags:

| public | billing_enabled | Type               | Description                         |
|--------|-----------------|-------------------|-------------------------------------|
| false  | false           | Custom Runner     | User's own infra, private, free     |
| true   | false           | Public Free Runner| Platform-provided free tier         |
| true   | true            | Public Paid Runner| Platform-provided, usage tracked    |
| false  | true            | Private Paid      | Private runner with billing (rare)  |

Key Points:
  - Only record samples when billing_enabled=true on the runner
  - Each runner has its own pricing rates (cpu_price_per_core_hour, etc.)
  - Usage is aggregated per-runner for accurate billing

# Billing Units (Industry Standard)

	CPU:     Core-seconds = (cpuPercent / 100) * intervalSeconds
	Memory:  GB-seconds   = (memoryBytes / 1GB) * intervalSeconds
	Network: Bytes transferred (rx + tx)
	Disk:    Bytes read/written

Hourly Aggregation:

	cpuCoreHours   = sumCpuCoreSeconds / 3600
	memoryGBHours  = sumMemoryGBSeconds / 3600
	networkGB      = (totalRxBytes + totalTxBytes) / (1024^3)
	storageGB      = (totalReadBytes + totalWriteBytes) / (1024^3)

# Sample Collection

The Collector records per-minute samples:

	type UsageSample struct {
		ResourceType    enum.ResourceType  // bot or backtest
		ResourceID      uuid.UUID          // Bot or Backtest ID
		OwnerID         string             // Organization ID
		RunnerID        uuid.UUID          // Runner for rate lookup
		CPUPercent      float64            // 0-100 per core
		MemoryBytes     int64              // Current memory usage
		NetworkRxBytes  int64              // Network received
		NetworkTxBytes  int64              // Network transmitted
		BlockReadBytes  int64              // Disk read
		BlockWriteBytes int64              // Disk written
		SampledAt       time.Time          // Sample timestamp
	}

Collection is triggered by monitors:

	// In BotMonitor.checkBot()
	if runner.BillingEnabled && status.Status == BotStatusRunning {
		collector.RecordBotSample(ctx, sample)
	}

Samples are retained for 7 days, then cleaned up by the aggregator.

# Aggregation

The Aggregator runs hourly to:

 1. Compute hourly aggregations from raw samples
 2. Compute daily aggregations from hourly data
 3. Clean up samples older than retention period (7 days)

Aggregation formula:

	cpuCoreSeconds  = sum((cpuPercent / 100) * 60) for each sample
	memoryGBSeconds = sum((memoryBytes / 1GB) * 60) for each sample
	cpuAvgPercent   = avg(cpuPercent) across samples
	cpuMaxPercent   = max(cpuPercent) across samples
	memoryAvgBytes  = avg(memoryBytes) across samples
	memoryMaxBytes  = max(memoryBytes) across samples

# Cost Calculation

Cost is calculated using runner-specific rates:

	cpuCost     = cpuCoreHours * runner.CPUPricePerCoreHour
	memoryCost  = memoryGBHours * runner.MemoryPricePerGBHour
	networkCost = networkGB * runner.NetworkPricePerGB
	storageCost = storageGB * runner.StoragePricePerGB
	totalCost   = cpuCost + memoryCost + networkCost + storageCost

If a user has resources on multiple runners, aggregate costs per runner first.

# Usage Patterns

## Recording Samples (in monitors)

	collector := usage.NewCollector(entClient)

	// Only if billing enabled
	if runner.BillingEnabled {
		err := collector.RecordBotSample(ctx, usage.UsageSample{
			ResourceType:    enum.ResourceTypeBot,
			ResourceID:      bot.ID,
			OwnerID:         bot.OwnerID,
			RunnerID:        runner.ID,
			CPUPercent:      status.CPUUsage,
			MemoryBytes:     status.MemoryUsage,
			NetworkRxBytes:  status.NetworkRxBytes,
			NetworkTxBytes:  status.NetworkTxBytes,
			BlockReadBytes:  status.BlockReadBytes,
			BlockWriteBytes: status.BlockWriteBytes,
			SampledAt:       time.Now(),
		})
	}

## Running Aggregation (worker)

	aggregator := usage.NewAggregator(entClient)

	// Run hourly via cron/worker
	if err := aggregator.AggregateHourly(ctx, lastHour); err != nil {
		log.Printf("hourly aggregation failed: %v", err)
	}

	// Cleanup old samples
	if err := aggregator.CleanupOldSamples(ctx, 7*24*time.Hour); err != nil {
		log.Printf("sample cleanup failed: %v", err)
	}

## Calculating Costs (for billing)

	calculator := usage.NewCalculator(entClient)

	// Get usage summary for organization
	summary, err := calculator.GetOrganizationUsage(ctx, ownerID, startTime, endTime)

	// Calculate cost for a specific runner
	cost, err := calculator.CalculateCost(summary, rates)

# Error Handling

Sample collection errors should not fail status checks:

	if err := collector.RecordSample(ctx, sample); err != nil {
		log.Printf("usage collection failed: %v", err)
		// Continue with status check - don't fail the bot
	}

Aggregation failures are logged but don't block:

	if err := aggregator.AggregateHourly(ctx, hour); err != nil {
		log.Printf("aggregation failed for %v: %v", hour, err)
		// Will retry next cycle
	}

# Files

	doc.go          - Package documentation
	types.go        - Domain types and interfaces
	collector.go    - Sample recording logic
	aggregator.go   - Hourly/daily aggregation
	calculator.go   - Usage queries and cost calculation

# Related Packages

	internal/monitor - Calls collector in bot/backtest monitors
	internal/runner  - Provides resource metrics via Docker/K8s stats
	internal/ent     - ResourceUsageSample and ResourceUsageAggregation entities
	internal/enum    - ResourceType and AggregationGranularity enums

# Database Entities

ResourceUsageSample (raw per-minute samples):
  - Retained for 7 days
  - Indexes: (resource_type, resource_id, sampled_at), (owner_id, sampled_at)

ResourceUsageAggregation (hourly/daily summaries):
  - Retained indefinitely for billing history
  - Unique: (resource_type, resource_id, granularity, bucket_start)

# Testing

Run unit tests:

	go test -v ./internal/usage
	go test -v ./internal/usage -cover

Coverage target: >90%
*/
package usage
