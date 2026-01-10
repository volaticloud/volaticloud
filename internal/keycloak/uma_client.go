package keycloak

import (
	"context"
	"fmt"
	"log"

	"github.com/Nerzal/gocloak/v13"
)

// UMAClientInterface defines the interface for UMA 2.0 operations
// This allows for mocking in tests
type UMAClientInterface interface {
	CheckPermission(ctx context.Context, token, resourceID, scope string) (bool, error)
	CreateResource(ctx context.Context, resourceID, resourceName string, scopes []string, attributes map[string][]string) error
	GetResource(ctx context.Context, resourceID string) (*gocloak.ResourceRepresentation, error)
	UpdateResource(ctx context.Context, resourceID string, attributes map[string][]string) error
	SyncResourceScopes(ctx context.Context, resourceID, resourceName string, scopes []string, attributes map[string][]string) error
	DeleteResource(ctx context.Context, resourceID string) error
	CreatePermission(ctx context.Context, resourceID, ownerID string) error
}

// UMAClient handles UMA 2.0 (User-Managed Access) operations for resource-level authorization
type UMAClient struct {
	client       *gocloak.GoCloak
	realm        string
	clientID     string
	clientSecret string
}

// NewUMAClient creates a new UMA client for Keycloak authorization services
func NewUMAClient(keycloakURL, realm, clientID, clientSecret string) *UMAClient {
	client := gocloak.NewClient(keycloakURL)

	return &UMAClient{
		client:       client,
		realm:        realm,
		clientID:     clientID,
		clientSecret: clientSecret,
	}
}

// getClientToken retrieves a client credentials token for admin operations
func (u *UMAClient) getClientToken(ctx context.Context) (string, error) {
	token, err := u.client.LoginClient(ctx, u.clientID, u.clientSecret, u.realm)
	if err != nil {
		return "", fmt.Errorf("failed to get client token: %w", err)
	}

	return token.AccessToken, nil
}

// CreateResource registers a new resource in Keycloak with specified scopes and attributes
// resourceID should be the Strategy UUID
// resourceName is a human-readable name (e.g., "Strategy: MyStrategy")
// scopes are the available permissions (e.g., ["view", "edit", "backtest", "delete"])
// attributes are custom key-value pairs (e.g., ownerId, type)
func (u *UMAClient) CreateResource(ctx context.Context, resourceID, resourceName string, scopes []string, attributes map[string][]string) error {
	token, err := u.getClientToken(ctx)
	if err != nil {
		return err
	}

	log.Printf("DEBUG: Creating resource with clientID=%s, realm=%s, resourceID=%s", u.clientID, u.realm, resourceID)

	// Convert scopes to gocloak format
	resourceScopes := make([]gocloak.ScopeRepresentation, 0, len(scopes))
	for _, scope := range scopes {
		resourceScopes = append(resourceScopes, gocloak.ScopeRepresentation{
			Name: gocloak.StringP(scope),
		})
	}

	// Create resource
	// Name is the unique identifier (UUID), DisplayName is the human-readable title
	resource := gocloak.ResourceRepresentation{
		ID:          gocloak.StringP(resourceID),
		Name:        gocloak.StringP(resourceID),   // Use UUID as the name for uniqueness
		DisplayName: gocloak.StringP(resourceName), // Human-readable name with version
		Type:        gocloak.StringP("urn:" + u.clientID + ":resources:tenant"),
		Scopes:      &resourceScopes,
		Attributes:  &attributes, // Custom attributes (ownerId, type, etc.)
		// Owner is set automatically by Keycloak based on client token
		OwnerManagedAccess: gocloak.BoolP(true), // Enable user-managed access for permission sharing
	}

	log.Printf("DEBUG: Calling CreateResourceClient API (UMA Protection API)...")
	result, err := u.client.CreateResourceClient(ctx, token, u.realm, resource)
	if err != nil {
		log.Printf("DEBUG: CreateResourceClient failed with error: %v", err)
		return fmt.Errorf("failed to create resource in Keycloak: %w", err)
	}

	log.Printf("DEBUG: CreateResourceClient succeeded, result: %+v", result)
	log.Printf("Created Keycloak resource: %s (%s) with scopes: %v", resourceID, resourceName, scopes)
	return nil
}

// DeleteResource removes a resource from Keycloak
func (u *UMAClient) DeleteResource(ctx context.Context, resourceID string) error {
	token, err := u.getClientToken(ctx)
	if err != nil {
		return err
	}

	// Use UMA Protection API (DeleteResourceClient) instead of Admin API
	err = u.client.DeleteResourceClient(ctx, token, u.realm, resourceID)
	if err != nil {
		// Log but don't fail - resource might not exist in Keycloak
		log.Printf("Warning: failed to delete Keycloak resource %s: %v", resourceID, err)
		return nil
	}

	log.Printf("Deleted Keycloak resource: %s", resourceID)
	return nil
}

// GetResource retrieves a resource by ID from Keycloak
// Returns the resource representation or an error if not found
func (u *UMAClient) GetResource(ctx context.Context, resourceID string) (*gocloak.ResourceRepresentation, error) {
	token, err := u.getClientToken(ctx)
	if err != nil {
		return nil, err
	}

	// Use UMA Protection API to get resource by name (which is the resource ID)
	resources, err := u.client.GetResourcesClient(ctx, token, u.realm, gocloak.GetResourceParams{
		Name: gocloak.StringP(resourceID),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get resource: %w", err)
	}

	if len(resources) == 0 {
		return nil, fmt.Errorf("resource not found: %s", resourceID)
	}

	return resources[0], nil
}

// UpdateResource updates the attributes of an existing resource in Keycloak
// This is used to sync the public attribute when visibility is toggled
func (u *UMAClient) UpdateResource(ctx context.Context, resourceID string, attributes map[string][]string) error {
	token, err := u.getClientToken(ctx)
	if err != nil {
		return err
	}

	// Get existing resource first to preserve other fields
	resources, err := u.client.GetResourcesClient(ctx, token, u.realm, gocloak.GetResourceParams{
		Name: gocloak.StringP(resourceID),
	})
	if err != nil {
		return fmt.Errorf("failed to get resource: %w", err)
	}

	if len(resources) == 0 {
		return fmt.Errorf("resource not found: %s", resourceID)
	}

	existingResource := resources[0]

	// Update attributes on existing resource
	existingResource.Attributes = &attributes

	// Update resource using UMA Protection API
	err = u.client.UpdateResourceClient(ctx, token, u.realm, *existingResource)
	if err != nil {
		return fmt.Errorf("failed to update resource in Keycloak: %w", err)
	}

	log.Printf("Updated Keycloak resource: %s with attributes: %v", resourceID, attributes)
	return nil
}

// SyncResourceScopes updates the scopes of an existing resource in Keycloak
// This is used during startup to ensure all resources have the latest scopes
// If the resource doesn't exist, it will be created
func (u *UMAClient) SyncResourceScopes(ctx context.Context, resourceID, resourceName string, scopes []string, attributes map[string][]string) error {
	token, err := u.getClientToken(ctx)
	if err != nil {
		return err
	}

	// Get existing resource
	resources, err := u.client.GetResourcesClient(ctx, token, u.realm, gocloak.GetResourceParams{
		Name: gocloak.StringP(resourceID),
	})
	if err != nil {
		return fmt.Errorf("failed to get resource: %w", err)
	}

	// If resource doesn't exist, create it
	if len(resources) == 0 {
		return u.CreateResource(ctx, resourceID, resourceName, scopes, attributes)
	}

	existingResource := resources[0]

	// Convert scopes to ScopeRepresentation format
	// Note: Use Scopes field for updates (ResourceScopes is read-only response field)
	resourceScopes := make([]gocloak.ScopeRepresentation, len(scopes))
	for i, scope := range scopes {
		resourceScopes[i] = gocloak.ScopeRepresentation{
			Name: gocloak.StringP(scope),
		}
	}

	// Update scopes and attributes
	// Scopes is the writable field, ResourceScopes is read-only
	existingResource.Scopes = &resourceScopes
	existingResource.Attributes = &attributes

	// Update resource using UMA Protection API
	err = u.client.UpdateResourceClient(ctx, token, u.realm, *existingResource)
	if err != nil {
		return fmt.Errorf("failed to update resource scopes in Keycloak: %w", err)
	}

	log.Printf("Synced Keycloak resource scopes: %s with scopes: %v", resourceID, scopes)
	return nil
}

// CheckPermission verifies if a user has a specific scope on a resource
// userToken is the user's JWT access token
// resourceID is the Strategy UUID
// scope is the permission to check (e.g., "edit", "delete")
// Returns true if user has permission, false otherwise
func (u *UMAClient) CheckPermission(ctx context.Context, userToken, resourceID, scope string) (bool, error) {
	// Request permission using UMA Protection API
	// Format: resource#scope (e.g., "550e8400-e29b-41d4-a716-446655440000#edit")
	permission := fmt.Sprintf("%s#%s", resourceID, scope)

	// Request RPT (Requesting Party Token) with permission
	rpt, err := u.client.GetRequestingPartyToken(ctx, userToken, u.realm, gocloak.RequestingPartyTokenOptions{
		Permissions: &[]string{permission},
		Audience:    gocloak.StringP(u.clientID),
	})

	if err != nil {
		// If error is "access_denied", user doesn't have permission
		if IsAccessDenied(err) {
			return false, nil
		}
		return false, fmt.Errorf("failed to check permission: %w", err)
	}

	// If we got an RPT, user has permission
	return rpt != nil && rpt.AccessToken != "", nil
}

// CreatePermission creates a permission policy for a resource
// This allows fine-grained control over who can access what
// ownerID is the user ID (sub claim) who owns the resource
func (u *UMAClient) CreatePermission(ctx context.Context, resourceID, ownerID string) error {
	// TODO: Implement proper Keycloak policy creation
	// For now, resources are created with OwnerManagedAccess=true
	// which allows owners to manage their own permissions
	// Full policy creation requires understanding the correct gocloak v13 API

	log.Printf("Permission policy stub for resource %s (owner: %s) - using owner-managed access", resourceID, ownerID)
	return nil
}

// IsAccessDenied checks if an error is an access denied error
func IsAccessDenied(err error) bool {
	if err == nil {
		return false
	}
	// gocloak returns errors with "403" or "access_denied" in the message
	errMsg := err.Error()
	return contains(errMsg, "403") || contains(errMsg, "access_denied") || contains(errMsg, "not_authorized")
}

// contains checks if a string contains a substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// VerifyResourceOwnership checks if a user owns a resource by comparing owner_id
// This is a fast local check before hitting Keycloak UMA API
func VerifyResourceOwnership(ownerID, userID string) bool {
	return ownerID == userID
}
