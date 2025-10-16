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

// BotRuntime holds the schema definition for the BotRuntime entity.
type BotRuntime struct {
	ent.Schema
}

// Fields of the BotRuntime.
func (BotRuntime) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable(),
		field.String("name").
			NotEmpty().
			Comment("Runtime display name"),
		field.Enum("type").
			GoType(enum.RuntimeType("")).
			Default(string(enum.RuntimeDocker)).
			Comment("Runtime environment type (docker, kubernetes, local)"),
		field.JSON("config", map[string]interface{}{}).
			Optional().
			Annotations(entgql.Skip(entgql.SkipAll)).
			Comment("Runtime connection configuration (host, port, credentials, etc.)"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

// Edges of the BotRuntime.
func (BotRuntime) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("bots", Bot.Type).
			Annotations(entgql.RelayConnection()),
	}
}

// Annotations of the BotRuntime.
func (BotRuntime) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.RelayConnection(),
		entgql.QueryField(),
		entgql.Mutations(entgql.MutationCreate(), entgql.MutationUpdate()),
	}
}

// Hooks of the BotRuntime.
func (BotRuntime) Hooks() []ent.Hook {
	return []ent.Hook{
		validateRuntimeConfig,
	}
}