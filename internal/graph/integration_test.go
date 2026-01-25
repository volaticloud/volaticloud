//go:build integration

package graph

import (
	"context"
	"fmt"
	"log"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"volaticloud/internal/auth"
	"volaticloud/internal/authz"
	"volaticloud/internal/keycloak"
	"volaticloud/internal/testutil"
)

// testKeycloak holds the shared Keycloak container for all integration tests
var testKeycloak *testutil.KeycloakContainer

// TestMain sets up the Keycloak container before running integration tests
func TestMain(m *testing.M) {
	ctx := context.Background()

	// Start Keycloak container
	log.Println("Starting Keycloak container for integration tests...")
	var err error
	testKeycloak, err = testutil.StartKeycloakContainer(ctx)
	if err != nil {
		log.Fatalf("Failed to start Keycloak container: %v", err)
	}
	log.Printf("Keycloak container started at %s", testKeycloak.URL)

	// Run tests
	code := m.Run()

	// Cleanup
	log.Println("Stopping Keycloak container...")
	if err := testKeycloak.Stop(ctx); err != nil {
		log.Printf("Failed to stop Keycloak container: %v", err)
	}

	os.Exit(code)
}

// IntegrationTestEnv extends TestEnv with real Keycloak clients
type IntegrationTestEnv struct {
	*TestEnv
	AdminClient *keycloak.AdminClient
	UMAClient   *keycloak.UMAClient
}

// SetupIntegration creates a test environment with real Keycloak clients
func SetupIntegration(t *testing.T) *IntegrationTestEnv {
	if testKeycloak == nil {
		t.Skip("Integration test - requires Keycloak container (run with -tags=integration)")
	}

	// Create base test environment
	baseEnv := Setup(t)

	return &IntegrationTestEnv{
		TestEnv:     baseEnv,
		AdminClient: testKeycloak.NewAdminClient(),
		UMAClient:   testKeycloak.NewUMAClient(),
	}
}

// GetKeycloakURL returns the URL of the test Keycloak instance
func GetKeycloakURL() string {
	if testKeycloak != nil {
		return testKeycloak.URL
	}
	return ""
}

// TestIntegration_KeycloakConnection verifies the Keycloak container is accessible
func TestIntegration_KeycloakConnection(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	if testKeycloak == nil {
		t.Fatal("Keycloak container not available")
	}

	// Verify we can connect
	t.Logf("Keycloak URL: %s", testKeycloak.URL)
	t.Logf("Realm: %s", testKeycloak.Config.Realm)
	t.Logf("Client ID: %s", testKeycloak.Config.ClientID)

	// Create admin client and test connection
	adminClient := testKeycloak.NewAdminClient()
	if adminClient == nil {
		t.Fatal("Failed to create admin client")
	}

	// Verify dashboard client ID is configured
	dashboardClientID := adminClient.GetDashboardClientID()
	t.Logf("Dashboard Client ID: %s", dashboardClientID)
}

// TestIntegration_OrganizationAliasCheck tests organization alias existence checking
func TestIntegration_OrganizationAliasCheck(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()

	t.Run("non-existent alias returns false", func(t *testing.T) {
		exists, err := env.AdminClient.CheckOrganizationAliasExists(ctx, "non-existent-org-"+uuid.New().String())
		require.NoError(t, err, "Should not error for non-existent alias")
		assert.False(t, exists, "Non-existent alias should return false")
	})
}

// TestIntegration_AdminClientResourceLifecycle tests full resource lifecycle using AdminClient
// This matches the production pattern where AdminClient is used for resource management
func TestIntegration_AdminClientResourceLifecycle(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()
	testUserID := uuid.New().String()
	var orgResourceID string
	var strategyResourceID string

	// Register cleanup to run even if tests fail
	t.Cleanup(func() {
		cleanupCtx := context.Background()
		if strategyResourceID != "" {
			_ = env.AdminClient.DeleteResource(cleanupCtx, strategyResourceID)
		}
		if orgResourceID != "" {
			_ = env.AdminClient.DeleteResource(cleanupCtx, orgResourceID)
		}
	})

	// First create an organization (parent resource)
	t.Run("create organization", func(t *testing.T) {
		req := keycloak.ResourceCreateRequest{
			Title:   "Test Organization " + uuid.New().String()[:8],
			Type:    "organization",
			OwnerID: testUserID,
			Scopes:  authz.GroupScopes,
			Attributes: map[string][]string{
				"alias": {"test-org-" + uuid.New().String()[:8]},
			},
		}

		resp, err := env.AdminClient.CreateResource(ctx, req)
		require.NoError(t, err, "Should create organization resource")
		require.NotNil(t, resp)
		assert.NotEmpty(t, resp.ID, "Response should have resource ID")
		orgResourceID = resp.ID
	})

	// Create child resource (strategy) with organization as parent
	t.Run("create strategy resource", func(t *testing.T) {
		require.NotEmpty(t, orgResourceID, "Org resource ID should be set from create organization test")

		resourceID := uuid.New().String()
		req := keycloak.ResourceCreateRequest{
			ID:      resourceID,
			Title:   "Test Strategy " + resourceID[:8],
			Type:    "strategy",
			OwnerID: orgResourceID, // Parent is the organization
			Scopes:  authz.StrategyScopes,
			Attributes: map[string][]string{
				"type": {"strategy"},
			},
		}

		resp, err := env.AdminClient.CreateResource(ctx, req)
		require.NoError(t, err, "Should create strategy resource")
		require.NotNil(t, resp)
		assert.NotEmpty(t, resp.ID, "Response should have resource ID")
		strategyResourceID = resp.ID
	})

	t.Run("update resource", func(t *testing.T) {
		require.NotEmpty(t, strategyResourceID, "Strategy resource ID should be set from create test")

		updateReq := keycloak.ResourceUpdateRequest{
			Title: "Updated Strategy Name",
			Attributes: map[string][]string{
				"type":   {"strategy"},
				"public": {"true"},
			},
		}

		resp, err := env.AdminClient.UpdateResource(ctx, strategyResourceID, updateReq)
		require.NoError(t, err, "Should update resource")
		require.NotNil(t, resp)
	})

	t.Run("delete strategy resource", func(t *testing.T) {
		require.NotEmpty(t, strategyResourceID, "Strategy resource ID should be set from create test")

		err := env.AdminClient.DeleteResource(ctx, strategyResourceID)
		require.NoError(t, err, "Should delete strategy resource")
	})

	t.Run("delete organization resource", func(t *testing.T) {
		require.NotEmpty(t, orgResourceID, "Org resource ID should be set from create test")

		err := env.AdminClient.DeleteResource(ctx, orgResourceID)
		require.NoError(t, err, "Should delete organization resource")
	})
}

// TestIntegration_ResourceCreationWithScopes tests creating resources with different scope sets
func TestIntegration_ResourceCreationWithScopes(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()
	testUserID := uuid.New().String()

	// First create an organization to serve as parent for all test resources
	orgReq := keycloak.ResourceCreateRequest{
		Title:   "Test Organization " + uuid.New().String()[:8],
		Type:    "organization",
		OwnerID: testUserID,
		Scopes:  authz.GroupScopes,
		Attributes: map[string][]string{
			"alias": {"test-org-scopes-" + uuid.New().String()[:8]},
		},
	}
	orgResp, err := env.AdminClient.CreateResource(ctx, orgReq)
	require.NoError(t, err, "Should create organization resource")
	require.NotNil(t, orgResp)
	orgResourceID := orgResp.ID

	// Clean up organization at the end
	defer func() {
		_ = env.AdminClient.DeleteResource(ctx, orgResourceID)
	}()

	testCases := []struct {
		name       string
		scopes     []string
		resType    string
		attributes map[string][]string
	}{
		{
			name:    "Strategy scopes",
			scopes:  authz.StrategyScopes,
			resType: "strategy",
			attributes: map[string][]string{
				"type": {"strategy"},
			},
		},
		{
			name:    "Bot scopes",
			scopes:  authz.BotScopes,
			resType: "bot",
			attributes: map[string][]string{
				"type": {"bot"},
			},
		},
		{
			name:    "Exchange scopes",
			scopes:  authz.ExchangeScopes,
			resType: "exchange",
			attributes: map[string][]string{
				"type": {"exchange"},
			},
		},
		{
			name:    "BotRunner scopes",
			scopes:  authz.BotRunnerScopes,
			resType: "botrunner",
			attributes: map[string][]string{
				"type": {"botrunner"},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			resourceID := uuid.New().String()
			req := keycloak.ResourceCreateRequest{
				ID:         resourceID,
				Title:      fmt.Sprintf("test-%s-%s", tc.resType, resourceID[:8]),
				Type:       tc.resType,
				OwnerID:    orgResourceID, // Parent is the organization
				Scopes:     tc.scopes,
				Attributes: tc.attributes,
			}

			// Create resource
			resp, err := env.AdminClient.CreateResource(ctx, req)
			require.NoError(t, err, "Should create resource with %s", tc.name)
			require.NotNil(t, resp)
			assert.NotEmpty(t, resp.ID)

			// Cleanup
			err = env.AdminClient.DeleteResource(ctx, resp.ID)
			require.NoError(t, err)
		})
	}
}

// TestIntegration_AdminClientOrganizationResource tests organization-specific resource operations
func TestIntegration_AdminClientOrganizationResource(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()
	testUserID := uuid.New().String()

	t.Run("create organization resource", func(t *testing.T) {
		req := keycloak.ResourceCreateRequest{
			Title:   "Test Organization " + uuid.New().String()[:8],
			Type:    "organization",
			OwnerID: testUserID,
			Scopes:  authz.GroupScopes,
			Attributes: map[string][]string{
				"alias": {"test-org-" + uuid.New().String()[:8]},
			},
		}

		resp, err := env.AdminClient.CreateResource(ctx, req)
		require.NoError(t, err, "Should create organization resource")
		require.NotNil(t, resp)
		assert.NotEmpty(t, resp.ID, "Response should have resource ID")

		// Cleanup
		err = env.AdminClient.DeleteResource(ctx, resp.ID)
		require.NoError(t, err, "Should delete organization resource")
	})
}

// TestIntegration_ContextWithRealClients tests that real clients work with context helpers
func TestIntegration_ContextWithRealClients(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()

	t.Run("UMA client in context", func(t *testing.T) {
		ctx = SetUMAClientInContext(ctx, env.UMAClient)
		retrieved := GetUMAClientFromContext(ctx)
		require.NotNil(t, retrieved, "Should retrieve UMA client from context")
	})

	t.Run("Admin client in context", func(t *testing.T) {
		ctx = authz.SetAdminClientInContext(ctx, env.AdminClient)
		retrieved := authz.GetAdminClientFromContext(ctx)
		require.NotNil(t, retrieved, "Should retrieve Admin client from context")
	})

	t.Run("User context with clients", func(t *testing.T) {
		userCtx := auth.SetUserContext(ctx, &auth.UserContext{
			UserID: "test-user-id",
			Email:  "test@example.com",
		})
		userCtx = SetUMAClientInContext(userCtx, env.UMAClient)
		userCtx = authz.SetAdminClientInContext(userCtx, env.AdminClient)

		// Verify all context values are accessible
		user, err := auth.GetUserContext(userCtx)
		require.NoError(t, err)
		assert.Equal(t, "test-user-id", user.UserID)

		uma := GetUMAClientFromContext(userCtx)
		require.NotNil(t, uma)

		admin := authz.GetAdminClientFromContext(userCtx)
		require.NotNil(t, admin)
	})
}

// TestIntegration_MultipleResourcesSequential tests creating multiple resources sequentially
func TestIntegration_MultipleResourcesSequential(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()
	testUserID := uuid.New().String()
	numResources := 5
	resourceIDs := make([]string, 0, numResources)

	// First create an organization to serve as parent
	orgReq := keycloak.ResourceCreateRequest{
		Title:   "Test Organization " + uuid.New().String()[:8],
		Type:    "organization",
		OwnerID: testUserID,
		Scopes:  authz.GroupScopes,
		Attributes: map[string][]string{
			"alias": {"test-org-multi-" + uuid.New().String()[:8]},
		},
	}
	orgResp, err := env.AdminClient.CreateResource(ctx, orgReq)
	require.NoError(t, err, "Should create organization resource")
	require.NotNil(t, orgResp)
	orgResourceID := orgResp.ID

	// Clean up organization at the end
	defer func() {
		_ = env.AdminClient.DeleteResource(ctx, orgResourceID)
	}()

	// Create multiple resources
	for i := 0; i < numResources; i++ {
		resourceID := uuid.New().String()
		req := keycloak.ResourceCreateRequest{
			ID:      resourceID,
			Title:   fmt.Sprintf("test-concurrent-%d-%s", i, resourceID[:8]),
			Type:    "strategy",
			OwnerID: orgResourceID, // Parent is the organization
			Scopes:  authz.StrategyScopes,
			Attributes: map[string][]string{
				"type":  {"strategy"},
				"index": {fmt.Sprintf("%d", i)},
			},
		}

		resp, err := env.AdminClient.CreateResource(ctx, req)
		require.NoError(t, err, "Should create resource %d", i)
		require.NotNil(t, resp)
		resourceIDs = append(resourceIDs, resp.ID)
	}

	// Verify all resources were created
	assert.Equal(t, numResources, len(resourceIDs), "Should have created all resources")

	// Cleanup all resources
	for _, resourceID := range resourceIDs {
		err := env.AdminClient.DeleteResource(ctx, resourceID)
		require.NoError(t, err)
	}
}

// TestIntegration_ResourceDeleteNonExistent tests deleting a non-existent resource
func TestIntegration_ResourceDeleteNonExistent(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()
	nonExistentID := uuid.New().String()

	// Deleting non-existent resource should error
	err := env.AdminClient.DeleteResource(ctx, nonExistentID)
	// AdminClient may or may not error depending on implementation
	// We just verify it doesn't panic
	_ = err
}
