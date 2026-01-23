package monitor

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestDefaultDataDownloadTimeout(t *testing.T) {
	assert.Equal(t, 12*time.Hour, DefaultDataDownloadTimeout)
}

func TestRunnerMonitorDefaultTimeout(t *testing.T) {
	// NewRunnerMonitor should initialize with default timeout
	rm := NewRunnerMonitor(nil, nil)
	assert.Equal(t, DefaultDataDownloadTimeout, rm.GetDataDownloadTimeout())
}

func TestRunnerMonitorSetDataDownloadTimeout(t *testing.T) {
	rm := NewRunnerMonitor(nil, nil)

	// Set custom timeout
	customTimeout := 24 * time.Hour
	rm.SetDataDownloadTimeout(customTimeout)

	assert.Equal(t, customTimeout, rm.GetDataDownloadTimeout())
}

func TestRunnerMonitorDefaultInterval(t *testing.T) {
	assert.Equal(t, 5*time.Minute, DefaultRunnerMonitorInterval)
}

func TestDataRefreshInterval(t *testing.T) {
	assert.Equal(t, 24*time.Hour, DataRefreshInterval)
}