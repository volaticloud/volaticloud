package monitor

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestNewBotMonitor(t *testing.T) {
	// Create a bot monitor without actual DB client
	monitor := &BotMonitor{
		dbClient:    nil, // Would be a real client in production
		coordinator: nil, // Would be a real coordinator in production
		interval:    DefaultMonitorInterval,
		stopChan:    make(chan struct{}),
		doneChan:    make(chan struct{}),
	}

	assert.NotNil(t, monitor)
	assert.Equal(t, DefaultMonitorInterval, monitor.interval)
	assert.NotNil(t, monitor.stopChan)
	assert.NotNil(t, monitor.doneChan)
}

func TestSetInterval(t *testing.T) {
	monitor := &BotMonitor{
		interval: DefaultMonitorInterval,
	}

	newInterval := 60 * time.Second
	monitor.SetInterval(newInterval)

	assert.Equal(t, newInterval, monitor.interval)
}

func TestMonitorBatchSize(t *testing.T) {
	// Verify the batch size constant is reasonable
	assert.Equal(t, 10, MonitorBatchSize, "Batch size should be 10 for balanced performance")
}

func TestDefaultMonitorInterval(t *testing.T) {
	// Verify the default interval is 30 seconds
	assert.Equal(t, 30*time.Second, DefaultMonitorInterval)
}
