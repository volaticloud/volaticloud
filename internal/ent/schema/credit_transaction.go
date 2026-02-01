package schema

import (
	"context"
	"fmt"
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

// Hooks of the CreditTransaction.
func (CreditTransaction) Hooks() []ent.Hook {
	return []ent.Hook{
		rejectCreditTransactionDelete,
	}
}

// rejectCreditTransactionDelete prevents deletion of credit transactions (append-only ledger).
func rejectCreditTransactionDelete(next ent.Mutator) ent.Mutator {
	return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
		if m.Op().Is(ent.OpDelete | ent.OpDeleteOne) {
			return nil, fmt.Errorf("credit transactions are append-only and cannot be deleted")
		}
		return next.Mutate(ctx, m)
	})
}

// Annotations of the CreditTransaction.
func (CreditTransaction) Annotations() []schema.Annotation {
	return []schema.Annotation{
		// No GraphQL auto-generation - exposed via custom resolvers
		entgql.Skip(entgql.SkipAll),
	}
}
