package monitor

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"anytrade/internal/backtest"
	"anytrade/internal/ent"
	entbacktest "anytrade/internal/ent/backtest"
	"anytrade/internal/enum"
	"anytrade/internal/runner"
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
	// Skip if no container ID
	if bt.ContainerID == "" {
		log.Printf("Backtest %s has no container ID, skipping", bt.ID)
		return
	}

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
		m.handleFailedBacktest(ctx, bt, status)
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
}

// handleFailedBacktest handles a failed backtest
func (m *BacktestMonitor) handleFailedBacktest(ctx context.Context, bt *ent.Backtest, status *runner.BacktestStatus) {
	log.Printf("Backtest %s failed with exit code %d", bt.ID, status.ExitCode)

	update := m.client.Backtest.UpdateOneID(bt.ID).
		SetStatus(enum.TaskStatusFailed)

	if status.CompletedAt != nil {
		update = update.SetCompletedAt(*status.CompletedAt)
	} else {
		update = update.SetCompletedAt(time.Now())
	}

	errorMsg := status.ErrorMessage
	if errorMsg == "" {
		errorMsg = "Backtest failed with non-zero exit code"
	}
	update = update.SetErrorMessage(errorMsg)

	_, err := update.Save(ctx)
	if err != nil {
		log.Printf("Failed to update failed backtest %s: %v", bt.ID, err)
	}
}