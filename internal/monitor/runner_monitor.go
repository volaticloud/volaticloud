package monitor

import (
	"context"
	"fmt"
	"log"
	"time"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/botrunner"
	"volaticloud/internal/enum"
	"volaticloud/internal/pubsub"
)

const (
	// DefaultRunnerMonitorInterval is how often to check runner data status
	DefaultRunnerMonitorInterval = 5 * time.Minute

	// RunnerMonitorBatchSize is how many runners to check in parallel
	RunnerMonitorBatchSize = 5

	// DataRefreshInterval is how often data should be refreshed (24 hours)
	DataRefreshInterval = 24 * time.Hour

	// DefaultDataDownloadTimeout is the maximum time allowed for runner data downloads
	DefaultDataDownloadTimeout = 12 * time.Hour
)

// RunnerMonitor periodically checks runner data status and triggers downloads
type RunnerMonitor struct {
	dbClient            *ent.Client
	coordinator         *Coordinator
	pubsub              pubsub.PubSub
	interval            time.Duration
	dataDownloadTimeout time.Duration

	stopChan chan struct{}
	doneChan chan struct{}
}

// NewRunnerMonitor creates a new runner monitoring worker
func NewRunnerMonitor(dbClient *ent.Client, coordinator *Coordinator, ps pubsub.PubSub) *RunnerMonitor {
	return &RunnerMonitor{
		dbClient:            dbClient,
		coordinator:         coordinator,
		pubsub:              ps,
		interval:            DefaultRunnerMonitorInterval,
		dataDownloadTimeout: DefaultDataDownloadTimeout,
		stopChan:            make(chan struct{}),
		doneChan:            make(chan struct{}),
	}
}

// SetInterval sets the monitoring interval
func (m *RunnerMonitor) SetInterval(interval time.Duration) {
	m.interval = interval
}

// SetDataDownloadTimeout sets the maximum time allowed for data downloads
func (m *RunnerMonitor) SetDataDownloadTimeout(timeout time.Duration) {
	m.dataDownloadTimeout = timeout
}

// GetDataDownloadTimeout returns the configured data download timeout
func (m *RunnerMonitor) GetDataDownloadTimeout() time.Duration {
	return m.dataDownloadTimeout
}

// Start begins the monitoring loop
func (m *RunnerMonitor) Start(ctx context.Context) error {
	log.Printf("Starting runner monitor (interval: %v)", m.interval)

	go m.monitorLoop(ctx)

	return nil
}

// Stop stops the monitoring loop
func (m *RunnerMonitor) Stop() {
	close(m.stopChan)
	<-m.doneChan
}

// monitorLoop runs the periodic check loop
func (m *RunnerMonitor) monitorLoop(ctx context.Context) {
	defer close(m.doneChan)

	ticker := time.NewTicker(m.interval)
	defer ticker.Stop()

	// Run initial check immediately
	m.checkAllRunners(ctx)

	for {
		select {
		case <-ctx.Done():
			log.Println("Runner monitor stopped (context cancelled)")
			return
		case <-m.stopChan:
			log.Println("Runner monitor stopped")
			return
		case <-ticker.C:
			m.checkAllRunners(ctx)
		}
	}
}

// checkAllRunners checks all runners and triggers data downloads if needed
func (m *RunnerMonitor) checkAllRunners(ctx context.Context) {
	// Query all runners
	runners, err := m.dbClient.BotRunner.Query().
		Order(ent.Asc(botrunner.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		log.Printf("Runner monitor: failed to query runners: %v", err)
		return
	}

	if len(runners) == 0 {
		return
	}

	log.Printf("Runner monitor: checking %d runners", len(runners))

	// Check runners in batches
	for i := 0; i < len(runners); i += RunnerMonitorBatchSize {
		end := i + RunnerMonitorBatchSize
		if end > len(runners) {
			end = len(runners)
		}

		batch := runners[i:end]
		m.checkRunnerBatch(ctx, batch)
	}
}

// checkRunnerBatch checks a batch of runners in parallel
func (m *RunnerMonitor) checkRunnerBatch(ctx context.Context, runners []*ent.BotRunner) {
	for _, runner := range runners {
		// Check if this instance should monitor this runner (distributed coordination)
		if !m.coordinator.ShouldMonitor(runner.ID.String()) {
			continue
		}

		m.checkRunner(ctx, runner)
	}
}

// checkRunner checks a single runner and triggers data download if needed
func (m *RunnerMonitor) checkRunner(ctx context.Context, runner *ent.BotRunner) {
	// Check if currently downloading - verify if download is actually running
	if runner.DataDownloadStatus == enum.DataDownloadStatusDownloading {
		if m.isDownloadStuck(ctx, runner) {
			log.Printf("Runner %s: download appears to be stuck, marking as failed", runner.Name)
			m.markDownloadFailed(ctx, runner, "download process not responding (container not found)")
		} else {
			log.Printf("Runner %s: data download in progress", runner.Name)
		}
		return
	}

	needsDownload := false
	reason := ""

	// Check if data is not ready and has never been downloaded
	// Don't auto-retry failed downloads - user should manually trigger
	if !runner.DataIsReady && runner.DataDownloadStatus != enum.DataDownloadStatusFailed {
		needsDownload = true
		reason = "data not downloaded yet"
	} else if !runner.DataLastUpdated.IsZero() {
		// Check if data needs refresh (older than 24 hours)
		timeSinceUpdate := time.Since(runner.DataLastUpdated)
		if timeSinceUpdate > DataRefreshInterval {
			needsDownload = true
			reason = fmt.Sprintf("data outdated (last updated: %v ago)", timeSinceUpdate.Round(time.Hour))
		}
	}

	if needsDownload {
		log.Printf("Runner %s: triggering data download (%s)", runner.Name, reason)
		if err := m.triggerDataDownload(ctx, runner); err != nil {
			log.Printf("Runner %s: failed to trigger data download: %v", runner.Name, err)
		}
	}
}

// isDownloadStuck checks if a download process is stuck by checking time since last progress update.
// With S3 downloads, we run locally on the control plane, so we check based on time elapsed.
func (m *RunnerMonitor) isDownloadStuck(ctx context.Context, r *ent.BotRunner) bool {
	// If no start time recorded, consider it stuck
	if r.DataDownloadStartedAt == nil {
		log.Printf("Runner %s: no download start time recorded, assuming stuck", r.Name)
		return true
	}

	timeSinceStart := time.Since(*r.DataDownloadStartedAt)

	// Downloads taking more than the configured timeout are likely stuck
	if timeSinceStart > m.dataDownloadTimeout {
		log.Printf("Runner %s: download started %v ago (exceeded %v limit), assuming stuck", r.Name, timeSinceStart.Round(time.Second), m.dataDownloadTimeout)
		return true
	}

	// Get the current phase from progress
	progress := r.DataDownloadProgress
	if progress == nil {
		// No progress yet - give it 5 minutes to start
		if timeSinceStart > 5*time.Minute {
			log.Printf("Runner %s: download started %v ago but no progress info", r.Name, timeSinceStart.Round(time.Second))
			return true
		}
		return false
	}

	// For long-running downloads (up to 12 hours), we only check the hard timeout above.
	// Progress tracking ensures the download is making forward progress.
	// We don't consider phase-based stuck detection since large datasets may take hours per phase.

	return false
}

// markDownloadFailed marks a runner's download as failed
func (m *RunnerMonitor) markDownloadFailed(ctx context.Context, runner *ent.BotRunner, errorMsg string) {
	if _, err := m.dbClient.BotRunner.UpdateOne(runner).
		SetDataDownloadStatus(enum.DataDownloadStatusFailed).
		SetDataIsReady(false).
		SetDataErrorMessage(errorMsg).
		ClearDataDownloadStartedAt().
		Save(ctx); err != nil {
		log.Printf("Runner %s: failed to mark download as failed: %v", runner.Name, err)
		return
	}
	m.publishRunnerStatusEvent(ctx, runner, enum.DataDownloadStatusFailed, errorMsg)
}

// triggerDataDownload triggers the data download process for a runner
func (m *RunnerMonitor) triggerDataDownload(ctx context.Context, r *ent.BotRunner) error {
	// Update status to downloading with start timestamp
	now := time.Now()
	_, err := m.dbClient.BotRunner.UpdateOne(r).
		SetDataDownloadStatus(enum.DataDownloadStatusDownloading).
		SetDataDownloadStartedAt(now).
		SetDataDownloadProgress(map[string]interface{}{
			"pairs_completed":  0,
			"pairs_total":      0,
			"current_pair":     "",
			"percent_complete": 0.0,
		}).
		ClearDataErrorMessage().
		Save(ctx)
	if err != nil {
		return fmt.Errorf("failed to update runner status: %w", err)
	}

	// Re-query to get decrypted secrets (Save() return doesn't go through interceptors)
	r, err = m.dbClient.BotRunner.Get(ctx, r.ID)
	if err != nil {
		return fmt.Errorf("failed to reload runner: %w", err)
	}

	// Publish status change event
	m.publishRunnerStatusEvent(ctx, r, enum.DataDownloadStatusDownloading, "")

	// Launch data download in a goroutine
	go func() {
		downloadCtx, cancel := context.WithTimeout(context.Background(), m.dataDownloadTimeout)
		defer cancel()

		if err := DownloadRunnerData(downloadCtx, m.dbClient, r, m.pubsub); err != nil {
			log.Printf("Runner %s: data download failed: %v", r.Name, err)

			// Update status to failed
			if _, saveErr := m.dbClient.BotRunner.UpdateOne(r).
				SetDataDownloadStatus(enum.DataDownloadStatusFailed).
				SetDataIsReady(false).
				SetDataErrorMessage(err.Error()).
				ClearDataDownloadStartedAt().
				Save(context.Background()); saveErr != nil {
				log.Printf("Runner %s: failed to update runner status after download error: %v", r.Name, saveErr)
			} else {
				m.publishRunnerStatusEvent(context.Background(), r, enum.DataDownloadStatusFailed, err.Error())
			}
		} else {
			log.Printf("Runner %s: data download completed successfully", r.Name)

			// Update status to completed
			completedAt := time.Now()
			if _, saveErr := m.dbClient.BotRunner.UpdateOne(r).
				SetDataDownloadStatus(enum.DataDownloadStatusCompleted).
				SetDataIsReady(true).
				SetDataLastUpdated(completedAt).
				ClearDataErrorMessage().
				ClearDataDownloadProgress().
				ClearDataDownloadStartedAt().
				Save(context.Background()); saveErr != nil {
				log.Printf("Runner %s: failed to update runner status after successful download: %v", r.Name, saveErr)
			} else {
				m.publishRunnerStatusEvent(context.Background(), r, enum.DataDownloadStatusCompleted, "")
			}
		}
	}()

	return nil
}

// publishRunnerStatusEvent publishes a runner status change event to pub/sub
func (m *RunnerMonitor) publishRunnerStatusEvent(ctx context.Context, r *ent.BotRunner, status enum.DataDownloadStatus, errorMsg string) {
	if m.pubsub == nil {
		return
	}

	event := pubsub.RunnerEvent{
		Type:      pubsub.EventTypeRunnerStatus,
		RunnerID:  r.ID.String(),
		Status:    string(status),
		Error:     errorMsg,
		Timestamp: time.Now(),
	}

	// Publish to runner-specific topic (for detail views)
	topic := pubsub.RunnerTopic(r.ID.String())
	if err := m.pubsub.Publish(ctx, topic, event); err != nil {
		log.Printf("Runner %s: failed to publish status event: %v", r.Name, err)
	}

	// Also publish to org-level topic (for list views)
	orgTopic := pubsub.OrgRunnersTopic(r.OwnerID)
	if err := m.pubsub.Publish(ctx, orgTopic, event); err != nil {
		log.Printf("Runner %s: failed to publish org status event: %v", r.Name, err)
	}
}
