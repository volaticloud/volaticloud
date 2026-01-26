package alert

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"

	"volaticloud/internal/alert/channel"
	"volaticloud/internal/auth"
	"volaticloud/internal/ent"
	"volaticloud/internal/enum"
	"volaticloud/internal/keycloak"
	"volaticloud/internal/pubsub"
)

// Config holds configuration for the alert manager
type Config struct {
	// DatabaseClient for querying rules and storing events
	DatabaseClient *ent.Client

	// BatchInterval is how often to send batched alerts (default: 1 hour)
	BatchInterval time.Duration
}

// Manager orchestrates the alerting system
type Manager struct {
	dbClient     *ent.Client
	evaluator    *Evaluator
	dispatcher   *Dispatcher
	batcher      *Batcher
	emailChannel channel.Channel
	umaClient    keycloak.UMAClientInterface
}

// NewManager creates a new alert manager
func NewManager(cfg Config) (*Manager, error) {
	if cfg.DatabaseClient == nil {
		return nil, fmt.Errorf("database client is required")
	}

	if cfg.BatchInterval == 0 {
		cfg.BatchInterval = time.Hour
	}

	evaluator := NewEvaluator(cfg.DatabaseClient)
	dispatcher := NewDispatcher(cfg.DatabaseClient, evaluator)
	batcher := NewBatcher(BatcherConfig{
		FlushInterval: cfg.BatchInterval,
	})

	// Wire up batcher and dispatcher
	dispatcher.SetBatcher(batcher)
	batcher.SetDispatcher(dispatcher)

	return &Manager{
		dbClient:   cfg.DatabaseClient,
		evaluator:  evaluator,
		dispatcher: dispatcher,
		batcher:    batcher,
	}, nil
}

// SetEmailChannel sets the email channel for delivery
func (m *Manager) SetEmailChannel(ch channel.Channel) {
	m.emailChannel = ch
	m.dispatcher.SetEmailChannel(ch)
}

// SetUMAClient sets the UMA client for permission checks
func (m *Manager) SetUMAClient(client keycloak.UMAClientInterface) {
	m.umaClient = client
}

// SetPubSub sets the pub/sub for publishing alert events
func (m *Manager) SetPubSub(ps pubsub.PubSub) {
	m.dispatcher.SetPubSub(ps)
}

// Start starts the alert manager
func (m *Manager) Start(ctx context.Context) error {
	hasEmail := m.emailChannel != nil
	log.Printf("Starting alert manager (email configured: %v)", hasEmail)

	// Start batcher
	if err := m.batcher.Start(ctx); err != nil {
		return fmt.Errorf("failed to start batcher: %w", err)
	}

	log.Println("Alert manager started successfully")
	return nil
}

// Stop stops the alert manager
func (m *Manager) Stop(ctx context.Context) error {
	log.Println("Stopping alert manager...")

	// Stop batcher (flushes remaining alerts)
	if err := m.batcher.Stop(ctx); err != nil {
		log.Printf("Error stopping batcher: %v", err)
	}

	log.Println("Alert manager stopped")
	return nil
}

// HandleBotStatus processes a bot status change event
func (m *Manager) HandleBotStatus(
	ctx context.Context,
	botID uuid.UUID,
	botName string,
	ownerID string,
	oldStatus enum.BotStatus,
	newStatus enum.BotStatus,
	errorMessage string,
	botMode string,
) error {
	// Build event data
	eventData := map[string]interface{}{
		"bot_id":        botID.String(),
		"bot_name":      botName,
		"owner_id":      ownerID,
		"old_status":    string(oldStatus),
		"new_status":    string(newStatus),
		"error_message": errorMessage,
		"bot_mode":      botMode,
		"timestamp":     time.Now(),
	}

	// Validate and sanitize event data
	if err := ValidateEventData(eventData); err != nil {
		return fmt.Errorf("invalid event data: %w", err)
	}

	// Determine alert type
	alertType := enum.AlertTypeStatusChange
	if newStatus == enum.BotStatusError {
		// Could also trigger connection_issue if it's a connection error
		if errorMessage != "" {
			eventData["error_type"] = "runtime_error"
		}
	}

	// Find matching rules
	log.Printf("Alert: Bot %s (%s) status changed %s -> %s (owner: %s)", botName, botMode, oldStatus, newStatus, ownerID)
	botIDStr := botID.String()
	rules, err := m.evaluator.FindMatchingRules(ctx, ownerID, alertType, enum.AlertResourceTypeBot, &botIDStr)
	if err != nil {
		return fmt.Errorf("failed to find matching rules: %w", err)
	}
	log.Printf("Alert: Found %d matching rules for bot %s", len(rules), botName)

	// Filter rules with recipients and bot mode
	rules = m.evaluator.FilterByRecipients(rules)
	rules = m.evaluator.FilterByBotMode(rules, botMode)
	if len(rules) == 0 {
		log.Printf("Alert: No matching rules for bot %s (mode: %s)", botName, botMode)
		return nil
	}

	// Evaluate conditions and dispatch
	for _, rule := range rules {
		if !m.evaluator.EvaluateStatusConditions(rule.Conditions, string(newStatus)) {
			continue
		}

		if err := m.dispatcher.Dispatch(ctx, rule, eventData); err != nil {
			log.Printf("Failed to dispatch alert for rule %s: %v", rule.ID, err)
		}
	}

	return nil
}

// HandleConnectionIssue processes a connection issue event
func (m *Manager) HandleConnectionIssue(
	ctx context.Context,
	botID uuid.UUID,
	botName string,
	ownerID string,
	errorMessage string,
	retryCount int,
	botMode string,
) error {
	eventData := map[string]interface{}{
		"bot_id":        botID.String(),
		"bot_name":      botName,
		"owner_id":      ownerID,
		"error_message": errorMessage,
		"retry_count":   retryCount,
		"bot_mode":      botMode,
		"timestamp":     time.Now(),
	}

	log.Printf("Alert: Bot %s (%s) connection issue - %s (owner: %s)", botName, botMode, errorMessage, ownerID)
	botIDStr := botID.String()
	return m.dispatchForAlertType(ctx, ownerID, enum.AlertTypeConnectionIssue, enum.AlertResourceTypeBot, &botIDStr, eventData, botMode)
}

// TradeInfo holds trade data for batch alerting
type TradeInfo struct {
	TradeID     int
	Pair        string
	Amount      float64
	StakeAmount float64
	OpenRate    float64
	CloseRate   float64
	ProfitAbs   float64
	ProfitRatio float64
	Strategy    string
	ExitReason  string
	IsOpen      bool
}

// HandleTradeOpened processes a trade opened event (single trade - legacy)
func (m *Manager) HandleTradeOpened(
	ctx context.Context,
	botID uuid.UUID,
	botName string,
	ownerID string,
	tradeID int,
	pair string,
	amount float64,
	stakeAmount float64,
	openRate float64,
	strategy string,
	botMode string,
) error {
	return m.HandleTradesOpened(ctx, botID, botName, ownerID, botMode, []TradeInfo{{
		TradeID:     tradeID,
		Pair:        pair,
		Amount:      amount,
		StakeAmount: stakeAmount,
		OpenRate:    openRate,
		Strategy:    strategy,
	}})
}

// HandleTradesOpened processes multiple trade opened events in a single alert
func (m *Manager) HandleTradesOpened(
	ctx context.Context,
	botID uuid.UUID,
	botName string,
	ownerID string,
	botMode string,
	trades []TradeInfo,
) error {
	if len(trades) == 0 {
		return nil
	}

	// Build trades list for event data
	tradesList := make([]map[string]interface{}, len(trades))
	for i, t := range trades {
		tradesList[i] = map[string]interface{}{
			"trade_id":     t.TradeID,
			"pair":         t.Pair,
			"amount":       t.Amount,
			"stake_amount": t.StakeAmount,
			"open_rate":    t.OpenRate,
			"strategy":     t.Strategy,
		}
	}

	eventData := map[string]interface{}{
		"bot_id":      botID.String(),
		"bot_name":    botName,
		"owner_id":    ownerID,
		"bot_mode":    botMode,
		"trade_count": len(trades),
		"trades":      tradesList,
		"timestamp":   time.Now(),
	}

	// For single trade, include top-level fields for backward compatibility
	if len(trades) == 1 {
		eventData["trade_id"] = trades[0].TradeID
		eventData["pair"] = trades[0].Pair
		eventData["amount"] = trades[0].Amount
		eventData["stake_amount"] = trades[0].StakeAmount
		eventData["open_rate"] = trades[0].OpenRate
		eventData["strategy"] = trades[0].Strategy
	}

	log.Printf("Alert: Bot %s opened %d trade(s)", botName, len(trades))
	botIDStr := botID.String()
	return m.dispatchForAlertType(ctx, ownerID, enum.AlertTypeTradeOpened, enum.AlertResourceTypeBot, &botIDStr, eventData, botMode)
}

// HandleTradeClosed processes a trade closed event (single trade - legacy)
func (m *Manager) HandleTradeClosed(
	ctx context.Context,
	botID uuid.UUID,
	botName string,
	ownerID string,
	tradeID int,
	pair string,
	profitAbs float64,
	profitRatio float64,
	openRate float64,
	closeRate float64,
	exitReason string,
	botMode string,
) error {
	return m.HandleTradesClosed(ctx, botID, botName, ownerID, botMode, []TradeInfo{{
		TradeID:     tradeID,
		Pair:        pair,
		ProfitAbs:   profitAbs,
		ProfitRatio: profitRatio,
		OpenRate:    openRate,
		CloseRate:   closeRate,
		ExitReason:  exitReason,
	}})
}

// HandleTradesClosed processes multiple trade closed events in a single alert
func (m *Manager) HandleTradesClosed(
	ctx context.Context,
	botID uuid.UUID,
	botName string,
	ownerID string,
	botMode string,
	trades []TradeInfo,
) error {
	if len(trades) == 0 {
		return nil
	}

	// Calculate totals
	var totalProfitAbs, totalProfitRatio float64
	tradesList := make([]map[string]interface{}, len(trades))
	for i, t := range trades {
		totalProfitAbs += t.ProfitAbs
		totalProfitRatio += t.ProfitRatio
		tradesList[i] = map[string]interface{}{
			"trade_id":     t.TradeID,
			"pair":         t.Pair,
			"profit_abs":   t.ProfitAbs,
			"profit_ratio": t.ProfitRatio,
			"open_rate":    t.OpenRate,
			"close_rate":   t.CloseRate,
			"exit_reason":  t.ExitReason,
		}
	}

	eventData := map[string]interface{}{
		"bot_id":             botID.String(),
		"bot_name":           botName,
		"owner_id":           ownerID,
		"bot_mode":           botMode,
		"trade_count":        len(trades),
		"trades":             tradesList,
		"total_profit_abs":   totalProfitAbs,
		"total_profit_ratio": totalProfitRatio,
		"timestamp":          time.Now(),
	}

	// For single trade, include top-level fields for backward compatibility
	if len(trades) == 1 {
		eventData["trade_id"] = trades[0].TradeID
		eventData["pair"] = trades[0].Pair
		eventData["profit_abs"] = trades[0].ProfitAbs
		eventData["profit_ratio"] = trades[0].ProfitRatio
		eventData["open_rate"] = trades[0].OpenRate
		eventData["close_rate"] = trades[0].CloseRate
		eventData["exit_reason"] = trades[0].ExitReason
	}

	log.Printf("Alert: Bot %s closed %d trade(s), total profit: %.4f", botName, len(trades), totalProfitAbs)

	botIDStr := botID.String()

	// Dispatch trade_closed alert
	if err := m.dispatchForAlertType(ctx, ownerID, enum.AlertTypeTradeClosed, enum.AlertResourceTypeBot, &botIDStr, eventData, botMode); err != nil {
		log.Printf("Failed to dispatch trade_closed alert: %v", err)
	}

	// Check for large_profit_loss alert (for any trade exceeding threshold)
	rules, err := m.evaluator.FindMatchingRules(ctx, ownerID, enum.AlertTypeLargeProfitLoss, enum.AlertResourceTypeBot, &botIDStr)
	if err != nil {
		return err
	}

	rules = m.evaluator.FilterByRecipients(rules)
	rules = m.evaluator.FilterByBotMode(rules, botMode)
	for _, rule := range rules {
		// Check each trade for threshold violation
		for _, t := range trades {
			if m.evaluator.EvaluateProfitLossConditions(rule.Conditions, t.ProfitRatio) {
				// Build individual trade event for large profit/loss
				singleEventData := map[string]interface{}{
					"bot_id":       botID.String(),
					"bot_name":     botName,
					"owner_id":     ownerID,
					"trade_id":     t.TradeID,
					"pair":         t.Pair,
					"profit_abs":   t.ProfitAbs,
					"profit_ratio": t.ProfitRatio,
					"open_rate":    t.OpenRate,
					"close_rate":   t.CloseRate,
					"exit_reason":  t.ExitReason,
					"bot_mode":     botMode,
					"timestamp":    time.Now(),
				}
				if err := m.dispatcher.Dispatch(ctx, rule, singleEventData); err != nil {
					log.Printf("Failed to dispatch large_profit_loss alert: %v", err)
				}
			}
		}
	}

	return nil
}

// HandleBacktestCompleted processes a backtest completion event
func (m *Manager) HandleBacktestCompleted(
	ctx context.Context,
	backtestID uuid.UUID,
	strategyID uuid.UUID,
	strategyName string,
	ownerID string,
	success bool,
	errorMessage string,
	totalTrades int,
	winRate float64,
	profitTotal float64,
) error {
	eventData := map[string]interface{}{
		"backtest_id":   backtestID.String(),
		"strategy_id":   strategyID.String(),
		"strategy_name": strategyName,
		"owner_id":      ownerID,
		"success":       success,
		"error_message": errorMessage,
		"total_trades":  totalTrades,
		"win_rate":      winRate,
		"profit_total":  profitTotal,
		"timestamp":     time.Now(),
	}

	alertType := enum.AlertTypeBacktestCompleted
	if !success {
		alertType = enum.AlertTypeBacktestFailed
	}

	strategyIDStr := strategyID.String()
	return m.dispatchForAlertType(ctx, ownerID, alertType, enum.AlertResourceTypeStrategy, &strategyIDStr, eventData)
}

// HandlePerformanceThreshold processes a performance threshold violation
func (m *Manager) HandlePerformanceThreshold(
	ctx context.Context,
	botID uuid.UUID,
	botName string,
	ownerID string,
	alertType enum.AlertType,
	currentValue float64,
	thresholdValue float64,
) error {
	eventData := map[string]interface{}{
		"bot_id":          botID.String(),
		"bot_name":        botName,
		"owner_id":        ownerID,
		"current_value":   currentValue,
		"threshold_value": thresholdValue,
		"timestamp":       time.Now(),
	}

	botIDStr := botID.String()
	return m.dispatchForAlertType(ctx, ownerID, alertType, enum.AlertResourceTypeBot, &botIDStr, eventData)
}

// dispatchForAlertType is a helper to find rules and dispatch alerts
// botMode is optional - pass empty string for non-bot resources
func (m *Manager) dispatchForAlertType(
	ctx context.Context,
	ownerID string,
	alertType enum.AlertType,
	resourceType enum.AlertResourceType,
	resourceID *string,
	eventData map[string]interface{},
	botMode ...string,
) error {
	rules, err := m.evaluator.FindMatchingRules(ctx, ownerID, alertType, resourceType, resourceID)
	if err != nil {
		return fmt.Errorf("failed to find matching rules: %w", err)
	}

	rules = m.evaluator.FilterByRecipients(rules)

	// Filter by bot mode if provided
	if len(botMode) > 0 && botMode[0] != "" {
		rules = m.evaluator.FilterByBotMode(rules, botMode[0])
	}

	if len(rules) == 0 {
		return nil
	}

	for _, rule := range rules {
		if err := m.dispatcher.Dispatch(ctx, rule, eventData); err != nil {
			log.Printf("Failed to dispatch alert for rule %s: %v", rule.ID, err)
		}
	}

	return nil
}

// TestRule sends a test alert for the specified rule
func (m *Manager) TestRule(ctx context.Context, ruleID uuid.UUID) error {
	// Check if email channel is configured
	if m.emailChannel == nil {
		return fmt.Errorf("email channel not configured")
	}

	// Load rule
	rule, err := m.dbClient.AlertRule.Get(ctx, ruleID)
	if err != nil {
		return fmt.Errorf("failed to load rule: %w", err)
	}

	// Check permission on the rule's resource (testing is an update operation)
	if m.umaClient != nil {
		userCtx, err := auth.GetUserContext(ctx)
		if err != nil {
			return fmt.Errorf("authentication required: %w", err)
		}

		effectiveResourceID := getEffectiveResourceID(rule.ResourceID, rule.OwnerID)
		hasPermission, permErr := m.umaClient.CheckPermission(ctx, userCtx.RawToken, effectiveResourceID, "update-alert-rule")
		if permErr != nil {
			return fmt.Errorf("permission check failed: %w", permErr)
		}
		if !hasPermission {
			return fmt.Errorf("you don't have permission to test alert rules on resource %q", effectiveResourceID)
		}
	}

	// Check recipients
	if len(rule.Recipients) == 0 {
		return fmt.Errorf("rule has no recipients configured")
	}

	// Build test event data
	eventData := map[string]interface{}{
		"bot_name":      "Test Bot",
		"strategy_name": "Test Strategy",
		"pair":          "BTC/USDT",
		"old_status":    "running",
		"new_status":    "stopped",
		"profit_ratio":  0.05,
		"timestamp":     time.Now(),
		"is_test":       true,
	}

	// Send immediately (bypass cooldown and batching)
	subject, body, htmlBody := defaultTemplate(rule.AlertType, eventData)

	msg := channel.Message{
		Subject:    "[TEST] " + subject,
		Body:       body,
		HTMLBody:   htmlBody,
		Recipients: rule.Recipients,
		Metadata: map[string]interface{}{
			"test": true,
		},
	}

	return m.emailChannel.Send(ctx, msg)
}
