package schema

import (
	"time"

	"entgo.io/contrib/entgql"
	"entgo.io/ent"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"

	"volaticloud/internal/enum"
)

// CreditTransaction is an append-only ledger of all credit changes.
type CreditTransaction struct {
	ent.Schema
}

// Fields of the CreditTransaction.
func (CreditTransaction) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable(),
		field.String("owner_id").
			NotEmpty().
			Comment("Organization alias"),
		field.Float("amount").
			Comment("Positive for credits, negative for debits"),
		field.Float("balance_after").
			Comment("Balance snapshot after this transaction"),
		field.Enum("type").
			GoType(enum.CreditTransactionType("")).
			Comment("Transaction type"),
		field.String("description").
			Optional().
			Comment("Human-readable description"),
		field.String("reference_id").
			Optional().
			Comment("For idempotency (e.g. Stripe invoice ID, aggregation bucket key)"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
	}
}

// Edges of the CreditTransaction.
func (CreditTransaction) Edges() []ent.Edge {
	return nil
}

// Indexes of the CreditTransaction.
func (CreditTransaction) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("owner_id", "created_at"),
		index.Fields("reference_id").Unique(),
	}
}

// Annotations of the CreditTransaction.
func (CreditTransaction) Annotations() []schema.Annotation {
	return []schema.Annotation{
		// No GraphQL auto-generation - exposed via custom resolvers
		entgql.Skip(entgql.SkipAll),
	}
}
