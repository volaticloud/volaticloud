package usage

import (
	"context"
	"time"

	"github.com/google/uuid"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/resourceusageaggregation"
	"volaticloud/internal/enum"
)

// calculator implements the Calculator interface.
type calculator struct {
	client *ent.Client
}

// NewCalculator creates a new usage calculator.
func NewCalculator(client *ent.Client) Calculator {
	return &calculator{client: client}
}

// GetResourceUsage returns aggregated usage for a specific resource.
func (c *calculator) GetResourceUsage(ctx context.Context, resourceType enum.ResourceType, resourceID uuid.UUID, start, end time.Time) (*UsageSummary, error) {
	// Convert times to local timezone to match how data is stored in SQLite
	// SQLite does string comparison, so timezone must match
	localStart := start.Local()
	localEnd := end.Local()

	// Query aggregations for the resource within the time range
	aggs, err := c.client.ResourceUsageAggregation.Query().
		Where(
			resourceusageaggregation.ResourceTypeEQ(resourceType),
			resourceusageaggregation.ResourceID(resourceID),
			resourceusageaggregation.BucketStartGTE(localStart),
			resourceusageaggregation.BucketStartLT(localEnd),
		).
		Order(ent.Asc(resourceusageaggregation.FieldBucketStart)).
		All(ctx)
	if err != nil {
		return nil, err
	}

	if len(aggs) == 0 {
		return nil, nil
	}

	return combineAggregations(aggs, start, end), nil
}

// GetOrganizationUsage returns total usage for an organization.
func (c *calculator) GetOrganizationUsage(ctx context.Context, ownerID string, start, end time.Time) (*UsageSummary, error) {
	// Convert times to local timezone to match how data is stored in SQLite
	// SQLite does string comparison, so timezone must match
	localStart := start.Local()
	localEnd := end.Local()

	// Query all aggregations for the owner within the time range
	aggs, err := c.client.ResourceUsageAggregation.Query().
		Where(
			resourceusageaggregation.OwnerID(ownerID),
			resourceusageaggregation.BucketStartGTE(localStart),
			resourceusageaggregation.BucketStartLT(localEnd),
		).
		All(ctx)
	if err != nil {
		return nil, err
	}

	if len(aggs) == 0 {
		return nil, nil
	}

	summary := combineAggregations(aggs, start, end)
	summary.OwnerID = ownerID
	return summary, nil
}

// GetUsageBreakdown returns usage broken down by resource.
func (c *calculator) GetUsageBreakdown(ctx context.Context, ownerID string, start, end time.Time) ([]UsageSummary, error) {
	// Convert times to local timezone to match how data is stored in SQLite
	// SQLite does string comparison, so timezone must match
	localStart := start.Local()
	localEnd := end.Local()

	// Query all aggregations for the owner within the time range
	aggs, err := c.client.ResourceUsageAggregation.Query().
		Where(
			resourceusageaggregation.OwnerID(ownerID),
			resourceusageaggregation.BucketStartGTE(localStart),
			resourceusageaggregation.BucketStartLT(localEnd),
		).
		All(ctx)
	if err != nil {
		return nil, err
	}

	if len(aggs) == 0 {
		return nil, nil
	}

	// Group by resource
	type resourceKey struct {
		ResourceType enum.ResourceType
		ResourceID   uuid.UUID
	}
	grouped := make(map[resourceKey][]*ent.ResourceUsageAggregation)
	for _, agg := range aggs {
		key := resourceKey{
			ResourceType: agg.ResourceType,
			ResourceID:   agg.ResourceID,
		}
		grouped[key] = append(grouped[key], agg)
	}

	// Combine each resource's aggregations
	result := make([]UsageSummary, 0, len(grouped))
	for _, resourceAggs := range grouped {
		summary := combineAggregations(resourceAggs, start, end)
		if summary != nil {
			result = append(result, *summary)
		}
	}

	return result, nil
}

// combineAggregations merges multiple aggregation records into a single summary.
func combineAggregations(aggs []*ent.ResourceUsageAggregation, start, end time.Time) *UsageSummary {
	if len(aggs) == 0 {
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

	// Use first aggregation for resource identification
	first := aggs[0]

	for _, agg := range aggs {
		cpuCoreSeconds += agg.CPUCoreSeconds
		memoryGBSeconds += agg.MemoryGBSeconds

		// Weight average by sample count
		cpuSum += agg.CPUAvgPercent * float64(agg.SampleCount)
		memorySum += agg.MemoryAvgBytes * int64(agg.SampleCount)

		if agg.CPUMaxPercent > cpuMax {
			cpuMax = agg.CPUMaxPercent
		}
		if agg.MemoryMaxBytes > memoryMax {
			memoryMax = agg.MemoryMaxBytes
		}

		networkRx += agg.NetworkRxBytes
		networkTx += agg.NetworkTxBytes
		blockRead += agg.BlockReadBytes
		blockWrite += agg.BlockWriteBytes
		totalSamples += agg.SampleCount
	}

	var cpuAvg float64
	var memoryAvg int64
	if totalSamples > 0 {
		cpuAvg = cpuSum / float64(totalSamples)
		memoryAvg = memorySum / int64(totalSamples)
	}

	return &UsageSummary{
		ResourceType:    first.ResourceType,
		ResourceID:      first.ResourceID,
		OwnerID:         first.OwnerID,
		RunnerID:        first.RunnerID,
		PeriodStart:     start,
		PeriodEnd:       end,
		CPUCoreSeconds:  cpuCoreSeconds,
		CPUAvgPercent:   cpuAvg,
		CPUMaxPercent:   cpuMax,
		MemoryGBSeconds: memoryGBSeconds,
		MemoryAvgBytes:  memoryAvg,
		MemoryMaxBytes:  memoryMax,
		NetworkRxBytes:  networkRx,
		NetworkTxBytes:  networkTx,
		BlockReadBytes:  blockRead,
		BlockWriteBytes: blockWrite,
		SampleCount:     totalSamples,
	}
}

// CalculateCost calculates the cost for a usage summary using runner rates.
func (c *calculator) CalculateCost(summary *UsageSummary, rates *RunnerRates) *UsageCost {
	if summary == nil || rates == nil {
		return &UsageCost{Currency: "USD"}
	}

	// Convert core-seconds to core-hours
	cpuCoreHours := summary.CPUCoreSeconds / SecondsPerHour

	// Convert GB-seconds to GB-hours
	memoryGBHours := summary.MemoryGBSeconds / SecondsPerHour

	// Convert bytes to GB for network and storage
	networkGB := float64(summary.NetworkRxBytes+summary.NetworkTxBytes) / BytesPerGB
	storageGB := float64(summary.BlockReadBytes+summary.BlockWriteBytes) / BytesPerGB

	// Calculate individual costs
	cpuCost := cpuCoreHours * rates.CPUPricePerCoreHour
	memoryCost := memoryGBHours * rates.MemoryPricePerGBHour
	networkCost := networkGB * rates.NetworkPricePerGB
	storageCost := storageGB * rates.StoragePricePerGB

	return &UsageCost{
		CPUCost:     cpuCost,
		MemoryCost:  memoryCost,
		NetworkCost: networkCost,
		StorageCost: storageCost,
		TotalCost:   cpuCost + memoryCost + networkCost + storageCost,
		Currency:    "USD",
	}
}

// GetRunnerRates retrieves pricing rates for a runner.
func (c *calculator) GetRunnerRates(ctx context.Context, runnerID uuid.UUID) (*RunnerRates, error) {
	runner, err := c.client.BotRunner.Get(ctx, runnerID)
	if err != nil {
		return nil, err
	}

	rates := &RunnerRates{}

	if runner.CPUPricePerCoreHour != nil {
		rates.CPUPricePerCoreHour = *runner.CPUPricePerCoreHour
	}
	if runner.MemoryPricePerGBHour != nil {
		rates.MemoryPricePerGBHour = *runner.MemoryPricePerGBHour
	}
	if runner.NetworkPricePerGB != nil {
		rates.NetworkPricePerGB = *runner.NetworkPricePerGB
	}
	if runner.StoragePricePerGB != nil {
		rates.StoragePricePerGB = *runner.StoragePricePerGB
	}

	return rates, nil
}

// CombineAggregationsToEntity merges multiple aggregation records into a single synthetic entity.
// This is used by GraphQL resolvers to return a combined ResourceUsageAggregation for time ranges.
func CombineAggregationsToEntity(aggs []*ent.ResourceUsageAggregation, start, end time.Time) *ent.ResourceUsageAggregation {
	if len(aggs) == 0 {
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

	first := aggs[0]

	for _, agg := range aggs {
		cpuCoreSeconds += agg.CPUCoreSeconds
		memoryGBSeconds += agg.MemoryGBSeconds
		cpuSum += agg.CPUAvgPercent * float64(agg.SampleCount)
		memorySum += agg.MemoryAvgBytes * int64(agg.SampleCount)

		if agg.CPUMaxPercent > cpuMax {
			cpuMax = agg.CPUMaxPercent
		}
		if agg.MemoryMaxBytes > memoryMax {
			memoryMax = agg.MemoryMaxBytes
		}

		networkRx += agg.NetworkRxBytes
		networkTx += agg.NetworkTxBytes
		blockRead += agg.BlockReadBytes
		blockWrite += agg.BlockWriteBytes
		totalSamples += agg.SampleCount
	}

	var cpuAvg float64
	var memoryAvg int64
	if totalSamples > 0 {
		cpuAvg = cpuSum / float64(totalSamples)
		memoryAvg = memorySum / int64(totalSamples)
	}

	return &ent.ResourceUsageAggregation{
		ResourceType:    first.ResourceType,
		ResourceID:      first.ResourceID,
		OwnerID:         first.OwnerID,
		RunnerID:        first.RunnerID,
		Granularity:     enum.AggregationGranularityDaily,
		BucketStart:     start,
		BucketEnd:       end,
		CPUCoreSeconds:  cpuCoreSeconds,
		CPUAvgPercent:   cpuAvg,
		CPUMaxPercent:   cpuMax,
		MemoryGBSeconds: memoryGBSeconds,
		MemoryAvgBytes:  memoryAvg,
		MemoryMaxBytes:  memoryMax,
		NetworkRxBytes:  networkRx,
		NetworkTxBytes:  networkTx,
		BlockReadBytes:  blockRead,
		BlockWriteBytes: blockWrite,
		SampleCount:     totalSamples,
	}
}
