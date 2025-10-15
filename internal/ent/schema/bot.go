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
			Comment("Runtime-specific identifier (container ID, pod name, etc.)"),
		field.JSON("runtime_metadata", map[string]string{}).
			Optional().
			Annotations(entgql.Skip(entgql.SkipAll)).
			Comment("Runtime-specific metadata"),
		field.String("api_url").
			Optional().
			Comment("Freqtrade API endpoint"),
		field.String("api_username").
			Optional().
			Comment("Freqtrade API username"),
		field.String("api_password").
			Sensitive().
			Optional().
			Comment("Freqtrade API password (encrypted)"),
		field.JSON("config", map[string]interface{}{}).
			Optional().
			Annotations(entgql.Skip(entgql.SkipAll)).
			Comment("Bot-specific freqtrade config overrides"),
		field.String("freqtrade_version").
			Default("2024.1").
			Comment("Freqtrade version"),
		field.Time("last_seen_at").
			Optional().
			Comment("Last successful health check"),
		field.Text("error_message").
			Optional().
			Comment("Last error message if status is error"),
		field.UUID("exchange_id", uuid.UUID{}).
			Comment("Foreign key to exchange"),
		field.UUID("strategy_id", uuid.UUID{}).
			Comment("Foreign key to strategy"),
		field.UUID("runtime_id", uuid.UUID{}).
			Comment("Foreign key to runtime"),
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
		edge.From("runtime", BotRuntime.Type).
			Ref("bots").
			Field("runtime_id").
			Required().
			Unique(),
		edge.To("trades", Trade.Type).
			Annotations(entgql.RelayConnection()),
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