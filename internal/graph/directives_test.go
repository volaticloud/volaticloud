package graph

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"volaticloud/internal/auth"
	"volaticloud/internal/authz"
	"volaticloud/internal/ent"
	"volaticloud/internal/keycloak"
)

// TestExtractResourceID tests the extractResourceID helper function
func TestExtractResourceID(t *testing.T) {
	tests := []struct {
		name      string
		obj       interface{}
		fieldName string
		wantID    string
		wantErr   bool
		errMsg    string
	}{
		{
			name: "extract ID from ent.Strategy (fast path)",
			obj: &ent.Strategy{
				ID:   uuid.MustParse("123e4567-e89b-12d3-a456-426614174000"),
				Name: "TestStrategy",
			},
			fieldName: "id",
			wantID:    "123e4567-e89b-12d3-a456-426614174000",
			wantErr:   false,
		},
		{
			name: "extract ID from ent.Bot (fast path)",
			obj: &ent.Bot{
				ID:   uuid.MustParse("987e6543-e21b-34d5-a678-543216789000"),
				Name: "TestBot",
			},
			fieldName: "id",
			wantID:    "987e6543-e21b-34d5-a678-543216789000",
			wantErr:   false,
		},
		{
			name: "extract ID from ent.Exchange (fast path)",
			obj: &ent.Exchange{
				ID:   uuid.MustParse("aaaa1111-2222-3333-4444-555555555555"),
				Name: "TestExchange",
			},
			fieldName: "id",
			wantID:    "aaaa1111-2222-3333-4444-555555555555",
			wantErr:   false,
		},
		{
			name: "extract ID from ent.BotRunner (fast path)",
			obj: &ent.BotRunner{
				ID:   uuid.MustParse("bbbb2222-3333-4444-5555-666666666666"),
				Name: "TestRunner",
			},
			fieldName: "id",
			wantID:    "bbbb2222-3333-4444-5555-666666666666",
			wantErr:   false,
		},
		{
			name:      "nil object",
			obj:       nil,
			fieldName: "id",
			wantErr:   true,
			errMsg:    "parent object is nil",
		},
		{
			name: "object with custom ID field name",
			obj: &ent.Strategy{
				ID:   uuid.MustParse("aaa11111-bbbb-cccc-dddd-eeeeeeee0000"),
				Name: "CustomIDStrategy",
			},
			fieldName: "id", // Still uses "id" but tests field name capitalization
			wantID:    "aaa11111-bbbb-cccc-dddd-eeeeeeee0000",
			wantErr:   false,
		},
		{
			name:      "non-struct object",
			obj:       "not a struct",
			fieldName: "id",
			wantErr:   true,
			errMsg:    "object is not a struct",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			id, err := extractResourceID(tt.obj, tt.fieldName)

			if tt.wantErr {
				require.Error(t, err, "Expected error but got none")
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg, "Error message should contain expected text")
				}
			} else {
				require.NoError(t, err, "Expected no error but got: %v", err)
				assert.Equal(t, tt.wantID, id, "Resource ID should match")
			}
		})
	}
}

// Note: The UMAClient in keycloak package is a struct, not an interface.
// For testing, we would need to either:
// 1. Create an interface in the keycloak package
// 2. Use a test Keycloak server
// 3. Test at a higher level with integration tests
//
// For now, these tests focus on testing the directive logic without actual UMA calls

// mockResolver is a simple next resolver for testing
func mockResolver(ctx context.Context) (interface{}, error) {
	return "resolved_value", nil
}

// TestRequiresPermissionDirective tests the RequiresPermissionDirective function
// Note: Full testing requires a database and UMA server. These tests focus on error paths.
func TestRequiresPermissionDirective(t *testing.T) {
	strategyID := uuid.MustParse("11111111-2222-3333-4444-555555555555")
	ownerID := "user-123"
	rawToken := "test-token-123"

	tests := []struct {
		name         string
		setupContext func() context.Context
		obj          interface{}
		scope        string
		idField      *string
		wantErr      bool
		errMsg       string
	}{
		{
			name: "missing authentication",
			setupContext: func() context.Context {
				// Return context without user context
				return context.Background()
			},
			obj: &ent.Strategy{
				ID:      strategyID,
				Name:    "TestStrategy",
				OwnerID: ownerID,
			},
			scope:   "view",
			idField: nil,
			wantErr: true,
			errMsg:  "authentication required",
		},
		{
			name: "UMA client not available",
			setupContext: func() context.Context {
				ctx := context.Background()
				ctx = auth.SetUserContext(ctx, &auth.UserContext{
					UserID:   ownerID,
					RawToken: rawToken,
					Email:    "user@test.com",
				})
				// Don't add UMA client to context
				return ctx
			},
			obj: &ent.Strategy{
				ID:      strategyID,
				Name:    "TestStrategy",
				OwnerID: ownerID,
			},
			scope:   "view",
			idField: nil,
			wantErr: true,
			errMsg:  "UMA client not available",
		},
		{
			name: "nil parent object",
			setupContext: func() context.Context {
				ctx := context.Background()
				ctx = auth.SetUserContext(ctx, &auth.UserContext{
					UserID:   ownerID,
					RawToken: rawToken,
					Email:    "user@test.com",
				})
				// Add minimal UMA client (won't be called due to early error)
				ctx = SetUMAClientInContext(ctx, keycloak.NewUMAClient("", "", "", ""))
				return ctx
			},
			obj:     nil,
			scope:   "view",
			idField: nil,
			wantErr: true,
			errMsg:  "failed to extract resource ID",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := tt.setupContext()

			result, err := RequiresPermissionDirective(
				ctx,
				tt.obj,
				mockResolver,
				tt.scope,
				tt.idField,
			)

			if tt.wantErr {
				require.Error(t, err, "Expected error but got none")
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg, "Error message should contain expected text")
				}
			} else {
				require.NoError(t, err, "Expected no error but got: %v", err)
				assert.NotNil(t, result)
			}
		})
	}
}

// TestRequiresPermissionDirective_RealScenarios tests real-world scenarios
// Note: These would require a test database setup in a real test suite
func TestRequiresPermissionDirective_RealScenarios(t *testing.T) {
	t.Run("code field protection", func(t *testing.T) {
		// This test would verify that:
		// 1. Strategy.code field returns null if user lacks "view" permission
		// 2. Strategy.code field returns value if user has "view" permission
		t.Skip("Requires test database and UMA server setup")
	})

	t.Run("config field protection", func(t *testing.T) {
		// This test would verify that:
		// 1. Strategy.config field returns null if user lacks "view" permission
		// 2. Strategy.config field returns value if user has "view" permission
		t.Skip("Requires test database and UMA server setup")
	})

	t.Run("nested edge protection", func(t *testing.T) {
		// This test would verify that:
		// 1. When querying bot.strategy.code, permission is checked on the strategy
		// 2. Unauthorized access returns null with partial error
		t.Skip("Requires test database and UMA server setup")
	})

	t.Run("list query with mixed permissions", func(t *testing.T) {
		// This test would verify that:
		// 1. strategies { edges { node { code } } }
		// 2. Some strategies return code (authorized), others return null (unauthorized)
		// 3. Partial errors are returned for unauthorized fields
		t.Skip("Requires test database and UMA server setup")
	})
}

// TestVerifyStrategyPermission_Integration tests the UMA permission check integration
// Note: This is a placeholder for integration tests
func TestVerifyStrategyPermission_Integration(t *testing.T) {
	t.Skip("Integration test - requires test database and Keycloak server")

	// This would test:
	// 1. Strategy exists and owner_id matches user
	// 2. Keycloak UMA permission check passes
	// 3. Strategy does not exist
	// 4. Strategy exists but owner_id doesn't match
	// 5. UMA permission check fails
}

// TestContextHelpers tests the context helper functions
func TestContextHelpers(t *testing.T) {
	t.Run("SetUMAClientInContext and GetUMAClientFromContext", func(t *testing.T) {
		ctx := context.Background()
		testClient := keycloak.NewUMAClient("http://test", "test-realm", "test-client", "test-secret")

		// Set UMA client
		ctx = SetUMAClientInContext(ctx, testClient)

		// Get UMA client
		retrieved := GetUMAClientFromContext(ctx)
		require.NotNil(t, retrieved, "UMA client should be retrievable")
		assert.Equal(t, testClient, retrieved, "Retrieved client should match original")
	})

	t.Run("GetUMAClientFromContext with no client", func(t *testing.T) {
		ctx := context.Background()

		retrieved := GetUMAClientFromContext(ctx)
		assert.Nil(t, retrieved, "Should return nil when no UMA client in context")
	})

	t.Run("SetEntClientInContext and GetEntClientFromContext", func(t *testing.T) {
		ctx := context.Background()
		// Note: Cannot create real ENT client without database
		// This test verifies the context storage/retrieval mechanism

		// Set a marker value
		ctx = SetEntClientInContext(ctx, "test-marker")

		// Get it back
		retrieved := GetEntClientFromContext(ctx)
		require.NotNil(t, retrieved, "Should retrieve value from context")
		assert.Equal(t, "test-marker", retrieved, "Retrieved value should match")
	})

	t.Run("GetEntClientFromContext with no client", func(t *testing.T) {
		ctx := context.Background()

		retrieved := GetEntClientFromContext(ctx)
		assert.Nil(t, retrieved, "Should return nil when no ENT client in context")
	})
}

// TestEntityScopes tests that the scope definitions are correct
// Scopes are now defined in the authz package
func TestEntityScopes(t *testing.T) {
	t.Run("BotScopes contains expected values", func(t *testing.T) {
		expected := []string{"view", "view-secrets", "run", "stop", "delete", "edit"}
		assert.Equal(t, expected, authz.BotScopes, "BotScopes should contain the expected values")
		assert.Len(t, authz.BotScopes, 6, "BotScopes should have 6 scopes")
	})

	t.Run("ExchangeScopes contains expected values", func(t *testing.T) {
		expected := []string{"view", "view-secrets", "edit", "delete"}
		assert.Equal(t, expected, authz.ExchangeScopes, "ExchangeScopes should contain the expected values")
		assert.Len(t, authz.ExchangeScopes, 4, "ExchangeScopes should have 4 scopes")
	})

	t.Run("BotRunnerScopes contains expected values", func(t *testing.T) {
		expected := []string{"view", "view-secrets", "edit", "delete", "make-public"}
		assert.Equal(t, expected, authz.BotRunnerScopes, "BotRunnerScopes should contain the expected values")
		assert.Len(t, authz.BotRunnerScopes, 5, "BotRunnerScopes should have 5 scopes")
	})

	t.Run("StrategyScopes contains expected values", func(t *testing.T) {
		expected := []string{"view", "edit", "backtest", "delete"}
		assert.Equal(t, expected, authz.StrategyScopes, "StrategyScopes should contain the expected values")
		assert.Len(t, authz.StrategyScopes, 4, "StrategyScopes should have 4 scopes")
	})
}

// TestRequiresPermissionDirective_AllEntityTypes tests the directive with different entity types
func TestRequiresPermissionDirective_AllEntityTypes(t *testing.T) {
	ownerID := "user-123"
	rawToken := "test-token-123"

	// Base setup context function
	setupContextWithAuth := func() context.Context {
		ctx := context.Background()
		ctx = auth.SetUserContext(ctx, &auth.UserContext{
			UserID:   ownerID,
			RawToken: rawToken,
			Email:    "user@test.com",
		})
		// Add UMA client but NOT ENT client - this will cause "database client not available" error
		ctx = SetUMAClientInContext(ctx, keycloak.NewUMAClient("http://test", "test-realm", "test-client", "test-secret"))
		return ctx
	}

	tests := []struct {
		name   string
		obj    interface{}
		scope  string
		errMsg string // Expected error (since we don't have a real DB)
	}{
		{
			name: "Bot with view scope",
			obj: &ent.Bot{
				ID:      uuid.MustParse("11111111-1111-1111-1111-111111111111"),
				Name:    "TestBot",
				OwnerID: ownerID,
			},
			scope:  "view",
			errMsg: "database client not available",
		},
		{
			name: "Bot with run scope",
			obj: &ent.Bot{
				ID:      uuid.MustParse("22222222-2222-2222-2222-222222222222"),
				Name:    "TestBot2",
				OwnerID: ownerID,
			},
			scope:  "run",
			errMsg: "database client not available",
		},
		{
			name: "Exchange with edit scope",
			obj: &ent.Exchange{
				ID:      uuid.MustParse("33333333-3333-3333-3333-333333333333"),
				Name:    "TestExchange",
				OwnerID: ownerID,
			},
			scope:  "edit",
			errMsg: "database client not available",
		},
		{
			name: "BotRunner with delete scope",
			obj: &ent.BotRunner{
				ID:      uuid.MustParse("44444444-4444-4444-4444-444444444444"),
				Name:    "TestRunner",
				OwnerID: ownerID,
			},
			scope:  "delete",
			errMsg: "database client not available",
		},
		{
			name: "Strategy with backtest scope",
			obj: &ent.Strategy{
				ID:      uuid.MustParse("55555555-5555-5555-5555-555555555555"),
				Name:    "TestStrategy",
				OwnerID: ownerID,
			},
			scope:  "backtest",
			errMsg: "database client not available",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := setupContextWithAuth()

			_, err := RequiresPermissionDirective(
				ctx,
				tt.obj,
				mockResolver,
				tt.scope,
				nil,
			)

			// All tests should fail with "database client not available" since we don't have a real DB
			require.Error(t, err, "Expected error but got none")
			assert.Contains(t, err.Error(), tt.errMsg, "Error message should contain expected text")
		})
	}
}

// TestVerifyResourcePermission_Integration tests for all entity types
// Note: These are integration test placeholders
func TestVerifyResourcePermission_Integration(t *testing.T) {
	t.Run("Bot permission verification", func(t *testing.T) {
		t.Skip("Integration test - requires test database and Keycloak server")
		// This would test:
		// 1. Bot exists and owner_id matches user
		// 2. Keycloak UMA permission check for run/stop/view scopes
		// 3. Bot does not exist
		// 4. Bot exists but owner_id doesn't match
	})

	t.Run("Exchange permission verification", func(t *testing.T) {
		t.Skip("Integration test - requires test database and Keycloak server")
		// This would test:
		// 1. Exchange exists and owner_id matches user
		// 2. Keycloak UMA permission check for edit/view scopes
		// 3. Exchange does not exist
		// 4. Exchange exists but owner_id doesn't match
	})

	t.Run("BotRunner permission verification", func(t *testing.T) {
		t.Skip("Integration test - requires test database and Keycloak server")
		// This would test:
		// 1. BotRunner exists and owner_id matches user
		// 2. Keycloak UMA permission check for edit/delete/make-public scopes
		// 3. BotRunner does not exist
		// 4. BotRunner exists but owner_id doesn't match
	})
}

// TestCreateWithResource_Integration tests for all entity types
// Note: These are integration test placeholders
func TestCreateWithResource_Integration(t *testing.T) {
	t.Run("CreateBotWithResource", func(t *testing.T) {
		t.Skip("Integration test - requires test database and Keycloak server")
		// This would test:
		// 1. Bot is created in database
		// 2. Keycloak resource is created with correct scopes
		// 3. Keycloak permission is created for owner
		// 4. Transaction rollback on Keycloak failure
	})

	t.Run("CreateExchangeWithResource", func(t *testing.T) {
		t.Skip("Integration test - requires test database and Keycloak server")
		// This would test:
		// 1. Exchange is created in database
		// 2. Keycloak resource is created with correct scopes
		// 3. Keycloak permission is created for owner
		// 4. Transaction rollback on Keycloak failure
	})

	t.Run("CreateBotRunnerWithResource", func(t *testing.T) {
		t.Skip("Integration test - requires test database and Keycloak server")
		// This would test:
		// 1. BotRunner is created in database
		// 2. Keycloak resource is created with correct scopes
		// 3. Keycloak permission is created for owner
		// 4. Transaction rollback on Keycloak failure
	})
}

// TestDeleteWithResource_Integration tests for all entity types
// Note: These are integration test placeholders
func TestDeleteWithResource_Integration(t *testing.T) {
	t.Run("DeleteBotWithResource", func(t *testing.T) {
		t.Skip("Integration test - requires test database and Keycloak server")
		// This would test:
		// 1. Bot is deleted from database
		// 2. Keycloak resource is deleted
		// 3. Error handling when bot doesn't exist
	})

	t.Run("DeleteExchangeWithResource", func(t *testing.T) {
		t.Skip("Integration test - requires test database and Keycloak server")
		// This would test:
		// 1. Exchange is deleted from database
		// 2. Keycloak resource is deleted
		// 3. Error handling when exchange doesn't exist
	})

	t.Run("DeleteBotRunnerWithResource", func(t *testing.T) {
		t.Skip("Integration test - requires test database and Keycloak server")
		// This would test:
		// 1. BotRunner is deleted from database
		// 2. Keycloak resource is deleted
		// 3. Error handling when runner doesn't exist
	})
}
