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

// Bot holds the schema definition for the Bot entity.
type Bot struct {
	ent.Schema
}

// Fields of the Bot.
func (Bot) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable(),
		field.String("name").
			NotEmpty().
			Comment("Bot display name"),
		field.Enum("status").
			GoType(enum.BotStatus("")).
			Default(string(enum.BotStatusCreating)).
			Comment("Bot lifecycle status"),
		field.Enum("mode").
			GoType(enum.BotMode("")).
			Default(string(enum.BotModeDryRun)).
			Comment("Trading mode (dry-run or live)"),
		field.String("container_id").
			Optional().
			Comment("Runner-specific identifier (container ID, pod name, etc.)"),
		field.JSON("config", map[string]interface{}{}).
			Optional().
			Annotations(entgql.Type("Map")).
			Comment("Complete freqtrade bot configuration (stake, pairlists, pricing, api_server, etc.)"),
		field.JSON("secure_config", map[string]interface{}{}).
			Optional().
			Annotations(entgql.Skip()).
			Comment("System-forced configuration (api_server, initial_state) - NEVER exposed via GraphQL"),
		field.String("freqtrade_version").
			Default("2025.10").
			Comment("Freqtrade Docker image version tag"),
		field.Time("last_seen_at").
			Optional().
			Comment("Last successful health check"),
		field.Text("error_message").
			Optional().
			Comment("Last error message if status is error"),
		field.UUID("exchange_id", uuid.UUID{}).
			Comment("Foreign key to exchange (provides credentials)"),
		field.UUID("strategy_id", uuid.UUID{}).
			Comment("Foreign key to strategy (provides code)"),
		field.UUID("runner_id", uuid.UUID{}).
			Comment("Foreign key to runner (provides execution environment)"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

// Edges of the Bot.
func (Bot) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("exchange", Exchange.Type).
			Ref("bots").
			Field("exchange_id").
			Required().
			Unique(),
		edge.From("strategy", Strategy.Type).
			Ref("bots").
			Field("strategy_id").
			Required().
			Unique(),
		edge.From("runner", BotRunner.Type).
			Ref("bots").
			Field("runner_id").
			Required().
			Unique(),
		edge.To("trades", Trade.Type).
			Annotations(entgql.RelayConnection()),
		edge.To("metrics", BotMetrics.Type).
			Unique(),
	}
}

// Annotations of the Bot.
func (Bot) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.RelayConnection(),
		entgql.QueryField(),
		entgql.Mutations(entgql.MutationCreate(), entgql.MutationUpdate()),
	}
}
