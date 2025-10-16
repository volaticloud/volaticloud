package runner

import (
	"fmt"
	"io"
	"time"

	"anytrade/internal/enum"
)

// BotSpec defines the specification for deploying a bot
type BotSpec struct {
	// Bot identification
	ID   string
	Name string

	// Container configuration
	Image           string            // Docker image (e.g., "freqtradeorg/freqtrade:2024.1")
	FreqtradeVersion string           // Freqtrade version tag

	// Strategy configuration
	StrategyName    string            // Name of the strategy file
	StrategyCode    string            // Strategy Python code content

	// Bot configuration
	Config          map[string]interface{} // Freqtrade config JSON

	// Exchange configuration
	ExchangeName    string            // Exchange name (binance, kraken, etc.)
	ExchangeAPIKey  string            // Exchange API key
	ExchangeSecret  string            // Exchange API secret

	// Runtime configuration
	Environment     map[string]string // Additional environment variables
	ResourceLimits  *ResourceLimits   // CPU/memory limits
	NetworkMode     string            // Network mode (bridge, host, custom)

	// API configuration
	APIUsername     string            // Freqtrade API username
	APIPassword     string            // Freqtrade API password
	APIPort         int               // Freqtrade API port (default: 8080)
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

// BotStatus represents the current status of a bot in the runtime
type BotStatus struct {
	// Bot identification
	BotID string

	// Runtime status
	Status      enum.BotStatus // creating, running, stopped, error
	ContainerID string         // Runtime-specific identifier

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

// RuntimeError represents an error from runtime operations
type RuntimeError struct {
	Operation string // Operation that failed (e.g., "CreateBot", "DeleteBot")
	BotID     string // Bot ID if applicable
	Err       error  // Underlying error
	Retryable bool   // Whether the operation can be retried
}

// Error implements the error interface
func (e *RuntimeError) Error() string {
	if e.BotID != "" {
		return fmt.Sprintf("runtime %s failed for bot %s: %v", e.Operation, e.BotID, e.Err)
	}
	return fmt.Sprintf("runtime %s failed: %v", e.Operation, e.Err)
}

// Unwrap implements error unwrapping
func (e *RuntimeError) Unwrap() error {
	return e.Err
}

// Common runtime errors
var (
	ErrBotNotFound       = fmt.Errorf("bot not found in runtime")
	ErrBotAlreadyExists  = fmt.Errorf("bot already exists in runtime")
	ErrRuntimeNotConnected = fmt.Errorf("runtime client not connected")
	ErrInvalidSpec       = fmt.Errorf("invalid bot specification")
	ErrResourceLimit     = fmt.Errorf("resource limit exceeded")
)

// NewRuntimeError creates a new runtime error
func NewRuntimeError(operation, botID string, err error, retryable bool) *RuntimeError {
	return &RuntimeError{
		Operation: operation,
		BotID:     botID,
		Err:       err,
		Retryable: retryable,
	}
}
