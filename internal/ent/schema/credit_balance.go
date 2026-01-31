package schema

import (
	"time"

	"entgo.io/contrib/entgql"
	"entgo.io/ent"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

// CreditBalance holds the credit balance for an organization.
// One row per organization, tracking current balance and suspension state.
type CreditBalance struct {
	ent.Schema
}

// Fields of the CreditBalance.
func (CreditBalance) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable(),
		field.String("owner_id").
			NotEmpty().
			Unique().
			Comment("Organization alias (unique identifier)"),
		field.Float("balance").
			Default(0).
			Comment("Current credit balance in dollars"),
		field.Bool("suspended").
			Default(false).
			Comment("Whether the organization is suspended due to insufficient credits"),
		field.Time("suspended_at").
			Optional().
			Nillable().
			Comment("When the organization was suspended"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

// Edges of the CreditBalance.
func (CreditBalance) Edges() []ent.Edge {
	return nil
}

// Indexes of the CreditBalance.
func (CreditBalance) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("owner_id").Unique(),
	}
}

// Annotations of the CreditBalance.
func (CreditBalance) Annotations() []schema.Annotation {
	return []schema.Annotation{
		// No GraphQL queries/mutations - managed programmatically via billing domain package
		entgql.Skip(entgql.SkipAll),
	}
}
