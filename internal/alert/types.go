package alert

import (
	"time"

	"github.com/google/uuid"

	"volaticloud/internal/alert/channel"
	"volaticloud/internal/enum"
)

// Alert represents a prepared alert ready for delivery
type Alert struct {
	ID           uuid.UUID
	RuleID       uuid.UUID
	ChannelType  channel.ChannelType // Email by default
	AlertType    enum.AlertType
	Severity     enum.AlertSeverity
	ResourceType enum.AlertResourceType
	ResourceID   *uuid.UUID
	Subject      string
	Body         string
	HTMLBody     string
	Recipients   []string
	Context      map[string]interface{}
	CreatedAt    time.Time
}

// RuleMatch represents a matched rule for an event
type RuleMatch struct {
	RuleID       uuid.UUID
	AlertType    enum.AlertType
	Severity     enum.AlertSeverity
	DeliveryMode enum.AlertDeliveryMode
	Recipients   []string
	Conditions   map[string]interface{}
}

// StatusChangeConditions represents conditions for status_change alert type
type StatusChangeConditions struct {
	TriggerOn []string `json:"trigger_on"` // List of status values to trigger on
}

// LargeProfitLossConditions represents conditions for large_profit_loss alert type
type LargeProfitLossConditions struct {
	ThresholdPercent float64 `json:"threshold_percent"`
	Direction        string  `json:"direction"` // "profit", "loss", or "both"
}

// DrawdownConditions represents conditions for drawdown_threshold alert type
type DrawdownConditions struct {
	MaxDrawdownPercent float64 `json:"max_drawdown_percent"`
}

// DailyLossConditions represents conditions for daily_loss_limit alert type
type DailyLossConditions struct {
	MaxLossPercent float64 `json:"max_loss_percent"`
}

// ProfitTargetConditions represents conditions for profit_target alert type
type ProfitTargetConditions struct {
	TargetPercent float64 `json:"target_percent"`
}
