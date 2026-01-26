package graph

import (
	"testing"
)

func TestIsDevMode(t *testing.T) {
	tests := []struct {
		name           string
		allowedOrigins []string
		want           bool
	}{
		{
			name:           "empty origins list",
			allowedOrigins: []string{},
			want:           true,
		},
		{
			name:           "nil origins list",
			allowedOrigins: nil,
			want:           true,
		},
		{
			name:           "localhost in origins",
			allowedOrigins: []string{"http://localhost:3000"},
			want:           true,
		},
		{
			name:           "127.0.0.1 in origins",
			allowedOrigins: []string{"http://127.0.0.1:3000"},
			want:           true,
		},
		{
			name:           "localhost:8080 in origins",
			allowedOrigins: []string{"http://localhost:8080", "https://app.example.com"},
			want:           true,
		},
		{
			name:           "production only origins",
			allowedOrigins: []string{"https://app.volaticloud.com", "https://volaticloud.com"},
			want:           false,
		},
		{
			name:           "mixed production and localhost",
			allowedOrigins: []string{"https://app.volaticloud.com", "http://localhost:3000"},
			want:           true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isDevMode(tt.allowedOrigins)
			if got != tt.want {
				t.Errorf("isDevMode(%v) = %v, want %v", tt.allowedOrigins, got, tt.want)
			}
		})
	}
}

func TestWebSocketAuthError_Error(t *testing.T) {
	err := &WebSocketAuthError{Message: "test error message"}
	got := err.Error()
	want := "test error message"
	if got != want {
		t.Errorf("WebSocketAuthError.Error() = %q, want %q", got, want)
	}
}

func TestWebSocketConfig_Fields(t *testing.T) {
	// Test that WebSocketConfig can be properly instantiated
	cfg := WebSocketConfig{
		AllowedOrigins:        []string{"https://app.example.com"},
		KeepAlivePingInterval: 10,
		AuthClient:            nil, // nil for testing
	}

	if len(cfg.AllowedOrigins) != 1 {
		t.Errorf("Expected 1 allowed origin, got %d", len(cfg.AllowedOrigins))
	}
	if cfg.KeepAlivePingInterval != 10 {
		t.Errorf("Expected KeepAlivePingInterval=10, got %v", cfg.KeepAlivePingInterval)
	}
}

// TestCreateWebsocketInitFunc_NoToken tests that missing auth token is rejected.
// Note: Full integration tests require a real Keycloak client.
func TestCreateWebsocketInitFunc_NilAuthClient(t *testing.T) {
	// When AuthClient is nil, createWebsocketInitFunc should still return a valid function
	// that can be called (even if it will fail at runtime)
	initFunc := createWebsocketInitFunc(nil)
	if initFunc == nil {
		t.Error("Expected createWebsocketInitFunc to return non-nil function")
	}
}
