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
	"volaticloud/internal/runner"
	"volaticloud/internal/secrets"
)

// BotRunner holds the schema definition for the BotRunner entity.
type BotRunner struct {
	ent.Schema
}

// Fields of the BotRunner.
func (BotRunner) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable(),
		field.String("name").
			NotEmpty().
			Comment("Runner display name"),
		field.Enum("type").
			GoType(enum.RunnerType("")).
			Default(string(enum.RunnerDocker)).
			Comment("Runner environment type (docker, kubernetes, local)"),
		field.JSON("config", map[string]interface{}{}).
			Optional().
			Annotations(
				entgql.Type("Map"),
				HasScope("view-secrets", "BOT_RUNNER"),
			).
			Comment("Runner connection configuration (host, port, credentials, etc.)"),
		field.Bool("data_is_ready").
			Default(false).
			Comment("Whether runner has downloaded historical data for backtesting"),
		field.Time("data_last_updated").
			Optional().
			Comment("When data was last refreshed"),
		field.Enum("data_download_status").
			GoType(enum.DataDownloadStatus("")).
			Default(string(enum.DataDownloadStatusIdle)).
			Comment("Current data download status (idle, downloading, completed, failed)"),
		field.Time("data_download_started_at").
			Optional().
			Nillable().
			Comment("When the current data download started (for stuck detection)"),
		field.JSON("data_download_progress", map[string]interface{}{}).
			Optional().
			Comment("Progress details: {pairs_completed, pairs_total, current_pair, percent_complete}"),
		field.String("data_error_message").
			Optional().
			Comment("Error message if data download failed"),
		field.JSON("data_download_config", map[string]interface{}{}).
			Optional().
			Annotations(
				entgql.Type("Map"),
				HasScope("view", "BOT_RUNNER"),
			).
			Comment("Data download configuration: {exchanges: [{name, enabled, timeframes, pairs_pattern, days, trading_mode}]}"),

		// S3 storage fields for data distribution
		field.JSON("s3_config", map[string]interface{}{}).
			Optional().
			Annotations(
				entgql.Type("Map"),
				HasScope("view-secrets", "BOT_RUNNER"),
			).
			Comment("S3 config: {endpoint, bucket, accessKeyId, secretAccessKey, region, forcePathStyle, useSSL}"),
		field.String("s3_data_key").
			Optional().
			Comment("S3 object key: runners/data/{runnerId}.zip"),
		field.Time("s3_data_uploaded_at").
			Optional().
			Nillable().
			Comment("When data was last uploaded to S3"),

		// Available data metadata (populated after data download completes)
		field.JSON("data_available", map[string]interface{}{}).
			Optional().
			Annotations(entgql.Type("Map")).
			Comment("Available data metadata: {exchanges: [{name, pairs: [{pair, timeframes: [{timeframe, from, to}]}]}]}"),

		field.String("owner_id").
			NotEmpty().
			Comment("Group ID (organization) that owns this bot runner"),

		// Billing fields
		field.Bool("billing_enabled").
			Default(false).
			Comment("Whether usage tracking and billing is enabled for this runner"),
		field.Float("cpu_price_per_core_hour").
			Optional().
			Nillable().
			Comment("Price per core-hour in USD (only used if billing_enabled)"),
		field.Float("memory_price_per_gb_hour").
			Optional().
			Nillable().
			Comment("Price per GB-hour in USD (only used if billing_enabled)"),
		field.Float("network_price_per_gb").
			Optional().
			Nillable().
			Comment("Price per GB of network transfer in USD (only used if billing_enabled)"),
		field.Float("storage_price_per_gb").
			Optional().
			Nillable().
			Comment("Price per GB of disk I/O in USD (only used if billing_enabled)"),

		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

// Edges of the BotRunner.
func (BotRunner) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("bots", Bot.Type).
			Annotations(entgql.RelayConnection()),
		edge.To("backtests", Backtest.Type).
			Annotations(entgql.RelayConnection()),
		edge.To("usage_samples", ResourceUsageSample.Type).
			Annotations(entgql.Skip()),
		edge.To("usage_aggregations", ResourceUsageAggregation.Type).
			Annotations(entgql.Skip()),
	}
}

// Indexes of the BotRunner.
func (BotRunner) Indexes() []ent.Index {
	return []ent.Index{
		// Index on owner_id for efficient ownership queries
		index.Fields("owner_id"),
	}
}

// Annotations of the BotRunner.
func (BotRunner) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.RelayConnection(),
		entgql.QueryField(),
		entgql.Mutations(entgql.MutationCreate(), entgql.MutationUpdate()),
	}
}

// Hooks of the BotRunner.
func (BotRunner) Hooks() []ent.Hook {
	return []ent.Hook{
		validateRunnerConfig,
		validateDataDownloadConfig,
		secrets.EncryptHook("config", runner.SecretConfigPaths),
		secrets.EncryptHook("s3_config", runner.SecretS3ConfigPaths),
	}
}

// Mixin of the BotRunner.
func (BotRunner) Mixin() []ent.Mixin {
	return []ent.Mixin{
		entmixin.PublicMixin{},
		entmixin.SoftDeleteMixin{},
	}
}
