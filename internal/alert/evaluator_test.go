package alert

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"volaticloud/internal/ent"
	"volaticloud/internal/enum"
)

func TestCheckCooldown(t *testing.T) {
	evaluator := &Evaluator{}

	tests := []struct {
		name            string
		lastTriggeredAt *time.Time
		cooldownMinutes int
		wantSuppressed  bool
	}{
		{
			name:            "no previous trigger - not suppressed",
			lastTriggeredAt: nil,
			cooldownMinutes: 5,
			wantSuppressed:  false,
		},
		{
			name:            "within cooldown period - suppressed",
			lastTriggeredAt: timePtr(time.Now().Add(-2 * time.Minute)),
			cooldownMinutes: 5,
			wantSuppressed:  true,
		},
		{
			name:            "after cooldown period - not suppressed",
			lastTriggeredAt: timePtr(time.Now().Add(-10 * time.Minute)),
			cooldownMinutes: 5,
			wantSuppressed:  false,
		},
		{
			name:            "exactly at cooldown boundary - not suppressed",
			lastTriggeredAt: timePtr(time.Now().Add(-5 * time.Minute)),
			cooldownMinutes: 5,
			wantSuppressed:  false,
		},
		{
			name:            "zero cooldown - not suppressed",
			lastTriggeredAt: timePtr(time.Now()),
			cooldownMinutes: 0,
			wantSuppressed:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule := &ent.AlertRule{
				LastTriggeredAt: tt.lastTriggeredAt,
				CooldownMinutes: tt.cooldownMinutes,
			}

			got := evaluator.CheckCooldown(rule)
			if got != tt.wantSuppressed {
				t.Errorf("CheckCooldown() = %v, want %v", got, tt.wantSuppressed)
			}
		})
	}
}

func TestEvaluateStatusConditions(t *testing.T) {
	evaluator := &Evaluator{}

	tests := []struct {
		name       string
		conditions map[string]interface{}
		newStatus  string
		wantMatch  bool
	}{
		{
			name:       "nil conditions - match all",
			conditions: nil,
			newStatus:  "error",
			wantMatch:  true,
		},
		{
			name:       "no trigger_on - match all",
			conditions: map[string]interface{}{},
			newStatus:  "error",
			wantMatch:  true,
		},
		{
			name: "trigger_on matches - array of strings",
			conditions: map[string]interface{}{
				"trigger_on": []string{"error", "stopped"},
			},
			newStatus: "error",
			wantMatch: true,
		},
		{
			name: "trigger_on matches - array of interface",
			conditions: map[string]interface{}{
				"trigger_on": []interface{}{"error", "stopped"},
			},
			newStatus: "stopped",
			wantMatch: true,
		},
		{
			name: "trigger_on does not match",
			conditions: map[string]interface{}{
				"trigger_on": []string{"error"},
			},
			newStatus: "running",
			wantMatch: false,
		},
		{
			name: "trigger_on with multiple statuses - one matches",
			conditions: map[string]interface{}{
				"trigger_on": []string{"error", "stopped", "terminated"},
			},
			newStatus: "terminated",
			wantMatch: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := evaluator.EvaluateStatusConditions(tt.conditions, tt.newStatus)
			if got != tt.wantMatch {
				t.Errorf("EvaluateStatusConditions() = %v, want %v", got, tt.wantMatch)
			}
		})
	}
}

func TestEvaluateProfitLossConditions(t *testing.T) {
	evaluator := &Evaluator{}

	tests := []struct {
		name        string
		conditions  map[string]interface{}
		profitRatio float64
		wantMatch   bool
	}{
		{
			name:        "nil conditions - match all",
			conditions:  nil,
			profitRatio: 0.05,
			wantMatch:   true,
		},
		{
			name:        "no threshold - match all",
			conditions:  map[string]interface{}{},
			profitRatio: 0.05,
			wantMatch:   true,
		},
		{
			name: "profit exceeds threshold - profit direction",
			conditions: map[string]interface{}{
				"threshold_percent": 5.0,
				"direction":         "profit",
			},
			profitRatio: 0.06, // 6%
			wantMatch:   true,
		},
		{
			name: "profit below threshold - profit direction",
			conditions: map[string]interface{}{
				"threshold_percent": 5.0,
				"direction":         "profit",
			},
			profitRatio: 0.03, // 3%
			wantMatch:   false,
		},
		{
			name: "loss exceeds threshold - loss direction",
			conditions: map[string]interface{}{
				"threshold_percent": 5.0,
				"direction":         "loss",
			},
			profitRatio: -0.06, // -6%
			wantMatch:   true,
		},
		{
			name: "loss below threshold - loss direction",
			conditions: map[string]interface{}{
				"threshold_percent": 5.0,
				"direction":         "loss",
			},
			profitRatio: -0.03, // -3%
			wantMatch:   false,
		},
		{
			name: "profit in both mode - matches profit threshold",
			conditions: map[string]interface{}{
				"threshold_percent": 5.0,
				"direction":         "both",
			},
			profitRatio: 0.06, // 6%
			wantMatch:   true,
		},
		{
			name: "loss in both mode - matches loss threshold",
			conditions: map[string]interface{}{
				"threshold_percent": 5.0,
				"direction":         "both",
			},
			profitRatio: -0.06, // -6%
			wantMatch:   true,
		},
		{
			name: "neither profit nor loss in both mode - no match",
			conditions: map[string]interface{}{
				"threshold_percent": 5.0,
				"direction":         "both",
			},
			profitRatio: 0.03, // 3%
			wantMatch:   false,
		},
		{
			name: "default direction (both) when not specified",
			conditions: map[string]interface{}{
				"threshold_percent": 5.0,
			},
			profitRatio: -0.06, // -6%
			wantMatch:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := evaluator.EvaluateProfitLossConditions(tt.conditions, tt.profitRatio)
			if got != tt.wantMatch {
				t.Errorf("EvaluateProfitLossConditions() = %v, want %v", got, tt.wantMatch)
			}
		})
	}
}

func TestEvaluateDrawdownConditions(t *testing.T) {
	evaluator := &Evaluator{}

	tests := []struct {
		name            string
		conditions      map[string]interface{}
		currentDrawdown float64
		wantMatch       bool
	}{
		{
			name:            "nil conditions - match all",
			conditions:      nil,
			currentDrawdown: 10.0,
			wantMatch:       true,
		},
		{
			name:            "no threshold - match all",
			conditions:      map[string]interface{}{},
			currentDrawdown: 10.0,
			wantMatch:       true,
		},
		{
			name: "drawdown exceeds threshold - match",
			conditions: map[string]interface{}{
				"max_drawdown_percent": 15.0,
			},
			currentDrawdown: 20.0,
			wantMatch:       true,
		},
		{
			name: "drawdown below threshold - no match",
			conditions: map[string]interface{}{
				"max_drawdown_percent": 15.0,
			},
			currentDrawdown: 10.0,
			wantMatch:       false,
		},
		{
			name: "drawdown exactly at threshold - match",
			conditions: map[string]interface{}{
				"max_drawdown_percent": 15.0,
			},
			currentDrawdown: 15.0,
			wantMatch:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := evaluator.EvaluateDrawdownConditions(tt.conditions, tt.currentDrawdown)
			if got != tt.wantMatch {
				t.Errorf("EvaluateDrawdownConditions() = %v, want %v", got, tt.wantMatch)
			}
		})
	}
}

func TestFilterByRecipients(t *testing.T) {
	evaluator := &Evaluator{}

	tests := []struct {
		name      string
		rules     []*ent.AlertRule
		wantCount int
	}{
		{
			name:      "empty rules",
			rules:     []*ent.AlertRule{},
			wantCount: 0,
		},
		{
			name: "all rules have recipients",
			rules: []*ent.AlertRule{
				{ID: uuid.New(), Recipients: []string{"user@example.com"}},
				{ID: uuid.New(), Recipients: []string{"admin@example.com"}},
			},
			wantCount: 2,
		},
		{
			name: "some rules have no recipients",
			rules: []*ent.AlertRule{
				{ID: uuid.New(), Recipients: []string{"user@example.com"}},
				{ID: uuid.New(), Recipients: []string{}},
				{ID: uuid.New(), Recipients: nil},
				{ID: uuid.New(), Recipients: []string{"admin@example.com"}},
			},
			wantCount: 2,
		},
		{
			name: "no rules have recipients",
			rules: []*ent.AlertRule{
				{ID: uuid.New(), Recipients: []string{}},
				{ID: uuid.New(), Recipients: nil},
			},
			wantCount: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := evaluator.FilterByRecipients(tt.rules)
			if len(got) != tt.wantCount {
				t.Errorf("FilterByRecipients() returned %d rules, want %d", len(got), tt.wantCount)
			}
		})
	}
}

func TestFilterByBotMode(t *testing.T) {
	evaluator := &Evaluator{}

	tests := []struct {
		name      string
		rules     []*ent.AlertRule
		botMode   string
		wantCount int
	}{
		{
			name:      "empty bot mode returns all rules",
			rules:     createRulesWithBotModeFilter(3, enum.AlertBotModeFilterAll),
			botMode:   "",
			wantCount: 3,
		},
		{
			name:      "all filter matches any mode",
			rules:     createRulesWithBotModeFilter(2, enum.AlertBotModeFilterAll),
			botMode:   "live",
			wantCount: 2,
		},
		{
			name:      "live filter matches live mode",
			rules:     createRulesWithBotModeFilter(2, enum.AlertBotModeFilterLive),
			botMode:   "live",
			wantCount: 2,
		},
		{
			name:      "live filter does not match dry_run",
			rules:     createRulesWithBotModeFilter(2, enum.AlertBotModeFilterLive),
			botMode:   "dry_run",
			wantCount: 0,
		},
		{
			name:      "dry_run filter matches dry_run mode",
			rules:     createRulesWithBotModeFilter(2, enum.AlertBotModeFilterDryRun),
			botMode:   "dry_run",
			wantCount: 2,
		},
		{
			name:      "dry_run filter does not match live",
			rules:     createRulesWithBotModeFilter(2, enum.AlertBotModeFilterDryRun),
			botMode:   "live",
			wantCount: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := evaluator.FilterByBotMode(tt.rules, tt.botMode)
			if len(got) != tt.wantCount {
				t.Errorf("FilterByBotMode() returned %d rules, want %d", len(got), tt.wantCount)
			}
		})
	}
}

// Helper functions

func timePtr(t time.Time) *time.Time {
	return &t
}

func createRulesWithBotModeFilter(count int, filter enum.AlertBotModeFilter) []*ent.AlertRule {
	rules := make([]*ent.AlertRule, count)
	for i := 0; i < count; i++ {
		rules[i] = &ent.AlertRule{
			ID:            uuid.New(),
			Recipients:    []string{"test@example.com"},
			BotModeFilter: filter,
		}
	}
	return rules
}
