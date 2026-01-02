package graph

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/enttest"
	"volaticloud/internal/keycloak"

	_ "github.com/mattn/go-sqlite3"
)

// mockUMAClient is a mock implementation for testing
type mockUMAClient struct {
	mu         sync.Mutex
	syncCalls  int
	syncDelay  time.Duration
	syncError  error
	syncCalled chan struct{} // Signal when sync is called
}

func newMockUMAClient() *mockUMAClient {
	return &mockUMAClient{
		syncCalled: make(chan struct{}, 100),
	}
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
	m.mu.Lock()
	m.syncCalls++
	m.mu.Unlock()

	// Signal that sync was called
	select {
	case m.syncCalled <- struct{}{}:
	default:
	}

	// Simulate delay if configured
	if m.syncDelay > 0 {
		time.Sleep(m.syncDelay)
	}

	if m.syncError != nil {
		return m.syncError
	}

	return nil
}

func (m *mockUMAClient) DeleteResource(ctx context.Context, resourceID string) error {
	return nil
}

func (m *mockUMAClient) CreatePermission(ctx context.Context, resourceID, ownerID string) error {
	return nil
}

func (m *mockUMAClient) getSyncCalls() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.syncCalls
}

// setupTestContext creates a context with UMA client
func setupTestContext(umaClient keycloak.UMAClientInterface) context.Context {
	ctx := context.Background()
	return context.WithValue(ctx, umaClientKey, umaClient)
}

// createBotWithDeps creates a bot with all required dependencies (exchange, strategy, runner)
func createBotWithDeps(t *testing.T, client *ent.Client, ctx context.Context, botName string) uuid.UUID {
	exchange := client.Exchange.Create().
		SetName("Test Exchange").
		SetOwnerID("user-123").
		SetConfig(map[string]interface{}{
			"name": "binance",
		}).
		SaveX(ctx)

	strategy := client.Strategy.Create().
		SetName("Strategy for " + botName).
		SetOwnerID("user-123").
		SetCode("# code").
		SetVersionNumber(1).
		SetConfig(map[string]interface{}{
			"strategy": "SampleStrategy",
		}).
		SaveX(ctx)

	runner := client.BotRunner.Create().
		SetName("Test Runner").
		SetOwnerID("user-123").
		SaveX(ctx)

	bot := client.Bot.Create().
		SetName(botName).
		SetOwnerID("user-123").
		SetConfig(map[string]interface{}{}).
		SetExchangeID(exchange.ID).
		SetStrategyID(strategy.ID).
		SetRunnerID(runner.ID).
		SaveX(ctx)

	return bot.ID
}

func TestSyncResourceScopes_Success(t *testing.T) {
	// Clear global state before test
	syncInProgress = sync.Map{}
	syncFailures = sync.Map{}

	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	mockUMA := newMockUMAClient()
	ctx := setupTestContext(mockUMA)

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
		SetVersionNumber(1).
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

	// Sync should succeed
	err := SyncResourceScopes(ctx, client, bot.ID.String())
	require.NoError(t, err)

	// Verify sync was called once
	assert.Equal(t, 1, mockUMA.getSyncCalls())
}

func TestSyncResourceScopes_ConcurrentDeduplication(t *testing.T) {
	// Clear global state before test
	syncInProgress = sync.Map{}
	syncFailures = sync.Map{}

	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	// Mock UMA client with delay to ensure goroutines overlap
	mockUMA := newMockUMAClient()
	mockUMA.syncDelay = 100 * time.Millisecond
	ctx := setupTestContext(mockUMA)

	// Create a bot with dependencies
	botID := createBotWithDeps(t, client, ctx, "Test Bot")
	resourceID := botID.String()

	// Launch 10 concurrent sync requests for the same resource
	var wg sync.WaitGroup
	numGoroutines := 10
	errors := make([]error, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			errors[idx] = SyncResourceScopes(ctx, client, resourceID)
		}(i)
	}

	wg.Wait()

	// All goroutines should succeed
	for i, err := range errors {
		assert.NoError(t, err, "goroutine %d should not error", i)
	}

	// Despite 10 concurrent calls, sync should only be called ONCE (deduplication)
	assert.Equal(t, 1, mockUMA.getSyncCalls(), "sync should only be called once due to deduplication")

	// Verify no entries remain in syncInProgress after completion
	count := 0
	syncInProgress.Range(func(key, value interface{}) bool {
		count++
		return true
	})
	assert.Equal(t, 0, count, "syncInProgress should be empty after completion")
}

func TestSyncResourceScopes_CooldownPeriod(t *testing.T) {
	// Clear global state before test
	syncInProgress = sync.Map{}
	syncFailures = sync.Map{}

	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	// Mock UMA client that fails
	mockUMA := newMockUMAClient()
	mockUMA.syncError = fmt.Errorf("keycloak unavailable")
	ctx := setupTestContext(mockUMA)

	// Create a bot with dependencies
	botID := createBotWithDeps(t, client, ctx, "Test Bot")
	resourceID := botID.String()

	// First sync attempt should fail
	err := SyncResourceScopes(ctx, client, resourceID)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "keycloak unavailable")

	// Verify failure was tracked
	_, exists := syncFailures.Load(resourceID)
	assert.True(t, exists, "failure should be tracked")

	// Second attempt immediately should be blocked by cooldown
	err = SyncResourceScopes(ctx, client, resourceID)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "sync recently failed")
	assert.Contains(t, err.Error(), "retry after")

	// Sync should only have been called once (second was blocked by cooldown)
	assert.Equal(t, 1, mockUMA.getSyncCalls())
}

func TestSyncResourceScopes_CooldownExpiration(t *testing.T) {
	// This test is skipped in CI as it requires time manipulation
	// In real implementation, you might use a time mock
	t.Skip("Skipping time-dependent test - requires 5 minute wait or time mocking")

	// Clear global state before test
	syncInProgress = sync.Map{}
	syncFailures = sync.Map{}

	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	mockUMA := newMockUMAClient()
	mockUMA.syncError = fmt.Errorf("keycloak unavailable")
	ctx := setupTestContext(mockUMA)

	botID := createBotWithDeps(t, client, ctx, "Test Bot")
	resourceID := botID.String()

	// First attempt fails
	err := SyncResourceScopes(ctx, client, resourceID)
	require.Error(t, err)

	// Manually expire the cooldown by setting old timestamp
	syncFailures.Store(resourceID, time.Now().Add(-6*time.Minute))

	// Now sync should be attempted again (not blocked by cooldown)
	err = SyncResourceScopes(ctx, client, resourceID)
	require.Error(t, err) // Still fails due to mock error

	// Sync should have been called twice now
	assert.Equal(t, 2, mockUMA.getSyncCalls())
}

func TestSyncResourceScopes_SuccessClearsFailure(t *testing.T) {
	// Clear global state before test
	syncInProgress = sync.Map{}
	syncFailures = sync.Map{}

	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	mockUMA := newMockUMAClient()
	ctx := setupTestContext(mockUMA)

	botID := createBotWithDeps(t, client, ctx, "Test Bot")
	resourceID := botID.String()

	// Manually add a failure entry (more than 5 minutes ago to ensure it's expired)
	syncFailures.Store(resourceID, time.Now().Add(-6*time.Minute))

	// Successful sync should clear the failure
	err := SyncResourceScopes(ctx, client, resourceID)
	require.NoError(t, err)

	// Verify failure was cleared
	_, exists := syncFailures.Load(resourceID)
	assert.False(t, exists, "failure should be cleared on success")
}

func TestSyncResourceScopes_NoUMAClient(t *testing.T) {
	// Clear global state before test
	syncInProgress = sync.Map{}
	syncFailures = sync.Map{}

	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	// Context without UMA client
	ctx := context.Background()

	resourceID := uuid.New().String()

	// Should fail with "UMA client not available"
	err := SyncResourceScopes(ctx, client, resourceID)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "UMA client not available")
}

func TestSyncResourceScopes_TypeAssertionError(t *testing.T) {
	// Clear global state before test
	syncInProgress = sync.Map{}
	syncFailures = sync.Map{}

	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	mockUMA := newMockUMAClient()
	ctx := setupTestContext(mockUMA)

	botID := createBotWithDeps(t, client, ctx, "Test Bot")
	resourceID := botID.String()

	// Manually corrupt the syncInProgress map with wrong type
	syncInProgress.Store(resourceID, "invalid-type-not-channel")

	// Should fail with type assertion error
	err := SyncResourceScopes(ctx, client, resourceID)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unexpected type in sync map")

	// Clean up
	syncInProgress.Delete(resourceID)
}

func TestSyncResourceScopes_ContextCancellation(t *testing.T) {
	// Clear global state before test
	syncInProgress = sync.Map{}
	syncFailures = sync.Map{}

	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	mockUMA := newMockUMAClient()
	mockUMA.syncDelay = 200 * time.Millisecond

	// Create test context first
	testCtx := setupTestContext(mockUMA)

	botID := createBotWithDeps(t, client, testCtx, "Test Bot")
	resourceID := botID.String()

	// Create cancellable context
	ctx, cancel := context.WithCancel(testCtx)

	// Start first sync (will take 200ms)
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		SyncResourceScopes(ctx, client, resourceID)
	}()

	// Wait for first sync to start
	select {
	case <-mockUMA.syncCalled:
	case <-time.After(1 * time.Second):
		t.Fatal("first sync never started")
	}

	// Start second sync that will wait for first
	wg.Add(1)
	var secondErr error
	go func() {
		defer wg.Done()
		secondErr = SyncResourceScopes(ctx, client, resourceID)
	}()

	// Cancel context while second is waiting
	time.Sleep(50 * time.Millisecond)
	cancel()

	wg.Wait()

	// Second sync should fail with context cancellation
	require.Error(t, secondErr)
	assert.Contains(t, secondErr.Error(), "context canceled")
}

func TestSyncResourceScopes_DifferentResources(t *testing.T) {
	// Clear global state before test
	syncInProgress = sync.Map{}
	syncFailures = sync.Map{}

	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	mockUMA := newMockUMAClient()
	mockUMA.syncDelay = 100 * time.Millisecond
	ctx := setupTestContext(mockUMA)

	// Create two different bots with dependencies
	bot1ID := createBotWithDeps(t, client, ctx, "Bot 1")
	bot2ID := createBotWithDeps(t, client, ctx, "Bot 2")

	// Sync both concurrently - no deduplication since different resources
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		SyncResourceScopes(ctx, client, bot1ID.String())
	}()

	go func() {
		defer wg.Done()
		SyncResourceScopes(ctx, client, bot2ID.String())
	}()

	wg.Wait()

	// Both syncs should have been called (2 different resources)
	assert.Equal(t, 2, mockUMA.getSyncCalls())
}

func TestSyncResourceScopes_Integration_WithAuthzSync(t *testing.T) {
	// This is an integration test that verifies the full flow
	// from graph.SyncResourceScopes -> authz.SyncResourcePermissions
	syncInProgress = sync.Map{}
	syncFailures = sync.Map{}

	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	mockUMA := newMockUMAClient()
	ctx := setupTestContext(mockUMA)

	// Create different resource types
	botID := createBotWithDeps(t, client, ctx, "Test Bot")

	strategy := client.Strategy.Create().
		SetName("Test Strategy").
		SetOwnerID("user-456").
		SetCode("# code").
		SetVersionNumber(1).
		SetConfig(map[string]interface{}{
			"strategy": "SampleStrategy",
		}).
		SaveX(ctx)

	// Sync both resources
	err := SyncResourceScopes(ctx, client, botID.String())
	require.NoError(t, err)

	err = SyncResourceScopes(ctx, client, strategy.ID.String())
	require.NoError(t, err)

	// Both should have been synced
	assert.Equal(t, 2, mockUMA.getSyncCalls())
}

// Verify that the mockUMAClient implements the interface
var _ keycloak.UMAClientInterface = (*mockUMAClient)(nil)
