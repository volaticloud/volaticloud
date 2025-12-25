package monitor

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/botmetrics"
	"volaticloud/internal/ent/trade"
	"volaticloud/internal/freqtrade"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"
)

const (
	// DefaultTradeSyncInterval is how often to sync trades
	DefaultTradeSyncInterval = 2 * time.Minute

	// TradeFetchBatchSize is the maximum number of trades to fetch per API call
	TradeFetchBatchSize int64 = 500
)

// TradeChange represents a detected trade event for future alerting
type TradeChange struct {
	Type      TradeChangeType
	Trade     *ent.Trade
	BotID     uuid.UUID
	Timestamp time.Time
}

// TradeChangeType represents the type of trade change detected
type TradeChangeType string

const (
	// TradeChangeNewTrade indicates a new trade was opened
	TradeChangeNewTrade TradeChangeType = "new_trade"
	// TradeChangeTradeClosed indicates a trade was closed
	TradeChangeTradeClosed TradeChangeType = "trade_closed"
	// TradeChangeTradeUpdated indicates a trade was updated (profit changed)
	TradeChangeTradeUpdated TradeChangeType = "trade_updated"
)

// syncTrades fetches trades from Freqtrade and upserts them to the database
// Uses incremental sync based on last_synced_trade_id for efficiency
func (m *BotMonitor) syncTrades(ctx context.Context, b *ent.Bot, ftClient *freqtrade.BotClient) error {
	// Get existing metrics to find last synced trade ID
	metrics, err := m.dbClient.BotMetrics.Query().
		Where(botmetrics.BotIDEQ(b.ID)).
		Only(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return err
	}

	lastSyncedTradeID := 0
	if metrics != nil {
		lastSyncedTradeID = metrics.LastSyncedTradeID
	}

	// Fetch all trades from Freqtrade (paginated)
	allTrades, err := m.fetchAllTrades(ctx, ftClient)
	if err != nil {
		return err
	}

	if len(allTrades) == 0 {
		return nil
	}

	// Filter trades that need syncing (trade_id > lastSyncedTradeID or still open)
	tradesToSync := make([]freqtrade.TradeSchema, 0)
	maxTradeID := lastSyncedTradeID
	for _, t := range allTrades {
		tradeID := int(t.TradeId)
		if tradeID > maxTradeID {
			maxTradeID = tradeID
		}
		// Sync new trades or open trades (open trades can update)
		if tradeID > lastSyncedTradeID || t.IsOpen {
			tradesToSync = append(tradesToSync, t)
		}
	}

	if len(tradesToSync) == 0 {
		return nil
	}

	log.Printf("Bot %s: syncing %d trades (last synced: %d, max: %d)",
		b.Name, len(tradesToSync), lastSyncedTradeID, maxTradeID)

	// Batch upsert trades
	if err := m.upsertTrades(ctx, b.ID, tradesToSync); err != nil {
		return err
	}

	// Update last synced trade ID
	return m.updateLastSyncedTradeID(ctx, b.ID, maxTradeID)
}

// fetchAllTrades fetches all trades from Freqtrade with pagination
func (m *BotMonitor) fetchAllTrades(ctx context.Context, ftClient *freqtrade.BotClient) ([]freqtrade.TradeSchema, error) {
	var allTrades []freqtrade.TradeSchema
	var offset int64 = 0

	for {
		resp, err := ftClient.GetTrades(ctx, TradeFetchBatchSize, offset)
		if err != nil {
			return nil, err
		}

		allTrades = append(allTrades, resp.Trades...)

		// Check if we've fetched all trades
		if int64(len(resp.Trades)) < TradeFetchBatchSize || int64(len(allTrades)) >= resp.TotalTrades {
			break
		}

		offset += TradeFetchBatchSize
	}

	return allTrades, nil
}

// upsertTrades batch upserts trades to the database using PostgreSQL ON CONFLICT
func (m *BotMonitor) upsertTrades(ctx context.Context, botID uuid.UUID, trades []freqtrade.TradeSchema) error {
	builders := make([]*ent.TradeCreate, 0, len(trades))

	for _, t := range trades {
		// Convert timestamps
		openDate := time.Unix(t.OpenTimestamp/1000, 0)

		var closeDate *time.Time
		if t.CloseTimestamp.IsSet() && t.CloseTimestamp.Get() != nil {
			ts := *t.CloseTimestamp.Get()
			cd := time.Unix(ts/1000, 0)
			closeDate = &cd
		}

		var closeRate *float64
		if t.CloseRate.IsSet() && t.CloseRate.Get() != nil {
			cr := float64(*t.CloseRate.Get())
			closeRate = &cr
		}

		// Get profit values
		profitAbs := 0.0
		if t.ProfitAbs.IsSet() && t.ProfitAbs.Get() != nil {
			profitAbs = float64(*t.ProfitAbs.Get())
		}

		profitRatio := 0.0
		if t.ProfitRatio.IsSet() && t.ProfitRatio.Get() != nil {
			profitRatio = float64(*t.ProfitRatio.Get())
		}

		// Get exit reason
		var sellReason *string
		if t.ExitReason.IsSet() && t.ExitReason.Get() != nil {
			sr := *t.ExitReason.Get()
			sellReason = &sr
		}

		// Convert trade to raw JSON for storage
		rawData, err := tradeToRawData(t)
		if err != nil {
			log.Printf("Warning: failed to convert trade %d to raw data: %v", t.TradeId, err)
			rawData = map[string]interface{}{}
		}

		// Create trade builder
		builder := m.dbClient.Trade.Create().
			SetBotID(botID).
			SetFreqtradeTradeID(int(t.TradeId)).
			SetPair(t.Pair).
			SetIsOpen(t.IsOpen).
			SetOpenDate(openDate).
			SetOpenRate(float64(t.OpenRate)).
			SetAmount(float64(t.Amount)).
			SetStakeAmount(float64(t.StakeAmount)).
			SetProfitAbs(profitAbs).
			SetProfitRatio(profitRatio).
			SetStrategyName(t.Strategy).
			SetRawData(rawData)

		// Set nullable fields
		if closeDate != nil {
			builder = builder.SetCloseDate(*closeDate)
		}
		if closeRate != nil {
			builder = builder.SetCloseRate(*closeRate)
		}
		if sellReason != nil {
			builder = builder.SetSellReason(*sellReason)
		}

		// Set timeframe (convert from minutes to string)
		if t.Timeframe > 0 {
			builder = builder.SetTimeframe(formatTimeframe(t.Timeframe))
		}

		builders = append(builders, builder)
	}

	// Batch upsert with ON CONFLICT
	return m.dbClient.Trade.CreateBulk(builders...).
		OnConflict(
			sql.ConflictColumns(trade.FieldBotID, trade.FieldFreqtradeTradeID),
		).
		UpdateNewValues().
		Exec(ctx)
}

// updateLastSyncedTradeID updates the last synced trade ID in BotMetrics
func (m *BotMonitor) updateLastSyncedTradeID(ctx context.Context, botID uuid.UUID, lastTradeID int) error {
	// Check if bot metrics exist
	metrics, err := m.dbClient.BotMetrics.Query().
		Where(botmetrics.BotIDEQ(botID)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			// Create metrics with just the sync tracking fields
			return m.dbClient.BotMetrics.Create().
				SetBotID(botID).
				SetLastSyncedTradeID(lastTradeID).
				SetLastTradeSyncAt(time.Now()).
				Exec(ctx)
		}
		return err
	}

	// Update existing metrics
	return m.dbClient.BotMetrics.UpdateOneID(metrics.ID).
		SetLastSyncedTradeID(lastTradeID).
		SetLastTradeSyncAt(time.Now()).
		Exec(ctx)
}

// tradeToRawData converts a TradeSchema to a map for storage
func tradeToRawData(t freqtrade.TradeSchema) (map[string]interface{}, error) {
	// Marshal to JSON and back to get a clean map
	data, err := json.Marshal(t)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}

	return result, nil
}

// formatTimeframe converts timeframe in minutes to string format
func formatTimeframe(minutes int64) string {
	switch {
	case minutes >= 10080: // 1 week
		return "1w"
	case minutes >= 1440: // 1 day
		return "1d"
	case minutes >= 240:
		return "4h"
	case minutes >= 60:
		return "1h"
	case minutes >= 30:
		return "30m"
	case minutes >= 15:
		return "15m"
	case minutes >= 5:
		return "5m"
	case minutes >= 1:
		return "1m"
	default:
		return ""
	}
}
