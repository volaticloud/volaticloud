package authz

import (
	"context"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"volaticloud/internal/ent/enttest"
	"volaticloud/internal/keycloak"

	_ "github.com/mattn/go-sqlite3"
)

// mockUMAClient is a mock implementation of keycloak.UMAClientInterface for testing
type mockUMAClient struct {
	syncCalls      []syncCall
	syncError      error
	shouldFailSync bool
}

type syncCall struct {
	resourceID   string
	resourceName string
	scopes       []string
	attributes   map[string][]string
}

func (m *mockUMAClient) CheckPermission(ctx context.Context, token, resourceID, scope string) (bool, error) {
	return true, nil
}

func (m *mockUMAClient) CreateResource(ctx context.Context, resourceID, resourceName string, scopes []string, attributes map[string][]string) error {
	return nil
}

func (m *mockUMAClient) UpdateResource(ctx context.Context, resourceID string, attributes map[string][]string) error {
	return nil
}

func (m *mockUMAClient) SyncResourceScopes(ctx context.Context, resourceID, resourceName string, scopes []string, attributes map[string][]string) error {
	m.syncCalls = append(m.syncCalls, syncCall{
		resourceID:   resourceID,
		resourceName: resourceName,
		scopes:       scopes,
		attributes:   attributes,
	})

	if m.shouldFailSync {
		return fmt.Errorf("mock sync error: %w", m.syncError)
	}

	return nil
}

func (m *mockUMAClient) DeleteResource(ctx context.Context, resourceID string) error {
	return nil
}

func (m *mockUMAClient) CreatePermission(ctx context.Context, resourceID, ownerID string) error {
	return nil
}

// Helper to get the last sync call
func (m *mockUMAClient) lastSyncCall() *syncCall {
	if len(m.syncCalls) == 0 {
		return nil
	}
	return &m.syncCalls[len(m.syncCalls)-1]
}

func TestSyncResourcePermissions_Bot(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	mockUMA := &mockUMAClient{}
	ctx := context.Background()

	// Create required dependencies for bot
	exchange := client.Exchange.Create().
		SetName("Test Exchange").
		SetOwnerID("user-123").
		SetConfig(map[string]interface{}{
			"name": "binance",
		}).
		SaveX(ctx)

	strategy := client.Strategy.Create().
		SetName("Test Strategy").
		SetOwnerID("user-123").
		SetCode("# code").
		SetConfig(map[string]interface{}{
			"strategy": "SampleStrategy",
		}).
		SaveX(ctx)

	runner := client.BotRunner.Create().
		SetName("Test Runner").
		SetOwnerID("user-123").
		SaveX(ctx)

	// Create a bot
	bot := client.Bot.Create().
		SetName("Test Bot").
		SetOwnerID("user-123").
		SetPublic(true).
		SetConfig(map[string]interface{}{"test": "value"}).
		SetExchangeID(exchange.ID).
		SetStrategyID(strategy.ID).
		SetRunnerID(runner.ID).
		SaveX(ctx)

	// Sync bot resource
	err := SyncResourcePermissions(ctx, client, mockUMA, bot.ID.String())
	require.NoError(t, err)

	// Verify sync was called with correct parameters
	require.Len(t, mockUMA.syncCalls, 1)
	call := mockUMA.lastSyncCall()
	assert.Equal(t, bot.ID.String(), call.resourceID)
	assert.Equal(t, "Bot: Test Bot", call.resourceName)

	// Verify bot scopes were used
	expectedScopes := GetScopesForType(ResourceTypeBot)
	assert.ElementsMatch(t, expectedScopes, call.scopes)

	// Verify attributes
	assert.Equal(t, string(ResourceTypeBot), call.attributes["type"][0])
	assert.Equal(t, "user-123", call.attributes["ownerId"][0])
	assert.Equal(t, "true", call.attributes["public"][0])
}

func TestSyncResourcePermissions_Strategy(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	mockUMA := &mockUMAClient{}
	ctx := context.Background()

	// Create a strategy
	strategy := client.Strategy.Create().
		SetName("Test Strategy").
		SetOwnerID("user-123").
		SetPublic(false).
		SetCode("# test code").
		SetVersionNumber(1).
		SetConfig(map[string]interface{}{
			"strategy": "SampleStrategy",
		}).
		SaveX(ctx)

	// Sync strategy resource
	err := SyncResourcePermissions(ctx, client, mockUMA, strategy.ID.String())
	require.NoError(t, err)

	// Verify sync was called
	require.Len(t, mockUMA.syncCalls, 1)
	call := mockUMA.lastSyncCall()
	assert.Equal(t, strategy.ID.String(), call.resourceID)
	assert.Equal(t, "Strategy: Test Strategy", call.resourceName)

	// Verify strategy scopes
	expectedScopes := GetScopesForType(ResourceTypeStrategy)
	assert.ElementsMatch(t, expectedScopes, call.scopes)

	// Verify attributes
	assert.Equal(t, string(ResourceTypeStrategy), call.attributes["type"][0])
	assert.Equal(t, "user-123", call.attributes["ownerId"][0])
	assert.Equal(t, "false", call.attributes["public"][0])
}

func TestSyncResourcePermissions_Exchange(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	mockUMA := &mockUMAClient{}
	ctx := context.Background()

	// Create an exchange
	exchange := client.Exchange.Create().
		SetName("Test Exchange").
		SetOwnerID("user-123").
		SetConfig(map[string]interface{}{
			"name": "binance",
		}).
		SaveX(ctx)

	// Sync exchange resource
	err := SyncResourcePermissions(ctx, client, mockUMA, exchange.ID.String())
	require.NoError(t, err)

	// Verify sync was called
	require.Len(t, mockUMA.syncCalls, 1)
	call := mockUMA.lastSyncCall()
	assert.Equal(t, exchange.ID.String(), call.resourceID)
	assert.Equal(t, "Exchange: Test Exchange", call.resourceName)

	// Verify exchange scopes
	expectedScopes := GetScopesForType(ResourceTypeExchange)
	assert.ElementsMatch(t, expectedScopes, call.scopes)

	// Verify attributes
	assert.Equal(t, string(ResourceTypeExchange), call.attributes["type"][0])
	assert.Equal(t, "user-123", call.attributes["ownerId"][0])
}

func TestSyncResourcePermissions_BotRunner(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	mockUMA := &mockUMAClient{}
	ctx := context.Background()

	// Create a bot runner
	runner := client.BotRunner.Create().
		SetName("Test Runner").
		SetOwnerID("user-123").
		SetPublic(true).
		SaveX(ctx)

	// Sync runner resource
	err := SyncResourcePermissions(ctx, client, mockUMA, runner.ID.String())
	require.NoError(t, err)

	// Verify sync was called
	require.Len(t, mockUMA.syncCalls, 1)
	call := mockUMA.lastSyncCall()
	assert.Equal(t, runner.ID.String(), call.resourceID)
	assert.Equal(t, "Runner: Test Runner", call.resourceName)

	// Verify runner scopes
	expectedScopes := GetScopesForType(ResourceTypeBotRunner)
	assert.ElementsMatch(t, expectedScopes, call.scopes)

	// Verify attributes
	assert.Equal(t, string(ResourceTypeBotRunner), call.attributes["type"][0])
	assert.Equal(t, "user-123", call.attributes["ownerId"][0])
	assert.Equal(t, "true", call.attributes["public"][0])
}

func TestSyncResourcePermissions_Group_FallbackWithValidUUID(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	mockUMA := &mockUMAClient{}
	ctx := context.Background()

	// Use a valid UUID that doesn't exist in any entity table
	// This should fallback to group sync
	nonExistentID := uuid.New().String()

	// Sync non-existent resource (should fallback to group)
	err := SyncResourcePermissions(ctx, client, mockUMA, nonExistentID)
	require.NoError(t, err)

	// Verify group sync was called
	require.Len(t, mockUMA.syncCalls, 1)
	call := mockUMA.lastSyncCall()
	assert.Equal(t, nonExistentID, call.resourceID)
	assert.Equal(t, "Group: "+nonExistentID, call.resourceName)

	// Verify group scopes
	expectedScopes := GetScopesForType(ResourceTypeGroup)
	assert.ElementsMatch(t, expectedScopes, call.scopes)

	// Verify attributes
	assert.Equal(t, string(ResourceTypeGroup), call.attributes["type"][0])
}

func TestSyncResourcePermissions_Group_DirectStringID(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	mockUMA := &mockUMAClient{}
	ctx := context.Background()

	// Use a non-UUID string (like a Keycloak group ID)
	groupID := "keycloak-group-abc123"

	// Sync group resource with string ID
	err := SyncResourcePermissions(ctx, client, mockUMA, groupID)
	require.NoError(t, err)

	// Verify group sync was called
	require.Len(t, mockUMA.syncCalls, 1)
	call := mockUMA.lastSyncCall()
	assert.Equal(t, groupID, call.resourceID)
	assert.Equal(t, "Group: "+groupID, call.resourceName)

	// Verify group scopes
	expectedScopes := GetScopesForType(ResourceTypeGroup)
	assert.ElementsMatch(t, expectedScopes, call.scopes)
}

func TestSyncResourcePermissions_UMAClientError(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	mockUMA := &mockUMAClient{
		shouldFailSync: true,
		syncError:      fmt.Errorf("keycloak unavailable"),
	}
	ctx := context.Background()

	// Create required dependencies
	exchange := client.Exchange.Create().
		SetName("Test Exchange").
		SetOwnerID("user-123").
		SetConfig(map[string]interface{}{
			"name": "binance",
		}).
		SaveX(ctx)

	strategy := client.Strategy.Create().
		SetName("Test Strategy").
		SetOwnerID("user-123").
		SetCode("# code").
		SetConfig(map[string]interface{}{
			"strategy": "SampleStrategy",
		}).
		SaveX(ctx)

	runner := client.BotRunner.Create().
		SetName("Test Runner").
		SetOwnerID("user-123").
		SaveX(ctx)

	// Create a bot
	bot := client.Bot.Create().
		SetName("Test Bot").
		SetOwnerID("user-123").
		SetConfig(map[string]interface{}{}).
		SetExchangeID(exchange.ID).
		SetStrategyID(strategy.ID).
		SetRunnerID(runner.ID).
		SaveX(ctx)

	// Sync should fail
	err := SyncResourcePermissions(ctx, client, mockUMA, bot.ID.String())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "mock sync error")
}

func TestSyncResourcePermissions_ResourceTypePriority(t *testing.T) {
	// This test verifies that if a UUID exists in multiple tables (shouldn't happen in practice),
	// the function checks in a specific order: Bot -> Strategy -> Exchange -> BotRunner -> Group
	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	mockUMA := &mockUMAClient{}
	ctx := context.Background()

	// Create required dependencies
	exchange := client.Exchange.Create().
		SetName("Test Exchange").
		SetOwnerID("user-123").
		SetConfig(map[string]interface{}{
			"name": "binance",
		}).
		SaveX(ctx)

	strategy := client.Strategy.Create().
		SetName("Test Strategy").
		SetOwnerID("user-123").
		SetCode("# code").
		SetConfig(map[string]interface{}{
			"strategy": "SampleStrategy",
		}).
		SaveX(ctx)

	runner := client.BotRunner.Create().
		SetName("Test Runner").
		SetOwnerID("user-123").
		SaveX(ctx)

	// Create a bot with a specific UUID
	botID := uuid.New()
	client.Bot.Create().
		SetID(botID).
		SetName("Test Bot").
		SetOwnerID("user-123").
		SetConfig(map[string]interface{}{}).
		SetExchangeID(exchange.ID).
		SetStrategyID(strategy.ID).
		SetRunnerID(runner.ID).
		SaveX(ctx)

	// Sync - should find Bot first
	err := SyncResourcePermissions(ctx, client, mockUMA, botID.String())
	require.NoError(t, err)

	call := mockUMA.lastSyncCall()
	assert.Equal(t, "Bot: Test Bot", call.resourceName)
	assert.Equal(t, string(ResourceTypeBot), call.attributes["type"][0])
}

func TestSyncGroupResource(t *testing.T) {
	mockUMA := &mockUMAClient{}
	ctx := context.Background()

	groupID := "test-group-123"

	// Directly test the private syncGroupResource function
	err := syncGroupResource(ctx, mockUMA, groupID)
	require.NoError(t, err)

	// Verify sync was called
	require.Len(t, mockUMA.syncCalls, 1)
	call := mockUMA.lastSyncCall()
	assert.Equal(t, groupID, call.resourceID)
	assert.Equal(t, "Group: "+groupID, call.resourceName)

	// Verify group scopes
	expectedScopes := GetScopesForType(ResourceTypeGroup)
	assert.ElementsMatch(t, expectedScopes, call.scopes)
}

func TestSyncResourcePermissions_EmptyResourceID(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	mockUMA := &mockUMAClient{}
	ctx := context.Background()

	// Empty string is not a valid UUID, should try group sync
	err := SyncResourcePermissions(ctx, client, mockUMA, "")
	require.NoError(t, err)

	// Should have called group sync
	require.Len(t, mockUMA.syncCalls, 1)
	call := mockUMA.lastSyncCall()
	assert.Equal(t, "", call.resourceID)
	assert.Equal(t, "Group: ", call.resourceName)
}

// Verify that the mockUMAClient implements the interface
var _ keycloak.UMAClientInterface = (*mockUMAClient)(nil)
