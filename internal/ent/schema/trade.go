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
)

// Trade holds the schema definition for the Trade entity.
type Trade struct {
	ent.Schema
}

// Fields of the Trade.
func (Trade) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable(),
		field.Int("freqtrade_trade_id").
			Positive().
			Comment("Original trade ID from freqtrade"),
		field.String("pair").
			NotEmpty().
			Comment("Trading pair (BTC/USDT)"),
		field.Bool("is_open").
			Default(true).
			Comment("Trade open status"),
		field.Time("open_date").
			Comment("Trade open time").
			Annotations(entgql.OrderField("OPEN_DATE")),
		field.Time("close_date").
			Optional().
			Nillable().
			Comment("Trade close time").
			Annotations(entgql.OrderField("CLOSE_DATE")),
		field.Float("open_rate").
			Positive().
			Comment("Entry price"),
		field.Float("close_rate").
			Optional().
			Nillable().
			Comment("Exit price"),
		field.Float("amount").
			Positive().
			Comment("Amount of coins"),
		field.Float("stake_amount").
			Positive().
			Comment("Stake in base currency"),
		field.Float("profit_abs").
			Default(0).
			Comment("Absolute profit").
			Annotations(entgql.OrderField("PROFIT_ABS")),
		field.Float("profit_ratio").
			Default(0).
			Comment("Profit percentage (0.05 = 5%)").
			Annotations(entgql.OrderField("PROFIT_RATIO")),
		field.String("sell_reason").
			Optional().
			Comment("Reason for selling (roi, stoploss, etc.)"),
		field.String("strategy_name").
			Optional().
			Comment("Strategy used"),
		field.String("timeframe").
			Optional().
			Comment("Timeframe used"),
		field.JSON("raw_data", map[string]interface{}{}).
			Optional().
			Comment("Full Freqtrade trade response for advanced analytics").
			Annotations(entgql.Skip()),
		field.UUID("bot_id", uuid.UUID{}).
			Comment("Foreign key to bot"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

// Edges of the Trade.
func (Trade) Edges() []ent.Edge {
	return []ent.Edge{
		// Many-to-one: Bot has many Trades
		// Unique() means "each Trade belongs to exactly one Bot"
		// The reverse edge Bot.trades (edge.To) allows multiple trades per bot
		edge.From("bot", Bot.Type).
			Ref("trades").
			Field("bot_id").
			Required().
			Unique(),
	}
}

// Indexes of the Trade.
func (Trade) Indexes() []ent.Index {
	return []ent.Index{
		// Unique constraint on bot_id + freqtrade_trade_id
		index.Fields("bot_id", "freqtrade_trade_id").
			Unique(),
		// Index for querying open trades
		index.Fields("bot_id", "is_open"),
		// Index for time-based queries
		index.Fields("open_date"),
	}
}

// Annotations of the Trade.
func (Trade) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.RelayConnection(),
		entgql.QueryField(),
		entgql.Mutations(entgql.MutationCreate(), entgql.MutationUpdate()),
	}
}

// Mixin of the Trade.
func (Trade) Mixin() []ent.Mixin {
	return []ent.Mixin{
		entmixin.SoftDeleteMixin{},
	}
}
