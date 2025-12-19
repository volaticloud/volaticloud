package usage

import (
	"context"
	"time"

	"github.com/google/uuid"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/resourceusageaggregation"
	"volaticloud/internal/ent/resourceusagesample"
	"volaticloud/internal/enum"
)

// aggregator implements the Aggregator interface.
type aggregator struct {
	client *ent.Client
}

// NewAggregator creates a new usage aggregator.
func NewAggregator(client *ent.Client) Aggregator {
	return &aggregator{client: client}
}

// resourceKey uniquely identifies a resource for aggregation grouping.
type resourceKey struct {
	ResourceType enum.ResourceType
	ResourceID   uuid.UUID
	OwnerID      string
	RunnerID     uuid.UUID
}

// AggregateHourly computes hourly aggregations for the specified hour.
func (a *aggregator) AggregateHourly(ctx context.Context, hour time.Time) error {
	// Normalize to hour boundary
	bucketStart := hour.Truncate(time.Hour)
	bucketEnd := bucketStart.Add(time.Hour)

	// Query all samples for this hour
	samples, err := a.client.ResourceUsageSample.Query().
		Where(
			resourceusagesample.SampledAtGTE(bucketStart),
			resourceusagesample.SampledAtLT(bucketEnd),
		).
		All(ctx)
	if err != nil {
		return err
	}

	if len(samples) == 0 {
		return nil
	}

	// Group samples by resource
	grouped := make(map[resourceKey][]*ent.ResourceUsageSample)
	for _, s := range samples {
		key := resourceKey{
			ResourceType: s.ResourceType,
			ResourceID:   s.ResourceID,
			OwnerID:      s.OwnerID,
			RunnerID:     s.RunnerID,
		}
		grouped[key] = append(grouped[key], s)
	}

	// Aggregate each resource group
	for key, resourceSamples := range grouped {
		summary := computeAggregation(resourceSamples, bucketStart, bucketEnd)

		// Upsert aggregation record
		err := a.upsertHourlyAggregation(ctx, key, summary)
		if err != nil {
			return err
		}
	}

	return nil
}

// computeAggregation computes aggregated metrics from a slice of samples.
func computeAggregation(samples []*ent.ResourceUsageSample, bucketStart, bucketEnd time.Time) *UsageSummary {
	if len(samples) == 0 {
		return nil
	}

	var (
		cpuCoreSeconds  float64
		memoryGBSeconds float64
		cpuSum          float64
		cpuMax          float64
		memorySum       int64
		memoryMax       int64
		networkRx       int64
		networkTx       int64
		blockRead       int64
		blockWrite      int64
	)

	for _, s := range samples {
		// CPU: convert percentage to core-seconds
		// (cpuPercent / 100) * 60 seconds = core-seconds per sample
		cpuCoreSeconds += (s.CPUPercent / 100.0) * SampleIntervalSeconds

		// Memory: convert bytes to GB-seconds
		// (bytes / 1GB) * 60 seconds = GB-seconds per sample
		memoryGBSeconds += (float64(s.MemoryBytes) / BytesPerGB) * SampleIntervalSeconds

		// Running stats for averages and max
		cpuSum += s.CPUPercent
		if s.CPUPercent > cpuMax {
			cpuMax = s.CPUPercent
		}

		memorySum += s.MemoryBytes
		if s.MemoryBytes > memoryMax {
			memoryMax = s.MemoryBytes
		}

		// Cumulative I/O metrics
		networkRx += s.NetworkRxBytes
		networkTx += s.NetworkTxBytes
		blockRead += s.BlockReadBytes
		blockWrite += s.BlockWriteBytes
	}

	sampleCount := len(samples)

	return &UsageSummary{
		ResourceType:    samples[0].ResourceType,
		ResourceID:      samples[0].ResourceID,
		OwnerID:         samples[0].OwnerID,
		RunnerID:        samples[0].RunnerID,
		PeriodStart:     bucketStart,
		PeriodEnd:       bucketEnd,
		CPUCoreSeconds:  cpuCoreSeconds,
		CPUAvgPercent:   cpuSum / float64(sampleCount),
		CPUMaxPercent:   cpuMax,
		MemoryGBSeconds: memoryGBSeconds,
		MemoryAvgBytes:  memorySum / int64(sampleCount),
		MemoryMaxBytes:  memoryMax,
		NetworkRxBytes:  networkRx,
		NetworkTxBytes:  networkTx,
		BlockReadBytes:  blockRead,
		BlockWriteBytes: blockWrite,
		SampleCount:     sampleCount,
	}
}

// upsertHourlyAggregation creates or updates an hourly aggregation record.
func (a *aggregator) upsertHourlyAggregation(ctx context.Context, key resourceKey, summary *UsageSummary) error {
	// Check if aggregation exists
	existing, err := a.client.ResourceUsageAggregation.Query().
		Where(
			resourceusageaggregation.ResourceTypeEQ(key.ResourceType),
			resourceusageaggregation.ResourceID(key.ResourceID),
			resourceusageaggregation.GranularityEQ(enum.AggregationGranularityHourly),
			resourceusageaggregation.BucketStart(summary.PeriodStart),
		).
		Only(ctx)

	if err != nil && !ent.IsNotFound(err) {
		return err
	}

	if existing != nil {
		// Update existing
		_, err = existing.Update().
			SetCPUCoreSeconds(summary.CPUCoreSeconds).
			SetCPUAvgPercent(summary.CPUAvgPercent).
			SetCPUMaxPercent(summary.CPUMaxPercent).
			SetMemoryGBSeconds(summary.MemoryGBSeconds).
			SetMemoryAvgBytes(summary.MemoryAvgBytes).
			SetMemoryMaxBytes(summary.MemoryMaxBytes).
			SetNetworkRxBytes(summary.NetworkRxBytes).
			SetNetworkTxBytes(summary.NetworkTxBytes).
			SetBlockReadBytes(summary.BlockReadBytes).
			SetBlockWriteBytes(summary.BlockWriteBytes).
			SetSampleCount(summary.SampleCount).
			Save(ctx)
		return err
	}

	// Create new
	_, err = a.client.ResourceUsageAggregation.Create().
		SetResourceType(key.ResourceType).
		SetResourceID(key.ResourceID).
		SetOwnerID(key.OwnerID).
		SetRunnerID(key.RunnerID).
		SetGranularity(enum.AggregationGranularityHourly).
		SetBucketStart(summary.PeriodStart).
		SetBucketEnd(summary.PeriodEnd).
		SetCPUCoreSeconds(summary.CPUCoreSeconds).
		SetCPUAvgPercent(summary.CPUAvgPercent).
		SetCPUMaxPercent(summary.CPUMaxPercent).
		SetMemoryGBSeconds(summary.MemoryGBSeconds).
		SetMemoryAvgBytes(summary.MemoryAvgBytes).
		SetMemoryMaxBytes(summary.MemoryMaxBytes).
		SetNetworkRxBytes(summary.NetworkRxBytes).
		SetNetworkTxBytes(summary.NetworkTxBytes).
		SetBlockReadBytes(summary.BlockReadBytes).
		SetBlockWriteBytes(summary.BlockWriteBytes).
		SetSampleCount(summary.SampleCount).
		Save(ctx)

	return err
}

// AggregateDaily computes daily aggregations from hourly data.
func (a *aggregator) AggregateDaily(ctx context.Context, day time.Time) error {
	// Normalize to day boundary (UTC)
	bucketStart := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, time.UTC)
	bucketEnd := bucketStart.AddDate(0, 0, 1)

	// Query all hourly aggregations for this day
	hourlyAggs, err := a.client.ResourceUsageAggregation.Query().
		Where(
			resourceusageaggregation.GranularityEQ(enum.AggregationGranularityHourly),
			resourceusageaggregation.BucketStartGTE(bucketStart),
			resourceusageaggregation.BucketStartLT(bucketEnd),
		).
		All(ctx)
	if err != nil {
		return err
	}

	if len(hourlyAggs) == 0 {
		return nil
	}

	// Group by resource
	grouped := make(map[resourceKey][]*ent.ResourceUsageAggregation)
	for _, agg := range hourlyAggs {
		key := resourceKey{
			ResourceType: agg.ResourceType,
			ResourceID:   agg.ResourceID,
			OwnerID:      agg.OwnerID,
			RunnerID:     agg.RunnerID,
		}
		grouped[key] = append(grouped[key], agg)
	}

	// Aggregate each resource group
	for key, hourlyData := range grouped {
		summary := aggregateHourlyToDaily(hourlyData, bucketStart, bucketEnd)

		err := a.upsertDailyAggregation(ctx, key, summary)
		if err != nil {
			return err
		}
	}

	return nil
}

// aggregateHourlyToDaily combines hourly aggregations into a daily summary.
func aggregateHourlyToDaily(hourly []*ent.ResourceUsageAggregation, bucketStart, bucketEnd time.Time) *UsageSummary {
	if len(hourly) == 0 {
		return nil
	}

	var (
		cpuCoreSeconds  float64
		memoryGBSeconds float64
		cpuSum          float64
		cpuMax          float64
		memorySum       int64
		memoryMax       int64
		networkRx       int64
		networkTx       int64
		blockRead       int64
		blockWrite      int64
		totalSamples    int
	)

	for _, h := range hourly {
		cpuCoreSeconds += h.CPUCoreSeconds
		memoryGBSeconds += h.MemoryGBSeconds

		// Weight average by sample count
		cpuSum += h.CPUAvgPercent * float64(h.SampleCount)
		memorySum += h.MemoryAvgBytes * int64(h.SampleCount)

		if h.CPUMaxPercent > cpuMax {
			cpuMax = h.CPUMaxPercent
		}
		if h.MemoryMaxBytes > memoryMax {
			memoryMax = h.MemoryMaxBytes
		}

		networkRx += h.NetworkRxBytes
		networkTx += h.NetworkTxBytes
		blockRead += h.BlockReadBytes
		blockWrite += h.BlockWriteBytes
		totalSamples += h.SampleCount
	}

	return &UsageSummary{
		ResourceType:    hourly[0].ResourceType,
		ResourceID:      hourly[0].ResourceID,
		OwnerID:         hourly[0].OwnerID,
		RunnerID:        hourly[0].RunnerID,
		PeriodStart:     bucketStart,
		PeriodEnd:       bucketEnd,
		CPUCoreSeconds:  cpuCoreSeconds,
		CPUAvgPercent:   cpuSum / float64(totalSamples),
		CPUMaxPercent:   cpuMax,
		MemoryGBSeconds: memoryGBSeconds,
		MemoryAvgBytes:  memorySum / int64(totalSamples),
		MemoryMaxBytes:  memoryMax,
		NetworkRxBytes:  networkRx,
		NetworkTxBytes:  networkTx,
		BlockReadBytes:  blockRead,
		BlockWriteBytes: blockWrite,
		SampleCount:     totalSamples,
	}
}

// upsertDailyAggregation creates or updates a daily aggregation record.
func (a *aggregator) upsertDailyAggregation(ctx context.Context, key resourceKey, summary *UsageSummary) error {
	// Check if aggregation exists
	existing, err := a.client.ResourceUsageAggregation.Query().
		Where(
			resourceusageaggregation.ResourceTypeEQ(key.ResourceType),
			resourceusageaggregation.ResourceID(key.ResourceID),
			resourceusageaggregation.GranularityEQ(enum.AggregationGranularityDaily),
			resourceusageaggregation.BucketStart(summary.PeriodStart),
		).
		Only(ctx)

	if err != nil && !ent.IsNotFound(err) {
		return err
	}

	if existing != nil {
		// Update existing
		_, err = existing.Update().
			SetCPUCoreSeconds(summary.CPUCoreSeconds).
			SetCPUAvgPercent(summary.CPUAvgPercent).
			SetCPUMaxPercent(summary.CPUMaxPercent).
			SetMemoryGBSeconds(summary.MemoryGBSeconds).
			SetMemoryAvgBytes(summary.MemoryAvgBytes).
			SetMemoryMaxBytes(summary.MemoryMaxBytes).
			SetNetworkRxBytes(summary.NetworkRxBytes).
			SetNetworkTxBytes(summary.NetworkTxBytes).
			SetBlockReadBytes(summary.BlockReadBytes).
			SetBlockWriteBytes(summary.BlockWriteBytes).
			SetSampleCount(summary.SampleCount).
			Save(ctx)
		return err
	}

	// Create new
	_, err = a.client.ResourceUsageAggregation.Create().
		SetResourceType(key.ResourceType).
		SetResourceID(key.ResourceID).
		SetOwnerID(key.OwnerID).
		SetRunnerID(key.RunnerID).
		SetGranularity(enum.AggregationGranularityDaily).
		SetBucketStart(summary.PeriodStart).
		SetBucketEnd(summary.PeriodEnd).
		SetCPUCoreSeconds(summary.CPUCoreSeconds).
		SetCPUAvgPercent(summary.CPUAvgPercent).
		SetCPUMaxPercent(summary.CPUMaxPercent).
		SetMemoryGBSeconds(summary.MemoryGBSeconds).
		SetMemoryAvgBytes(summary.MemoryAvgBytes).
		SetMemoryMaxBytes(summary.MemoryMaxBytes).
		SetNetworkRxBytes(summary.NetworkRxBytes).
		SetNetworkTxBytes(summary.NetworkTxBytes).
		SetBlockReadBytes(summary.BlockReadBytes).
		SetBlockWriteBytes(summary.BlockWriteBytes).
		SetSampleCount(summary.SampleCount).
		Save(ctx)

	return err
}

// CleanupOldSamples removes raw samples older than the retention period.
func (a *aggregator) CleanupOldSamples(ctx context.Context, olderThan time.Duration) (int, error) {
	cutoff := time.Now().Add(-olderThan)

	deleted, err := a.client.ResourceUsageSample.Delete().
		Where(resourceusagesample.SampledAtLT(cutoff)).
		Exec(ctx)

	return deleted, err
}
