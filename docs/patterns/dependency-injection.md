# Dependency Injection Pattern

## Problem

How do you inject dependencies (database clients, auth clients, etc.) into GraphQL resolvers when:
- gqlgen uses code generation and doesn't support constructor injection
- Dependencies need to be request-scoped, not global
- Multiple dependencies must be available to resolvers
- Type safety is required

## Solution

Use context-based dependency injection with private context keys and GraphQL directives. Dependencies flow through `context.Context` and are injected via middleware and custom directives.

## Implementation

### 1. Define Private Context Keys

```go
// internal/graph/context.go
package graph

import (
    "context"
    "volaticloud/internal/ent"
    "volaticloud/internal/keycloak"
)

// Private context key types (prevents collisions)
type entClientCtxKey struct{}
type umaClientCtxKey struct{}
type userCtxKey struct{}

// Setter functions
func SetEntClientInContext(ctx context.Context, client *ent.Client) context.Context {
    return context.WithValue(ctx, entClientCtxKey{}, client)
}

func SetUMAClientInContext(ctx context.Context, client keycloak.UMAClientInterface) context.Context {
    return context.WithValue(ctx, umaClientCtxKey{}, client)
}

func SetUserContext(ctx context.Context, userID string) context.Context {
    return context.WithValue(ctx, userCtxKey{}, userID)
}

// Getter functions
func GetEntClientFromContext(ctx context.Context) (*ent.Client, bool) {
    client, ok := ctx.Value(entClientCtxKey{}).(*ent.Client)
    return client, ok
}

func MustGetEntClientFromContext(ctx context.Context) *ent.Client {
    client, ok := GetEntClientFromContext(ctx)
    if !ok {
        panic("ENT client not found in context")
    }
    return client
}

func GetUMAClientFromContext(ctx context.Context) (keycloak.UMAClientInterface, bool) {
    client, ok := ctx.Value(umaClientCtxKey{}).(keycloak.UMAClientInterface)
    return client, ok
}

func GetUserContext(ctx context.Context) (string, bool) {
    userID, ok := ctx.Value(userCtxKey{}).(string)
    return userID, ok
}
```

### 2. Create HTTP Middleware

```go
// cmd/server/main.go
func main() {
    // Initialize clients
    entClient := ent.NewClient(...)
    umaClient := keycloak.NewUMAClient(...)

    // Create injection middleware
    injectClientsMiddleware := func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            ctx := r.Context()

            // Inject dependencies into context
            ctx = graph.SetEntClientInContext(ctx, entClient)
            ctx = graph.SetUMAClientInContext(ctx, umaClient)

            // Continue with enriched context
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }

    // Create GraphQL server
    srv := handler.NewDefaultServer(graph.NewExecutableSchema(graph.Config{
        Resolvers:  &graph.Resolver{},
        Directives: graph.DirectiveRoot{},
    }))

    // Apply middleware
    http.Handle("/query", injectClientsMiddleware(srv))
    http.ListenAndServe(":8080", nil)
}
```

### 3. Define GraphQL Directives

```graphql
# internal/graph/schema.graphqls
directive @injectEntClient on FIELD_DEFINITION
directive @injectUMAClient on FIELD_DEFINITION

type Query {
  bots: [Bot!]! @injectEntClient
}

type Mutation {
  createBot(input: CreateBotInput!): Bot!
    @injectEntClient
    @injectUMAClient
}
```

### 4. Implement Directive Handlers

```go
// internal/graph/directives.go
package graph

import (
    "context"
    "github.com/99designs/gqlgen/graphql"
)

type Directives struct{}

func (d *Directives) InjectEntClient(ctx context.Context, obj interface{},
    next graphql.Resolver) (interface{}, error) {

    // Verify ENT client is in context
    if _, ok := GetEntClientFromContext(ctx); !ok {
        return nil, fmt.Errorf("ENT client not found in context")
    }

    // Continue to resolver (client is already in context)
    return next(ctx)
}

func (d *Directives) InjectUMAClient(ctx context.Context, obj interface{},
    next graphql.Resolver) (interface{}, error) {

    // Verify UMA client is in context
    if _, ok := GetUMAClientFromContext(ctx); !ok {
        return nil, fmt.Errorf("UMA client not found in context")
    }

    return next(ctx)
}
```

### 5. Use in Resolvers

```go
// internal/graph/schema.resolvers.go
func (r *queryResolver) Bots(ctx context.Context,
    first *int, where *ent.BotWhereInput) (*ent.BotConnection, error) {

    // Get ENT client from context
    client := MustGetEntClientFromContext(ctx)

    // Use client
    return client.Bot.Query().
        Where(/* filters */).
        Paginate(ctx, first, nil, nil, nil)
}

func (r *mutationResolver) CreateBot(ctx context.Context,
    input ent.CreateBotInput) (*ent.Bot, error) {

    // Get clients from context
    entClient := MustGetEntClientFromContext(ctx)
    umaClient, _ := GetUMAClientFromContext(ctx)
    userID, _ := GetUserContext(ctx)

    // Use clients
    bot, err := entClient.Bot.Create().
        SetInput(input).
        SetOwnerID(userID).
        Save(ctx)

    if err != nil {
        return nil, err
    }

    // Register in Keycloak
    _, err = umaClient.RegisterResource(ctx, keycloak.RegisterResourceRequest{
        Name:   bot.Name,
        Type:   "bot",
        OwnerID: userID,
    })

    return bot, err
}
```

## Benefits

1. **No Global State**: All dependencies are request-scoped
2. **Type Safety**: Private context keys prevent collisions
3. **Testability**: Easy to inject mocks via context
4. **gqlgen Compatible**: Works with code generation
5. **Flexible**: Add new dependencies without changing resolver signatures
6. **Declarative**: GraphQL directives document dependency requirements

## Trade-offs

### Pros
- Clean separation of concerns
- Request-scoped dependencies
- Easy testing with mock clients
- Works with gqlgen's generated code

### Cons
- Context values are `interface{}` (requires type assertion)
- Panic if required dependency missing (use `Must*` functions)
- Directives add slight overhead
- Less explicit than constructor injection

## Common Patterns

### Testing with Mock Clients

```go
func TestCreateBot(t *testing.T) {
    // Create mocks
    mockClient := &ent.MockClient{}
    mockUMA := &keycloak.MockUMAClient{}

    // Inject into context
    ctx := context.Background()
    ctx = graph.SetEntClientInContext(ctx, mockClient)
    ctx = graph.SetUMAClientInContext(ctx, mockUMA)

    // Test resolver
    resolver := &mutationResolver{}
    bot, err := resolver.CreateBot(ctx, input)
    assert.NoError(t, err)
}
```

### Authentication Middleware

```go
// Extract user from JWT and inject into context
func authMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        ctx := r.Context()

        // Extract and validate JWT
        token := r.Header.Get("Authorization")
        claims, err := validateJWT(token)
        if err != nil {
            http.Error(w, "Unauthorized", 401)
            return
        }

        // Inject user ID into context
        ctx = graph.SetUserContext(ctx, claims.Sub)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

### Optional Dependencies

```go
func (r *queryResolver) PublicData(ctx context.Context) (string, error) {
    // Optional: Check if user is authenticated
    if userID, ok := GetUserContext(ctx); ok {
        return fmt.Sprintf("Hello, %s", userID), nil
    }

    return "Hello, anonymous", nil
}
```

### Chaining Middleware

```go
// Combine multiple middleware
handler := injectClientsMiddleware(
    authMiddleware(
        loggingMiddleware(graphqlServer)))

http.Handle("/query", handler)
```

## Testing

### Unit Test with Mock Context

```go
func TestGetEntClient(t *testing.T) {
    client := &ent.MockClient{}
    ctx := graph.SetEntClientInContext(context.Background(), client)

    retrieved := graph.MustGetEntClientFromContext(ctx)
    assert.Equal(t, client, retrieved)
}

func TestMissingClient(t *testing.T) {
    ctx := context.Background()

    assert.Panics(t, func() {
        graph.MustGetEntClientFromContext(ctx)
    })
}
```

### Integration Test

```go
func TestGraphQLWithDependencies(t *testing.T) {
    // Setup test database
    client := setupTestEntClient(t)
    defer client.Close()

    // Create GraphQL server
    srv := handler.NewDefaultServer(graph.NewExecutableSchema(graph.Config{
        Resolvers: &graph.Resolver{},
    }))

    // Create request with injected context
    req := httptest.NewRequest("POST", "/query", strings.NewReader(`
        query { bots { edges { node { id name } } } }
    `))

    ctx := graph.SetEntClientInContext(req.Context(), client)
    req = req.WithContext(ctx)

    // Execute request
    w := httptest.NewRecorder()
    srv.ServeHTTP(w, req)

    // Assert response
    assert.Equal(t, 200, w.Code)
}
```

## Related Patterns

- [GraphQL Code Generation](graphql-codegen.md) - Directive implementation
- [ENT ORM Integration](ent-orm-integration.md) - ENT client usage
- [Resolver Testing](resolver-testing.md) - Testing with mock contexts

## References

- [ADR-0001: Context-Based Dependency Injection](../adr/0001-context-based-dependency-injection.md)
- Go Context Documentation: https://pkg.go.dev/context
- gqlgen Directives: https://gqlgen.com/reference/directives/
- `internal/graph/context.go` - Context helper functions
- `internal/graph/directives.go` - Directive implementations
- `cmd/server/main.go` - Middleware setup
