package usage

import (
	"context"
	"time"

	"github.com/google/uuid"

	"volaticloud/internal/enum"
)

// UsageSample represents a point-in-time resource usage measurement.
// Samples are collected per-minute when billing is enabled for the runner.
type UsageSample struct {
	ResourceType    enum.ResourceType
	ResourceID      uuid.UUID
	OwnerID         string
	RunnerID        uuid.UUID
	CPUPercent      float64 // CPU usage as percentage (0-100 per core)
	MemoryBytes     int64   // Memory usage in bytes
	NetworkRxBytes  int64   // Network bytes received
	NetworkTxBytes  int64   // Network bytes transmitted
	BlockReadBytes  int64   // Disk bytes read
	BlockWriteBytes int64   // Disk bytes written
	SampledAt       time.Time
}

// UsageSummary represents aggregated usage metrics for a time period.
type UsageSummary struct {
	ResourceType    enum.ResourceType
	ResourceID      uuid.UUID
	OwnerID         string
	RunnerID        uuid.UUID
	PeriodStart     time.Time
	PeriodEnd       time.Time
	CPUCoreSeconds  float64 // Total CPU consumption in core-seconds
	CPUAvgPercent   float64 // Average CPU percentage
	CPUMaxPercent   float64 // Maximum CPU percentage
	MemoryGBSeconds float64 // Total memory consumption in GB-seconds
	MemoryAvgBytes  int64   // Average memory usage
	MemoryMaxBytes  int64   // Maximum memory usage
	NetworkRxBytes  int64   // Total network bytes received
	NetworkTxBytes  int64   // Total network bytes transmitted
	BlockReadBytes  int64   // Total disk bytes read
	BlockWriteBytes int64   // Total disk bytes written
	SampleCount     int     // Number of samples in this aggregation
}

// UsageCost represents the calculated cost for resource usage.
type UsageCost struct {
	CPUCost     float64 // Cost for CPU usage
	MemoryCost  float64 // Cost for memory usage
	NetworkCost float64 // Cost for network transfer
	StorageCost float64 // Cost for disk I/O
	TotalCost   float64 // Total cost
	Currency    string  // Currency code (e.g., "USD")
}

// RunnerRates holds the pricing rates for a runner.
type RunnerRates struct {
	CPUPricePerCoreHour  float64 // Price per core-hour in USD
	MemoryPricePerGBHour float64 // Price per GB-hour in USD
	NetworkPricePerGB    float64 // Price per GB of network transfer
	StoragePricePerGB    float64 // Price per GB of disk I/O
}

// Collector defines the interface for recording usage samples.
type Collector interface {
	// RecordSample records a single usage sample to the database.
	// This should be called per-minute for resources on billing-enabled runners.
	RecordSample(ctx context.Context, sample UsageSample) error
}

// Aggregator defines the interface for aggregating usage data.
type Aggregator interface {
	// AggregateHourly computes hourly aggregations for the specified hour.
	// It processes all samples within the hour and creates/updates aggregation records.
	AggregateHourly(ctx context.Context, hour time.Time) error

	// AggregateDaily computes daily aggregations from hourly data.
	// Should be called once per day after all hourly aggregations are complete.
	AggregateDaily(ctx context.Context, day time.Time) error

	// CleanupOldSamples removes raw samples older than the retention period.
	// Default retention is 7 days.
	CleanupOldSamples(ctx context.Context, olderThan time.Duration) (int, error)
}

// Calculator defines the interface for usage queries and cost calculation.
type Calculator interface {
	// GetResourceUsage returns aggregated usage for a specific resource.
	GetResourceUsage(ctx context.Context, resourceType enum.ResourceType, resourceID uuid.UUID, start, end time.Time) (*UsageSummary, error)

	// GetOrganizationUsage returns total usage for an organization.
	GetOrganizationUsage(ctx context.Context, ownerID string, start, end time.Time) (*UsageSummary, error)

	// GetUsageBreakdown returns usage broken down by resource.
	GetUsageBreakdown(ctx context.Context, ownerID string, start, end time.Time) ([]UsageSummary, error)

	// CalculateCost calculates the cost for a usage summary using runner rates.
	CalculateCost(summary *UsageSummary, rates *RunnerRates) *UsageCost

	// GetRunnerRates retrieves pricing rates for a runner.
	GetRunnerRates(ctx context.Context, runnerID uuid.UUID) (*RunnerRates, error)
}

// Constants for billing calculations.
const (
	// BytesPerGB is the number of bytes in a gigabyte.
	BytesPerGB = 1024 * 1024 * 1024

	// SecondsPerHour is the number of seconds in an hour.
	SecondsPerHour = 3600

	// SampleIntervalSeconds is the default sample interval (1 minute).
	SampleIntervalSeconds = 60

	// DefaultRetentionDays is the default raw sample retention period.
	DefaultRetentionDays = 7
)
