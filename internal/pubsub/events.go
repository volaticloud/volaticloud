package pubsub

import "time"

// EventType identifies the type of event for type switches.
type EventType string

const (
	EventTypeBotStatus        EventType = "bot_status"
	EventTypeBacktestProgress EventType = "backtest_progress"
	EventTypeAlertCreated     EventType = "alert_created"
	EventTypeTradeUpdated     EventType = "trade_updated"
	EventTypeRunnerStatus     EventType = "runner_status"
	EventTypeRunnerProgress   EventType = "runner_progress"
)

// BotEvent represents a bot status change event.
type BotEvent struct {
	Type      EventType `json:"type"`
	BotID     string    `json:"bot_id"`
	Status    string    `json:"status"` // BotStatus enum value
	Healthy   bool      `json:"healthy"`
	Error     string    `json:"error,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// BacktestEvent represents a backtest progress update.
type BacktestEvent struct {
	Type       EventType `json:"type"`
	BacktestID string    `json:"backtest_id"`
	StrategyID string    `json:"strategy_id"`
	Status     string    `json:"status"`   // BacktestStatus enum value
	Progress   float64   `json:"progress"` // 0.0 to 1.0
	Error      string    `json:"error,omitempty"`
	Timestamp  time.Time `json:"timestamp"`
}

// AlertEvent represents a new alert notification.
type AlertEvent struct {
	Type        EventType `json:"type"`
	AlertID     string    `json:"alert_id"`
	RuleID      string    `json:"rule_id"`
	OwnerID     string    `json:"owner_id"`
	AlertType   string    `json:"alert_type"`
	Severity    string    `json:"severity"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Timestamp   time.Time `json:"timestamp"`
}

// TradeEvent represents a trade update.
type TradeEvent struct {
	Type      EventType `json:"type"`
	TradeID   string    `json:"trade_id"`
	BotID     string    `json:"bot_id"`
	Pair      string    `json:"pair"`
	Side      string    `json:"side"` // buy/sell
	Status    string    `json:"status"`
	ProfitPct float64   `json:"profit_pct,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// RunnerEvent represents a runner status change or progress update.
type RunnerEvent struct {
	Type         EventType `json:"type"`
	RunnerID     string    `json:"runner_id"`
	Status       string    `json:"status"`                  // DataDownloadStatus enum value
	Progress     float64   `json:"progress,omitempty"`      // 0.0 to 100.0 for download progress
	CurrentPhase string    `json:"current_phase,omitempty"` // Current phase (e.g., "downloading binance", "packaging")
	Error        string    `json:"error,omitempty"`
	Timestamp    time.Time `json:"timestamp"`
}
