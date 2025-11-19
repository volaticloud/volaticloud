package monitor

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"volaticloud/internal/ent"
	"volaticloud/internal/ent/bot"
	"volaticloud/internal/ent/botmetrics"
	"volaticloud/internal/enum"
	"volaticloud/internal/freqtrade"
	"volaticloud/internal/logger"
	"volaticloud/internal/runner"
)

const (
	// DefaultMonitorInterval is how often to check bot status
	DefaultMonitorInterval = 30 * time.Second

	// MonitorBatchSize is how many bots to check in parallel
	MonitorBatchSize = 10
)

// BotMonitor periodically checks bot status and updates the database
type BotMonitor struct {
	dbClient    *ent.Client
	coordinator *Coordinator
	interval    time.Duration

	stopChan chan struct{}
	doneChan chan struct{}
}

// NewBotMonitor creates a new bot monitoring worker
func NewBotMonitor(dbClient *ent.Client, coordinator *Coordinator) *BotMonitor {
	return &BotMonitor{
		dbClient:    dbClient,
		coordinator: coordinator,
		interval:    DefaultMonitorInterval,
		stopChan:    make(chan struct{}),
		doneChan:    make(chan struct{}),
	}
}

// SetInterval sets the monitoring interval
func (m *BotMonitor) SetInterval(interval time.Duration) {
	m.interval = interval
}

// Start begins the monitoring loop
func (m *BotMonitor) Start(ctx context.Context) error {
	ctx = logger.WithComponent(ctx, "monitor.bot")
	log := logger.GetLogger(ctx)

	log.Info("Starting bot monitor", zap.Duration("interval", m.interval))

	go m.monitorLoop(ctx)

	return nil
}

// Stop stops the monitoring loop
func (m *BotMonitor) Stop() {
	close(m.stopChan)
	<-m.doneChan

	// Use background context for cleanup logging
	log := logger.GetLogger(context.Background())
	log.Info("Bot monitor stopped")
}

// monitorLoop is the main monitoring loop
func (m *BotMonitor) monitorLoop(ctx context.Context) {
	defer close(m.doneChan)

	// Do initial check immediately
	m.checkAllBots(ctx)

	ticker := time.NewTicker(m.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-m.stopChan:
			return
		case <-ticker.C:
			m.checkAllBots(ctx)
		case <-m.coordinator.AssignmentChanges():
			// Assignments changed (instance joined/left), recheck immediately
			log := logger.GetLogger(ctx)
			log.Info("Bot assignments changed, rechecking bots")
			m.checkAllBots(ctx)
		}
	}
}

// checkAllBots checks status of all bots assigned to this instance
func (m *BotMonitor) checkAllBots(ctx context.Context) {
	log := logger.GetLogger(ctx)

	// Query all bots from database
	bots, err := m.dbClient.Bot.Query().
		WithRunner().
		Where(bot.StatusIn(
			enum.BotStatusRunning,
			enum.BotStatusUnhealthy,
			enum.BotStatusStopped,
			enum.BotStatusCreating,
		)).
		All(ctx)
	if err != nil {
		log.Error("Failed to query bots", zap.Error(err))
		return
	}

	// Filter bots assigned to this instance
	botIDs := make([]string, len(bots))
	for i, b := range bots {
		botIDs[i] = b.ID.String()
	}

	assignedBotIDs := m.coordinator.GetAssignedBots(botIDs)
	assignedBotMap := make(map[string]bool, len(assignedBotIDs))
	for _, id := range assignedBotIDs {
		assignedBotMap[id] = true
	}

	// Check only assigned bots
	assignedBots := make([]*ent.Bot, 0, len(assignedBotMap))
	for _, b := range bots {
		if assignedBotMap[b.ID.String()] {
			assignedBots = append(assignedBots, b)
		}
	}

	if len(assignedBots) == 0 {
		// No logging for normal case
		return
	}

	log.Info("Checking assigned bots",
		zap.Int("assigned_count", len(assignedBots)),
		zap.Int("total_count", len(bots)))

	// Check bots in batches
	for i := 0; i < len(assignedBots); i += MonitorBatchSize {
		end := i + MonitorBatchSize
		if end > len(assignedBots) {
			end = len(assignedBots)
		}

		batch := assignedBots[i:end]
		m.checkBotBatch(ctx, batch)

		// Small delay between batches to avoid overwhelming the system
		if end < len(assignedBots) {
			time.Sleep(100 * time.Millisecond)
		}
	}
}

// checkBotBatch checks a batch of bots concurrently
func (m *BotMonitor) checkBotBatch(ctx context.Context, bots []*ent.Bot) {
	log := logger.GetLogger(ctx)

	for _, b := range bots {
		// Check each bot - errors are already logged inside checkBot
		if err := m.checkBot(ctx, b); err != nil {
			log.Error("Bot check failed",
				zap.String("bot_name", b.Name),
				zap.String("bot_id", b.ID.String()),
				zap.Error(err))
		}
	}
}

// checkBot checks a single bot's status and updates the database
func (m *BotMonitor) checkBot(ctx context.Context, b *ent.Bot) error {
	// Skip if bot has no container ID (not yet deployed)
	if b.ContainerID == "" {
		return nil
	}

	// Get runner
	botRunner := b.Edges.Runner
	if botRunner == nil {
		return fmt.Errorf("bot has no runner")
	}

	// Create runner client
	factory := runner.NewFactory()
	rt, err := factory.Create(ctx, botRunner.Type, botRunner.Config)
	if err != nil {
		return fmt.Errorf("failed to create runner client: %w", err)
	}
	defer func() {
		if err := rt.Close(); err != nil {
			log := logger.GetLogger(ctx)
			log.Warn("Failed to close runtime", zap.Error(err))
		}
	}()

	// Get bot status from runner
	status, err := rt.GetBotStatus(ctx, b.ContainerID)
	if err != nil {
		log := logger.GetLogger(ctx)

		// Container might not exist anymore - use errors.Is to handle wrapped errors
		if errors.Is(err, runner.ErrBotNotFound) {
			// Only log status change, not every check
			if b.Status != enum.BotStatusStopped {
				log.Info("Bot container not found, marking as stopped",
					zap.String("bot_name", b.Name),
					zap.String("bot_id", b.ID.String()))
			}
			return m.updateBotStatus(ctx, b.ID, enum.BotStatusStopped, false, nil, "Container not found")
		}
		// For other errors, mark as error status
		log.Error("Error checking bot status",
			zap.String("bot_name", b.Name),
			zap.String("bot_id", b.ID.String()),
			zap.Error(err))
		return m.updateBotStatus(ctx, b.ID, enum.BotStatusError, false, nil, err.Error())
	}

	// Map runner status to enum status
	botStatus := status.Status
	healthy := status.Healthy
	lastSeenAt := status.LastSeenAt
	errorMsg := status.ErrorMessage

	// Update database
	err = m.updateBotStatus(ctx, b.ID, botStatus, healthy, lastSeenAt, errorMsg)
	if err != nil {
		return err
	}

	// Fetch and update bot metrics if bot is running and healthy
	if botStatus == enum.BotStatusRunning && healthy {
		if err := m.fetchAndUpdateBotMetrics(ctx, b, status); err != nil {
			// Log error but don't fail the status check
			log := logger.GetLogger(ctx)
			log.Error("Failed to fetch bot metrics",
				zap.String("bot_name", b.Name),
				zap.String("bot_id", b.ID.String()),
				zap.Error(err))
		}
	}

	return nil
}

// updateBotStatus updates bot status in the database
func (m *BotMonitor) updateBotStatus(ctx context.Context, botID uuid.UUID, status enum.BotStatus, healthy bool, lastSeenAt *time.Time, errorMsg string) error {
	update := m.dbClient.Bot.UpdateOneID(botID).
		SetStatus(status)

	if lastSeenAt != nil {
		update = update.SetLastSeenAt(*lastSeenAt)
	}

	if errorMsg != "" {
		update = update.SetErrorMessage(errorMsg)
	} else {
		update = update.ClearErrorMessage()
	}

	_, err := update.Save(ctx)
	if err != nil {
		return fmt.Errorf("failed to update bot status: %w", err)
	}

	return nil
}

// fetchAndUpdateBotMetrics fetches metrics from Freqtrade API and updates BotMetrics entity
func (m *BotMonitor) fetchAndUpdateBotMetrics(ctx context.Context, b *ent.Bot, status *runner.BotStatus) error {
	// Extract API credentials from secure_config
	secureConfig := b.SecureConfig
	if secureConfig == nil {
		return fmt.Errorf("bot has no secure_config")
	}

	apiServerConfig, ok := secureConfig["api_server"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("secure_config has no api_server configuration")
	}

	username, ok := apiServerConfig["username"].(string)
	if !ok || username == "" {
		return fmt.Errorf("api_server has no username")
	}

	password, ok := apiServerConfig["password"].(string)
	if !ok || password == "" {
		return fmt.Errorf("api_server has no password")
	}

	// Get API port from secure_config or use default
	apiPort := 8080
	if listenPort, ok := apiServerConfig["listen_port"].(float64); ok {
		apiPort = int(listenPort)
	}

	// Try to fetch metrics with fallback:
	// 1. Try container IP first (works when server is in same Docker network)
	// 2. Fallback to localhost:hostPort (works when server is on host machine)
	var profit *freqtrade.Profit
	var err error
	log := logger.GetLogger(ctx)

	// Try container IP first with short timeout
	if status.IPAddress != "" {
		containerCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
		defer cancel()

		client := freqtrade.NewBotClientFromContainerIP(status.IPAddress, apiPort, username, password)
		profit, err = client.GetProfit(containerCtx)

		if err == nil {
			// Success with container IP
			goto processMetrics
		}
		// Log the container IP failure but continue to fallback
		log.Warn("Container IP connection failed, trying localhost fallback",
			zap.String("bot_name", b.Name),
			zap.String("container_ip", status.IPAddress),
			zap.Error(err))
	}

	// Fallback to localhost:hostPort
	if status.HostPort > 0 {
		localhostURL := fmt.Sprintf("http://localhost:%d", status.HostPort)
		client := freqtrade.NewBotClient(localhostURL, username, password)
		profit, err = client.GetProfit(ctx)

		if err == nil {
			// Success with localhost
			log.Info("Successfully connected via localhost",
				zap.String("bot_name", b.Name),
				zap.Int("host_port", status.HostPort))
			goto processMetrics
		}
		return fmt.Errorf("failed to fetch profit from both container IP and localhost: %w", err)
	}

	return fmt.Errorf("no accessible endpoint: container IP=%s, hostPort=%d", status.IPAddress, status.HostPort)

processMetrics:

	// Convert timestamps from Unix to time.Time
	var firstTradeTime, latestTradeTime *time.Time
	if profit.FirstTradeTimestamp != 0 {
		t := time.Unix(int64(profit.FirstTradeTimestamp), 0)
		firstTradeTime = &t
	}
	if profit.LatestTradeTimestamp != 0 {
		t := time.Unix(int64(profit.LatestTradeTimestamp), 0)
		latestTradeTime = &t
	}

	// Check if bot metrics already exist
	existingMetrics, err := m.dbClient.BotMetrics.Query().
		Where(botmetrics.BotIDEQ(b.ID)).
		Only(ctx)

	if err != nil && !ent.IsNotFound(err) {
		return fmt.Errorf("failed to query bot metrics: %w", err)
	}

	// Update or create BotMetrics
	if existingMetrics != nil {
		// Update existing metrics
		err = m.dbClient.BotMetrics.
			UpdateOneID(existingMetrics.ID).
			SetProfitClosedCoin(float64(profit.ProfitClosedCoin)).
			SetProfitClosedPercent(float64(profit.ProfitClosedPercent)).
			SetProfitAllCoin(float64(profit.ProfitAllCoin)).
			SetProfitAllPercent(float64(profit.ProfitAllPercent)).
			SetTradeCount(int(profit.TradeCount)).
			SetClosedTradeCount(int(profit.ClosedTradeCount)).
			SetWinningTrades(int(profit.WinningTrades)).
			SetLosingTrades(int(profit.LosingTrades)).
			SetWinrate(float64(profit.Winrate)).
			SetExpectancy(float64(profit.Expectancy)).
			SetProfitFactor(float64(profit.ProfitFactor)).
			SetMaxDrawdown(float64(profit.MaxDrawdown)).
			SetMaxDrawdownAbs(float64(profit.MaxDrawdownAbs)).
			SetBestPair(profit.BestPair).
			SetBestRate(float64(profit.BestRate)).
			SetNillableFirstTradeTimestamp(firstTradeTime).
			SetNillableLatestTradeTimestamp(latestTradeTime).
			SetFetchedAt(time.Now()).
			Exec(ctx)
	} else {
		// Create new metrics
		err = m.dbClient.BotMetrics.
			Create().
			SetBotID(b.ID).
			SetProfitClosedCoin(float64(profit.ProfitClosedCoin)).
			SetProfitClosedPercent(float64(profit.ProfitClosedPercent)).
			SetProfitAllCoin(float64(profit.ProfitAllCoin)).
			SetProfitAllPercent(float64(profit.ProfitAllPercent)).
			SetTradeCount(int(profit.TradeCount)).
			SetClosedTradeCount(int(profit.ClosedTradeCount)).
			SetWinningTrades(int(profit.WinningTrades)).
			SetLosingTrades(int(profit.LosingTrades)).
			SetWinrate(float64(profit.Winrate)).
			SetExpectancy(float64(profit.Expectancy)).
			SetProfitFactor(float64(profit.ProfitFactor)).
			SetMaxDrawdown(float64(profit.MaxDrawdown)).
			SetMaxDrawdownAbs(float64(profit.MaxDrawdownAbs)).
			SetBestPair(profit.BestPair).
			SetBestRate(float64(profit.BestRate)).
			SetNillableFirstTradeTimestamp(firstTradeTime).
			SetNillableLatestTradeTimestamp(latestTradeTime).
			SetFetchedAt(time.Now()).
			Exec(ctx)
	}

	if err != nil {
		return fmt.Errorf("failed to upsert bot metrics: %w", err)
	}

	return nil
}
