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

// Exchange holds the schema definition for the Exchange entity.
type Exchange struct {
	ent.Schema
}

// Fields of the Exchange.
func (Exchange) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable(),
		field.Enum("name").
			GoType(enum.ExchangeType("")).
			Comment("Exchange name from ExchangeType enum"),
		field.Bool("test_mode").
			Default(false).
			Comment("Use testnet/sandbox"),
		field.JSON("config", map[string]interface{}{}).
			Optional().
			Annotations(entgql.Skip(entgql.SkipAll)).
			Comment("Exchange-specific settings (non-sensitive)"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

// Edges of the Exchange.
func (Exchange) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("bots", Bot.Type).
			Annotations(entgql.RelayConnection()),
		edge.To("secrets", ExchangeSecret.Type).
			Annotations(entgql.RelayConnection()),
	}
}

// Annotations of the Exchange.
func (Exchange) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.QueryField(),
		entgql.Mutations(entgql.MutationCreate(), entgql.MutationUpdate()),
	}
}