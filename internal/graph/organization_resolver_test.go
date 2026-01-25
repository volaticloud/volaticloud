package graph

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"volaticloud/internal/auth"
	"volaticloud/internal/authz"
	"volaticloud/internal/graph/model"
	"volaticloud/internal/keycloak"
)

// TestCreateOrganization tests the CreateOrganization resolver
func TestCreateOrganization(t *testing.T) {
	t.Run("requires authentication", func(t *testing.T) {
		// Context without user
		ctx := context.Background()

		resolver := &mutationResolver{}
		result, err := resolver.CreateOrganization(ctx, model.CreateOrganizationInput{Title: "Test Org"})

		require.Error(t, err)
		assert.Contains(t, err.Error(), "authentication required")
		assert.Nil(t, result)
	})

	t.Run("rejects empty title", func(t *testing.T) {
		ctx := auth.SetUserContext(context.Background(), &auth.UserContext{
			UserID: "test-user-id",
			Email:  "test@example.com",
		})

		resolver := &mutationResolver{}
		result, err := resolver.CreateOrganization(ctx, model.CreateOrganizationInput{Title: ""})

		require.Error(t, err)
		assert.Contains(t, err.Error(), "organization title is required")
		assert.Nil(t, result)
	})

	t.Run("rejects whitespace-only title", func(t *testing.T) {
		ctx := auth.SetUserContext(context.Background(), &auth.UserContext{
			UserID: "test-user-id",
			Email:  "test@example.com",
		})

		resolver := &mutationResolver{}
		result, err := resolver.CreateOrganization(ctx, model.CreateOrganizationInput{Title: "   "})

		require.Error(t, err)
		assert.Contains(t, err.Error(), "organization title is required")
		assert.Nil(t, result)
	})

	t.Run("rejects title longer than 100 characters", func(t *testing.T) {
		ctx := auth.SetUserContext(context.Background(), &auth.UserContext{
			UserID: "test-user-id",
			Email:  "test@example.com",
		})

		longTitle := strings.Repeat("a", 101)

		resolver := &mutationResolver{}
		result, err := resolver.CreateOrganization(ctx, model.CreateOrganizationInput{Title: longTitle})

		require.Error(t, err)
		assert.Contains(t, err.Error(), "organization title must be 100 characters or less")
		assert.Nil(t, result)
	})

	t.Run("accepts title exactly 100 characters", func(t *testing.T) {
		ctx := auth.SetUserContext(context.Background(), &auth.UserContext{
			UserID: "test-user-id",
			Email:  "test@example.com",
		})
		// No admin client - will fail on admin client check, but title should be valid

		exactTitle := strings.Repeat("a", 100)

		resolver := &mutationResolver{}
		result, err := resolver.CreateOrganization(ctx, model.CreateOrganizationInput{Title: exactTitle})

		// Should fail at admin client, not at validation
		require.Error(t, err)
		assert.Contains(t, err.Error(), "admin client not available")
		assert.Nil(t, result)
	})

	t.Run("rejects title with control characters", func(t *testing.T) {
		ctx := auth.SetUserContext(context.Background(), &auth.UserContext{
			UserID: "test-user-id",
			Email:  "test@example.com",
		})

		// Test various control characters
		testCases := []string{
			"Test\x00Org", // null character
			"Test\x1fOrg", // unit separator
			"Test\x7fOrg", // DEL character
			"Test\tOrg",   // tab
			"Test\nOrg",   // newline
		}

		resolver := &mutationResolver{}
		for _, titleWithControl := range testCases {
			result, err := resolver.CreateOrganization(ctx, model.CreateOrganizationInput{Title: titleWithControl})

			require.Error(t, err, "Expected error for title with control character")
			assert.Contains(t, err.Error(), "organization title contains invalid characters")
			assert.Nil(t, result)
		}
	})

	t.Run("trims whitespace from title", func(t *testing.T) {
		ctx := auth.SetUserContext(context.Background(), &auth.UserContext{
			UserID: "test-user-id",
			Email:  "test@example.com",
		})
		// No admin client - will fail on admin client check

		resolver := &mutationResolver{}
		result, err := resolver.CreateOrganization(ctx, model.CreateOrganizationInput{Title: "  Test Org  "})

		// Should fail at admin client, not at validation (meaning title was trimmed and accepted)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "admin client not available")
		assert.Nil(t, result)
	})

	t.Run("requires admin client", func(t *testing.T) {
		ctx := auth.SetUserContext(context.Background(), &auth.UserContext{
			UserID: "test-user-id",
			Email:  "test@example.com",
		})
		// No admin client in context

		resolver := &mutationResolver{}
		result, err := resolver.CreateOrganization(ctx, model.CreateOrganizationInput{Title: "My Organization"})

		require.Error(t, err)
		assert.Contains(t, err.Error(), "admin client not available")
		assert.Nil(t, result)
	})

	t.Run("successful organization creation", func(t *testing.T) {
		// Create mock admin client
		mockAdmin := keycloak.NewMockAdminClient()

		// Create context with user and admin client
		ctx := auth.SetUserContext(context.Background(), &auth.UserContext{
			UserID: "test-user-id",
			Email:  "test@example.com",
		})
		ctx = authz.SetAdminClientInContext(ctx, mockAdmin)

		resolver := &mutationResolver{}
		result, err := resolver.CreateOrganization(ctx, model.CreateOrganizationInput{Title: "My Test Organization"})

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.NotEmpty(t, result.ID)
		assert.Equal(t, "My Test Organization", result.Title)
		assert.NotEmpty(t, result.Alias)

		// Verify the correct methods were called
		calls := mockAdmin.GetCalls()
		require.GreaterOrEqual(t, len(calls), 3)
		assert.Equal(t, "CheckOrganizationAliasExists", calls[0].Method)
		assert.Equal(t, "CreateResource", calls[1].Method)
		assert.Equal(t, "ChangeUserRole", calls[2].Method)
	})

	t.Run("rollback on ChangeUserRole failure", func(t *testing.T) {
		// Create mock admin client with error on ChangeUserRole
		mockAdmin := keycloak.NewMockAdminClient()
		mockAdmin.SetError("ChangeUserRole", fmt.Errorf("simulated ChangeUserRole failure"))

		// Create context with user and admin client
		ctx := auth.SetUserContext(context.Background(), &auth.UserContext{
			UserID: "test-user-id",
			Email:  "test@example.com",
		})
		ctx = authz.SetAdminClientInContext(ctx, mockAdmin)

		resolver := &mutationResolver{}
		result, err := resolver.CreateOrganization(ctx, model.CreateOrganizationInput{Title: "Rollback Test Org"})

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to add you as organization admin")
		assert.Nil(t, result)

		// Verify DeleteResource was called for rollback
		calls := mockAdmin.GetCalls()
		foundDelete := false
		for _, call := range calls {
			if call.Method == "DeleteResource" {
				foundDelete = true
				break
			}
		}
		assert.True(t, foundDelete, "DeleteResource should be called for rollback")
	})

	t.Run("rollback failure logged on ChangeUserRole failure", func(t *testing.T) {
		// Create mock admin client with errors on both ChangeUserRole and DeleteResource
		mockAdmin := keycloak.NewMockAdminClient()
		mockAdmin.SetError("ChangeUserRole", fmt.Errorf("simulated ChangeUserRole failure"))
		mockAdmin.SetError("DeleteResource", fmt.Errorf("simulated DeleteResource failure"))

		// Create context with user and admin client
		ctx := auth.SetUserContext(context.Background(), &auth.UserContext{
			UserID: "test-user-id",
			Email:  "test@example.com",
		})
		ctx = authz.SetAdminClientInContext(ctx, mockAdmin)

		resolver := &mutationResolver{}
		result, err := resolver.CreateOrganization(ctx, model.CreateOrganizationInput{Title: "Double Failure Org"})

		// Should still return error about adding admin (primary failure)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to add you as organization admin")
		assert.Nil(t, result)

		// Verify both methods were called (even though DeleteResource failed, it should have been attempted)
		calls := mockAdmin.GetCalls()
		foundChangeUserRole := false
		foundDeleteResource := false
		for _, call := range calls {
			if call.Method == "ChangeUserRole" {
				foundChangeUserRole = true
			}
			if call.Method == "DeleteResource" {
				foundDeleteResource = true
			}
		}
		assert.True(t, foundChangeUserRole, "ChangeUserRole should be called")
		assert.True(t, foundDeleteResource, "DeleteResource should be attempted for rollback")
	})
}
