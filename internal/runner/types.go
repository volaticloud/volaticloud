package runner

import (
	"fmt"
	"io"
	"time"

	"volaticloud/internal/enum"
)

// BotSpec defines the specification for deploying a bot
// Config-first architecture: each entity provides its own config.json
// Freqtrade merges them via: --config exchange.json --config strategy.json --config bot.json
type BotSpec struct {
	// Bot identification
	ID   string
	Name string

	// Container configuration
	Image            string // Docker image (e.g., "freqtradeorg/freqtrade:stable")
	FreqtradeVersion string // Freqtrade version tag

	// Strategy configuration
	StrategyName   string                 // Name of the strategy file
	StrategyCode   string                 // Strategy Python code content
	StrategyConfig map[string]interface{} // Strategy-specific config.json (separate file)

	// Bot configuration
	Config map[string]interface{} // Bot-specific config.json (separate file, includes dry_run)

	// Exchange configuration
	ExchangeConfig map[string]interface{} // Exchange config.json (separate file, includes credentials)

	// Secure system configuration (NEVER exposed to users)
	SecureConfig map[string]interface{} // System-forced config.json (api_server, initial_state, etc.)

	// Runner configuration
	Environment    map[string]string // Additional environment variables
	ResourceLimits *ResourceLimits   // CPU/memory limits
	NetworkMode    string            // Network mode (bridge, host, custom)
	APIPort        int               // Freqtrade API port (default: 8080)
}

// ResourceLimits defines resource constraints for a bot
type ResourceLimits struct {
	// Memory limit in bytes (e.g., 512*1024*1024 for 512MB)
	MemoryBytes int64

	// Memory limit in human-readable format (e.g., "512M", "1G")
	Memory string

	// CPU quota (e.g., 0.5 for 50%, 1.0 for 100%, 2.0 for 200%)
	CPUQuota float64

	// CPU period in microseconds (default: 100000)
	CPUPeriod int64
}

// BotStatus represents the current status of a bot in the runner
type BotStatus struct {
	// Bot identification
	BotID string

	// Runner status
	Status      enum.BotStatus // creating, running, stopped, error
	ContainerID string         // Runner-specific identifier

	// Health information
	Healthy    bool
	LastSeenAt *time.Time

	// Resource usage
	CPUUsage    float64 // CPU usage percentage
	MemoryUsage int64   // Memory usage in bytes

	// Network information
	IPAddress string
	HostPort  int // Mapped host port for API

	// Error information
	ErrorMessage string

	// Metadata
	CreatedAt time.Time
	StartedAt *time.Time
	StoppedAt *time.Time
}

// LogOptions defines options for retrieving bot logs
type LogOptions struct {
	// Follow logs (stream)
	Follow bool

	// Return only last N lines
	Tail int

	// Show timestamps
	Timestamps bool

	// Since timestamp (show logs since this time)
	Since time.Time

	// Until timestamp (show logs until this time)
	Until time.Time

	// Filter by log level (stdout, stderr)
	Stream string // "stdout", "stderr", or "" for both
}

// LogEntry represents a single log entry
type LogEntry struct {
	Timestamp time.Time
	Stream    string // "stdout" or "stderr"
	Message   string
}

// LogReader provides access to bot logs
type LogReader struct {
	io.ReadCloser
	Entries chan LogEntry
	Errors  chan error
}

// UpdateBotSpec defines what can be updated on a running bot
type UpdateBotSpec struct {
	// Container image update
	Image *string

	// Resource limits update
	ResourceLimits *ResourceLimits

	// Environment variables update (merged with existing)
	Environment map[string]string
}

// RunnerError represents an error from runner operations
type RunnerError struct {
	Operation string // Operation that failed (e.g., "CreateBot", "DeleteBot")
	BotID     string // Bot ID if applicable
	Err       error  // Underlying error
	Retryable bool   // Whether the operation can be retried
}

// Error implements the error interface
func (e *RunnerError) Error() string {
	if e.BotID != "" {
		return fmt.Sprintf("runner %s failed for bot %s: %v", e.Operation, e.BotID, e.Err)
	}
	return fmt.Sprintf("runner %s failed: %v", e.Operation, e.Err)
}

// Unwrap implements error unwrapping
func (e *RunnerError) Unwrap() error {
	return e.Err
}

// Common runner errors
var (
	ErrBotNotFound        = fmt.Errorf("bot not found in runner")
	ErrBotAlreadyExists   = fmt.Errorf("bot already exists in runner")
	ErrRunnerNotConnected = fmt.Errorf("runner client not connected")
	ErrInvalidSpec        = fmt.Errorf("invalid bot specification")
	ErrResourceLimit      = fmt.Errorf("resource limit exceeded")
)

// NewRunnerError creates a new runner error
func NewRunnerError(operation, botID string, err error, retryable bool) *RunnerError {
	return &RunnerError{
		Operation: operation,
		BotID:     botID,
		Err:       err,
		Retryable: retryable,
	}
}
