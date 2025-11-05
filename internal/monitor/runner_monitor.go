package monitor

import (
	"context"
	"fmt"
	"log"
	"time"

	"anytrade/internal/ent"
	"anytrade/internal/ent/botrunner"
	"anytrade/internal/enum"
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
	// Skip if currently downloading
	if runner.DataDownloadStatus == enum.DataDownloadStatusDownloading {
		log.Printf("Runner %s: data download already in progress", runner.Name)
		return
	}

	needsDownload := false
	reason := ""

	// Check if data is not ready
	if !runner.DataIsReady {
		needsDownload = true
		reason = "data not downloaded yet"
	} else if runner.DataDownloadStatus == enum.DataDownloadStatusFailed {
		// Retry failed downloads
		needsDownload = true
		reason = "retrying failed download"
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

// triggerDataDownload triggers the data download process for a runner
func (m *RunnerMonitor) triggerDataDownload(ctx context.Context, runner *ent.BotRunner) error {
	// Update status to downloading
	runner, err := m.dbClient.BotRunner.UpdateOne(runner).
		SetDataDownloadStatus(enum.DataDownloadStatusDownloading).
		SetDataDownloadProgress(map[string]interface{}{
			"pairs_completed": 0,
			"pairs_total":     0,
			"current_pair":    "",
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

		if err := DownloadRunnerData(downloadCtx, m.dbClient, runner); err != nil {
			log.Printf("Runner %s: data download failed: %v", runner.Name, err)

			// Update status to failed
			if _, saveErr := m.dbClient.BotRunner.UpdateOne(runner).
				SetDataDownloadStatus(enum.DataDownloadStatusFailed).
				SetDataIsReady(false).
				SetDataErrorMessage(err.Error()).
				Save(context.Background()); saveErr != nil {
				log.Printf("Runner %s: failed to update runner status after download error: %v", runner.Name, saveErr)
			}
		} else {
			log.Printf("Runner %s: data download completed successfully", runner.Name)

			// Update status to completed
			now := time.Now()
			if _, saveErr := m.dbClient.BotRunner.UpdateOne(runner).
				SetDataDownloadStatus(enum.DataDownloadStatusCompleted).
				SetDataIsReady(true).
				SetDataLastUpdated(now).
				ClearDataErrorMessage().
				ClearDataDownloadProgress().
				Save(context.Background()); saveErr != nil {
				log.Printf("Runner %s: failed to update runner status after successful download: %v", runner.Name, saveErr)
			}
		}
	}()

	return nil
}
