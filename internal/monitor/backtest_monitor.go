package monitor

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"go.uber.org/zap"

	"volaticloud/internal/backtest"
	"volaticloud/internal/ent"
	entbacktest "volaticloud/internal/ent/backtest"
	"volaticloud/internal/enum"
	"volaticloud/internal/logger"
	"volaticloud/internal/runner"
)

// BacktestMonitor monitors running backtests and updates their status
type BacktestMonitor struct {
	client   *ent.Client
	interval time.Duration
	stopChan chan struct{}
}

// NewBacktestMonitor creates a new backtest monitor
func NewBacktestMonitor(client *ent.Client, interval time.Duration) *BacktestMonitor {
	if interval == 0 {
		interval = 30 * time.Second // Default to 30 seconds
	}

	return &BacktestMonitor{
		client:   client,
		interval: interval,
		stopChan: make(chan struct{}),
	}
}

// Start begins monitoring backtests
func (m *BacktestMonitor) Start(ctx context.Context) {
	// Create sub-logger for backtest monitor
	ctx = logger.WithComponent(ctx, "backtest-monitor")
	log := logger.GetLogger(ctx)

	log.Info("Starting backtest monitor", zap.Duration("interval", m.interval))

	ticker := time.NewTicker(m.interval)
	defer ticker.Stop()

	// Run once immediately
	m.checkBacktests(ctx)

	for {
		select {
		case <-ctx.Done():
			log.Info("Backtest monitor stopped (context cancelled)")
			return
		case <-m.stopChan:
			log.Info("Backtest monitor stopped")
			return
		case <-ticker.C:
			m.checkBacktests(ctx)
		}
	}
}

// Stop stops the monitor
func (m *BacktestMonitor) Stop() {
	close(m.stopChan)
}

// checkBacktests checks all running backtests and updates their status
func (m *BacktestMonitor) checkBacktests(ctx context.Context) {
	log := logger.GetLogger(ctx)

	// Query all running backtests
	backtests, err := m.client.Backtest.Query().
		Where(entbacktest.StatusEQ(enum.TaskStatusRunning)).
		WithRunner().
		WithStrategy().
		All(ctx)
	if err != nil {
		log.Error("Error querying running backtests", zap.Error(err))
		return
	}

	if len(backtests) == 0 {
		return
	}

	log.Info("Checking running backtests", zap.Int("count", len(backtests)))

	for _, bt := range backtests {
		m.checkBacktest(ctx, bt)
	}
}

// checkBacktest checks a single backtest and updates its status
func (m *BacktestMonitor) checkBacktest(ctx context.Context, bt *ent.Backtest) {
	// Create sub-logger with backtest context
	ctx = logger.WithFields(ctx, zap.String("backtest_id", bt.ID.String()))
	log := logger.GetLogger(ctx)

	// Skip if no container ID
	if bt.ContainerID == "" {
		log.Warn("Backtest has no container ID, skipping")
		return
	}

	// Get runner
	if bt.Edges.Runner == nil {
		log.Warn("Backtest has no runner, skipping")
		return
	}

	// Create runner client
	factory := runner.NewFactory()
	backtestRunner, err := factory.CreateBacktestRunner(ctx, bt.Edges.Runner.Type, bt.Edges.Runner.Config)
	if err != nil {
		log.Error("Failed to create backtest runner", zap.Error(err))
		return
	}
	defer func() {
		if err := backtestRunner.Close(); err != nil {
			log.Warn("Failed to close backtest runner", zap.Error(err))
		}
	}()

	// Get backtest status
	status, err := backtestRunner.GetBacktestStatus(ctx, bt.ID.String())
	if err != nil {
		log.Error("Failed to get backtest status", zap.Error(err))
		return
	}

	// Check if status changed
	if status.Status == bt.Status {
		return // Still running
	}

	log.Info("Backtest status changed",
		zap.String("old_status", string(bt.Status)),
		zap.String("new_status", string(status.Status)))

	// Update backtest based on new status
	switch status.Status {
	case enum.TaskStatusCompleted:
		m.handleCompletedBacktest(ctx, bt, backtestRunner)
	case enum.TaskStatusFailed:
		m.handleFailedBacktest(ctx, bt, backtestRunner)
	}
}

// handleCompletedBacktest handles a completed backtest
func (m *BacktestMonitor) handleCompletedBacktest(ctx context.Context, bt *ent.Backtest, backtestRunner runner.BacktestRunner) {
	log := logger.GetLogger(ctx)
	log.Info("Backtest completed, fetching results...")

	// Get backtest results (includes parsing)
	result, err := backtestRunner.GetBacktestResult(ctx, bt.ID.String())
	if err != nil {
		log.Error("Failed to get backtest results", zap.Error(err))
		// Mark as completed but without results
		if _, saveErr := m.client.Backtest.UpdateOneID(bt.ID).
			SetStatus(enum.TaskStatusCompleted).
			SetCompletedAt(time.Now()).
			SetErrorMessage("Failed to retrieve results").
			Save(ctx); saveErr != nil {
			log.Error("Failed to update backtest after result error", zap.Error(saveErr))
		}
		return
	}

	// Extract typed summary from result
	summary, err := backtest.ExtractSummaryFromResult(result.RawResult)
	if err != nil {
		log.Warn("Failed to extract summary from backtest result", zap.Error(err))
		// Continue without summary - it's optional
	}

	// Update backtest with results
	update := m.client.Backtest.UpdateOneID(bt.ID).
		SetStatus(enum.TaskStatusCompleted).
		SetResult(result.RawResult)

	// Store summary if successfully extracted
	if summary != nil {
		summaryJSON, err := json.Marshal(summary)
		if err == nil {
			var summaryMap map[string]interface{}
			if err := json.Unmarshal(summaryJSON, &summaryMap); err == nil {
				update = update.SetSummary(summaryMap)
				log.Info("Backtest summary extracted",
					zap.Int("total_trades", summary.TotalTrades),
					zap.Float64("profit", summary.ProfitTotalAbs))
			}
		}
	}

	// Store logs from container execution
	if result.Logs != "" {
		update = update.SetLogs(result.Logs)
		log.Info("Backtest logs captured", zap.Int("bytes", len(result.Logs)))
	}

	if result.CompletedAt != nil {
		update = update.SetCompletedAt(*result.CompletedAt)
	} else {
		update = update.SetCompletedAt(time.Now())
	}

	if result.ErrorMessage != "" {
		update = update.SetErrorMessage(result.ErrorMessage)
	} else {
		update = update.ClearErrorMessage()
	}

	_, err = update.Save(ctx)
	if err != nil {
		log.Error("Failed to update backtest", zap.Error(err))
		return
	}

	log.Info("Backtest completed successfully, results saved")

	// Cleanup container after successfully saving results
	if err := backtestRunner.DeleteBacktest(ctx, bt.ID.String()); err != nil {
		log.Warn("Failed to cleanup backtest container", zap.Error(err))
		// Don't return error - results are already saved
	} else {
		log.Info("Backtest container cleaned up")
	}
}

// handleFailedBacktest handles a failed backtest
func (m *BacktestMonitor) handleFailedBacktest(ctx context.Context, bt *ent.Backtest, backtestRunner runner.BacktestRunner) {
	log := logger.GetLogger(ctx)
	log.Info("Backtest failed")

	// Try to get result (which includes logs) even for failed backtests
	result, err := backtestRunner.GetBacktestResult(ctx, bt.ID.String())

	update := m.client.Backtest.UpdateOneID(bt.ID).
		SetStatus(enum.TaskStatusFailed)

	if err == nil {
		// Store logs if available
		if result.Logs != "" {
			update = update.SetLogs(result.Logs)
			log.Info("Backtest logs captured", zap.Int("bytes", len(result.Logs)))
		}

		if result.CompletedAt != nil {
			update = update.SetCompletedAt(*result.CompletedAt)
		} else {
			update = update.SetCompletedAt(time.Now())
		}

		errorMsg := result.ErrorMessage
		if errorMsg == "" {
			errorMsg = "Backtest failed with non-zero exit code"
		}
		update = update.SetErrorMessage(errorMsg)
	} else {
		// Fallback if we can't get result
		update = update.SetCompletedAt(time.Now())
		update = update.SetErrorMessage(fmt.Sprintf("Backtest failed: %v", err))
	}

	_, saveErr := update.Save(ctx)
	if saveErr != nil {
		log.Error("Failed to update failed backtest", zap.Error(saveErr))
		return
	}

	// Cleanup container after successfully saving failed status
	if err := backtestRunner.DeleteBacktest(ctx, bt.ID.String()); err != nil {
		log.Warn("Failed to cleanup failed backtest container", zap.Error(err))
		// Don't return error - status is already saved
	} else {
		log.Info("Failed backtest container cleaned up")
	}
}
