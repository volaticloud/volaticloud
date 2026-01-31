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

// StripeSubscription links an organization to its Stripe subscription.
type StripeSubscription struct {
	ent.Schema
}

// Fields of the StripeSubscription.
func (StripeSubscription) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable(),
		field.String("owner_id").
			NotEmpty().
			Unique().
			Comment("Organization alias"),
		field.String("stripe_customer_id").
			NotEmpty().
			Comment("Stripe customer ID"),
		field.String("stripe_subscription_id").
			NotEmpty().
			Unique().
			Comment("Stripe subscription ID"),
		field.String("stripe_price_id").
			NotEmpty().
			Comment("Stripe price ID for the plan"),
		field.String("plan_name").
			NotEmpty().
			Comment("Plan name: starter, pro, enterprise, or custom"),
		field.Float("monthly_deposit").
			Comment("Credit amount deposited on each renewal"),
		field.Enum("status").
			GoType(enum.StripeSubStatus("")).
			Default(string(enum.StripeSubActive)).
			Comment("Subscription status"),
		field.JSON("features", []string{}).
			Optional().
			Comment("Feature flags parsed from Stripe product metadata"),
		field.Time("current_period_start").
			Comment("Start of the current billing period"),
		field.Time("current_period_end").
			Comment("End of the current billing period"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

// Edges of the StripeSubscription.
func (StripeSubscription) Edges() []ent.Edge {
	return nil
}

// Indexes of the StripeSubscription.
func (StripeSubscription) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("owner_id").Unique(),
		index.Fields("stripe_subscription_id").Unique(),
	}
}

// Annotations of the StripeSubscription.
func (StripeSubscription) Annotations() []schema.Annotation {
	return []schema.Annotation{
		// No GraphQL auto-generation - exposed via custom resolvers
		entgql.Skip(entgql.SkipAll),
	}
}
