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

	"volaticloud/internal/enum"
)

// AlertEvent holds the schema definition for alert event audit log.
type AlertEvent struct {
	ent.Schema
}

// Fields of the AlertEvent.
func (AlertEvent) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable(),
		field.UUID("rule_id", uuid.UUID{}).
			Comment("Foreign key to the rule that triggered this event"),
		field.Enum("status").
			GoType(enum.AlertEventStatus("")).
			Default(string(enum.AlertEventStatusPending)).
			Comment("Delivery status: pending, sent, failed, suppressed"),

		// Event details (denormalized from rule for querying and historical record)
		field.Enum("alert_type").
			GoType(enum.AlertType("")).
			Comment("Alert type (denormalized from rule)"),
		field.Enum("severity").
			GoType(enum.AlertSeverity("")).
			Comment("Severity (denormalized from rule)"),
		field.String("subject").
			Comment("Alert subject/title"),
		field.Text("body").
			Comment("Alert body content (plain text)"),
		field.JSON("context", map[string]interface{}{}).
			Optional().
			Annotations(entgql.Type("Map")).
			Comment("Event context data (bot ID, trade details, metrics, etc.)"),

		// Delivery tracking
		field.JSON("recipients", []string{}).
			Comment("Actual recipients at time of send"),
		field.String("channel_type").
			Default("email").
			Comment("Delivery channel type: email (webhook, push reserved for future)"),
		field.Time("sent_at").
			Optional().
			Nillable().
			Comment("When the alert was actually delivered"),
		field.Text("error_message").
			Optional().
			Comment("Error message if delivery failed"),

		// Resource reference (denormalized for querying)
		field.Enum("resource_type").
			GoType(enum.AlertResourceType("")).
			Comment("Type of resource that triggered alert"),
		field.UUID("resource_id", uuid.UUID{}).
			Optional().
			Nillable().
			Annotations(entgql.Type("ID")).
			Comment("ID of resource that triggered alert"),

		// Ownership (denormalized for efficient querying)
		field.String("owner_id").
			NotEmpty().
			Comment("Organization ID"),

		// Read tracking
		field.Time("read_at").
			Optional().
			Nillable().
			Comment("When the alert was read by the user"),

		// Timestamp
		field.Time("created_at").
			Default(time.Now).
			Immutable().
			Annotations(entgql.OrderField("CREATED_AT")),
	}
}

// Edges of the AlertEvent.
func (AlertEvent) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("rule", AlertRule.Type).
			Ref("events").
			Field("rule_id").
			Required().
			Unique(),
	}
}

// Indexes of the AlertEvent.
func (AlertEvent) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("owner_id", "created_at"),
		index.Fields("owner_id", "read_at"), // For efficient unread count queries
		index.Fields("rule_id"),
		index.Fields("status"),
		index.Fields("resource_type", "resource_id"),
	}
}

// Annotations of the AlertEvent.
func (AlertEvent) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.RelayConnection(),
		entgql.QueryField(),
		// No mutations - events are created by system only
	}
}

// Note: AlertEvent does NOT use SoftDeleteMixin - we want to keep audit trail
