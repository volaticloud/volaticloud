package graph

import (
	"context"
	"testing"

	"github.com/99designs/gqlgen/client"
	"github.com/99designs/gqlgen/graphql/handler"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"

	"volaticloud/internal/auth"
	"volaticloud/internal/ent"
)

// TestEnv holds all test environment components
type TestEnv struct {
	Client  *ent.Client
	GraphQL *client.Client
	MockUMA *MockUMAClient
	Context context.Context
	T       *testing.T
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

	// Create GraphQL handler with test configuration
	// Pass nil for Keycloak auth client since tests handle auth differently
	srv := handler.NewDefaultServer(NewExecutableSchema(Config{
		Resolvers: NewResolver(entClient, nil, mockUMA),
		Directives: DirectiveRoot{
			IsAuthenticated:    IsAuthenticatedDirective,
			HasScope:           HasScopeDirective,
			RequiresPermission: RequiresPermissionDirective,
		},
	}))

	// Create GraphQL test client
	graphqlClient := client.New(srv)

	return &TestEnv{
		Client:  entClient,
		GraphQL: graphqlClient,
		MockUMA: mockUMA,
		Context: ctx,
		T:       t,
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

	return ctx
}

// WithoutAuth returns a context without authentication
func (te *TestEnv) WithoutAuth() context.Context {
	ctx := te.Context
	ctx = SetEntClientInContext(ctx, te.Client)
	ctx = SetUMAClientInContext(ctx, te.MockUMA)
	return ctx
}