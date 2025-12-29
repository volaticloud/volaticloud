package alert

import (
	"volaticloud/internal/enum"
)

// ConditionFieldType represents the type of a condition field
type ConditionFieldType string

const (
	ConditionFieldTypeNumber      ConditionFieldType = "number"
	ConditionFieldTypeSelect      ConditionFieldType = "select"
	ConditionFieldTypeMultiSelect ConditionFieldType = "multi_select"
)

// ConditionField describes a configurable condition for an alert type
type ConditionField struct {
	Name        string             `json:"name"`
	Label       string             `json:"label"`
	Type        ConditionFieldType `json:"type"`
	Required    bool               `json:"required"`
	Description string             `json:"description"`
	// For number fields
	Min     *float64 `json:"min,omitempty"`
	Max     *float64 `json:"max,omitempty"`
	Default *float64 `json:"default,omitempty"`
	Unit    string   `json:"unit,omitempty"`
	// For select fields
	Options []SelectOption `json:"options,omitempty"`
}

// SelectOption represents an option for select/multi_select fields
type SelectOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// AlertTypeInfo contains metadata about an alert type
type AlertTypeInfo struct {
	Type            enum.AlertType     `json:"type"`
	Label           string             `json:"label"`
	Description     string             `json:"description"`
	DefaultSeverity enum.AlertSeverity `json:"defaultSeverity"`
	ConditionFields []ConditionField   `json:"conditionFields"`
}

// alertTypeMetadata defines all alert types with their metadata
var alertTypeMetadata = map[enum.AlertType]AlertTypeInfo{
	enum.AlertTypeStatusChange: {
		Type:            enum.AlertTypeStatusChange,
		Label:           "Bot Status Change",
		Description:     "Triggered when a bot's status changes (started, stopped, error, etc.)",
		DefaultSeverity: enum.AlertSeverityWarning,
		ConditionFields: []ConditionField{
			{
				Name:        "trigger_statuses",
				Label:       "Trigger on statuses",
				Type:        ConditionFieldTypeMultiSelect,
				Required:    false,
				Description: "Only trigger when bot enters these statuses (leave empty for all)",
				Options: []SelectOption{
					{Value: "running", Label: "Running"},
					{Value: "stopped", Label: "Stopped"},
					{Value: "error", Label: "Error"},
					{Value: "starting", Label: "Starting"},
					{Value: "stopping", Label: "Stopping"},
				},
			},
		},
	},
	enum.AlertTypeTradeOpened: {
		Type:            enum.AlertTypeTradeOpened,
		Label:           "Trade Opened",
		Description:     "Triggered when a new trade is opened",
		DefaultSeverity: enum.AlertSeverityInfo,
		ConditionFields: []ConditionField{},
	},
	enum.AlertTypeTradeClosed: {
		Type:            enum.AlertTypeTradeClosed,
		Label:           "Trade Closed",
		Description:     "Triggered when a trade is closed",
		DefaultSeverity: enum.AlertSeverityInfo,
		ConditionFields: []ConditionField{},
	},
	enum.AlertTypeLargeProfitLoss: {
		Type:            enum.AlertTypeLargeProfitLoss,
		Label:           "Large Profit/Loss",
		Description:     "Triggered when a trade closes with profit or loss exceeding threshold",
		DefaultSeverity: enum.AlertSeverityWarning,
		ConditionFields: []ConditionField{
			{
				Name:        "profit_threshold",
				Label:       "Profit threshold",
				Type:        ConditionFieldTypeNumber,
				Required:    false,
				Description: "Alert when profit exceeds this percentage",
				Min:         ptr(0.0),
				Max:         ptr(1000.0),
				Default:     ptr(10.0),
				Unit:        "%",
			},
			{
				Name:        "loss_threshold",
				Label:       "Loss threshold",
				Type:        ConditionFieldTypeNumber,
				Required:    false,
				Description: "Alert when loss exceeds this percentage",
				Min:         ptr(0.0),
				Max:         ptr(100.0),
				Default:     ptr(5.0),
				Unit:        "%",
			},
		},
	},
	enum.AlertTypeDailyLossLimit: {
		Type:            enum.AlertTypeDailyLossLimit,
		Label:           "Daily Loss Limit",
		Description:     "Triggered when daily losses exceed threshold",
		DefaultSeverity: enum.AlertSeverityCritical,
		ConditionFields: []ConditionField{
			{
				Name:        "loss_limit",
				Label:       "Daily loss limit",
				Type:        ConditionFieldTypeNumber,
				Required:    true,
				Description: "Maximum allowed daily loss percentage",
				Min:         ptr(0.0),
				Max:         ptr(100.0),
				Default:     ptr(5.0),
				Unit:        "%",
			},
		},
	},
	enum.AlertTypeDrawdownThreshold: {
		Type:            enum.AlertTypeDrawdownThreshold,
		Label:           "Drawdown Threshold",
		Description:     "Triggered when drawdown exceeds threshold",
		DefaultSeverity: enum.AlertSeverityWarning,
		ConditionFields: []ConditionField{
			{
				Name:        "drawdown_threshold",
				Label:       "Drawdown threshold",
				Type:        ConditionFieldTypeNumber,
				Required:    true,
				Description: "Alert when drawdown exceeds this percentage",
				Min:         ptr(0.0),
				Max:         ptr(100.0),
				Default:     ptr(10.0),
				Unit:        "%",
			},
		},
	},
	enum.AlertTypeProfitTarget: {
		Type:            enum.AlertTypeProfitTarget,
		Label:           "Profit Target",
		Description:     "Triggered when cumulative profit reaches target",
		DefaultSeverity: enum.AlertSeverityInfo,
		ConditionFields: []ConditionField{
			{
				Name:        "profit_target",
				Label:       "Profit target",
				Type:        ConditionFieldTypeNumber,
				Required:    true,
				Description: "Target profit percentage to trigger alert",
				Min:         ptr(0.0),
				Max:         ptr(10000.0),
				Default:     ptr(20.0),
				Unit:        "%",
			},
		},
	},
	enum.AlertTypeConnectionIssue: {
		Type:            enum.AlertTypeConnectionIssue,
		Label:           "Connection Issue",
		Description:     "Triggered when connection to exchange or runner fails",
		DefaultSeverity: enum.AlertSeverityCritical,
		ConditionFields: []ConditionField{},
	},
	enum.AlertTypeBacktestCompleted: {
		Type:            enum.AlertTypeBacktestCompleted,
		Label:           "Backtest Completed",
		Description:     "Triggered when a backtest finishes successfully",
		DefaultSeverity: enum.AlertSeverityInfo,
		ConditionFields: []ConditionField{},
	},
	enum.AlertTypeBacktestFailed: {
		Type:            enum.AlertTypeBacktestFailed,
		Label:           "Backtest Failed",
		Description:     "Triggered when a backtest fails",
		DefaultSeverity: enum.AlertSeverityWarning,
		ConditionFields: []ConditionField{},
	},
}

// resourceTypeAlertTypes defines which alert types are available for each resource type
var resourceTypeAlertTypes = map[enum.AlertResourceType][]enum.AlertType{
	enum.AlertResourceTypeOrganization: {
		// Organization-wide: all alert types available
		enum.AlertTypeStatusChange,
		enum.AlertTypeTradeOpened,
		enum.AlertTypeTradeClosed,
		enum.AlertTypeLargeProfitLoss,
		enum.AlertTypeDailyLossLimit,
		enum.AlertTypeDrawdownThreshold,
		enum.AlertTypeProfitTarget,
		enum.AlertTypeConnectionIssue,
		enum.AlertTypeBacktestCompleted,
		enum.AlertTypeBacktestFailed,
	},
	enum.AlertResourceTypeBot: {
		// Bot-specific alerts
		enum.AlertTypeStatusChange,
		enum.AlertTypeTradeOpened,
		enum.AlertTypeTradeClosed,
		enum.AlertTypeLargeProfitLoss,
		enum.AlertTypeDailyLossLimit,
		enum.AlertTypeDrawdownThreshold,
		enum.AlertTypeProfitTarget,
		enum.AlertTypeConnectionIssue,
	},
	enum.AlertResourceTypeStrategy: {
		// Strategy-specific: alerts for all bots using this strategy + backtest alerts
		enum.AlertTypeStatusChange,
		enum.AlertTypeTradeOpened,
		enum.AlertTypeTradeClosed,
		enum.AlertTypeLargeProfitLoss,
		enum.AlertTypeDailyLossLimit,
		enum.AlertTypeDrawdownThreshold,
		enum.AlertTypeProfitTarget,
		enum.AlertTypeBacktestCompleted,
		enum.AlertTypeBacktestFailed,
	},
	enum.AlertResourceTypeRunner: {
		// Runner-specific: connection and status alerts
		enum.AlertTypeConnectionIssue,
	},
}

// GetAlertTypesForResource returns available alert types for a given resource type
// The resourceID parameter is reserved for future smart filtering (e.g., based on resource state)
func GetAlertTypesForResource(resourceType enum.AlertResourceType, resourceID *string) []AlertTypeInfo {
	alertTypes, ok := resourceTypeAlertTypes[resourceType]
	if !ok {
		return []AlertTypeInfo{}
	}

	result := make([]AlertTypeInfo, 0, len(alertTypes))
	for _, at := range alertTypes {
		if info, exists := alertTypeMetadata[at]; exists {
			result = append(result, info)
		}
	}

	return result
}

// GetAlertTypeInfo returns metadata for a specific alert type
func GetAlertTypeInfo(alertType enum.AlertType) (AlertTypeInfo, bool) {
	info, ok := alertTypeMetadata[alertType]
	return info, ok
}

func ptr(v float64) *float64 {
	return &v
}
