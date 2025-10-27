package schema

import (
	"time"

	"entgo.io/contrib/entgql"
	"entgo.io/ent"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
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
		field.String("name").
			NotEmpty().
			Comment("Exchange display name (e.g., 'Binance Production', 'Coinbase Testnet')"),
		field.JSON("config", map[string]interface{}{}).
			Optional().
			Annotations(entgql.Type("Map")).
			Comment("Complete freqtrade exchange configuration (name, key, secret, pair_whitelist, etc.)"),
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
	}
}

// Annotations of the Exchange.
func (Exchange) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.QueryField(),
		entgql.Mutations(entgql.MutationCreate(), entgql.MutationUpdate()),
	}
}

// Hooks of the Exchange.
func (Exchange) Hooks() []ent.Hook {
	return []ent.Hook{
		validateExchangeConfig,
	}
}
