package monitor

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"anytrade/internal/ent"
	"anytrade/internal/ent/bot"
	"anytrade/internal/enum"
	"anytrade/internal/runner"

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
		_ = m.checkBot(ctx, b)
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
	defer rt.Close()

	// Get bot status from runner
	status, err := rt.GetBotStatus(ctx, b.ContainerID)
	if err != nil {
		// Container might not exist anymore - use errors.Is to handle wrapped errors
		if errors.Is(err, runner.ErrBotNotFound) {
			// Only log status change, not every check
			if b.Status != enum.BotStatusStopped {
				log.Printf("Bot %s (%s) container not found, marking as stopped", b.Name, b.ID)
			}
			return m.updateBotStatus(ctx, b.ID, enum.BotStatusStopped, false, nil, "Container not found")
		}
		// For other errors, mark as error status
		log.Printf("Bot %s (%s) error checking status: %v", b.Name, b.ID, err)
		return m.updateBotStatus(ctx, b.ID, enum.BotStatusError, false, nil, err.Error())
	}

	// Map runner status to enum status
	botStatus := status.Status
	healthy := status.Healthy
	lastSeenAt := status.LastSeenAt
	errorMsg := status.ErrorMessage

	// Update database
	return m.updateBotStatus(ctx, b.ID, botStatus, healthy, lastSeenAt, errorMsg)
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