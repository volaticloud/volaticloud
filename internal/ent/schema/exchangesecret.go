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
)

// ExchangeSecret holds the schema definition for the ExchangeSecret entity.
type ExchangeSecret struct {
	ent.Schema
}

// Fields of the ExchangeSecret.
func (ExchangeSecret) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable(),
		field.UUID("exchange_id", uuid.UUID{}).
			Comment("Foreign key to exchange"),
		field.String("name").
			NotEmpty().
			Comment("Secret name (api_key, api_secret, password, passphrase, etc.)"),
		field.String("value").
			Sensitive().
			Comment("Secret value (encrypted at rest)"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

// Edges of the ExchangeSecret.
func (ExchangeSecret) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("exchange", Exchange.Type).
			Ref("secrets").
			Field("exchange_id").
			Required().
			Unique(),
	}
}

// Indexes of the ExchangeSecret.
func (ExchangeSecret) Indexes() []ent.Index {
	return []ent.Index{
		// One secret name per exchange
		index.Fields("exchange_id", "name").
			Unique(),
	}
}

// Annotations of the ExchangeSecret.
func (ExchangeSecret) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.RelayConnection(),
		entgql.QueryField(),
		entgql.Mutations(entgql.MutationCreate(), entgql.MutationUpdate()),
	}
}