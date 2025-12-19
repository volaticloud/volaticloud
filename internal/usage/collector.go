package usage

import (
	"context"

	"volaticloud/internal/ent"
)

// collector implements the Collector interface.
type collector struct {
	client *ent.Client
}

// NewCollector creates a new usage collector.
func NewCollector(client *ent.Client) Collector {
	return &collector{client: client}
}

// RecordSample records a single usage sample to the database.
func (c *collector) RecordSample(ctx context.Context, sample UsageSample) error {
	_, err := c.client.ResourceUsageSample.Create().
		SetResourceType(sample.ResourceType).
		SetResourceID(sample.ResourceID).
		SetOwnerID(sample.OwnerID).
		SetRunnerID(sample.RunnerID).
		SetCPUPercent(sample.CPUPercent).
		SetMemoryBytes(sample.MemoryBytes).
		SetNetworkRxBytes(sample.NetworkRxBytes).
		SetNetworkTxBytes(sample.NetworkTxBytes).
		SetBlockReadBytes(sample.BlockReadBytes).
		SetBlockWriteBytes(sample.BlockWriteBytes).
		SetSampledAt(sample.SampledAt).
		Save(ctx)

	return err
}
