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
			Comment("Data download configuration: {exchanges: [{name, enabled, timeframes, pairs_pattern, days, trading_mode}]}"),
		field.String("owner_id").
			NotEmpty().
			Comment("Group ID (organization) that owns this bot runner"),
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
	}
}

// Mixin of the BotRunner.
func (BotRunner) Mixin() []ent.Mixin {
	return []ent.Mixin{
		entmixin.PublicMixin{},
	}
}
