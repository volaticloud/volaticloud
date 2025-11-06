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

// BotMetrics holds real-time metrics fetched from Freqtrade API.
// This is a separate entity with one-to-one relationship to Bot
// to keep the metrics cache separate from bot configuration.
type BotMetrics struct {
	ent.Schema
}

// Fields of the BotMetrics.
func (BotMetrics) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable(),
		field.UUID("bot_id", uuid.UUID{}).
			Unique().
			Comment("Foreign key to bot (one-to-one)"),

		// Profit metrics
		field.Float("profit_closed_coin").
			Optional().
			Comment("Total closed profit in coin"),
		field.Float("profit_closed_percent").
			Optional().
			Comment("Total closed profit percentage"),
		field.Float("profit_all_coin").
			Optional().
			Comment("Total profit (closed + open) in coin"),
		field.Float("profit_all_percent").
			Optional().
			Comment("Total profit (closed + open) percentage"),

		// Trade counts
		field.Int("trade_count").
			Optional().
			Comment("Total number of trades"),
		field.Int("closed_trade_count").
			Optional().
			Comment("Number of closed trades"),
		field.Int("open_trade_count").
			Optional().
			Comment("Current number of open trades"),
		field.Int("winning_trades").
			Optional().
			Comment("Number of winning trades"),
		field.Int("losing_trades").
			Optional().
			Comment("Number of losing trades"),

		// Performance metrics
		field.Float("winrate").
			Optional().
			Comment("Win rate percentage (0-100)"),
		field.Float("expectancy").
			Optional().
			Comment("Average profit per trade"),
		field.Float("profit_factor").
			Optional().
			Comment("Ratio of gross profit to gross loss"),

		// Drawdown
		field.Float("max_drawdown").
			Optional().
			Comment("Maximum drawdown percentage"),
		field.Float("max_drawdown_abs").
			Optional().
			Comment("Maximum drawdown absolute value"),

		// Best trade
		field.String("best_pair").
			Optional().
			Comment("Best performing trading pair"),
		field.Float("best_rate").
			Optional().
			Comment("Best trade profit rate"),

		// Timestamps
		field.Time("first_trade_timestamp").
			Optional().
			Comment("Timestamp of first trade"),
		field.Time("latest_trade_timestamp").
			Optional().
			Comment("Timestamp of latest trade"),
		field.Time("fetched_at").
			Default(time.Now).
			Comment("When these metrics were fetched from Freqtrade API"),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

// Edges of the BotMetrics.
func (BotMetrics) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("bot", Bot.Type).
			Ref("metrics").
			Field("bot_id").
			Required().
			Unique(),
	}
}

// Annotations of the BotMetrics.
func (BotMetrics) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.QueryField(),
		entgql.Mutations(entgql.MutationCreate(), entgql.MutationUpdate()),
	}
}
