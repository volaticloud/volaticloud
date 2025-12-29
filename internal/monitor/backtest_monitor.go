package monitor

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"volaticloud/internal/alert"
	"volaticloud/internal/backtest"
	"volaticloud/internal/ent"
	entbacktest "volaticloud/internal/ent/backtest"
	"volaticloud/internal/enum"
	"volaticloud/internal/runner"
	"volaticloud/internal/usage"
)

// BacktestMonitor monitors running backtests and updates their status
type BacktestMonitor struct {
	client         *ent.Client
	usageCollector usage.Collector
	interval       time.Duration
	stopChan       chan struct{}
}

// NewBacktestMonitor creates a new backtest monitor
func NewBacktestMonitor(client *ent.Client, interval time.Duration) *BacktestMonitor {
	if interval == 0 {
		interval = 30 * time.Second // Default to 30 seconds
	}

	return &BacktestMonitor{
		client:         client,
		usageCollector: usage.NewCollector(client),
		interval:       interval,
		stopChan:       make(chan struct{}),
	}
}

// Start begins monitoring backtests
func (m *BacktestMonitor) Start(ctx context.Context) {
	log.Printf("Starting backtest monitor (interval: %v)", m.interval)

	ticker := time.NewTicker(m.interval)
	defer ticker.Stop()

	// Run once immediately
	m.checkBacktests(ctx)

	for {
		select {
		case <-ctx.Done():
			log.Println("Backtest monitor stopped (context cancelled)")
			return
		case <-m.stopChan:
			log.Println("Backtest monitor stopped")
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
	// Query all running backtests
	backtests, err := m.client.Backtest.Query().
		Where(entbacktest.StatusEQ(enum.TaskStatusRunning)).
		WithRunner().
		WithStrategy().
		All(ctx)
	if err != nil {
		log.Printf("Error querying running backtests: %v", err)
		return
	}

	if len(backtests) == 0 {
		return
	}

	log.Printf("Checking %d running backtest(s)", len(backtests))

	for _, bt := range backtests {
		m.checkBacktest(ctx, bt)
	}
}

// checkBacktest checks a single backtest and updates its status
func (m *BacktestMonitor) checkBacktest(ctx context.Context, bt *ent.Backtest) {
	// Get runner
	if bt.Edges.Runner == nil {
		log.Printf("Backtest %s has no runner, skipping", bt.ID)
		return
	}

	// Create runner client
	factory := runner.NewFactory()
	backtestRunner, err := factory.CreateBacktestRunner(ctx, bt.Edges.Runner.Type, bt.Edges.Runner.Config)
	if err != nil {
		log.Printf("Failed to create backtest runner for %s: %v", bt.ID, err)
		return
	}
	defer func() {
		if err := backtestRunner.Close(); err != nil {
			log.Printf("Warning: failed to close backtest runner: %v", err)
		}
	}()

	// Get backtest status
	status, err := backtestRunner.GetBacktestStatus(ctx, bt.ID.String())
	if err != nil {
		log.Printf("Failed to get backtest status for %s: %v", bt.ID, err)
		return
	}

	// Record usage sample if billing is enabled and backtest is running or just completed
	// OwnerID is from the strategy (backtest belongs to strategy which has owner_id)
	// We record samples for both running AND just-completed backtests to capture final metrics
	shouldRecordSample := bt.Edges.Runner.BillingEnabled && bt.Edges.Strategy != nil &&
		(status.Status == enum.TaskStatusRunning || status.Status == enum.TaskStatusCompleted)
	if shouldRecordSample {
		if err := m.usageCollector.RecordSample(ctx, usage.UsageSample{
			ResourceType:    enum.ResourceTypeBacktest,
			ResourceID:      bt.ID,
			OwnerID:         bt.Edges.Strategy.OwnerID,
			RunnerID:        bt.Edges.Runner.ID,
			CPUPercent:      status.CPUUsage,
			MemoryBytes:     status.MemoryUsage,
			NetworkRxBytes:  status.NetworkRxBytes,
			NetworkTxBytes:  status.NetworkTxBytes,
			BlockReadBytes:  status.BlockReadBytes,
			BlockWriteBytes: status.BlockWriteBytes,
			SampledAt:       time.Now(),
		}); err != nil {
			// Log error but don't fail the status check
			log.Printf("Backtest %s failed to record usage sample: %v", bt.ID, err)
		}
	}

	// Check if status changed
	if status.Status == bt.Status {
		return // Still running
	}

	log.Printf("Backtest %s status changed: %s -> %s", bt.ID, bt.Status, status.Status)

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
	log.Printf("Backtest %s completed, fetching results...", bt.ID)

	// Get backtest results (includes parsing)
	result, err := backtestRunner.GetBacktestResult(ctx, bt.ID.String())
	if err != nil {
		log.Printf("Failed to get backtest results for %s: %v", bt.ID, err)
		// Mark as completed but without results
		if _, saveErr := m.client.Backtest.UpdateOneID(bt.ID).
			SetStatus(enum.TaskStatusCompleted).
			SetCompletedAt(time.Now()).
			SetErrorMessage("Failed to retrieve results").
			Save(ctx); saveErr != nil {
			log.Printf("Failed to update backtest %s after result error: %v", bt.ID, saveErr)
		}
		return
	}

	// Extract typed summary from result
	summary, err := backtest.ExtractSummaryFromResult(result.RawResult)
	if err != nil {
		log.Printf("Failed to extract summary from backtest result: %v", err)
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
				log.Printf("Backtest %s summary extracted: %d trades, profit: %.2f", bt.ID, summary.TotalTrades, summary.ProfitTotalAbs)
			}
		}
	}

	// Store logs from container execution
	if result.Logs != "" {
		update = update.SetLogs(result.Logs)
		log.Printf("Backtest %s logs captured (%d bytes)", bt.ID, len(result.Logs))
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
		log.Printf("Failed to update backtest %s: %v", bt.ID, err)
		return
	}

	log.Printf("Backtest %s completed successfully, results saved", bt.ID)

	// Emit backtest completed alert
	m.emitBacktestAlert(ctx, bt, true, "", summary)

	// Cleanup container after successfully saving results
	if err := backtestRunner.DeleteBacktest(ctx, bt.ID.String()); err != nil {
		log.Printf("Warning: Failed to cleanup backtest container %s: %v", bt.ID, err)
		// Don't return error - results are already saved
	} else {
		log.Printf("Backtest %s container cleaned up", bt.ID)
	}
}

// handleFailedBacktest handles a failed backtest
func (m *BacktestMonitor) handleFailedBacktest(ctx context.Context, bt *ent.Backtest, backtestRunner runner.BacktestRunner) {
	log.Printf("Backtest %s failed", bt.ID)

	// Try to get result (which includes logs) even for failed backtests
	result, err := backtestRunner.GetBacktestResult(ctx, bt.ID.String())

	update := m.client.Backtest.UpdateOneID(bt.ID).
		SetStatus(enum.TaskStatusFailed)

	if err == nil {
		// Store logs if available
		if result.Logs != "" {
			update = update.SetLogs(result.Logs)
			log.Printf("Backtest %s logs captured (%d bytes)", bt.ID, len(result.Logs))
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
		log.Printf("Failed to update failed backtest %s: %v", bt.ID, saveErr)
		return
	}

	// Emit backtest failed alert
	errorMsg := "Backtest failed"
	if err == nil && result.ErrorMessage != "" {
		errorMsg = result.ErrorMessage
	}
	m.emitBacktestAlert(ctx, bt, false, errorMsg, nil)

	// Cleanup container after successfully saving failed status
	if err := backtestRunner.DeleteBacktest(ctx, bt.ID.String()); err != nil {
		log.Printf("Warning: Failed to cleanup failed backtest container %s: %v", bt.ID, err)
		// Don't return error - status is already saved
	} else {
		log.Printf("Failed backtest %s container cleaned up", bt.ID)
	}
}

// emitBacktestAlert sends an alert for backtest completion or failure
func (m *BacktestMonitor) emitBacktestAlert(ctx context.Context, bt *ent.Backtest, success bool, errorMessage string, summary *backtest.BacktestSummary) {
	alertMgr := alert.GetManagerFromContext(ctx)
	if alertMgr == nil {
		return // Alert manager not configured
	}

	// Get strategy info
	if bt.Edges.Strategy == nil {
		return // No strategy info available
	}

	strategy := bt.Edges.Strategy
	totalTrades := 0
	winRate := 0.0
	profitTotal := 0.0

	if summary != nil {
		totalTrades = summary.TotalTrades
		if summary.WinRate != nil {
			winRate = *summary.WinRate
		}
		profitTotal = summary.ProfitTotalAbs
	}

	if err := alertMgr.HandleBacktestCompleted(
		ctx,
		bt.ID,
		strategy.ID,
		strategy.Name,
		strategy.OwnerID,
		success,
		errorMessage,
		totalTrades,
		winRate,
		profitTotal,
	); err != nil {
		log.Printf("Backtest %s: failed to emit backtest alert: %v", bt.ID, err)
	}
}
