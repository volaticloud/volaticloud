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
		field.Time("start_date").
			Comment("Historical data start date"),
		field.Time("end_date").
			Comment("Historical data end date"),
		field.String("timeframe").
			NotEmpty().
			Comment("Candlestick timeframe"),
		field.Float("stake_amount").
			Positive().
			Comment("Stake amount per trade"),
		field.String("stake_currency").
			NotEmpty().
			Comment("Currency (USDT, BTC, etc.)"),
		field.JSON("pairs", []string{}).
			Annotations(entgql.Skip(entgql.SkipAll)).
			Comment("List of trading pairs"),
		field.JSON("results", map[string]interface{}{}).
			Optional().
			Annotations(entgql.Skip(entgql.SkipAll)).
			Comment("Backtest results"),
		field.JSON("config", map[string]interface{}{}).
			Optional().
			Annotations(entgql.Skip(entgql.SkipAll)).
			Comment("Backtest-specific configuration"),
		field.String("runtime_id").
			Optional().
			Comment("Runtime identifier for execution"),
		field.Text("log_output").
			Optional().
			Comment("Execution logs"),
		field.Text("error_message").
			Optional().
			Comment("Error if failed"),
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