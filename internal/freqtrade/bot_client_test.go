package freqtrade

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewBotClient(t *testing.T) {
	tests := []struct {
		name     string
		baseURL  string
		username string
		password string
	}{
		{
			name:     "valid client creation",
			baseURL:  "http://localhost:8080",
			username: "test-user",
			password: "test-pass",
		},
		{
			name:     "client with HTTPS URL",
			baseURL:  "https://api.example.com",
			username: "user",
			password: "pass",
		},
		{
			name:     "client with IP address",
			baseURL:  "http://192.168.1.100:8080",
			username: "admin",
			password: "secret",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewBotClient(tt.baseURL, tt.username, tt.password)

			require.NotNil(t, client, "Client should not be nil")
			assert.NotNil(t, client.client, "API client should be initialized")
			assert.Equal(t, tt.username, client.username, "Username should match")
			assert.Equal(t, tt.password, client.password, "Password should match")

			// Verify the server configuration
			require.NotNil(t, client.client.GetConfig(), "Client config should not be nil")
			servers := client.client.GetConfig().Servers
			require.Len(t, servers, 1, "Should have exactly one server configured")
			assert.Equal(t, tt.baseURL, servers[0].URL, "Server URL should match")
		})
	}
}

func TestNewBotClientFromContainerIP(t *testing.T) {
	tests := []struct {
		name        string
		containerIP string
		apiPort     int
		username    string
		password    string
		expectedURL string
	}{
		{
			name:        "valid container IP with port",
			containerIP: "172.17.0.2",
			apiPort:     8080,
			username:    "test-user",
			password:    "test-pass",
			expectedURL: "http://172.17.0.2:8080",
		},
		{
			name:        "container IP with custom port",
			containerIP: "172.17.0.5",
			apiPort:     9999,
			username:    "admin",
			password:    "secret",
			expectedURL: "http://172.17.0.5:9999",
		},
		{
			name:        "container IP with default port (zero)",
			containerIP: "172.17.0.3",
			apiPort:     0, // Should default to 8080
			username:    "user",
			password:    "pass",
			expectedURL: "http://172.17.0.3:8080",
		},
		{
			name:        "IPv6 address",
			containerIP: "fe80::1",
			apiPort:     8080,
			username:    "user",
			password:    "pass",
			expectedURL: "http://fe80::1:8080",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewBotClientFromContainerIP(tt.containerIP, tt.apiPort, tt.username, tt.password)

			require.NotNil(t, client, "Client should not be nil")
			assert.NotNil(t, client.client, "API client should be initialized")
			assert.Equal(t, tt.username, client.username, "Username should match")
			assert.Equal(t, tt.password, client.password, "Password should match")

			// Verify the server URL
			servers := client.client.GetConfig().Servers
			require.Len(t, servers, 1, "Should have exactly one server configured")
			assert.Equal(t, tt.expectedURL, servers[0].URL, "Generated URL should match expected")
		})
	}
}

func TestBotClient_ContextWithAuth(t *testing.T) {
	client := NewBotClient("http://localhost:8080", "test-user", "test-pass")

	ctx := context.Background()
	authCtx := client.contextWithAuth(ctx)

	require.NotNil(t, authCtx, "Context should not be nil")

	// Extract the auth from context
	authValue := authCtx.Value(ContextBasicAuth)
	require.NotNil(t, authValue, "Context should contain auth value")

	basicAuth, ok := authValue.(BasicAuth)
	require.True(t, ok, "Auth value should be BasicAuth type")
	assert.Equal(t, "test-user", basicAuth.UserName, "Username in context should match")
	assert.Equal(t, "test-pass", basicAuth.Password, "Password in context should match")
}

func TestBotClient_ContextWithAuth_PreservesExistingValues(t *testing.T) {
	client := NewBotClient("http://localhost:8080", "user", "pass")

	// Create context with existing value
	type contextKey string
	const testKey contextKey = "test-key"
	ctx := context.WithValue(context.Background(), testKey, "test-value")

	authCtx := client.contextWithAuth(ctx)

	// Verify original value is preserved
	originalValue := authCtx.Value(testKey)
	assert.Equal(t, "test-value", originalValue, "Original context value should be preserved")

	// Verify auth was added
	authValue := authCtx.Value(ContextBasicAuth)
	require.NotNil(t, authValue, "Auth should be added to context")
}

func TestBotClient_EmptyCredentials(t *testing.T) {
	// Test that client can be created with empty credentials
	// (might be needed for public endpoints or testing)
	client := NewBotClient("http://localhost:8080", "", "")

	require.NotNil(t, client, "Client should be created even with empty credentials")
	assert.Equal(t, "", client.username, "Username should be empty")
	assert.Equal(t, "", client.password, "Password should be empty")

	ctx := client.contextWithAuth(context.Background())
	authValue := ctx.Value(ContextBasicAuth)
	require.NotNil(t, authValue, "Context should contain auth value")

	basicAuth := authValue.(BasicAuth)
	assert.Equal(t, "", basicAuth.UserName, "Username should be empty in context")
	assert.Equal(t, "", basicAuth.Password, "Password should be empty in context")
}

func TestBotClient_MultipleInstances(t *testing.T) {
	// Test that multiple client instances can coexist
	client1 := NewBotClient("http://localhost:8080", "user1", "pass1")
	client2 := NewBotClient("http://localhost:9090", "user2", "pass2")

	// Verify they are independent
	assert.NotEqual(t, client1.username, client2.username, "Usernames should be different")
	assert.NotEqual(t, client1.password, client2.password, "Passwords should be different")

	servers1 := client1.client.GetConfig().Servers
	servers2 := client2.client.GetConfig().Servers

	assert.NotEqual(t, servers1[0].URL, servers2[0].URL, "Server URLs should be different")
}

func TestNewBotClientFromContainerIP_DefaultPort(t *testing.T) {
	// Explicitly test default port behavior
	client := NewBotClientFromContainerIP("172.17.0.2", 0, "user", "pass")

	servers := client.client.GetConfig().Servers
	require.Len(t, servers, 1)
	assert.Equal(t, "http://172.17.0.2:8080", servers[0].URL,
		"Should use default port 8080 when port is 0")
}

func TestBotClient_ConfigurationImmutability(t *testing.T) {
	// Test that creating a client doesn't affect other clients
	client1 := NewBotClient("http://localhost:8080", "user", "pass")
	config1 := client1.client.GetConfig()

	client2 := NewBotClient("http://localhost:9090", "admin", "secret")
	config2 := client2.client.GetConfig()

	// Verify configs are independent
	assert.NotEqual(t, config1.Servers[0].URL, config2.Servers[0].URL,
		"Client configurations should be independent")
}
