package monitor

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/bot"
	"volaticloud/internal/ent/botmetrics"
	"volaticloud/internal/enum"
	"volaticloud/internal/freqtrade"
	"volaticloud/internal/runner"
	"volaticloud/internal/usage"

	"github.com/google/uuid"
)

const (
	// DefaultMonitorInterval is how often to check bot status
	DefaultMonitorInterval = 30 * time.Second

	// MonitorBatchSize is how many bots to check in parallel
	MonitorBatchSize = 10
)

// BotMonitor periodically checks bot status and updates the database
type BotMonitor struct {
	dbClient       *ent.Client
	coordinator    *Coordinator
	usageCollector usage.Collector
	interval       time.Duration

	stopChan chan struct{}
	doneChan chan struct{}
}

// NewBotMonitor creates a new bot monitoring worker
func NewBotMonitor(dbClient *ent.Client, coordinator *Coordinator) *BotMonitor {
	return &BotMonitor{
		dbClient:       dbClient,
		coordinator:    coordinator,
		usageCollector: usage.NewCollector(dbClient),
		interval:       DefaultMonitorInterval,
		stopChan:       make(chan struct{}),
		doneChan:       make(chan struct{}),
	}
}

// SetInterval sets the monitoring interval
func (m *BotMonitor) SetInterval(interval time.Duration) {
	m.interval = interval
}

// Start begins the monitoring loop
func (m *BotMonitor) Start(ctx context.Context) error {
	log.Printf("Starting bot monitor (interval: %v)", m.interval)

	go m.monitorLoop(ctx)

	return nil
}

// Stop stops the monitoring loop
func (m *BotMonitor) Stop() {
	close(m.stopChan)
	<-m.doneChan
	log.Println("Bot monitor stopped")
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
			log.Println("Bot assignments changed, rechecking bots")
			m.checkAllBots(ctx)
		}
	}
}

// checkAllBots checks status of all bots assigned to this instance
func (m *BotMonitor) checkAllBots(ctx context.Context) {
	// Query all bots from database
	// Include Error status so bots can recover from transient network failures
	bots, err := m.dbClient.Bot.Query().
		WithRunner().
		Where(bot.StatusIn(
			enum.BotStatusRunning,
			enum.BotStatusUnhealthy,
			enum.BotStatusStopped,
			enum.BotStatusCreating,
			enum.BotStatusError,
		)).
		All(ctx)
	if err != nil {
		log.Printf("Failed to query bots: %v", err)
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
		// log.Printf("No bots assigned to this instance (%d total bots)", len(bots))
		return
	}

	log.Printf("Checking %d bots (assigned out of %d total)", len(assignedBots), len(bots))

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
	for _, b := range bots {
		// Check each bot - errors are already logged inside checkBot
		if err := m.checkBot(ctx, b); err != nil {
			log.Printf("Bot %s (%s) check failed: %v", b.Name, b.ID, err)
		}
	}
}

// checkBot checks a single bot's status and updates the database
func (m *BotMonitor) checkBot(ctx context.Context, b *ent.Bot) error {
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
			log.Printf("Warning: failed to close runtime: %v", err)
		}
	}()

	// Get bot status from runner (container name derived from bot ID)
	status, err := rt.GetBotStatus(ctx, b.ID.String())
	if err != nil {
		// Container might not exist anymore - use errors.Is to handle wrapped errors
		if errors.Is(err, runner.ErrBotNotFound) {
			// Only log status change, not every check
			if b.Status != enum.BotStatusStopped {
				log.Printf("Bot %s (%s) container not found, marking as stopped", b.Name, b.ID)
			}
			return m.updateBotStatus(ctx, b.ID, enum.BotStatusStopped, false, nil, "Container not found")
		}
		// For other errors (network issues, etc.), mark as error status
		// Only log if status is changing to avoid log spam during persistent issues
		if b.Status != enum.BotStatusError {
			log.Printf("Bot %s (%s) error checking status (will retry): %v", b.Name, b.ID, err)
		}
		return m.updateBotStatus(ctx, b.ID, enum.BotStatusError, false, nil, err.Error())
	}

	// If bot was in error state and successfully recovered, log it
	if b.Status == enum.BotStatusError {
		log.Printf("Bot %s (%s) recovered from error state", b.Name, b.ID)
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
		if err := m.fetchAndUpdateBotMetrics(ctx, b, rt); err != nil {
			// Log error but don't fail the status check
			log.Printf("Bot %s (%s) failed to fetch metrics: %v", b.Name, b.ID, err)
		}
	}

	// Record usage sample if billing is enabled for this runner
	if botRunner.BillingEnabled && botStatus == enum.BotStatusRunning {
		if err := m.usageCollector.RecordSample(ctx, usage.UsageSample{
			ResourceType:    enum.ResourceTypeBot,
			ResourceID:      b.ID,
			OwnerID:         b.OwnerID,
			RunnerID:        botRunner.ID,
			CPUPercent:      status.CPUUsage,
			MemoryBytes:     status.MemoryUsage,
			NetworkRxBytes:  status.NetworkRxBytes,
			NetworkTxBytes:  status.NetworkTxBytes,
			BlockReadBytes:  status.BlockReadBytes,
			BlockWriteBytes: status.BlockWriteBytes,
			SampledAt:       time.Now(),
		}); err != nil {
			// Log error but don't fail the status check
			log.Printf("Bot %s (%s) failed to record usage sample: %v", b.Name, b.ID, err)
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
// Uses the runtime's GetBotHTTPClient to handle access across different environments:
// - Docker: direct connection or mapped port
// - Kubernetes in-cluster: service DNS
// - Kubernetes outside cluster: API server proxy
func (m *BotMonitor) fetchAndUpdateBotMetrics(ctx context.Context, b *ent.Bot, rt runner.Runtime) error {
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

	// Get HTTP client and base URL from runtime
	// This handles Docker, K8s in-cluster, and K8s API server proxy automatically
	httpClient, baseURL, err := rt.GetBotHTTPClient(ctx, b.ID.String())
	if err != nil {
		return fmt.Errorf("failed to get bot HTTP client: %w", err)
	}

	// Create Freqtrade client with the runtime-provided HTTP client
	ftClient := freqtrade.NewBotClientWithHTTPClient(baseURL, username, password, httpClient)

	// Fetch profit metrics
	profit, err := ftClient.GetProfit(ctx)
	if err != nil {
		return fmt.Errorf("failed to fetch profit from %s: %w", baseURL, err)
	}

	// Metrics fetched successfully - no need to log every success

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

	// Calculate open trade count (total trades - closed trades)
	openTradeCount := int(profit.TradeCount - profit.ClosedTradeCount)

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
			SetOpenTradeCount(openTradeCount).
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
			SetOpenTradeCount(openTradeCount).
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
