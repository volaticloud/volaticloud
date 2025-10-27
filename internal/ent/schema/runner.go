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
			Annotations(
				entgql.Type("RunnerConfigInput"),
				entgql.Skip(entgql.SkipType), // Skip in type output, but allow in mutations
			).
			Comment("Runner connection configuration (host, port, credentials, etc.)"),
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
	}
}