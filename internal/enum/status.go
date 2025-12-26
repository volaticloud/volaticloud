package enum

import (
	"fmt"
	"io"
	"strconv"
)

// BotStatus represents the bot lifecycle status
type BotStatus string

const (
	BotStatusCreating    BotStatus = "creating"
	BotStatusRunning     BotStatus = "running"   // Container running and healthy
	BotStatusUnhealthy   BotStatus = "unhealthy" // Container running but health check failing
	BotStatusStopped     BotStatus = "stopped"
	BotStatusError       BotStatus = "error"
	BotStatusBacktesting BotStatus = "backtesting"
	BotStatusHyperopt    BotStatus = "hyperopt"
)

// Values returns all possible bot status values
func (BotStatus) Values() []string {
	return []string{
		string(BotStatusCreating),
		string(BotStatusRunning),
		string(BotStatusUnhealthy),
		string(BotStatusStopped),
		string(BotStatusError),
		string(BotStatusBacktesting),
		string(BotStatusHyperopt),
	}
}

// MarshalGQL implements graphql.Marshaler for BotStatus
func (b BotStatus) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(string(b)))
}

// UnmarshalGQL implements graphql.Unmarshaler for BotStatus
func (b *BotStatus) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("bot status must be a string")
	}
	*b = BotStatus(str)
	return nil
}

// BotMode represents the bot trading mode
type BotMode string

const (
	BotModeDryRun BotMode = "dry_run"
	BotModeLive   BotMode = "live"
)

// Values returns all possible bot mode values
func (BotMode) Values() []string {
	return []string{
		string(BotModeDryRun),
		string(BotModeLive),
	}
}

// MarshalGQL implements graphql.Marshaler for BotMode
func (b BotMode) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(string(b)))
}

// UnmarshalGQL implements graphql.Unmarshaler for BotMode
func (b *BotMode) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("bot mode must be a string")
	}
	*b = BotMode(str)
	return nil
}

// TaskStatus represents the status of backtest/hyperopt tasks
type TaskStatus string

const (
	TaskStatusPending   TaskStatus = "pending"
	TaskStatusRunning   TaskStatus = "running"
	TaskStatusCompleted TaskStatus = "completed"
	TaskStatusFailed    TaskStatus = "failed"
	TaskStatusCancelled TaskStatus = "cancelled"
)

// Values returns all possible task status values
func (TaskStatus) Values() []string {
	return []string{
		string(TaskStatusPending),
		string(TaskStatusRunning),
		string(TaskStatusCompleted),
		string(TaskStatusFailed),
		string(TaskStatusCancelled),
	}
}

// MarshalGQL implements graphql.Marshaler for TaskStatus
func (t TaskStatus) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(string(t)))
}

// UnmarshalGQL implements graphql.Unmarshaler for TaskStatus
func (t *TaskStatus) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("task status must be a string")
	}
	*t = TaskStatus(str)
	return nil
}

// OptimizationMetric represents hyperopt optimization metrics
type OptimizationMetric string

const (
	OptimizationMetricSharpe   OptimizationMetric = "sharpe"
	OptimizationMetricProfit   OptimizationMetric = "profit"
	OptimizationMetricTrades   OptimizationMetric = "trades"
	OptimizationMetricDrawdown OptimizationMetric = "drawdown"
)

// Values returns all possible optimization metric values
func (OptimizationMetric) Values() []string {
	return []string{
		string(OptimizationMetricSharpe),
		string(OptimizationMetricProfit),
		string(OptimizationMetricTrades),
		string(OptimizationMetricDrawdown),
	}
}

// MarshalGQL implements graphql.Marshaler for OptimizationMetric
func (o OptimizationMetric) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(string(o)))
}

// UnmarshalGQL implements graphql.Unmarshaler for OptimizationMetric
func (o *OptimizationMetric) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("optimization metric must be a string")
	}
	*o = OptimizationMetric(str)
	return nil
}

// DataDownloadStatus represents the status of data download for a runner
type DataDownloadStatus string

const (
	DataDownloadStatusIdle        DataDownloadStatus = "idle"
	DataDownloadStatusPending     DataDownloadStatus = "pending"
	DataDownloadStatusDownloading DataDownloadStatus = "downloading"
	DataDownloadStatusPackaging   DataDownloadStatus = "packaging"
	DataDownloadStatusUploading   DataDownloadStatus = "uploading"
	DataDownloadStatusCompleted   DataDownloadStatus = "completed"
	DataDownloadStatusFailed      DataDownloadStatus = "failed"
)

// Values returns all possible data download status values
func (DataDownloadStatus) Values() []string {
	return []string{
		string(DataDownloadStatusIdle),
		string(DataDownloadStatusPending),
		string(DataDownloadStatusDownloading),
		string(DataDownloadStatusPackaging),
		string(DataDownloadStatusUploading),
		string(DataDownloadStatusCompleted),
		string(DataDownloadStatusFailed),
	}
}

// MarshalGQL implements graphql.Marshaler for DataDownloadStatus
func (d DataDownloadStatus) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(string(d)))
}

// UnmarshalGQL implements graphql.Unmarshaler for DataDownloadStatus
func (d *DataDownloadStatus) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("data download status must be a string")
	}
	*d = DataDownloadStatus(str)
	return nil
}
