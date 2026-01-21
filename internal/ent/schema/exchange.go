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
			Annotations(
				entgql.Type("Map"),
				HasScope("view-secrets", "EXCHANGE"),
			).
			Comment("Complete freqtrade exchange configuration (name, key, secret, pair_whitelist, etc.)"),
		field.String("owner_id").
			NotEmpty().
			Comment("Group ID (organization) that owns this exchange"),
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

// Indexes of the Exchange.
func (Exchange) Indexes() []ent.Index {
	return []ent.Index{
		// Index on owner_id for efficient ownership queries
		index.Fields("owner_id"),
	}
}

// Annotations of the Exchange.
func (Exchange) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.RelayConnection(),
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

// Mixin of the Exchange.
func (Exchange) Mixin() []ent.Mixin {
	return []ent.Mixin{
		entmixin.SoftDeleteMixin{},
	}
}
