package enum

import (
	"fmt"
	"io"
	"strconv"
)

// AlertType represents the category of alert
type AlertType string

const (
	AlertTypeStatusChange      AlertType = "status_change"
	AlertTypeTradeOpened       AlertType = "trade_opened"
	AlertTypeTradeClosed       AlertType = "trade_closed"
	AlertTypeLargeProfitLoss   AlertType = "large_profit_loss"
	AlertTypeDailyLossLimit    AlertType = "daily_loss_limit"
	AlertTypeDrawdownThreshold AlertType = "drawdown_threshold"
	AlertTypeProfitTarget      AlertType = "profit_target"
	AlertTypeConnectionIssue   AlertType = "connection_issue"
	AlertTypeBacktestCompleted AlertType = "backtest_completed"
	AlertTypeBacktestFailed    AlertType = "backtest_failed"
)

// Values returns all possible alert type values
func (AlertType) Values() []string {
	return []string{
		string(AlertTypeStatusChange),
		string(AlertTypeTradeOpened),
		string(AlertTypeTradeClosed),
		string(AlertTypeLargeProfitLoss),
		string(AlertTypeDailyLossLimit),
		string(AlertTypeDrawdownThreshold),
		string(AlertTypeProfitTarget),
		string(AlertTypeConnectionIssue),
		string(AlertTypeBacktestCompleted),
		string(AlertTypeBacktestFailed),
	}
}

// MarshalGQL implements graphql.Marshaler for AlertType
func (a AlertType) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(string(a)))
}

// UnmarshalGQL implements graphql.Unmarshaler for AlertType
func (a *AlertType) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("alert type must be a string")
	}
	*a = AlertType(str)
	return nil
}

// AlertSeverity represents alert priority level
type AlertSeverity string

const (
	AlertSeverityCritical AlertSeverity = "critical"
	AlertSeverityWarning  AlertSeverity = "warning"
	AlertSeverityInfo     AlertSeverity = "info"
)

// Values returns all possible alert severity values
func (AlertSeverity) Values() []string {
	return []string{
		string(AlertSeverityCritical),
		string(AlertSeverityWarning),
		string(AlertSeverityInfo),
	}
}

// MarshalGQL implements graphql.Marshaler for AlertSeverity
func (s AlertSeverity) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(string(s)))
}

// UnmarshalGQL implements graphql.Unmarshaler for AlertSeverity
func (s *AlertSeverity) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("alert severity must be a string")
	}
	*s = AlertSeverity(str)
	return nil
}

// AlertResourceType represents the type of resource an alert is bound to
type AlertResourceType string

const (
	AlertResourceTypeOrganization AlertResourceType = "organization"
	AlertResourceTypeBot          AlertResourceType = "bot"
	AlertResourceTypeStrategy     AlertResourceType = "strategy"
	AlertResourceTypeRunner       AlertResourceType = "runner"
)

// Values returns all possible alert resource type values
func (AlertResourceType) Values() []string {
	return []string{
		string(AlertResourceTypeOrganization),
		string(AlertResourceTypeBot),
		string(AlertResourceTypeStrategy),
		string(AlertResourceTypeRunner),
	}
}

// MarshalGQL implements graphql.Marshaler for AlertResourceType
func (r AlertResourceType) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(string(r)))
}

// UnmarshalGQL implements graphql.Unmarshaler for AlertResourceType
func (r *AlertResourceType) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("alert resource type must be a string")
	}
	*r = AlertResourceType(str)
	return nil
}

// AlertDeliveryMode represents how alerts are delivered
type AlertDeliveryMode string

const (
	AlertDeliveryModeImmediate AlertDeliveryMode = "immediate"
	AlertDeliveryModeBatched   AlertDeliveryMode = "batched"
)

// Values returns all possible alert delivery mode values
func (AlertDeliveryMode) Values() []string {
	return []string{
		string(AlertDeliveryModeImmediate),
		string(AlertDeliveryModeBatched),
	}
}

// MarshalGQL implements graphql.Marshaler for AlertDeliveryMode
func (d AlertDeliveryMode) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(string(d)))
}

// UnmarshalGQL implements graphql.Unmarshaler for AlertDeliveryMode
func (d *AlertDeliveryMode) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("alert delivery mode must be a string")
	}
	*d = AlertDeliveryMode(str)
	return nil
}

// AlertEventStatus represents the delivery status of an alert event
type AlertEventStatus string

const (
	AlertEventStatusPending    AlertEventStatus = "pending"
	AlertEventStatusSent       AlertEventStatus = "sent"
	AlertEventStatusFailed     AlertEventStatus = "failed"
	AlertEventStatusSuppressed AlertEventStatus = "suppressed" // Rate limited or disabled
)

// AlertBotModeFilter represents which bot trading modes should trigger alerts
type AlertBotModeFilter string

const (
	AlertBotModeFilterAll    AlertBotModeFilter = "all"     // Both live and dry-run bots
	AlertBotModeFilterLive   AlertBotModeFilter = "live"    // Only live trading bots
	AlertBotModeFilterDryRun AlertBotModeFilter = "dry_run" // Only dry-run bots
)

// Values returns all possible bot mode filter values
func (AlertBotModeFilter) Values() []string {
	return []string{
		string(AlertBotModeFilterAll),
		string(AlertBotModeFilterLive),
		string(AlertBotModeFilterDryRun),
	}
}

// MarshalGQL implements graphql.Marshaler for AlertBotModeFilter
func (f AlertBotModeFilter) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(string(f)))
}

// UnmarshalGQL implements graphql.Unmarshaler for AlertBotModeFilter
func (f *AlertBotModeFilter) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("alert bot mode filter must be a string")
	}
	*f = AlertBotModeFilter(str)
	return nil
}

// MatchesBotMode returns true if the filter allows alerts for the given bot mode
func (f AlertBotModeFilter) MatchesBotMode(botMode string) bool {
	switch f {
	case AlertBotModeFilterAll:
		return true
	case AlertBotModeFilterLive:
		return botMode == "live"
	case AlertBotModeFilterDryRun:
		return botMode == "dry_run"
	default:
		return true // Default to all if unknown filter
	}
}

// Values returns all possible alert event status values
func (AlertEventStatus) Values() []string {
	return []string{
		string(AlertEventStatusPending),
		string(AlertEventStatusSent),
		string(AlertEventStatusFailed),
		string(AlertEventStatusSuppressed),
	}
}

// MarshalGQL implements graphql.Marshaler for AlertEventStatus
func (s AlertEventStatus) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(string(s)))
}

// UnmarshalGQL implements graphql.Unmarshaler for AlertEventStatus
func (s *AlertEventStatus) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("alert event status must be a string")
	}
	*s = AlertEventStatus(str)
	return nil
}
