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

// Strategy holds the schema definition for the Strategy entity.
type Strategy struct {
	ent.Schema
}

// Fields of the Strategy.
func (Strategy) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable(),
		field.String("name").
			NotEmpty().
			Comment("Strategy name (not unique, allows versions)"),
		field.Text("description").
			Optional().
			Comment("Strategy description"),
		field.Text("code").
			Comment("Python strategy code"),
		field.JSON("config", map[string]interface{}{}).
			Comment("Strategy-specific configuration (config.json) - REQUIRED").
			Annotations(entgql.Type("Map")),
		// Versioning fields
		field.UUID("parent_id", uuid.UUID{}).
			Optional().
			Nillable().
			Comment("Parent strategy ID for versioning (null for root v1)"),
		field.Bool("is_latest").
			Default(true).
			Comment("Indicates if this is the latest version of the strategy"),
		field.Int("version_number").
			Default(1).
			Comment("Auto-incremented version number"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

// Edges of the Strategy.
func (Strategy) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("bots", Bot.Type).
			Annotations(entgql.RelayConnection()),
		// One-to-one relationship with single backtest
		edge.To("backtest", Backtest.Type).
			Unique().
			Comment("Strategy can have at most one backtest (one-to-one)"),
		// Parent-child relationship for versioning
		edge.To("parent", Strategy.Type).
			Unique().
			Field("parent_id").
			From("children").
			Comment("Parent strategy for versioning (self-referential)"),
	}
}

// Indexes of the Strategy.
func (Strategy) Indexes() []ent.Index {
	return []ent.Index{
		// Composite index on name and version_number for efficient version queries
		index.Fields("name", "version_number").
			Unique(),
		// Index on is_latest for filtering latest versions
		index.Fields("is_latest"),
		// Index on parent_id for traversing version history
		index.Fields("parent_id"),
	}
}

// Annotations of the Strategy.
func (Strategy) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.RelayConnection(),
		entgql.QueryField(),
		entgql.Mutations(entgql.MutationCreate(), entgql.MutationUpdate()),
	}
}

// Hooks of the Strategy.
func (Strategy) Hooks() []ent.Hook {
	return []ent.Hook{
		validateStrategyConfig,
	}
}
