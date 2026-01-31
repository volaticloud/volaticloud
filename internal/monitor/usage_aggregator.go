package monitor

import (
	"context"
	"log"
	"time"

	"volaticloud/internal/ent"
	"volaticloud/internal/usage"
)

const (
	// DefaultAggregationInterval is how often to run aggregation
	DefaultAggregationInterval = 1 * time.Hour

	// DefaultSampleRetention is how long to keep raw samples
	DefaultSampleRetention = 7 * 24 * time.Hour // 7 days
)

// BillingDeductor is the interface for deducting hourly costs from billing.
type BillingDeductor interface {
	DeductHourlyCosts(ctx context.Context, bucketStart time.Time) error
}

// UsageAggregatorWorker periodically aggregates usage samples into hourly/daily summaries
type UsageAggregatorWorker struct {
	dbClient        *ent.Client
	aggregator      usage.Aggregator
	billingDeductor BillingDeductor
	interval        time.Duration
	retention       time.Duration

	stopChan chan struct{}
	doneChan chan struct{}
}

// NewUsageAggregatorWorker creates a new usage aggregation worker
func NewUsageAggregatorWorker(dbClient *ent.Client) *UsageAggregatorWorker {
	return &UsageAggregatorWorker{
		dbClient:   dbClient,
		aggregator: usage.NewAggregator(dbClient),
		interval:   DefaultAggregationInterval,
		retention:  DefaultSampleRetention,
		stopChan:   make(chan struct{}),
		doneChan:   make(chan struct{}),
	}
}

// SetInterval sets the aggregation interval
func (w *UsageAggregatorWorker) SetInterval(interval time.Duration) {
	w.interval = interval
}

// SetRetention sets the sample retention period
func (w *UsageAggregatorWorker) SetRetention(retention time.Duration) {
	w.retention = retention
}

// SetBillingDeductor sets the billing deductor for hourly cost deduction
func (w *UsageAggregatorWorker) SetBillingDeductor(deductor BillingDeductor) {
	w.billingDeductor = deductor
}

// Start begins the aggregation loop
func (w *UsageAggregatorWorker) Start(ctx context.Context) error {
	log.Printf("Starting usage aggregator worker (interval: %v, retention: %v)", w.interval, w.retention)

	go w.aggregatorLoop(ctx)

	return nil
}

// Stop stops the aggregation loop
func (w *UsageAggregatorWorker) Stop() {
	close(w.stopChan)
	<-w.doneChan
	log.Println("Usage aggregator worker stopped")
}

// aggregatorLoop is the main aggregation loop
func (w *UsageAggregatorWorker) aggregatorLoop(ctx context.Context) {
	defer close(w.doneChan)

	// Calculate time until next hour boundary for initial delay
	now := time.Now()
	nextHour := now.Truncate(time.Hour).Add(time.Hour)
	initialDelay := nextHour.Sub(now)

	// Add a small offset (5 minutes) to ensure the previous hour's data is complete
	initialDelay += 5 * time.Minute

	log.Printf("Usage aggregator will start first run in %v (at %v)", initialDelay, nextHour.Add(5*time.Minute))

	// Wait for initial delay
	select {
	case <-ctx.Done():
		return
	case <-w.stopChan:
		return
	case <-time.After(initialDelay):
		// Do first aggregation
		w.runAggregation(ctx)
	}

	// Continue with regular interval
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-w.stopChan:
			return
		case <-ticker.C:
			w.runAggregation(ctx)
		}
	}
}

// runAggregation performs the aggregation and cleanup tasks
func (w *UsageAggregatorWorker) runAggregation(ctx context.Context) {
	log.Println("Running usage aggregation...")

	// Aggregate the previous hour
	previousHour := time.Now().Truncate(time.Hour).Add(-time.Hour)

	if err := w.aggregator.AggregateHourly(ctx, previousHour); err != nil {
		log.Printf("Failed to aggregate hourly usage: %v", err)
	} else {
		log.Printf("Successfully aggregated usage for hour: %v", previousHour)
	}

	// Deduct hourly costs from organization credit balances
	if w.billingDeductor != nil {
		if err := w.billingDeductor.DeductHourlyCosts(ctx, previousHour); err != nil {
			log.Printf("Failed to deduct hourly costs: %v", err)
		}
	}

	// If it's the start of a new day (midnight-1am), also run daily aggregation
	if previousHour.Hour() == 23 {
		previousDay := previousHour.Truncate(24 * time.Hour)
		if err := w.aggregator.AggregateDaily(ctx, previousDay); err != nil {
			log.Printf("Failed to aggregate daily usage: %v", err)
		} else {
			log.Printf("Successfully aggregated daily usage for: %v", previousDay.Format("2006-01-02"))
		}
	}

	// Cleanup old samples
	deleted, err := w.aggregator.CleanupOldSamples(ctx, w.retention)
	if err != nil {
		log.Printf("Failed to cleanup old usage samples: %v", err)
	} else if deleted > 0 {
		log.Printf("Cleaned up %d old usage samples (older than %v)", deleted, w.retention)
	}
}

// RunNow immediately runs aggregation (for manual triggering or testing)
func (w *UsageAggregatorWorker) RunNow(ctx context.Context) {
	w.runAggregation(ctx)
}
