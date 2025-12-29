package alert

import (
	"strings"
	"testing"
)

func TestValidateEventData(t *testing.T) {
	tests := []struct {
		name    string
		data    map[string]interface{}
		check   func(map[string]interface{}) bool
		wantErr bool
	}{
		{
			name:    "nil data",
			data:    nil,
			wantErr: false,
		},
		{
			name:    "empty data",
			data:    map[string]interface{}{},
			wantErr: false,
		},
		{
			name: "valid bot_name",
			data: map[string]interface{}{
				"bot_name": "My Bot",
			},
			check: func(d map[string]interface{}) bool {
				return d["bot_name"] == "My Bot"
			},
			wantErr: false,
		},
		{
			name: "truncate long bot_name",
			data: map[string]interface{}{
				"bot_name": strings.Repeat("a", 300),
			},
			check: func(d map[string]interface{}) bool {
				name := d["bot_name"].(string)
				return len(name) == MaxNameLength
			},
			wantErr: false,
		},
		{
			name: "truncate long error_message",
			data: map[string]interface{}{
				"error_message": strings.Repeat("e", 6000),
			},
			check: func(d map[string]interface{}) bool {
				msg := d["error_message"].(string)
				return len(msg) < 6000 && strings.HasSuffix(msg, "(truncated)")
			},
			wantErr: false,
		},
		{
			name: "valid strategy_name",
			data: map[string]interface{}{
				"strategy_name": "MACD Strategy",
			},
			check: func(d map[string]interface{}) bool {
				return d["strategy_name"] == "MACD Strategy"
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateEventData(tt.data)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateEventData() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.check != nil && !tt.check(tt.data) {
				t.Errorf("ValidateEventData() check failed")
			}
		})
	}
}

func TestValidateRecipients(t *testing.T) {
	tests := []struct {
		name       string
		recipients []string
		wantErr    bool
	}{
		{
			name:       "empty recipients",
			recipients: []string{},
			wantErr:    true,
		},
		{
			name:       "nil recipients",
			recipients: nil,
			wantErr:    true,
		},
		{
			name:       "valid single recipient",
			recipients: []string{"test@example.com"},
			wantErr:    false,
		},
		{
			name:       "valid multiple recipients",
			recipients: []string{"a@example.com", "b@example.com"},
			wantErr:    false,
		},
		{
			name:       "invalid email - no @",
			recipients: []string{"invalid-email"},
			wantErr:    true,
		},
		{
			name:       "invalid email - no domain",
			recipients: []string{"test@"},
			wantErr:    true,
		},
		{
			name:       "invalid email - no local part",
			recipients: []string{"@example.com"},
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateRecipients(tt.recipients)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateRecipients() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestIsValidEmail(t *testing.T) {
	tests := []struct {
		email string
		want  bool
	}{
		{"test@example.com", true},
		{"user@domain.org", true},
		{"a@b.co", true},
		{"", false},
		{"invalid", false},
		{"@domain.com", false},
		{"user@", false},
		{"user@domain", false},
		{"user@d", false},
	}

	for _, tt := range tests {
		t.Run(tt.email, func(t *testing.T) {
			got := isValidEmail(tt.email)
			if got != tt.want {
				t.Errorf("isValidEmail(%q) = %v, want %v", tt.email, got, tt.want)
			}
		})
	}
}
