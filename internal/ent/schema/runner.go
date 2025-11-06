package schema

import (
	"time"

	"entgo.io/contrib/entgql"
	"entgo.io/ent"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"

	"anytrade/internal/enum"
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
		field.JSON("data_download_progress", map[string]interface{}{}).
			Optional().
			Comment("Progress details: {pairs_completed, pairs_total, current_pair, percent_complete}"),
		field.String("data_error_message").
			Optional().
			Comment("Error message if data download failed"),
		field.JSON("data_download_config", map[string]interface{}{}).
			Optional().
			Comment("Data download configuration: {exchanges: [{name, enabled, timeframes, pairs_pattern, days, trading_mode}]}"),
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
