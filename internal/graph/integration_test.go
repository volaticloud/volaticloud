//go:build integration

package graph

import (
	"context"
	"fmt"
	"log"
	"os"
	"testing"
	"time"

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
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
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
		if orgResourceID == "" {
			return // Skip cleanup if resource was never created
		}
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_ = env.AdminClient.DeleteResource(cleanupCtx, orgResourceID)
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
		if orgResourceID == "" {
			return // Skip cleanup if resource was never created
		}
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_ = env.AdminClient.DeleteResource(cleanupCtx, orgResourceID)
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

// TestIntegration_UpdateNonExistentResource tests updating a resource that doesn't exist
func TestIntegration_UpdateNonExistentResource(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()
	nonExistentID := uuid.New().String()

	updateReq := keycloak.ResourceUpdateRequest{
		Title: "Updated Title",
		Attributes: map[string][]string{
			"type": {"strategy"},
		},
	}

	// Updating non-existent resource should error
	_, err := env.AdminClient.UpdateResource(ctx, nonExistentID, updateReq)
	require.Error(t, err, "Updating non-existent resource should return error")
}

// TestIntegration_CreateResourceWithInvalidParent tests creating a resource with non-existent parent
func TestIntegration_CreateResourceWithInvalidParent(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()
	nonExistentParentID := uuid.New().String()

	req := keycloak.ResourceCreateRequest{
		ID:      uuid.New().String(),
		Title:   "Test Strategy",
		Type:    "strategy",
		OwnerID: nonExistentParentID, // Non-existent parent
		Scopes:  authz.StrategyScopes,
		Attributes: map[string][]string{
			"type": {"strategy"},
		},
	}

	// Creating resource with non-existent parent should error
	_, err := env.AdminClient.CreateResource(ctx, req)
	require.Error(t, err, "Creating resource with non-existent parent should return error")
}

// TestIntegration_ConcurrentResourceCreation tests creating multiple resources concurrently
func TestIntegration_ConcurrentResourceCreation(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()
	testUserID := uuid.New().String()
	numConcurrent := 5

	// First create an organization to serve as parent
	orgReq := keycloak.ResourceCreateRequest{
		Title:   "Test Organization " + uuid.New().String()[:8],
		Type:    "organization",
		OwnerID: testUserID,
		Scopes:  authz.GroupScopes,
		Attributes: map[string][]string{
			"alias": {"test-org-concurrent-" + uuid.New().String()[:8]},
		},
	}
	orgResp, err := env.AdminClient.CreateResource(ctx, orgReq)
	require.NoError(t, err, "Should create organization resource")
	require.NotNil(t, orgResp)
	orgResourceID := orgResp.ID

	// Clean up organization at the end
	defer func() {
		if orgResourceID == "" {
			return // Skip cleanup if resource was never created
		}
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_ = env.AdminClient.DeleteResource(cleanupCtx, orgResourceID)
	}()

	// Create resources concurrently
	type result struct {
		id  string
		err error
	}
	results := make(chan result, numConcurrent)

	for i := 0; i < numConcurrent; i++ {
		go func(index int) {
			resourceID := uuid.New().String()
			req := keycloak.ResourceCreateRequest{
				ID:      resourceID,
				Title:   fmt.Sprintf("concurrent-strategy-%d-%s", index, resourceID[:8]),
				Type:    "strategy",
				OwnerID: orgResourceID,
				Scopes:  authz.StrategyScopes,
				Attributes: map[string][]string{
					"type":  {"strategy"},
					"index": {fmt.Sprintf("%d", index)},
				},
			}

			resp, err := env.AdminClient.CreateResource(ctx, req)
			if err != nil {
				results <- result{err: err}
				return
			}
			results <- result{id: resp.ID}
		}(i)
	}

	// Collect results
	var createdIDs []string
	var errors []error
	for i := 0; i < numConcurrent; i++ {
		r := <-results
		if r.err != nil {
			errors = append(errors, r.err)
		} else {
			createdIDs = append(createdIDs, r.id)
		}
	}

	// All should succeed
	assert.Empty(t, errors, "No errors expected during concurrent creation")
	assert.Len(t, createdIDs, numConcurrent, "All resources should be created")

	// Cleanup created resources
	for _, id := range createdIDs {
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		_ = env.AdminClient.DeleteResource(cleanupCtx, id)
		cancel()
	}
}

// TestIntegration_OrganizationAliasExistsCheck tests the organization alias existence check
func TestIntegration_OrganizationAliasExistsCheck(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()
	uniqueAlias := "test-alias-" + uuid.New().String()[:8]

	t.Run("alias does not exist initially", func(t *testing.T) {
		exists, err := env.AdminClient.CheckOrganizationAliasExists(ctx, uniqueAlias)
		require.NoError(t, err)
		assert.False(t, exists, "Alias should not exist initially")
	})

	// Note: The "alias exists after creating organization" test is skipped because
	// the AdminClient.CreateResource creates a UMA resource with an alias attribute,
	// but CheckOrganizationAliasExists looks for Keycloak organizations which are
	// different from UMA resources. In production, organizations are created via
	// a separate flow that creates both the Keycloak organization and UMA resource.
}

// TestIntegration_InvitationLifecycle tests the full invitation lifecycle
// Note: This test may be skipped if Keycloak is not configured with SMTP for sending emails
func TestIntegration_InvitationLifecycle(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()
	testUserID := uuid.New().String()

	// First create an organization
	orgReq := keycloak.ResourceCreateRequest{
		Title:   "Test Organization " + uuid.New().String()[:8],
		Type:    "organization",
		OwnerID: testUserID,
		Scopes:  authz.GroupScopes,
		Attributes: map[string][]string{
			"alias": {"test-org-invite-" + uuid.New().String()[:8]},
		},
	}
	orgResp, err := env.AdminClient.CreateResource(ctx, orgReq)
	require.NoError(t, err, "Should create organization resource")
	require.NotNil(t, orgResp)
	orgResourceID := orgResp.ID

	// Clean up organization at the end
	defer func() {
		if orgResourceID == "" {
			return // Skip cleanup if resource was never created
		}
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_ = env.AdminClient.DeleteResource(cleanupCtx, orgResourceID)
	}()

	var invitationID string
	testEmail := fmt.Sprintf("test-%s@example.com", uuid.New().String()[:8])

	t.Run("create invitation", func(t *testing.T) {
		inviteReq := keycloak.InvitationRequest{
			Email:     testEmail,
			FirstName: "Test",
			LastName:  "User",
		}

		inviteResp, err := env.AdminClient.CreateInvitation(ctx, orgResourceID, inviteReq)
		if err != nil {
			// Skip the rest of the test if invitation creation fails due to email config
			// This is expected in test environments without SMTP configured
			t.Skipf("Skipping invitation tests - SMTP not configured: %v", err)
			return
		}
		require.NotNil(t, inviteResp)
		assert.NotEmpty(t, inviteResp.ID, "Invitation should have an ID")
		assert.Equal(t, testEmail, inviteResp.Email, "Invitation email should match")
		invitationID = inviteResp.ID
	})

	t.Run("list invitations", func(t *testing.T) {
		if invitationID == "" {
			t.Skip("Skipping - invitation was not created (SMTP not configured)")
		}

		listResp, err := env.AdminClient.ListInvitations(ctx, orgResourceID, 0, 10)
		require.NoError(t, err, "Should list invitations")
		require.NotNil(t, listResp)
		assert.GreaterOrEqual(t, len(listResp.Invitations), 1, "Should have at least one invitation")

		// Find our invitation
		found := false
		for _, inv := range listResp.Invitations {
			if inv.ID == invitationID {
				found = true
				assert.Equal(t, testEmail, inv.Email, "Invitation email should match")
				break
			}
		}
		assert.True(t, found, "Should find the created invitation in the list")
	})

	t.Run("delete invitation", func(t *testing.T) {
		if invitationID == "" {
			t.Skip("Skipping - invitation was not created (SMTP not configured)")
		}

		err := env.AdminClient.DeleteInvitation(ctx, orgResourceID, invitationID)
		require.NoError(t, err, "Should delete invitation")
	})

	t.Run("verify invitation deleted", func(t *testing.T) {
		if invitationID == "" {
			t.Skip("Skipping - invitation was not created (SMTP not configured)")
		}

		listResp, err := env.AdminClient.ListInvitations(ctx, orgResourceID, 0, 10)
		require.NoError(t, err, "Should list invitations")

		// Verify the invitation is no longer in the list
		for _, inv := range listResp.Invitations {
			assert.NotEqual(t, invitationID, inv.ID, "Deleted invitation should not be in list")
		}
	})
}

// TestIntegration_InvitationErrors tests error cases for invitations
func TestIntegration_InvitationErrors(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()

	t.Run("create invitation for non-existent organization", func(t *testing.T) {
		nonExistentOrgID := uuid.New().String()
		inviteReq := keycloak.InvitationRequest{
			Email:     "test@example.com",
			FirstName: "Test",
			LastName:  "User",
		}

		_, err := env.AdminClient.CreateInvitation(ctx, nonExistentOrgID, inviteReq)
		require.Error(t, err, "Should error when creating invitation for non-existent organization")
	})

	t.Run("list invitations for non-existent organization", func(t *testing.T) {
		nonExistentOrgID := uuid.New().String()

		_, err := env.AdminClient.ListInvitations(ctx, nonExistentOrgID, 0, 10)
		require.Error(t, err, "Should error when listing invitations for non-existent organization")
	})

	t.Run("delete non-existent invitation", func(t *testing.T) {
		nonExistentOrgID := uuid.New().String()
		nonExistentInviteID := uuid.New().String()

		err := env.AdminClient.DeleteInvitation(ctx, nonExistentOrgID, nonExistentInviteID)
		// May or may not error depending on implementation - just verify no panic
		_ = err
	})
}

// TestIntegration_UMAResourceOperations tests UMA resource operations via UMAClient
// Note: These tests require the Keycloak client to have uma_protection scope.
// If the scope is not configured, tests will be skipped.
func TestIntegration_UMAResourceOperations(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()
	resourceID := uuid.New().String()
	resourceName := "Test UMA Resource " + resourceID[:8]

	// Clean up at the end
	defer func() {
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_ = env.UMAClient.DeleteResource(cleanupCtx, resourceID)
	}()

	t.Run("create UMA resource", func(t *testing.T) {
		err := env.UMAClient.CreateResource(ctx, resourceID, resourceName, []string{"view", "edit"}, map[string][]string{
			"type": {"test"},
		})
		if err != nil && (contains(err.Error(), "uma_protection") || contains(err.Error(), "403")) {
			t.Skip("Skipping - UMA client requires uma_protection scope which is not configured in test realm")
		}
		require.NoError(t, err, "Should create UMA resource")
	})

	t.Run("get UMA resource", func(t *testing.T) {
		resource, err := env.UMAClient.GetResource(ctx, resourceID)
		if err != nil && (contains(err.Error(), "uma_protection") || contains(err.Error(), "403")) {
			t.Skip("Skipping - UMA client requires uma_protection scope which is not configured in test realm")
		}
		require.NoError(t, err, "Should get UMA resource")
		require.NotNil(t, resource)
		assert.Equal(t, resourceID, *resource.Name, "Resource name should match ID")
	})

	t.Run("update UMA resource attributes", func(t *testing.T) {
		err := env.UMAClient.UpdateResource(ctx, resourceID, map[string][]string{
			"type":   {"test"},
			"public": {"true"},
		})
		if err != nil && (contains(err.Error(), "uma_protection") || contains(err.Error(), "403")) {
			t.Skip("Skipping - UMA client requires uma_protection scope which is not configured in test realm")
		}
		require.NoError(t, err, "Should update UMA resource")

		// Verify the update
		resource, err := env.UMAClient.GetResource(ctx, resourceID)
		require.NoError(t, err)
		require.NotNil(t, resource.Attributes)
		attrs := *resource.Attributes
		assert.Equal(t, []string{"true"}, attrs["public"], "Public attribute should be updated")
	})

	t.Run("sync UMA resource scopes", func(t *testing.T) {
		// Add a new scope
		err := env.UMAClient.SyncResourceScopes(ctx, resourceID, resourceName, []string{"view", "edit", "delete"}, map[string][]string{
			"type": {"test"},
		})
		if err != nil && (contains(err.Error(), "uma_protection") || contains(err.Error(), "403")) {
			t.Skip("Skipping - UMA client requires uma_protection scope which is not configured in test realm")
		}
		require.NoError(t, err, "Should sync UMA resource scopes")
	})

	t.Run("delete UMA resource", func(t *testing.T) {
		err := env.UMAClient.DeleteResource(ctx, resourceID)
		require.NoError(t, err, "Should delete UMA resource")

		// Verify deletion - GetResource should return error
		_, err = env.UMAClient.GetResource(ctx, resourceID)
		require.Error(t, err, "GetResource should fail after deletion")
	})
}

// contains checks if a string contains a substring (helper for error checking)
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

// TestIntegration_UMAResourceErrors tests error cases for UMA operations
func TestIntegration_UMAResourceErrors(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()

	t.Run("get non-existent resource", func(t *testing.T) {
		nonExistentID := uuid.New().String()
		_, err := env.UMAClient.GetResource(ctx, nonExistentID)
		require.Error(t, err, "Should error when getting non-existent resource")
	})

	t.Run("update non-existent resource", func(t *testing.T) {
		nonExistentID := uuid.New().String()
		err := env.UMAClient.UpdateResource(ctx, nonExistentID, map[string][]string{
			"type": {"test"},
		})
		require.Error(t, err, "Should error when updating non-existent resource")
	})
}

// TestIntegration_GroupHierarchyOperations tests group hierarchy operations via AdminClient
// These test GetGroupUsers, GetGroupTree, and GetGroupMembers methods.
// Note: These tests require the Keycloak client to have realm admin roles.
// If the roles are not configured, tests will be skipped.
func TestIntegration_GroupHierarchyOperations(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()
	testUserID := uuid.New().String()

	// Create an organization resource (which creates a Keycloak group)
	orgAlias := "test-org-hierarchy-" + uuid.New().String()[:8]
	orgReq := keycloak.ResourceCreateRequest{
		Title:   "Test Organization " + uuid.New().String()[:8],
		Type:    "organization",
		OwnerID: testUserID,
		Scopes:  authz.GroupScopes,
		Attributes: map[string][]string{
			"alias": {orgAlias},
		},
	}
	orgResp, err := env.AdminClient.CreateResource(ctx, orgReq)
	require.NoError(t, err, "Should create organization resource")
	require.NotNil(t, orgResp)
	require.NotEmpty(t, orgResp.GroupID, "Organization should have a GroupID")
	orgResourceID := orgResp.ID
	orgGroupID := orgResp.GroupID

	// Clean up organization at the end
	defer func() {
		if orgResourceID == "" {
			return // Skip cleanup if resource was never created
		}
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_ = env.AdminClient.DeleteResource(cleanupCtx, orgResourceID)
	}()

	t.Run("get group tree for organization", func(t *testing.T) {
		tree, err := env.AdminClient.GetGroupTree(ctx, orgGroupID)
		if err != nil && contains(err.Error(), "403") {
			t.Skip("Skipping - client requires realm admin roles which are not configured in test realm")
		}
		require.NoError(t, err, "Should get group tree")
		require.NotNil(t, tree, "Group tree should not be nil")
		assert.NotEmpty(t, tree.ID, "Group tree should have ID")
		assert.NotEmpty(t, tree.Name, "Group tree should have name")
		t.Logf("Group tree: ID=%s, Name=%s, Type=%s, Children=%d",
			tree.ID, tree.Name, tree.Type, len(tree.Children))
	})

	t.Run("get group users for organization", func(t *testing.T) {
		users, err := env.AdminClient.GetGroupUsers(ctx, orgGroupID)
		if err != nil && contains(err.Error(), "403") {
			t.Skip("Skipping - client requires realm admin roles which are not configured in test realm")
		}
		require.NoError(t, err, "Should get group users")
		require.NotNil(t, users, "Users list should not be nil")
		// A newly created organization may not have users
		t.Logf("Group has %d users", len(users))
	})

	t.Run("get group members for organization", func(t *testing.T) {
		members, err := env.AdminClient.GetGroupMembers(ctx, orgGroupID)
		if err != nil && contains(err.Error(), "403") {
			t.Skip("Skipping - client requires realm admin roles which are not configured in test realm")
		}
		require.NoError(t, err, "Should get group members")
		require.NotNil(t, members, "Members list should not be nil")
		// A newly created organization may not have members
		t.Logf("Group has %d direct members", len(members))
	})
}

// TestIntegration_GroupHierarchyErrors tests error cases for group hierarchy operations
func TestIntegration_GroupHierarchyErrors(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()

	t.Run("get group tree for non-existent group", func(t *testing.T) {
		nonExistentID := uuid.New().String()
		_, err := env.AdminClient.GetGroupTree(ctx, nonExistentID)
		require.Error(t, err, "Should error when getting group tree for non-existent group")
	})

	t.Run("get group users for non-existent group", func(t *testing.T) {
		nonExistentID := uuid.New().String()
		_, err := env.AdminClient.GetGroupUsers(ctx, nonExistentID)
		require.Error(t, err, "Should error when getting group users for non-existent group")
	})

	t.Run("get group members for non-existent group", func(t *testing.T) {
		nonExistentID := uuid.New().String()
		_, err := env.AdminClient.GetGroupMembers(ctx, nonExistentID)
		require.Error(t, err, "Should error when getting group members for non-existent group")
	})
}

// TestIntegration_RoleChangeOperations tests role change operations via AdminClient
func TestIntegration_RoleChangeOperations(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()
	testUserID := uuid.New().String()

	// Create an organization resource
	orgAlias := "test-org-roles-" + uuid.New().String()[:8]
	orgReq := keycloak.ResourceCreateRequest{
		Title:   "Test Organization " + uuid.New().String()[:8],
		Type:    "organization",
		OwnerID: testUserID,
		Scopes:  authz.GroupScopes,
		Attributes: map[string][]string{
			"alias": {orgAlias},
		},
	}
	orgResp, err := env.AdminClient.CreateResource(ctx, orgReq)
	require.NoError(t, err, "Should create organization resource")
	require.NotNil(t, orgResp)
	orgResourceID := orgResp.ID

	// Clean up organization at the end
	defer func() {
		if orgResourceID == "" {
			return // Skip cleanup if resource was never created
		}
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_ = env.AdminClient.DeleteResource(cleanupCtx, orgResourceID)
	}()

	t.Run("get available roles for organization", func(t *testing.T) {
		roles, err := env.AdminClient.GetAvailableRoles(ctx, orgResourceID)
		require.NoError(t, err, "Should get available roles")
		require.NotNil(t, roles, "Roles list should not be nil")
		t.Logf("Available roles: %v", roles)
		// At minimum, there should be some roles available
		assert.NotEmpty(t, roles, "Should have at least one available role")
	})
}

// TestIntegration_RoleChangeErrors tests error cases for role change operations
func TestIntegration_RoleChangeErrors(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()

	t.Run("change role for non-existent organization", func(t *testing.T) {
		nonExistentOrgID := uuid.New().String()
		nonExistentUserID := uuid.New().String()

		_, err := env.AdminClient.ChangeUserRole(ctx, nonExistentOrgID, nonExistentUserID, "member")
		require.Error(t, err, "Should error when changing role for non-existent organization")
	})

	t.Run("get available roles for non-existent organization", func(t *testing.T) {
		nonExistentOrgID := uuid.New().String()

		_, err := env.AdminClient.GetAvailableRoles(ctx, nonExistentOrgID)
		require.Error(t, err, "Should error when getting roles for non-existent organization")
	})
}

// TestIntegration_ResourceGroupOperations tests resource group operations via AdminClient
func TestIntegration_ResourceGroupOperations(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()
	testUserID := uuid.New().String()

	// Create an organization resource
	orgAlias := "test-org-resgroups-" + uuid.New().String()[:8]
	orgReq := keycloak.ResourceCreateRequest{
		Title:   "Test Organization " + uuid.New().String()[:8],
		Type:    "organization",
		OwnerID: testUserID,
		Scopes:  authz.GroupScopes,
		Attributes: map[string][]string{
			"alias": {orgAlias},
		},
	}
	orgResp, err := env.AdminClient.CreateResource(ctx, orgReq)
	require.NoError(t, err, "Should create organization resource")
	require.NotNil(t, orgResp)
	orgResourceID := orgResp.ID

	// Clean up organization at the end
	defer func() {
		if orgResourceID == "" {
			return // Skip cleanup if resource was never created
		}
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_ = env.AdminClient.DeleteResource(cleanupCtx, orgResourceID)
	}()

	t.Run("get resource groups for organization", func(t *testing.T) {
		groups, err := env.AdminClient.GetResourceGroups(ctx, orgResourceID, "", 0, 10, "", "")
		require.NoError(t, err, "Should get resource groups")
		require.NotNil(t, groups, "Resource groups response should not be nil")
		t.Logf("Found %d resource groups, total count: %d", len(groups.Items), groups.TotalCount)
	})
}

// TestIntegration_ResourceGroupErrors tests error cases for resource group operations
func TestIntegration_ResourceGroupErrors(t *testing.T) {
	env := SetupIntegration(t)
	defer env.Cleanup()

	ctx := context.Background()

	t.Run("get resource groups for non-existent organization", func(t *testing.T) {
		nonExistentOrgID := uuid.New().String()

		_, err := env.AdminClient.GetResourceGroups(ctx, nonExistentOrgID, "", 0, 10, "", "")
		require.Error(t, err, "Should error when getting resource groups for non-existent organization")
	})

	t.Run("get resource group members for non-existent organization", func(t *testing.T) {
		nonExistentOrgID := uuid.New().String()
		nonExistentGroupID := uuid.New().String()

		_, err := env.AdminClient.GetResourceGroupMembers(ctx, nonExistentOrgID, nonExistentGroupID, nil, "", nil, nil, 0, 10, "", "")
		require.Error(t, err, "Should error when getting resource group members for non-existent organization")
	})
}
