package schema

import (
	"time"

	"entgo.io/contrib/entgql"
	"entgo.io/ent"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"

	"anytrade/internal/enum"
)

// Backtest holds the schema definition for the Backtest entity.
type Backtest struct {
	ent.Schema
}

// Fields of the Backtest.
func (Backtest) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable(),
		field.Enum("status").
			GoType(enum.TaskStatus("")).
			Default(string(enum.TaskStatusPending)).
			Comment("Task status"),
		field.JSON("config", map[string]interface{}{}).
			Optional().
			Annotations(entgql.Skip(entgql.SkipAll)).
			Comment("Backtest configuration (pairs, timeframe, dates, stake, etc.)"),
		field.JSON("result", map[string]interface{}{}).
			Optional().
			Annotations(entgql.Skip(entgql.SkipAll)).
			Comment("Backtest result data (metrics, logs, trades, etc.)"),
		field.UUID("strategy_id", uuid.UUID{}).
			Comment("Foreign key to strategy"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
		field.Time("completed_at").
			Optional().
			Comment("Completion timestamp"),
	}
}

// Edges of the Backtest.
func (Backtest) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("strategy", Strategy.Type).
			Ref("backtests").
			Field("strategy_id").
			Required().
			Unique(),
	}
}

// Annotations of the Backtest.
func (Backtest) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.RelayConnection(),
		entgql.QueryField(),
		entgql.Mutations(entgql.MutationCreate(), entgql.MutationUpdate()),
	}
}