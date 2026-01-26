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
	"volaticloud/internal/enum"
)

// AlertRule holds the schema definition for alert rule configuration.
type AlertRule struct {
	ent.Schema
}

// Fields of the AlertRule.
func (AlertRule) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable(),
		field.String("name").
			NotEmpty().
			Comment("Human-readable rule name (e.g., 'Bot Error Alert')"),
		field.Enum("alert_type").
			GoType(enum.AlertType("")).
			Comment("Type of alert: status_change, trade_opened, trade_closed, etc."),
		field.Enum("severity").
			GoType(enum.AlertSeverity("")).
			Default(string(enum.AlertSeverityInfo)).
			Comment("Alert severity: critical, warning, info"),
		field.Bool("enabled").
			Default(true).
			Comment("Whether this rule is active"),

		// Resource binding - polymorphic reference
		field.Enum("resource_type").
			GoType(enum.AlertResourceType("")).
			Comment("Type of resource: organization, bot, strategy, runner"),
		// ResourceID is stored as string to support both UUIDs and organization aliases.
		// Changed from UUID to string to support organization alias system (ADR-0012).
		// Existing UUID values remain compatible as strings.
		field.String("resource_id").
			Optional().
			Nillable().
			Comment("Resource ID - UUID for bot/strategy/runner, or organization alias for org-level rules"),

		// Alert condition configuration
		field.JSON("conditions", map[string]interface{}{}).
			Optional().
			Annotations(entgql.Type("Map")).
			Comment("Condition parameters: thresholds, status values, etc."),

		// Delivery configuration
		field.Enum("delivery_mode").
			GoType(enum.AlertDeliveryMode("")).
			Default(string(enum.AlertDeliveryModeImmediate)).
			Comment("Delivery mode: immediate or batched"),
		field.Int("batch_interval_minutes").
			Default(60).
			Comment("Batch window in minutes (only used if delivery_mode=batched)"),

		// Recipients (JSON array of emails for email channel)
		field.JSON("recipients", []string{}).
			Default([]string{}).
			Comment("List of recipient email addresses"),

		// Bot mode filter (for bot-related alerts)
		field.Enum("bot_mode_filter").
			GoType(enum.AlertBotModeFilter("")).
			Default(string(enum.AlertBotModeFilterAll)).
			Comment("Filter by bot trading mode: all, live, dry_run"),

		// Rate limiting
		field.Int("cooldown_minutes").
			Default(5).
			Comment("Minimum minutes between alerts of same type for same resource"),
		field.Time("last_triggered_at").
			Optional().
			Nillable().
			Comment("When this rule last triggered (for cooldown calculation)"),

		// Ownership
		field.String("owner_id").
			NotEmpty().
			Comment("Organization ID that owns this rule"),

		// Timestamps
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

// Edges of the AlertRule.
func (AlertRule) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("events", AlertEvent.Type).
			Annotations(entgql.RelayConnection()),
	}
}

// Indexes of the AlertRule.
func (AlertRule) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("owner_id"),
		index.Fields("resource_type", "resource_id"),
		index.Fields("alert_type", "enabled"),
	}
}

// Annotations of the AlertRule.
func (AlertRule) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.RelayConnection(),
		entgql.QueryField(),
		entgql.Mutations(entgql.MutationCreate(), entgql.MutationUpdate()),
	}
}

// Mixin of the AlertRule.
func (AlertRule) Mixin() []ent.Mixin {
	return []ent.Mixin{
		entmixin.SoftDeleteMixin{},
	}
}
