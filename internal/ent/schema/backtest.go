package schema

import (
	"time"

	"entgo.io/contrib/entgql"
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"

	"volaticloud/internal/enum"
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
		field.JSON("result", map[string]interface{}{}).
			Optional().
			Annotations(
				entgql.Type("Map"),
				RequiresPermissionWithField("view", "strategyID"),
			).
			Comment("Backtest result data (metrics, logs, trades, etc.)"),
		field.JSON("summary", map[string]interface{}{}).
			Optional().
			Comment("Typed summary of key backtest metrics").
			Annotations(
				entgql.Skip(entgql.SkipAll),
			),
		field.String("container_id").
			Optional().
			Comment("Docker container ID for running backtest"),
		field.String("error_message").
			Optional().
			Comment("Error message if backtest failed"),
		field.Text("logs").
			Optional().
			Annotations(RequiresPermissionWithField("view", "strategyID")).
			Comment("Container logs from backtest execution"),
		field.UUID("strategy_id", uuid.UUID{}).
			Comment("Foreign key to strategy"),
		field.UUID("runner_id", uuid.UUID{}).
			Comment("Foreign key to runner"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
		field.Time("completed_at").
			Optional().
			Comment("Completion timestamp"),
		field.Time("start_date").
			Optional().
			Comment("Backtest start date (beginning of time range)"),
		field.Time("end_date").
			Optional().
			Comment("Backtest end date (end of time range)"),
	}
}

// Edges of the Backtest.
func (Backtest) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("strategy", Strategy.Type).
			Ref("backtest").
			Field("strategy_id").
			Required().
			Unique().
			Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.From("runner", BotRunner.Type).
			Ref("backtests").
			Field("runner_id").
			Required().
			Unique(),
	}
}

// Annotations of the Backtest.
func (Backtest) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.RelayConnection(),
		entgql.QueryField(),
		// Backtests are immutable - only allow creation, no updates
		entgql.Mutations(entgql.MutationCreate()),
	}
}
