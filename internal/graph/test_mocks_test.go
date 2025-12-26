package graph

import (
	"context"
	"sync"

	"volaticloud/internal/keycloak"
)

// MockUMAClient is a mock implementation of UMAClient for testing
type MockUMAClient struct {
	keycloak.UMAClient
	mu          sync.RWMutex
	permissions map[string][]string // resourceID -> []scopes
}

// NewMockUMAClient creates a new mock UMA client
func NewMockUMAClient() *MockUMAClient {
	return &MockUMAClient{
		permissions: make(map[string][]string),
	}
}

// SetPermissions configures the mock to return specific permissions for resources
// permissions is a map of resourceID -> []scopes (e.g., {"resource-123": {"view", "edit"}})
func (m *MockUMAClient) SetPermissions(permissions map[string][]string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.permissions = permissions
}

// CheckPermission checks if the user has the specified scope on the resource
func (m *MockUMAClient) CheckPermission(ctx context.Context, token, resourceID, scope string) (bool, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	scopes, exists := m.permissions[resourceID]
	if !exists {
		return false, nil
	}

	// Check if the requested scope exists in the allowed scopes
	for _, s := range scopes {
		if s == scope {
			return true, nil
		}
	}

	return false, nil
}

// CreateResource is a no-op for the mock (not needed in tests)
func (m *MockUMAClient) CreateResource(ctx context.Context, resourceID, resourceName string, scopes []string, attributes map[string][]string) error {
	return nil
}

// DeleteResource is a no-op for the mock (not needed in tests)
func (m *MockUMAClient) DeleteResource(ctx context.Context, resourceID string) error {
	return nil
}

// CreatePermission is a no-op for the mock (not needed in tests)
func (m *MockUMAClient) CreatePermission(ctx context.Context, resourceID, ownerID string) error {
	return nil
}

// UpdateResource is a no-op for the mock (not needed in tests)
func (m *MockUMAClient) UpdateResource(ctx context.Context, resourceID string, attributes map[string][]string) error {
	return nil
}

// SyncResourceScopes is a no-op for the mock (not needed in tests)
func (m *MockUMAClient) SyncResourceScopes(ctx context.Context, resourceID, resourceName string, scopes []string, attributes map[string][]string) error {
	return nil
}
