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

	entmixin "volaticloud/internal/ent/mixin"
	"volaticloud/internal/enum"
)

// ResourceUsageAggregation holds hourly/daily aggregated usage data for billing.
// Aggregations are computed from raw samples and retained indefinitely.
type ResourceUsageAggregation struct {
	ent.Schema
}

// Fields of the ResourceUsageAggregation.
func (ResourceUsageAggregation) Fields() []ent.Field {
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

		// Time bucket
		field.Enum("granularity").
			GoType(enum.AggregationGranularity("")).
			Comment("Aggregation level: hourly or daily"),
		field.Time("bucket_start").
			Comment("Start of the time bucket"),
		field.Time("bucket_end").
			Comment("End of the time bucket"),

		// Aggregated CPU metrics
		field.Float("cpu_core_seconds").
			Default(0).
			Comment("Total CPU consumption in core-seconds"),
		field.Float("cpu_avg_percent").
			Default(0).
			Comment("Average CPU percentage during bucket"),
		field.Float("cpu_max_percent").
			Default(0).
			Comment("Maximum CPU percentage during bucket"),

		// Aggregated memory metrics
		field.Float("memory_gb_seconds").
			Default(0).
			Comment("Total memory consumption in GB-seconds"),
		field.Int64("memory_avg_bytes").
			Default(0).
			Comment("Average memory usage in bytes"),
		field.Int64("memory_max_bytes").
			Default(0).
			Comment("Maximum memory usage in bytes"),

		// Aggregated network metrics
		field.Int64("network_rx_bytes").
			Default(0).
			Comment("Total network bytes received"),
		field.Int64("network_tx_bytes").
			Default(0).
			Comment("Total network bytes transmitted"),

		// Aggregated disk I/O metrics
		field.Int64("block_read_bytes").
			Default(0).
			Comment("Total disk bytes read"),
		field.Int64("block_write_bytes").
			Default(0).
			Comment("Total disk bytes written"),

		// Sample metadata
		field.Int("sample_count").
			Default(0).
			Comment("Number of samples in this aggregation"),

		// Timestamps
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
	}
}

// Edges of the ResourceUsageAggregation.
func (ResourceUsageAggregation) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("runner", BotRunner.Type).
			Ref("usage_aggregations").
			Field("runner_id").
			Required().
			Unique(),
	}
}

// Indexes of the ResourceUsageAggregation.
func (ResourceUsageAggregation) Indexes() []ent.Index {
	return []ent.Index{
		// Unique constraint per resource per bucket
		index.Fields("resource_type", "resource_id", "granularity", "bucket_start").
			Unique(),
		// Billing query: aggregations for owner in time range
		index.Fields("owner_id", "granularity", "bucket_start"),
		// Runner query: aggregations for a runner
		index.Fields("runner_id", "granularity", "bucket_start"),
		// Dashboard: recent aggregations by resource
		index.Fields("resource_id", "bucket_start"),
	}
}

// Annotations of the ResourceUsageAggregation.
func (ResourceUsageAggregation) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.QueryField(),
		// No mutations - aggregations are created programmatically by the aggregator
	}
}

// Mixin of the ResourceUsageAggregation.
func (ResourceUsageAggregation) Mixin() []ent.Mixin {
	return []ent.Mixin{
		entmixin.SoftDeleteMixin{},
	}
}
