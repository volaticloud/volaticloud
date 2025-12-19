package monitor

import (
	"context"
	"fmt"
	"log"
	"time"

	"volaticloud/internal/docker"
	"volaticloud/internal/ent"
	"volaticloud/internal/ent/botrunner"
	"volaticloud/internal/enum"
	"volaticloud/internal/runner"
)

const (
	// DefaultRunnerMonitorInterval is how often to check runner data status
	DefaultRunnerMonitorInterval = 5 * time.Minute

	// RunnerMonitorBatchSize is how many runners to check in parallel
	RunnerMonitorBatchSize = 5

	// DataRefreshInterval is how often data should be refreshed (24 hours)
	DataRefreshInterval = 24 * time.Hour
)

// RunnerMonitor periodically checks runner data status and triggers downloads
type RunnerMonitor struct {
	dbClient    *ent.Client
	coordinator *Coordinator
	interval    time.Duration

	stopChan chan struct{}
	doneChan chan struct{}
}

// NewRunnerMonitor creates a new runner monitoring worker
func NewRunnerMonitor(dbClient *ent.Client, coordinator *Coordinator) *RunnerMonitor {
	return &RunnerMonitor{
		dbClient:    dbClient,
		coordinator: coordinator,
		interval:    DefaultRunnerMonitorInterval,
		stopChan:    make(chan struct{}),
		doneChan:    make(chan struct{}),
	}
}

// SetInterval sets the monitoring interval
func (m *RunnerMonitor) SetInterval(interval time.Duration) {
	m.interval = interval
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

// isDownloadStuck checks if a download process is stuck by verifying container status
func (m *RunnerMonitor) isDownloadStuck(ctx context.Context, r *ent.BotRunner) bool {
	// If no start time recorded, consider it stuck (legacy case)
	if r.DataDownloadStartedAt == nil {
		log.Printf("Runner %s: no download start time recorded, assuming stuck", r.Name)
		return true
	}

	// Get the current exchange being downloaded from progress
	progress := r.DataDownloadProgress
	currentExchange := ""
	if progress != nil {
		if ce, ok := progress["current_pair"].(string); ok {
			currentExchange = ce
		}
	}

	// If no exchange info yet, the download just started - give it some time
	// Only consider stuck if started more than 5 minutes ago without exchange info
	if currentExchange == "" {
		timeSinceStart := time.Since(*r.DataDownloadStartedAt)
		if timeSinceStart < 5*time.Minute {
			// Just started, not stuck yet
			return false
		}
		log.Printf("Runner %s: download started %v ago but no exchange info in progress", r.Name, timeSinceStart.Round(time.Second))
		return true
	}

	// Create Docker client to check container status
	factory := runner.NewFactory()
	rt, err := factory.Create(ctx, r.Type, r.Config)
	if err != nil {
		log.Printf("Runner %s: failed to create runtime for status check: %v", r.Name, err)
		return false // Can't determine, don't mark as stuck
	}
	defer func() {
		if err := rt.Close(); err != nil {
			log.Printf("Warning: failed to close runtime: %v", err)
		}
	}()

	dockerRT, ok := rt.(*docker.Runtime)
	if !ok {
		return false
	}

	cli := dockerRT.GetClient()
	containerName := GetDataDownloadContainerName(r.ID.String(), currentExchange)

	running, exists, err := CheckDownloadContainerStatus(ctx, cli, containerName)
	if err != nil {
		log.Printf("Runner %s: failed to check container status: %v", r.Name, err)
		return false
	}

	// If container is running, download is in progress
	if running {
		return false
	}

	// Container doesn't exist or stopped - check if it's been too long since download started
	if !exists {
		// Container was auto-removed (completed or failed) but status not updated
		// This means the goroutine handling the download crashed or DB update failed
		log.Printf("Runner %s: container %s not found but status is downloading", r.Name, containerName)
		return true
	}

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
	}
}

// triggerDataDownload triggers the data download process for a runner
func (m *RunnerMonitor) triggerDataDownload(ctx context.Context, r *ent.BotRunner) error {
	// Update status to downloading with start timestamp
	now := time.Now()
	r, err := m.dbClient.BotRunner.UpdateOne(r).
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

	// Launch data download in a goroutine
	go func() {
		downloadCtx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()

		if err := DownloadRunnerData(downloadCtx, m.dbClient, r); err != nil {
			log.Printf("Runner %s: data download failed: %v", r.Name, err)

			// Update status to failed
			if _, saveErr := m.dbClient.BotRunner.UpdateOne(r).
				SetDataDownloadStatus(enum.DataDownloadStatusFailed).
				SetDataIsReady(false).
				SetDataErrorMessage(err.Error()).
				ClearDataDownloadStartedAt().
				Save(context.Background()); saveErr != nil {
				log.Printf("Runner %s: failed to update runner status after download error: %v", r.Name, saveErr)
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
			}
		}
	}()

	return nil
}
