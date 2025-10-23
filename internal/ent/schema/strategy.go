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
			Unique().
			Comment("Strategy name"),
		field.Text("description").
			Optional().
			Comment("Strategy description"),
		field.Text("code").
			Comment("Python strategy code"),
		field.String("version").
			Default("1.0").
			Comment("Strategy version"),
		field.JSON("config", map[string]interface{}{}).
			Optional().
			Comment("Strategy-specific configuration (config.json)").
			Annotations(entgql.Type("Map")),
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
		edge.To("backtests", Backtest.Type).
			Annotations(entgql.RelayConnection()),
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