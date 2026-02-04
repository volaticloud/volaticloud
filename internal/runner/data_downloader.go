package runner

import (
	"context"
	"time"

	"volaticloud/internal/enum"
)

// DataDownloader downloads historical data on the runner infrastructure
// (Docker host or Kubernetes cluster) and uploads to S3.
type DataDownloader interface {
	// StartDownload starts a data download task on the runner infrastructure.
	// Returns a task ID that can be used to monitor progress.
	StartDownload(ctx context.Context, spec DataDownloadSpec) (taskID string, err error)

	// GetDownloadStatus returns the current status of a download task.
	GetDownloadStatus(ctx context.Context, taskID string) (*DataDownloadStatus, error)

	// GetDownloadLogs returns logs from a download task.
	GetDownloadLogs(ctx context.Context, taskID string) (string, error)

	// CancelDownload cancels a running download task.
	CancelDownload(ctx context.Context, taskID string) error

	// CleanupDownload removes resources for a completed/failed download task.
	CleanupDownload(ctx context.Context, taskID string) error
}

// DataDownloadSpec contains the specification for a data download task.
type DataDownloadSpec struct {
	// RunnerID is the unique identifier of the runner.
	RunnerID string

	// ExistingDataURL is a presigned GET URL for downloading existing data (for incremental updates).
	// Empty string means download from scratch.
	ExistingDataURL string

	// UploadURL is a presigned PUT URL for uploading the result to S3.
	UploadURL string

	// FreqtradeImage is the Docker image to use for freqtrade (e.g., "freqtradeorg/freqtrade:stable").
	FreqtradeImage string

	// ExchangeConfigs contains the download configuration for each exchange.
	ExchangeConfigs []ExchangeDownloadConfig
}

// ExchangeDownloadConfig contains download configuration for a single exchange.
type ExchangeDownloadConfig struct {
	// Name is the exchange name (e.g., "binance", "bybit").
	Name string

	// PairsPattern is the pair pattern to download (e.g., "BTC/USDT:USDT", ".*/USDT").
	PairsPattern string

	// Timeframes are the timeframes to download (e.g., ["5m", "1h", "4h"]).
	Timeframes []string

	// Days is the number of days of historical data to download.
	Days int

	// TradingMode is the trading mode ("spot" or "futures").
	TradingMode string
}

// DataDownloadStatus contains the current status of a download task.
type DataDownloadStatus struct {
	// TaskID is the unique identifier of the download task.
	TaskID string

	// Status is the current status of the download.
	Status enum.DataDownloadStatus

	// Progress is the completion percentage (0-100).
	Progress float64

	// CurrentPhase describes what's currently happening
	// (e.g., "downloading binance", "packaging", "uploading").
	CurrentPhase string

	// ErrorMessage contains error details if the download failed.
	ErrorMessage string

	// StartedAt is when the download task started.
	StartedAt *time.Time

	// CompletedAt is when the download task completed (success or failure).
	CompletedAt *time.Time
}

// DataDownloaderCreator is a factory function for creating DataDownloader instances.
type DataDownloaderCreator func(ctx context.Context, config map[string]interface{}) (DataDownloader, error)

// ShellEscape escapes a string for safe use in shell commands.
// It wraps the string in single quotes and escapes any embedded single quotes.
// This prevents shell injection attacks when inserting user input into shell scripts.
func ShellEscape(s string) string {
	// Single quotes prevent all shell interpretation except for single quotes themselves.
	// To include a single quote, we end the quoted string, add an escaped single quote,
	// and start a new quoted string: 'foo'\''bar' represents foo'bar
	escaped := "'"
	for _, c := range s {
		if c == '\'' {
			escaped += `'\''`
		} else {
			escaped += string(c)
		}
	}
	escaped += "'"
	return escaped
}
