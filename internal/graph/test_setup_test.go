package graph

import (
	"context"
	"testing"
	"time"

	"github.com/99designs/gqlgen/client"
	"github.com/99designs/gqlgen/graphql"
	"github.com/99designs/gqlgen/graphql/handler"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"

	"volaticloud/internal/auth"
	"volaticloud/internal/ent"
	"volaticloud/internal/enum"
	"volaticloud/internal/keycloak"
)

// TestEnv holds all test environment components
type TestEnv struct {
	Client    *ent.Client
	GraphQL   *client.Client
	MockUMA   *MockUMAClient
	MockAdmin *keycloak.MockAdminClient
	Context   context.Context
	T         *testing.T
}

// Setup creates a complete test environment with in-memory database
func Setup(t *testing.T) *TestEnv {
	ctx := context.Background()

	// Create in-memory SQLite database
	entClient, err := ent.Open("sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	require.NoError(t, err)

	// Run auto-migration
	err = entClient.Schema.Create(ctx)
	require.NoError(t, err)

	// Create mock UMA client
	mockUMA := NewMockUMAClient()

	// Create mock Admin client
	mockAdmin := keycloak.NewMockAdminClient()

	// Create GraphQL handler with test configuration
	// Pass nil for Keycloak auth client and pubsub since tests handle auth differently
	srv := handler.NewDefaultServer(NewExecutableSchema(Config{
		Resolvers: NewResolver(entClient, nil, mockUMA, nil),
		Directives: DirectiveRoot{
			IsAuthenticated: IsAuthenticatedDirective,
			HasScope:        HasScopeDirective,
			RequiresFeature: RequiresFeatureDirective,
		},
	}))

	// Add middleware to propagate HTTP request context to GraphQL operation context
	// This is needed for tests to properly inject user context via WithContext()
	srv.AroundResponses(func(ctx context.Context, next graphql.ResponseHandler) *graphql.Response {
		// The context here already contains the HTTP request context set by WithContext()
		// Simply pass it through to the GraphQL operation
		return next(ctx)
	})

	// Create GraphQL test client
	graphqlClient := client.New(srv)

	return &TestEnv{
		Client:    entClient,
		GraphQL:   graphqlClient,
		MockUMA:   mockUMA,
		MockAdmin: mockAdmin,
		Context:   ctx,
		T:         t,
	}
}

// Cleanup closes all test resources
func (te *TestEnv) Cleanup() {
	if te.Client != nil {
		te.Client.Close()
	}
}

// WithAuth returns a context with authentication injected
func (te *TestEnv) WithAuth(userID, groupID string, permissions map[string][]string) context.Context {
	// Create JWT token
	token := GenerateTestJWT(te.T, userID, "test@example.com", []string{groupID})

	// Configure mock UMA to return permissions
	te.MockUMA.SetPermissions(permissions)

	// Create user context
	userCtx := CreateUserContext(userID, "test@example.com", []string{groupID}, nil, token)

	// Inject clients and user context (required by directives)
	ctx := te.Context
	ctx = auth.SetUserContext(ctx, userCtx)
	ctx = SetEntClientInContext(ctx, te.Client)
	ctx = SetUMAClientInContext(ctx, te.MockUMA)
	ctx = SetAdminClientInContext(ctx, te.MockAdmin)

	return ctx
}

// CreateTestBillingRecords creates a subscription and credit balance for an org so
// billing enforcement passes. Call this before operations that check billing.
func CreateTestBillingRecords(t *testing.T, ctx context.Context, entClient *ent.Client, ownerID string) {
	t.Helper()
	_, err := entClient.StripeSubscription.Create().
		SetOwnerID(ownerID).
		SetStripeCustomerID("cus_test_" + ownerID).
		SetStripeSubscriptionID("sub_test_" + ownerID).
		SetStripePriceID("price_test").
		SetPlanName("starter").
		SetMonthlyDeposit(10).
		SetStatus(enum.StripeSubActive).
		SetFeatures([]string{"live_trading", "backtesting", "code_mode", "alerting"}).
		SetCurrentPeriodStart(time.Now()).
		SetCurrentPeriodEnd(time.Now().Add(30 * 24 * time.Hour)).
		Save(ctx)
	require.NoError(t, err)

	_, err = entClient.CreditBalance.Create().
		SetOwnerID(ownerID).
		SetBalance(100).
		SetSuspended(false).
		Save(ctx)
	require.NoError(t, err)
}

// WithoutAuth returns a context without authentication
func (te *TestEnv) WithoutAuth() context.Context {
	ctx := te.Context
	ctx = SetEntClientInContext(ctx, te.Client)
	ctx = SetUMAClientInContext(ctx, te.MockUMA)
	ctx = SetAdminClientInContext(ctx, te.MockAdmin)
	return ctx
}
