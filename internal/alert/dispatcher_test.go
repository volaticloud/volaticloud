package alert

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"volaticloud/internal/alert/channel"
	"volaticloud/internal/enum"
)

// mockChannel implements channel.Channel for testing
type mockChannel struct {
	sendCalls []channel.Message
	sendError error
}

func (m *mockChannel) Send(_ context.Context, msg channel.Message) error {
	m.sendCalls = append(m.sendCalls, msg)
	return m.sendError
}

func (m *mockChannel) Type() channel.ChannelType {
	return channel.ChannelType("mock")
}

func (m *mockChannel) Test(_ context.Context, _ string) error {
	return nil
}

func TestDispatcher_GroupAlerts(t *testing.T) {
	dispatcher := &Dispatcher{}

	tests := []struct {
		name           string
		alerts         []Alert
		wantGroupCount int
	}{
		{
			name:           "empty alerts",
			alerts:         []Alert{},
			wantGroupCount: 0,
		},
		{
			name: "single recipient group",
			alerts: []Alert{
				{ID: uuid.New(), Recipients: []string{"a@test.com"}},
				{ID: uuid.New(), Recipients: []string{"a@test.com"}},
			},
			wantGroupCount: 1,
		},
		{
			name: "multiple recipient groups",
			alerts: []Alert{
				{ID: uuid.New(), Recipients: []string{"a@test.com"}},
				{ID: uuid.New(), Recipients: []string{"b@test.com"}},
				{ID: uuid.New(), Recipients: []string{"a@test.com"}},
			},
			wantGroupCount: 2,
		},
		{
			name: "multiple recipients per alert - different groups",
			alerts: []Alert{
				{ID: uuid.New(), Recipients: []string{"a@test.com", "b@test.com"}},
				{ID: uuid.New(), Recipients: []string{"a@test.com"}},
			},
			wantGroupCount: 2,
		},
		{
			name: "multiple recipients per alert - same group",
			alerts: []Alert{
				{ID: uuid.New(), Recipients: []string{"a@test.com", "b@test.com"}},
				{ID: uuid.New(), Recipients: []string{"a@test.com", "b@test.com"}},
			},
			wantGroupCount: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			groups := dispatcher.groupAlerts(tt.alerts)
			if len(groups) != tt.wantGroupCount {
				t.Errorf("groupAlerts() returned %d groups, want %d", len(groups), tt.wantGroupCount)
			}
		})
	}
}

func TestDispatcher_BuildDigest(t *testing.T) {
	dispatcher := &Dispatcher{}

	alerts := []Alert{
		{
			Severity: enum.AlertSeverityCritical,
			Subject:  "Bot crashed",
		},
		{
			Severity: enum.AlertSeverityWarning,
			Subject:  "Trade closed",
		},
		{
			Severity: enum.AlertSeverityInfo,
			Subject:  "Backtest complete",
		},
	}

	body, htmlBody := dispatcher.buildDigest(alerts)

	// Check plain text body
	if body == "" {
		t.Error("buildDigest() returned empty body")
	}
	for _, alert := range alerts {
		if !containsString(body, string(alert.Severity)) {
			t.Errorf("body missing severity: %s", alert.Severity)
		}
		if !containsString(body, alert.Subject) {
			t.Errorf("body missing subject: %s", alert.Subject)
		}
	}

	// Check HTML body
	if htmlBody == "" {
		t.Error("buildDigest() returned empty htmlBody")
	}
	if !containsString(htmlBody, "<h2>") {
		t.Error("htmlBody missing header tag")
	}
	if !containsString(htmlBody, "<li>") {
		t.Error("htmlBody missing list items")
	}
}

func TestDispatcher_SendBatch_NoChannel(t *testing.T) {
	dispatcher := &Dispatcher{
		emailChannel: nil,
	}

	alerts := []Alert{
		{ID: uuid.New(), Recipients: []string{"test@test.com"}},
	}

	err := dispatcher.SendBatch(context.Background(), alerts)
	if err != nil {
		t.Errorf("SendBatch() with no channel should not error, got: %v", err)
	}
}

func TestDispatcher_SendBatch_EmptyAlerts(t *testing.T) {
	mock := &mockChannel{}
	dispatcher := &Dispatcher{
		emailChannel: mock,
	}

	err := dispatcher.SendBatch(context.Background(), []Alert{})
	if err != nil {
		t.Errorf("SendBatch() with empty alerts should not error, got: %v", err)
	}
	if len(mock.sendCalls) != 0 {
		t.Errorf("SendBatch() with empty alerts should not send, got %d calls", len(mock.sendCalls))
	}
}

func TestDispatcher_SendBatch_Success(t *testing.T) {
	mock := &mockChannel{}
	dispatcher := &Dispatcher{
		emailChannel: mock,
	}

	alerts := []Alert{
		{ID: uuid.New(), Recipients: []string{"a@test.com"}, Severity: enum.AlertSeverityCritical, Subject: "Alert 1"},
		{ID: uuid.New(), Recipients: []string{"a@test.com"}, Severity: enum.AlertSeverityWarning, Subject: "Alert 2"},
	}

	err := dispatcher.SendBatch(context.Background(), alerts)
	if err != nil {
		t.Errorf("SendBatch() error = %v", err)
	}

	if len(mock.sendCalls) != 1 {
		t.Errorf("SendBatch() expected 1 send call, got %d", len(mock.sendCalls))
	}

	if len(mock.sendCalls) > 0 {
		msg := mock.sendCalls[0]
		if !containsString(msg.Subject, "2 alerts") {
			t.Errorf("SendBatch() subject should mention alert count, got: %s", msg.Subject)
		}
		if len(msg.Recipients) != 1 || msg.Recipients[0] != "a@test.com" {
			t.Errorf("SendBatch() wrong recipients: %v", msg.Recipients)
		}
	}
}

func TestDefaultTemplate(t *testing.T) {
	tests := []struct {
		alertType    enum.AlertType
		wantSubject  string
		wantBodyPart string
	}{
		{
			alertType:    enum.AlertTypeStatusChange,
			wantSubject:  "Status",
			wantBodyPart: "",
		},
		{
			alertType:    enum.AlertTypeTradeOpened,
			wantSubject:  "Trade",
			wantBodyPart: "",
		},
		{
			alertType:    enum.AlertTypeTradeClosed,
			wantSubject:  "Trade",
			wantBodyPart: "",
		},
		{
			alertType:    enum.AlertTypeBacktestCompleted,
			wantSubject:  "Backtest",
			wantBodyPart: "",
		},
	}

	for _, tt := range tests {
		t.Run(string(tt.alertType), func(t *testing.T) {
			data := map[string]interface{}{
				"bot_name":      "Test Bot",
				"strategy_name": "Test Strategy",
				"pair":          "BTC/USDT",
				"old_status":    "running",
				"new_status":    "stopped",
				"profit_ratio":  0.05,
				"timestamp":     time.Now(),
			}

			subject, body, htmlBody := defaultTemplate(tt.alertType, data)

			if subject == "" {
				t.Error("defaultTemplate() returned empty subject")
			}
			if body == "" {
				t.Error("defaultTemplate() returned empty body")
			}
			if htmlBody == "" {
				t.Error("defaultTemplate() returned empty htmlBody")
			}
		})
	}
}

func TestDefaultTemplate_UnknownType(t *testing.T) {
	data := map[string]interface{}{}
	subject, body, htmlBody := defaultTemplate(enum.AlertType("unknown"), data)

	if subject == "" {
		t.Error("defaultTemplate() with unknown type should return fallback subject")
	}
	if body == "" {
		t.Error("defaultTemplate() with unknown type should return fallback body")
	}
	if htmlBody == "" {
		t.Error("defaultTemplate() with unknown type should return fallback htmlBody")
	}
}

func TestAlert_Struct(t *testing.T) {
	// Test that Alert struct can be created properly
	alert := Alert{
		ID:           uuid.New(),
		RuleID:       uuid.New(),
		ChannelType:  channel.ChannelTypeEmail,
		AlertType:    enum.AlertTypeStatusChange,
		Severity:     enum.AlertSeverityCritical,
		ResourceType: enum.AlertResourceTypeBot,
		ResourceID:   uuidPtr(uuid.New()),
		Subject:      "Test Subject",
		Body:         "Test Body",
		HTMLBody:     "<p>Test Body</p>",
		Recipients:   []string{"test@example.com"},
		Context:      map[string]interface{}{"key": "value"},
		CreatedAt:    time.Now(),
	}

	if alert.ID == uuid.Nil {
		t.Error("Alert ID should not be nil")
	}
	if alert.Subject != "Test Subject" {
		t.Errorf("Alert Subject = %s, want Test Subject", alert.Subject)
	}
}

// Helper functions

func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsSubstring(s, substr))
}

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func uuidPtr(u uuid.UUID) *uuid.UUID {
	return &u
}

// Note: Dispatch method requires a full database setup for integration testing.
// The cooldown logic is already tested via TestCheckCooldown in evaluator_test.go.
