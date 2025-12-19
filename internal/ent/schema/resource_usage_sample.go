package schema

import (
	"time"

	"entgo.io/contrib/entgql"
	"entgo.io/ent"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"

	"volaticloud/internal/enum"
)

// ResourceUsageSample holds per-minute resource usage measurements for billing.
// Samples are collected when billing_enabled=true on the runner.
// Raw samples are retained for 7 days, then cleaned up by the aggregation worker.
type ResourceUsageSample struct {
	ent.Schema
}

// Fields of the ResourceUsageSample.
func (ResourceUsageSample) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable(),

		// Resource identification
		field.Enum("resource_type").
			GoType(enum.ResourceType("")).
			Comment("Type of resource: bot or backtest"),
		field.UUID("resource_id", uuid.UUID{}).
			Annotations(entgql.Type("ID")).
			Comment("ID of the bot or backtest"),
		field.String("owner_id").
			NotEmpty().
			Comment("Organization ID for billing"),
		field.UUID("runner_id", uuid.UUID{}).
			Comment("Runner ID for rate lookup"),

		// CPU metrics
		field.Float("cpu_percent").
			Comment("CPU usage as percentage (0-100 per core)"),

		// Memory metrics
		field.Int64("memory_bytes").
			Comment("Memory usage in bytes"),

		// Network I/O metrics
		field.Int64("network_rx_bytes").
			Default(0).
			Comment("Network bytes received"),
		field.Int64("network_tx_bytes").
			Default(0).
			Comment("Network bytes transmitted"),

		// Disk I/O metrics
		field.Int64("block_read_bytes").
			Default(0).
			Comment("Disk bytes read"),
		field.Int64("block_write_bytes").
			Default(0).
			Comment("Disk bytes written"),

		// Timestamps
		field.Time("sampled_at").
			Comment("When this sample was collected"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
	}
}

// Edges of the ResourceUsageSample.
func (ResourceUsageSample) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("runner", BotRunner.Type).
			Ref("usage_samples").
			Field("runner_id").
			Required().
			Unique(),
	}
}

// Indexes of the ResourceUsageSample.
func (ResourceUsageSample) Indexes() []ent.Index {
	return []ent.Index{
		// Primary query: samples for a resource in time range
		index.Fields("resource_type", "resource_id", "sampled_at"),
		// Billing query: samples for owner in time range
		index.Fields("owner_id", "sampled_at"),
		// Runner query: samples for a runner in time range
		index.Fields("runner_id", "sampled_at"),
		// Cleanup: samples older than retention period
		index.Fields("sampled_at"),
	}
}

// Annotations of the ResourceUsageSample.
func (ResourceUsageSample) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.QueryField(),
		// No mutations - samples are created programmatically by the collector
	}
}
