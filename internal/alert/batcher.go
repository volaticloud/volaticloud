package alert

import (
	"context"
	"log"
	"sync"
	"time"
)

// BatcherConfig holds configuration for the alert batcher
type BatcherConfig struct {
	// FlushInterval is how often to send batched alerts
	FlushInterval time.Duration
}

// Batcher aggregates alerts for batched delivery
type Batcher struct {
	config     BatcherConfig
	alerts     []Alert
	mu         sync.Mutex
	dispatcher *Dispatcher
	stopChan   chan struct{}
	doneChan   chan struct{}
}

// NewBatcher creates a new alert batcher
func NewBatcher(config BatcherConfig) *Batcher {
	if config.FlushInterval == 0 {
		config.FlushInterval = time.Hour // Default to 1 hour
	}

	return &Batcher{
		config:   config,
		alerts:   make([]Alert, 0),
		stopChan: make(chan struct{}),
		doneChan: make(chan struct{}),
	}
}

// SetDispatcher sets the dispatcher for sending batched alerts
func (b *Batcher) SetDispatcher(dispatcher *Dispatcher) {
	b.dispatcher = dispatcher
}

// Start begins the batch flushing loop
func (b *Batcher) Start(ctx context.Context) error {
	log.Printf("Starting alert batcher (interval: %v)", b.config.FlushInterval)
	go b.flushLoop(ctx)
	return nil
}

// Stop stops the batcher and flushes any remaining alerts
func (b *Batcher) Stop(ctx context.Context) error {
	close(b.stopChan)
	<-b.doneChan

	// Final flush
	if err := b.Flush(ctx); err != nil {
		log.Printf("Error during final batch flush: %v", err)
	}

	log.Println("Alert batcher stopped")
	return nil
}

// Add adds an alert to the batch
func (b *Batcher) Add(alert Alert) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.alerts = append(b.alerts, alert)
}

// Flush sends all batched alerts
func (b *Batcher) Flush(ctx context.Context) error {
	b.mu.Lock()
	if len(b.alerts) == 0 {
		b.mu.Unlock()
		return nil
	}

	alerts := b.alerts
	b.alerts = make([]Alert, 0)
	b.mu.Unlock()

	log.Printf("Flushing %d batched alerts", len(alerts))

	if b.dispatcher == nil {
		log.Println("Warning: no dispatcher set for batcher")
		return nil
	}

	return b.dispatcher.SendBatch(ctx, alerts)
}

// Count returns the number of pending alerts
func (b *Batcher) Count() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.alerts)
}

// flushLoop periodically flushes batched alerts
func (b *Batcher) flushLoop(ctx context.Context) {
	defer close(b.doneChan)

	ticker := time.NewTicker(b.config.FlushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := b.Flush(ctx); err != nil {
				log.Printf("Error flushing alerts: %v", err)
			}
		case <-b.stopChan:
			return
		case <-ctx.Done():
			return
		}
	}
}
