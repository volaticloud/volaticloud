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
	"volaticloud/internal/graph/model"
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

// TestHasScopeDirective_FromParent tests the HasScopeDirective with fromParent=true (field-level mode)
// Note: Full testing requires a database and UMA server. These tests focus on error paths.
func TestHasScopeDirective_FromParent(t *testing.T) {
	strategyID := uuid.MustParse("11111111-2222-3333-4444-555555555555")
	ownerID := "user-123"
	rawToken := "test-token-123"
	fromParent := true

	tests := []struct {
		name         string
		setupContext func() context.Context
		obj          interface{}
		resource     string
		scope        string
		resourceType model.ResourceType
		fromParent   *bool
		wantErr      bool
		errMsg       string
	}{
		{
			name: "missing authentication",
			setupContext: func() context.Context {
				return context.Background()
			},
			obj: &ent.Strategy{
				ID:      strategyID,
				Name:    "TestStrategy",
				OwnerID: ownerID,
			},
			resource:     "id",
			scope:        "view",
			resourceType: model.ResourceTypeStrategy,
			fromParent:   &fromParent,
			wantErr:      true,
			errMsg:       "authentication required",
		},
		{
			name: "nil parent object in fromParent mode",
			setupContext: func() context.Context {
				ctx := context.Background()
				ctx = auth.SetUserContext(ctx, &auth.UserContext{
					UserID:   ownerID,
					RawToken: rawToken,
					Email:    "user@test.com",
				})
				ctx = SetUMAClientInContext(ctx, keycloak.NewUMAClient("", "", "", ""))
				return ctx
			},
			obj:          nil,
			resource:     "id",
			scope:        "view",
			resourceType: model.ResourceTypeStrategy,
			fromParent:   &fromParent,
			wantErr:      true,
			errMsg:       "failed to extract resource ID from parent",
		},
		{
			name: "database client not available",
			setupContext: func() context.Context {
				ctx := context.Background()
				ctx = auth.SetUserContext(ctx, &auth.UserContext{
					UserID:   ownerID,
					RawToken: rawToken,
					Email:    "user@test.com",
				})
				ctx = SetUMAClientInContext(ctx, keycloak.NewUMAClient("http://test", "test-realm", "test-client", "test-secret"))
				return ctx
			},
			obj: &ent.Strategy{
				ID:      strategyID,
				Name:    "TestStrategy",
				OwnerID: ownerID,
			},
			resource:     "id",
			scope:        "view",
			resourceType: model.ResourceTypeStrategy,
			fromParent:   &fromParent,
			wantErr:      true,
			errMsg:       "database client not available",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := tt.setupContext()

			result, err := HasScopeDirective(
				ctx,
				tt.obj,
				mockResolver,
				tt.resource,
				tt.scope,
				tt.resourceType,
				tt.fromParent,
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

// TestHasScopeDirective_RealScenarios tests real-world scenarios
// Note: These would require a test database setup in a real test suite
func TestHasScopeDirective_RealScenarios(t *testing.T) {
	t.Run("code field protection with fromParent", func(t *testing.T) {
		// This test would verify that:
		// 1. Strategy.code field returns null if user lacks "view" permission
		// 2. Strategy.code field returns value if user has "view" permission
		// Uses @hasScope(resource: "id", scope: "view", resourceType: STRATEGY, fromParent: true)
		t.Skip("Requires test database and UMA server setup")
	})

	t.Run("backtest result with cross-resource permission", func(t *testing.T) {
		// This test would verify that:
		// 1. Backtest.result field checks permission on the parent Strategy
		// 2. Uses @hasScope(resource: "strategyID", scope: "view", resourceType: STRATEGY, fromParent: true)
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
		expected := []string{"view", "view-secrets", "run", "stop", "delete", "edit", "freqtrade-api", "make-public",
			"create-alert-rule", "update-alert-rule", "delete-alert-rule", "view-alert-rules", "view-users"}
		assert.Equal(t, expected, authz.BotScopes, "BotScopes should contain the expected values")
		assert.Len(t, authz.BotScopes, 13, "BotScopes should have 13 scopes")
	})

	t.Run("ExchangeScopes contains expected values", func(t *testing.T) {
		expected := []string{"view", "view-secrets", "edit", "delete", "view-users"}
		assert.Equal(t, expected, authz.ExchangeScopes, "ExchangeScopes should contain the expected values")
		assert.Len(t, authz.ExchangeScopes, 5, "ExchangeScopes should have 5 scopes")
	})

	t.Run("BotRunnerScopes contains expected values", func(t *testing.T) {
		expected := []string{"view", "view-secrets", "edit", "delete", "make-public",
			"create-alert-rule", "update-alert-rule", "delete-alert-rule", "view-alert-rules", "view-users"}
		assert.Equal(t, expected, authz.BotRunnerScopes, "BotRunnerScopes should contain the expected values")
		assert.Len(t, authz.BotRunnerScopes, 10, "BotRunnerScopes should have 10 scopes")
	})

	t.Run("StrategyScopes contains expected values", func(t *testing.T) {
		expected := []string{"view", "edit", "delete", "run-backtest", "stop-backtest", "delete-backtest", "make-public",
			"create-alert-rule", "update-alert-rule", "delete-alert-rule", "view-alert-rules", "view-users"}
		assert.Equal(t, expected, authz.StrategyScopes, "StrategyScopes should contain the expected values")
		assert.Len(t, authz.StrategyScopes, 12, "StrategyScopes should have 12 scopes")
	})

	t.Run("GroupScopes contains expected values", func(t *testing.T) {
		expected := []string{"view", "edit", "delete", "mark-alert-as-read", "view-users", "invite-user", "change-user-roles",
			"create-strategy", "create-bot", "create-exchange", "create-runner",
			"create-alert-rule", "update-alert-rule", "delete-alert-rule", "view-alert-rules"}
		assert.Equal(t, expected, authz.GroupScopes, "GroupScopes should contain the expected values")
		assert.Len(t, authz.GroupScopes, 15, "GroupScopes should have 15 scopes")
	})
}

// TestHasScopeDirective_AllEntityTypes tests the directive with different entity types
func TestHasScopeDirective_AllEntityTypes(t *testing.T) {
	ownerID := "user-123"
	rawToken := "test-token-123"
	fromParent := true

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
		name         string
		obj          interface{}
		scope        string
		resourceType model.ResourceType
		errMsg       string // Expected error (since we don't have a real DB)
	}{
		{
			name: "Bot with view scope",
			obj: &ent.Bot{
				ID:      uuid.MustParse("11111111-1111-1111-1111-111111111111"),
				Name:    "TestBot",
				OwnerID: ownerID,
			},
			scope:        "view",
			resourceType: model.ResourceTypeBot,
			errMsg:       "database client not available",
		},
		{
			name: "Exchange with edit scope",
			obj: &ent.Exchange{
				ID:      uuid.MustParse("33333333-3333-3333-3333-333333333333"),
				Name:    "TestExchange",
				OwnerID: ownerID,
			},
			scope:        "edit",
			resourceType: model.ResourceTypeExchange,
			errMsg:       "database client not available",
		},
		{
			name: "BotRunner with delete scope",
			obj: &ent.BotRunner{
				ID:      uuid.MustParse("44444444-4444-4444-4444-444444444444"),
				Name:    "TestRunner",
				OwnerID: ownerID,
			},
			scope:        "delete",
			resourceType: model.ResourceTypeBotRunner,
			errMsg:       "database client not available",
		},
		{
			name: "Strategy with view scope",
			obj: &ent.Strategy{
				ID:      uuid.MustParse("55555555-5555-5555-5555-555555555555"),
				Name:    "TestStrategy",
				OwnerID: ownerID,
			},
			scope:        "view",
			resourceType: model.ResourceTypeStrategy,
			errMsg:       "database client not available",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := setupContextWithAuth()

			_, err := HasScopeDirective(
				ctx,
				tt.obj,
				mockResolver,
				"id",
				tt.scope,
				tt.resourceType,
				&fromParent,
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

// TestExtractArgumentValue tests the extractArgumentValue helper function
func TestExtractArgumentValue(t *testing.T) {
	tests := []struct {
		name    string
		args    map[string]interface{}
		path    string
		want    string
		wantErr bool
		errMsg  string
	}{
		{
			name: "simple path - id",
			args: map[string]interface{}{
				"id": "123e4567-e89b-12d3-a456-426614174000",
			},
			path:    "id",
			want:    "123e4567-e89b-12d3-a456-426614174000",
			wantErr: false,
		},
		{
			name: "nested path - input.strategyID",
			args: map[string]interface{}{
				"input": map[string]interface{}{
					"strategyID": "strategy-uuid-123",
				},
			},
			path:    "input.strategyID",
			want:    "strategy-uuid-123",
			wantErr: false,
		},
		{
			name: "nested path - where.ownerID",
			args: map[string]interface{}{
				"where": map[string]interface{}{
					"ownerID": "owner-group-456",
				},
			},
			path:    "where.ownerID",
			want:    "owner-group-456",
			wantErr: false,
		},
		{
			name: "deeply nested path",
			args: map[string]interface{}{
				"level1": map[string]interface{}{
					"level2": map[string]interface{}{
						"level3": "deep-value",
					},
				},
			},
			path:    "level1.level2.level3",
			want:    "deep-value",
			wantErr: false,
		},
		{
			name: "missing simple path",
			args: map[string]interface{}{
				"otherId": "some-value",
			},
			path:    "id",
			wantErr: true,
			errMsg:  "not found",
		},
		{
			name: "missing nested path",
			args: map[string]interface{}{
				"input": map[string]interface{}{
					"otherField": "some-value",
				},
			},
			path:    "input.strategyID",
			wantErr: true,
			errMsg:  "not found",
		},
		{
			name: "empty string value",
			args: map[string]interface{}{
				"id": "",
			},
			path:    "id",
			wantErr: true,
			errMsg:  "empty",
		},
		{
			name:    "empty args",
			args:    map[string]interface{}{},
			path:    "id",
			wantErr: true,
			errMsg:  "not found",
		},
		{
			name: "nil value in path",
			args: map[string]interface{}{
				"input": nil,
			},
			path:    "input.strategyID",
			wantErr: true,
			errMsg:  "type: <nil>", // Nil values can't be navigated
		},
		{
			name: "non-string value",
			args: map[string]interface{}{
				"count": 42,
			},
			path:    "count",
			wantErr: true,
			errMsg:  "not a string",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := extractArgumentValue(tt.args, tt.path)

			if tt.wantErr {
				require.Error(t, err, "Expected error but got none")
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg, "Error message should contain expected text")
				}
			} else {
				require.NoError(t, err, "Expected no error but got: %v", err)
				assert.Equal(t, tt.want, result, "Extracted value should match")
			}
		})
	}
}

// TestHasScopeDirective_ArgumentMode tests HasScopeDirective with fromParent=false (argument mode)
// This mode extracts resource ID from GraphQL arguments, used for mutations and queries
func TestHasScopeDirective_ArgumentMode(t *testing.T) {
	ownerID := "user-123"
	rawToken := "test-token-123"

	tests := []struct {
		name         string
		setupContext func() context.Context
		obj          interface{}
		resource     string
		scope        string
		resourceType model.ResourceType
		fromParent   *bool // nil or false for argument mode
		wantErr      bool
		errMsg       string
	}{
		{
			name: "missing authentication in argument mode",
			setupContext: func() context.Context {
				return context.Background()
			},
			obj:          nil,
			resource:     "id",
			scope:        "view",
			resourceType: model.ResourceTypeStrategy,
			fromParent:   nil, // argument mode
			wantErr:      true,
			errMsg:       "authentication required",
		},
		{
			name: "fromParent false - same as nil",
			setupContext: func() context.Context {
				return context.Background()
			},
			obj:          nil,
			resource:     "id",
			scope:        "view",
			resourceType: model.ResourceTypeBot,
			fromParent:   func() *bool { b := false; return &b }(),
			wantErr:      true,
			errMsg:       "authentication required",
		},
		{
			name: "argument mode with auth but no field context",
			setupContext: func() context.Context {
				ctx := context.Background()
				ctx = auth.SetUserContext(ctx, &auth.UserContext{
					UserID:   ownerID,
					RawToken: rawToken,
					Email:    "user@test.com",
				})
				ctx = SetUMAClientInContext(ctx, keycloak.NewUMAClient("http://test", "test-realm", "test-client", "test-secret"))
				return ctx
			},
			obj:          nil,
			resource:     "id",
			scope:        "view",
			resourceType: model.ResourceTypeStrategy,
			fromParent:   nil,
			wantErr:      true,
			errMsg:       "no field context available",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := tt.setupContext()

			_, err := HasScopeDirective(
				ctx,
				tt.obj,
				mockResolver,
				tt.resource,
				tt.scope,
				tt.resourceType,
				tt.fromParent,
			)

			if tt.wantErr {
				require.Error(t, err, "Expected error but got none")
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg, "Error message should contain expected text")
				}
			} else {
				require.NoError(t, err, "Expected no error but got: %v", err)
			}
		})
	}
}

// TestHasScopeDirective_CrossResourcePermission tests the cross-resource permission scenario
// where Backtest fields check permission against their parent Strategy
func TestHasScopeDirective_CrossResourcePermission(t *testing.T) {
	strategyID := uuid.MustParse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
	backtestID := uuid.MustParse("11111111-2222-3333-4444-555555555555")
	ownerID := "user-123"
	rawToken := "test-token-123"
	fromParent := true

	setupContextWithAuth := func() context.Context {
		ctx := context.Background()
		ctx = auth.SetUserContext(ctx, &auth.UserContext{
			UserID:   ownerID,
			RawToken: rawToken,
			Email:    "user@test.com",
		})
		ctx = SetUMAClientInContext(ctx, keycloak.NewUMAClient("http://test", "test-realm", "test-client", "test-secret"))
		return ctx
	}

	t.Run("Backtest.result checking Strategy permission via strategyID", func(t *testing.T) {
		// This tests the real scenario: Backtest.result field has
		// @hasScope(resource: "strategyID", scope: "view", resourceType: STRATEGY, fromParent: true)
		ctx := setupContextWithAuth()

		backtest := &ent.Backtest{
			ID:         backtestID,
			StrategyID: strategyID, // The field used for permission check
		}

		_, err := HasScopeDirective(
			ctx,
			backtest,
			mockResolver,
			"strategyID",                // Extract strategyID from Backtest object
			"view",                      // Check view permission
			model.ResourceTypeStrategy,  // On the Strategy resource
			&fromParent,
		)

		// Should fail with "database client not available" because we don't have ENT client
		// but importantly, it should NOT fail with "backtest not found" - that was the bug
		require.Error(t, err)
		assert.Contains(t, err.Error(), "database client not available")
		assert.NotContains(t, err.Error(), "backtest not found", "Should not try to find backtest as resource")
	})

	t.Run("Backtest.logs checking Strategy permission via strategyID", func(t *testing.T) {
		ctx := setupContextWithAuth()

		backtest := &ent.Backtest{
			ID:         backtestID,
			StrategyID: strategyID,
		}

		_, err := HasScopeDirective(
			ctx,
			backtest,
			mockResolver,
			"strategyID",
			"view",
			model.ResourceTypeStrategy,
			&fromParent,
		)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "database client not available")
	})

	t.Run("Backtest with zero strategyID fails extraction", func(t *testing.T) {
		ctx := setupContextWithAuth()

		backtest := &ent.Backtest{
			ID:         backtestID,
			StrategyID: uuid.Nil, // Zero UUID
		}

		_, err := HasScopeDirective(
			ctx,
			backtest,
			mockResolver,
			"strategyID",
			"view",
			model.ResourceTypeStrategy,
			&fromParent,
		)

		// Zero UUID is still a valid string, so it should pass extraction
		// but fail on DB lookup
		require.Error(t, err)
		assert.Contains(t, err.Error(), "database client not available")
	})
}

// TestHasScopeDirective_EdgeCases tests edge cases and error conditions
func TestHasScopeDirective_EdgeCases(t *testing.T) {
	ownerID := "user-123"
	rawToken := "test-token-123"
	fromParent := true

	t.Run("invalid ENT client type", func(t *testing.T) {
		ctx := context.Background()
		ctx = auth.SetUserContext(ctx, &auth.UserContext{
			UserID:   ownerID,
			RawToken: rawToken,
			Email:    "user@test.com",
		})
		ctx = SetUMAClientInContext(ctx, keycloak.NewUMAClient("http://test", "test-realm", "test-client", "test-secret"))
		// Set a non-*ent.Client value
		ctx = SetEntClientInContext(ctx, "not-an-ent-client")

		strategy := &ent.Strategy{
			ID:      uuid.MustParse("11111111-2222-3333-4444-555555555555"),
			Name:    "TestStrategy",
			OwnerID: ownerID,
		}

		_, err := HasScopeDirective(
			ctx,
			strategy,
			mockResolver,
			"id",
			"view",
			model.ResourceTypeStrategy,
			&fromParent,
		)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid database client type")
	})

	t.Run("non-existent field in parent object", func(t *testing.T) {
		ctx := context.Background()
		ctx = auth.SetUserContext(ctx, &auth.UserContext{
			UserID:   ownerID,
			RawToken: rawToken,
			Email:    "user@test.com",
		})
		ctx = SetUMAClientInContext(ctx, keycloak.NewUMAClient("http://test", "test-realm", "test-client", "test-secret"))

		// Use Backtest because Strategy/Bot/Exchange/BotRunner have fast paths that always return ID
		backtest := &ent.Backtest{
			ID:         uuid.MustParse("11111111-2222-3333-4444-555555555555"),
			StrategyID: uuid.MustParse("22222222-3333-4444-5555-666666666666"),
		}

		_, err := HasScopeDirective(
			ctx,
			backtest,
			mockResolver,
			"nonExistentField", // Field doesn't exist on Backtest
			"view",
			model.ResourceTypeStrategy,
			&fromParent,
		)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to extract resource ID from parent")
	})

	t.Run("pointer to non-struct object", func(t *testing.T) {
		ctx := context.Background()
		ctx = auth.SetUserContext(ctx, &auth.UserContext{
			UserID:   ownerID,
			RawToken: rawToken,
			Email:    "user@test.com",
		})
		ctx = SetUMAClientInContext(ctx, keycloak.NewUMAClient("http://test", "test-realm", "test-client", "test-secret"))

		intVal := 42
		_, err := HasScopeDirective(
			ctx,
			&intVal, // Pointer to non-struct
			mockResolver,
			"id",
			"view",
			model.ResourceTypeStrategy,
			&fromParent,
		)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to extract resource ID from parent")
	})
}

// TestExtractResourceID_CustomFields tests extractResourceID with various field configurations
// Note: Strategy, Bot, Exchange, BotRunner have a "fast path" that always returns ID field
// regardless of fieldName parameter. Only types without fast path (like Backtest) use reflection.
func TestExtractResourceID_CustomFields(t *testing.T) {
	strategyID := uuid.MustParse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
	backtestID := uuid.MustParse("11111111-2222-3333-4444-555555555555")

	tests := []struct {
		name      string
		obj       interface{}
		fieldName string
		wantID    string
		wantErr   bool
		errMsg    string
	}{
		{
			name: "extract strategyID from Backtest (uses reflection)",
			obj: &ent.Backtest{
				ID:         backtestID,
				StrategyID: strategyID,
			},
			fieldName: "strategyID",
			wantID:    strategyID.String(),
			wantErr:   false,
		},
		// Note: extracting "id" from Backtest won't work via reflection because
		// the ENT field is "ID" (all caps) but reflection capitalizes first letter only → "Id"
		// This is fine since Backtest fields always use strategyID for permission checks
		{
			name: "Strategy fast path always returns ID regardless of fieldName",
			obj: &ent.Strategy{
				ID:      strategyID,
				Name:    "TestStrategy",
				OwnerID: "group-owner-123",
			},
			fieldName: "ownerID", // Ignored by fast path
			wantID:    strategyID.String(), // Always returns ID
			wantErr:   false,
		},
		{
			name: "Bot fast path always returns ID regardless of fieldName",
			obj: &ent.Bot{
				ID:      backtestID,
				Name:    "TestBot",
				OwnerID: "group-owner-456",
			},
			fieldName: "ownerID", // Ignored by fast path
			wantID:    backtestID.String(), // Always returns ID
			wantErr:   false,
		},
		{
			name: "field name with wrong case on Backtest (uses reflection)",
			obj: &ent.Backtest{
				ID:         backtestID,
				StrategyID: strategyID,
			},
			fieldName: "STRATEGYID", // Wrong case - should fail
			wantErr:   true,
			errMsg:    "not found",
		},
		{
			name: "non-existent field on Backtest (uses reflection)",
			obj: &ent.Backtest{
				ID:         backtestID,
				StrategyID: strategyID,
			},
			fieldName: "nonExistent",
			wantErr:   true,
			errMsg:    "not found",
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

// TestHasScopeDirective_AllResourceTypes tests the directive with all supported resource types
func TestHasScopeDirective_AllResourceTypes(t *testing.T) {
	ownerID := "user-123"
	rawToken := "test-token-123"
	fromParent := true

	setupContextWithAuth := func() context.Context {
		ctx := context.Background()
		ctx = auth.SetUserContext(ctx, &auth.UserContext{
			UserID:   ownerID,
			RawToken: rawToken,
			Email:    "user@test.com",
		})
		ctx = SetUMAClientInContext(ctx, keycloak.NewUMAClient("http://test", "test-realm", "test-client", "test-secret"))
		return ctx
	}

	tests := []struct {
		name         string
		resourceType model.ResourceType
		obj          interface{}
		scope        string
	}{
		{
			name:         "STRATEGY resource type",
			resourceType: model.ResourceTypeStrategy,
			obj: &ent.Strategy{
				ID:      uuid.MustParse("11111111-1111-1111-1111-111111111111"),
				Name:    "TestStrategy",
				OwnerID: ownerID,
			},
			scope: "view",
		},
		{
			name:         "BOT resource type",
			resourceType: model.ResourceTypeBot,
			obj: &ent.Bot{
				ID:      uuid.MustParse("22222222-2222-2222-2222-222222222222"),
				Name:    "TestBot",
				OwnerID: ownerID,
			},
			scope: "view-secrets",
		},
		{
			name:         "EXCHANGE resource type",
			resourceType: model.ResourceTypeExchange,
			obj: &ent.Exchange{
				ID:      uuid.MustParse("33333333-3333-3333-3333-333333333333"),
				Name:    "TestExchange",
				OwnerID: ownerID,
			},
			scope: "edit",
		},
		{
			name:         "BOT_RUNNER resource type",
			resourceType: model.ResourceTypeBotRunner,
			obj: &ent.BotRunner{
				ID:      uuid.MustParse("44444444-4444-4444-4444-444444444444"),
				Name:    "TestRunner",
				OwnerID: ownerID,
			},
			scope: "delete",
		},
		// Note: Backtest is excluded because it uses strategyID for permissions
		// and has special handling (checked via parent Strategy)
		// We test Backtest in TestHasScopeDirective_CrossResourcePermission instead
		{
			name:         "ORGANIZATION resource type",
			resourceType: model.ResourceTypeOrganization,
			obj: &ent.Strategy{ // Using Strategy as placeholder since Organization isn't an ENT entity
				ID:      uuid.MustParse("77777777-7777-7777-7777-777777777777"),
				Name:    "OrgPlaceholder",
				OwnerID: ownerID,
			},
			scope: "view-users",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := setupContextWithAuth()

			_, err := HasScopeDirective(
				ctx,
				tt.obj,
				mockResolver,
				"id",
				tt.scope,
				tt.resourceType,
				&fromParent,
			)

			// All should fail with "database client not available" since we don't have ENT client
			require.Error(t, err)
			assert.Contains(t, err.Error(), "database client not available")
		})
	}
}

// TestHasScopeDirective_ScopeVariations tests various scope values
func TestHasScopeDirective_ScopeVariations(t *testing.T) {
	ownerID := "user-123"
	rawToken := "test-token-123"
	fromParent := true

	setupContextWithAuth := func() context.Context {
		ctx := context.Background()
		ctx = auth.SetUserContext(ctx, &auth.UserContext{
			UserID:   ownerID,
			RawToken: rawToken,
			Email:    "user@test.com",
		})
		ctx = SetUMAClientInContext(ctx, keycloak.NewUMAClient("http://test", "test-realm", "test-client", "test-secret"))
		return ctx
	}

	strategy := &ent.Strategy{
		ID:      uuid.MustParse("11111111-2222-3333-4444-555555555555"),
		Name:    "TestStrategy",
		OwnerID: ownerID,
	}

	scopes := []string{
		"view",
		"view-secrets",
		"edit",
		"delete",
		"run",
		"stop",
		"run-backtest",
		"stop-backtest",
		"delete-backtest",
		"make-public",
		"freqtrade-api",
		"create-alert-rule",
		"view-users",
		"invite-user",
		"change-user-roles",
	}

	for _, scope := range scopes {
		t.Run("scope_"+scope, func(t *testing.T) {
			ctx := setupContextWithAuth()

			_, err := HasScopeDirective(
				ctx,
				strategy,
				mockResolver,
				"id",
				scope,
				model.ResourceTypeStrategy,
				&fromParent,
			)

			// All should fail with "database client not available"
			// The point is to verify the directive accepts all scope values
			require.Error(t, err)
			assert.Contains(t, err.Error(), "database client not available")
		})
	}
}

// TestChangeOrganizationUserRole tests the ChangeOrganizationUserRole resolver
func TestChangeOrganizationUserRole(t *testing.T) {
	orgID := "11111111-1111-1111-1111-111111111111"
	userID := "22222222-2222-2222-2222-222222222222"
	currentUserID := "33333333-3333-3333-3333-333333333333"

	t.Run("prevents self-role-change", func(t *testing.T) {
		// Create context with user trying to change their own role
		ctx := auth.SetUserContext(context.Background(), &auth.UserContext{
			UserID: userID, // Same as target user
		})

		resolver := &mutationResolver{}
		result, err := resolver.ChangeOrganizationUserRole(ctx, orgID, userID, "admin")

		require.Error(t, err)
		assert.Contains(t, err.Error(), "cannot change your own role")
		assert.False(t, result)
	})

	t.Run("rejects empty role", func(t *testing.T) {
		ctx := auth.SetUserContext(context.Background(), &auth.UserContext{
			UserID: currentUserID,
		})

		resolver := &mutationResolver{}
		result, err := resolver.ChangeOrganizationUserRole(ctx, orgID, userID, "")

		require.Error(t, err)
		assert.Contains(t, err.Error(), "role cannot be empty")
		assert.False(t, result)
	})

	t.Run("requires admin client", func(t *testing.T) {
		ctx := auth.SetUserContext(context.Background(), &auth.UserContext{
			UserID: currentUserID,
		})
		// No admin client in context

		resolver := &mutationResolver{}
		result, err := resolver.ChangeOrganizationUserRole(ctx, orgID, userID, "viewer")

		require.Error(t, err)
		assert.Contains(t, err.Error(), "admin client not available")
		assert.False(t, result)
	})

	t.Run("validates role against available roles", func(t *testing.T) {
		t.Skip("Integration test - requires Keycloak mock or interface refactor")
		// This would test:
		// 1. Mock admin client returns available roles: ["admin", "viewer"]
		// 2. Resolver rejects "invalid-role" with helpful error message
		// 3. Error contains both the invalid role and available roles list
	})

	t.Run("successful role change", func(t *testing.T) {
		t.Skip("Integration test - requires Keycloak mock or interface refactor")
		// This would test:
		// 1. Mock admin client validates role is in available list
		// 2. Mock admin client successfully changes role
		// 3. Resolver returns true on success
	})
}
