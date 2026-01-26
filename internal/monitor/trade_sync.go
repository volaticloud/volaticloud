package monitor

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"volaticloud/internal/alert"
	"volaticloud/internal/ent"
	"volaticloud/internal/ent/botmetrics"
	"volaticloud/internal/ent/trade"
	"volaticloud/internal/freqtrade"
	"volaticloud/internal/pubsub"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"
)

const (
	// DefaultTradeSyncInterval is how often to sync trades
	DefaultTradeSyncInterval = 2 * time.Minute

	// TradeFetchBatchSize is the maximum number of trades to fetch per API call
	TradeFetchBatchSize int64 = 500

	// TradeSyncTimeout is the maximum time allowed for a single trade sync operation
	TradeSyncTimeout = 30 * time.Second

	// RecentTradesWindow is how far back to look for DB trades (for detecting changes)
	// This limits memory usage for bots with many historical trades
	RecentTradesWindow = 7 * 24 * time.Hour // 7 days
)

// syncTrades fetches trades from Freqtrade and upserts them to the database
// Uses smart incremental sync with bot reset detection for efficiency
func (m *BotMonitor) syncTrades(ctx context.Context, b *ent.Bot, ftClient *freqtrade.BotClient) error {
	// Add timeout to prevent long-running syncs
	ctx, cancel := context.WithTimeout(ctx, TradeSyncTimeout)
	defer cancel()

	// Get existing metrics for sync state
	metrics, err := m.dbClient.BotMetrics.Query().
		Where(botmetrics.BotIDEQ(b.ID)).
		Only(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return err
	}

	lastSyncedTradeID := 0
	lastKnownMaxTradeID := 0
	if metrics != nil {
		lastSyncedTradeID = metrics.LastSyncedTradeID
		lastKnownMaxTradeID = metrics.LastKnownMaxTradeID
	}

	// Fetch trades from Freqtrade API (paginated but in memory)
	log.Printf("Bot %s: fetching trades from Freqtrade API...", b.Name)
	allAPITrades, err := m.fetchAllTrades(ctx, ftClient)
	if err != nil {
		log.Printf("Bot %s: failed to fetch trades: %v", b.Name, err)
		return err
	}

	if len(allAPITrades) == 0 {
		log.Printf("Bot %s: no trades found, skipping sync", b.Name)
		return nil
	}

	// Find max trade ID from API response
	apiMaxTradeID := 0
	for _, t := range allAPITrades {
		if int(t.TradeId) > apiMaxTradeID {
			apiMaxTradeID = int(t.TradeId)
		}
	}

	// Detect bot reset: if API max < last known max, bot was recreated
	botWasReset := lastKnownMaxTradeID > 0 && apiMaxTradeID < lastKnownMaxTradeID
	if botWasReset {
		log.Printf("Bot %s: RESET DETECTED - API max trade ID (%d) < last known max (%d)",
			b.Name, apiMaxTradeID, lastKnownMaxTradeID)
		// Reset sync state - all trades are new
		lastSyncedTradeID = 0
	}

	log.Printf("Bot %s: fetched %d trades from API (lastSyncedID=%d, apiMax=%d, reset=%v)",
		b.Name, len(allAPITrades), lastSyncedTradeID, apiMaxTradeID, botWasReset)

	// Query only relevant DB trades (open + recent) to minimize memory
	existingTrades, err := m.queryRelevantTrades(ctx, b.ID, botWasReset)
	if err != nil {
		return err
	}

	// Build lookup maps for existing trades using composite key (trade_id, open_date)
	type tradeKey struct {
		tradeID      int
		openDateUnix int64
	}
	existingTradeKeys := make(map[tradeKey]bool)
	existingOpenTradeKeys := make(map[tradeKey]bool)
	for _, t := range existingTrades {
		key := tradeKey{tradeID: t.FreqtradeTradeID, openDateUnix: t.OpenDate.Unix()}
		existingTradeKeys[key] = true
		if t.IsOpen {
			existingOpenTradeKeys[key] = true
		}
	}

	// Process trades and collect for sync/alerts
	tradesToSync := make([]freqtrade.TradeSchema, 0)
	var newTrades []freqtrade.TradeSchema
	var closedTrades []freqtrade.TradeSchema

	for _, t := range allAPITrades {
		tradeID := int(t.TradeId)
		openDateUnix := t.OpenTimestamp / 1000 // Convert milliseconds to seconds
		key := tradeKey{tradeID: tradeID, openDateUnix: openDateUnix}

		// Check if trade is missing from database using composite key
		isMissingFromDB := !existingTradeKeys[key]

		// Sync trades that are:
		// 1. New (trade_id > lastSyncedTradeID)
		// 2. Open (open trades can update)
		// 3. Missing from database (handles gaps and bot recreation)
		if tradeID > lastSyncedTradeID || t.IsOpen || isMissingFromDB {
			tradesToSync = append(tradesToSync, t)
		}

		// Detect new trades for alerts
		if isMissingFromDB {
			newTrades = append(newTrades, t)
			if !t.IsOpen {
				// Trade opened and closed between syncs
				closedTrades = append(closedTrades, t)
			}
		} else if !t.IsOpen && existingOpenTradeKeys[key] {
			// Existing trade transitioned from open to closed
			closedTrades = append(closedTrades, t)
		}
	}

	if len(tradesToSync) == 0 {
		log.Printf("Bot %s: no trades to sync (all %d trades already synced)", b.Name, len(allAPITrades))
		return nil
	}

	log.Printf("Bot %s: syncing %d trades, %d new, %d closed",
		b.Name, len(tradesToSync), len(newTrades), len(closedTrades))

	// Batch upsert trades
	if err := m.upsertTrades(ctx, b.ID, tradesToSync); err != nil {
		return err
	}

	// Publish trade events to pub/sub for real-time updates
	m.publishTradeEvents(ctx, b, tradesToSync)

	// Emit grouped alerts (single alert per type with all trades)
	m.emitTradeAlerts(ctx, b, newTrades, closedTrades)

	// Update sync state including max trade ID for reset detection
	return m.updateTradeSyncState(ctx, b.ID, apiMaxTradeID)
}

// queryRelevantTrades queries only the trades we need for comparison
// - If bot was reset: query trades from recent window only
// - Otherwise: query open trades + trades from recent window
func (m *BotMonitor) queryRelevantTrades(ctx context.Context, botID uuid.UUID, botWasReset bool) ([]*ent.Trade, error) {
	recentCutoff := time.Now().Add(-RecentTradesWindow)

	query := m.dbClient.Trade.Query().
		Where(trade.BotIDEQ(botID))

	if botWasReset {
		// For reset, only need recent trades to avoid false duplicates
		query = query.Where(trade.OpenDateGTE(recentCutoff))
	} else {
		// Normal case: open trades + recent trades
		query = query.Where(
			trade.Or(
				trade.IsOpenEQ(true),
				trade.OpenDateGTE(recentCutoff),
			),
		)
	}

	return query.All(ctx)
}

// emitTradeAlerts sends grouped alerts for new and closed trades
func (m *BotMonitor) emitTradeAlerts(ctx context.Context, b *ent.Bot, newTrades, closedTrades []freqtrade.TradeSchema) {
	alertMgr := alert.GetManagerFromContext(ctx)
	if alertMgr == nil {
		return // Alert manager not configured
	}

	botMode := string(b.Mode)

	// Convert to TradeInfo and send grouped alert for new trades
	if len(newTrades) > 0 {
		tradeInfos := make([]alert.TradeInfo, len(newTrades))
		for i, t := range newTrades {
			tradeInfos[i] = alert.TradeInfo{
				TradeID:     int(t.TradeId),
				Pair:        t.Pair,
				Amount:      float64(t.Amount),
				StakeAmount: float64(t.StakeAmount),
				OpenRate:    float64(t.OpenRate),
				Strategy:    t.Strategy,
				IsOpen:      t.IsOpen,
			}
		}
		if err := alertMgr.HandleTradesOpened(ctx, b.ID, b.Name, b.OwnerID, botMode, tradeInfos); err != nil {
			log.Printf("Bot %s: failed to emit trades opened alert: %v", b.Name, err)
		}
	}

	// Convert to TradeInfo and send grouped alert for closed trades
	if len(closedTrades) > 0 {
		tradeInfos := make([]alert.TradeInfo, len(closedTrades))
		for i, t := range closedTrades {
			profitAbs := 0.0
			if t.ProfitAbs.IsSet() && t.ProfitAbs.Get() != nil {
				profitAbs = float64(*t.ProfitAbs.Get())
			}
			profitRatio := 0.0
			if t.ProfitRatio.IsSet() && t.ProfitRatio.Get() != nil {
				profitRatio = float64(*t.ProfitRatio.Get())
			}
			closeRate := 0.0
			if t.CloseRate.IsSet() && t.CloseRate.Get() != nil {
				closeRate = float64(*t.CloseRate.Get())
			}
			exitReason := ""
			if t.ExitReason.IsSet() && t.ExitReason.Get() != nil {
				exitReason = *t.ExitReason.Get()
			}

			tradeInfos[i] = alert.TradeInfo{
				TradeID:     int(t.TradeId),
				Pair:        t.Pair,
				ProfitAbs:   profitAbs,
				ProfitRatio: profitRatio,
				OpenRate:    float64(t.OpenRate),
				CloseRate:   closeRate,
				ExitReason:  exitReason,
			}
		}
		if err := alertMgr.HandleTradesClosed(ctx, b.ID, b.Name, b.OwnerID, botMode, tradeInfos); err != nil {
			log.Printf("Bot %s: failed to emit trades closed alert: %v", b.Name, err)
		}
	}
}

// publishTradeEvents publishes trade update events to pub/sub
func (m *BotMonitor) publishTradeEvents(ctx context.Context, b *ent.Bot, trades []freqtrade.TradeSchema) {
	if m.pubsub == nil {
		return
	}

	// Publish each trade to both bot-specific and org-level topics
	for _, t := range trades {
		// Determine trade side and status
		side := "long"
		if t.IsShort {
			side = "short"
		}
		status := "open"
		if !t.IsOpen {
			status = "closed"
		}

		// Get profit percentage
		profitPct := 0.0
		if t.ProfitRatio.IsSet() && t.ProfitRatio.Get() != nil {
			profitPct = float64(*t.ProfitRatio.Get()) * 100
		}

		event := pubsub.TradeEvent{
			Type:      pubsub.EventTypeTradeUpdated,
			TradeID:   fmt.Sprintf("%d", t.TradeId),
			BotID:     b.ID.String(),
			Pair:      t.Pair,
			Side:      side,
			Status:    status,
			ProfitPct: profitPct,
			Timestamp: time.Now(),
		}

		// Publish to bot-specific topic (for trade detail views)
		topic := pubsub.TradeTopic(b.ID.String())
		if err := m.pubsub.Publish(ctx, topic, event); err != nil {
			log.Printf("Bot %s: failed to publish trade event: %v", b.Name, err)
		}

		// Also publish to org-level topic (for list views)
		orgTopic := pubsub.OrgTradesTopic(b.OwnerID)
		if err := m.pubsub.Publish(ctx, orgTopic, event); err != nil {
			log.Printf("Bot %s: failed to publish org trade event: %v", b.Name, err)
		}
	}
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

// upsertTrades batch upserts trades to the database using ON CONFLICT
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
	// Uses (bot_id, freqtrade_trade_id, open_date) to allow same trade IDs
	// when a bot is recreated (old trades have different open_date)
	return m.dbClient.Trade.CreateBulk(builders...).
		OnConflict(
			sql.ConflictColumns(trade.FieldBotID, trade.FieldFreqtradeTradeID, trade.FieldOpenDate),
		).
		UpdateNewValues().
		Exec(ctx)
}

// updateTradeSyncState updates the sync state in BotMetrics
func (m *BotMonitor) updateTradeSyncState(ctx context.Context, botID uuid.UUID, maxTradeID int) error {
	// Check if bot metrics exist
	metrics, err := m.dbClient.BotMetrics.Query().
		Where(botmetrics.BotIDEQ(botID)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			// Create metrics with sync tracking fields
			return m.dbClient.BotMetrics.Create().
				SetBotID(botID).
				SetLastSyncedTradeID(maxTradeID).
				SetLastKnownMaxTradeID(maxTradeID).
				SetLastTradeSyncAt(time.Now()).
				Exec(ctx)
		}
		return err
	}

	// Update existing metrics
	// Only update lastKnownMaxTradeID if current max is higher (handles normal case)
	newMaxTradeID := metrics.LastKnownMaxTradeID
	if maxTradeID > newMaxTradeID {
		newMaxTradeID = maxTradeID
	}

	return m.dbClient.BotMetrics.UpdateOneID(metrics.ID).
		SetLastSyncedTradeID(maxTradeID).
		SetLastKnownMaxTradeID(newMaxTradeID).
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
