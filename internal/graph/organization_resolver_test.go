package graph

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"volaticloud/internal/auth"
)

// TestCreateOrganization tests the CreateOrganization resolver
func TestCreateOrganization(t *testing.T) {
	t.Run("requires authentication", func(t *testing.T) {
		// Context without user
		ctx := context.Background()

		resolver := &mutationResolver{}
		result, err := resolver.CreateOrganization(ctx, "Test Org")

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
		result, err := resolver.CreateOrganization(ctx, "")

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
		result, err := resolver.CreateOrganization(ctx, "   ")

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
		result, err := resolver.CreateOrganization(ctx, longTitle)

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
		result, err := resolver.CreateOrganization(ctx, exactTitle)

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
			result, err := resolver.CreateOrganization(ctx, titleWithControl)

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
		result, err := resolver.CreateOrganization(ctx, "  Test Org  ")

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
		result, err := resolver.CreateOrganization(ctx, "My Organization")

		require.Error(t, err)
		assert.Contains(t, err.Error(), "admin client not available")
		assert.Nil(t, result)
	})

	t.Run("successful organization creation", func(t *testing.T) {
		// TODO(#128): Add integration test with Keycloak mock
		t.Skip("Integration test - requires Keycloak mock or interface refactor")
		// This would test:
		// 1. Mock admin client CreateResource returns successfully
		// 2. Mock admin client ChangeUserRole adds user as admin
		// 3. Resolver returns CreateOrganizationResponse with ID and title
	})

	t.Run("rollback on ChangeUserRole failure", func(t *testing.T) {
		// TODO(#128): Add integration test with Keycloak mock
		t.Skip("Integration test - requires Keycloak mock or interface refactor")
		// This would test:
		// 1. Mock admin client CreateResource returns successfully
		// 2. Mock admin client ChangeUserRole fails
		// 3. Mock admin client DeleteResource is called (rollback)
		// 4. Resolver returns error about adding admin
	})

	t.Run("rollback failure logged on ChangeUserRole failure", func(t *testing.T) {
		// TODO(#128): Add integration test with Keycloak mock
		t.Skip("Integration test - requires Keycloak mock or interface refactor")
		// This would test:
		// 1. Mock admin client CreateResource returns successfully
		// 2. Mock admin client ChangeUserRole fails
		// 3. Mock admin client DeleteResource also fails
		// 4. Both failures are logged
		// 5. Resolver returns error about adding admin
	})
}
