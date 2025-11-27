# Mock Generation Pattern

## Problem

How do you create mocks for testing when:

- Interfaces have multiple methods to implement
- Mock behavior needs to vary per test case
- Type safety must be maintained
- Setup should be simple and clear

## Solution

Create manual mock structs with function fields that allow test-specific behavior injection. This provides full control, type safety, and clear test intent without code generation complexity.

## Implementation

### 1. Define Interface

```go
// internal/keycloak/client.go
package keycloak

type UMAClientInterface interface {
    RegisterResource(ctx context.Context, req RegisterResourceRequest) (*RegisterResourceResponse, error)
    DeleteResource(ctx context.Context, resourceID string) error
    RequestPermission(ctx context.Context, req PermissionRequest) (*PermissionResponse, error)
    GetResource(ctx context.Context, resourceID string) (*Resource, error)
}
```

### 2. Create Mock with Function Fields

```go
// internal/keycloak/mock.go
package keycloak

import "context"

// MockUMAClient implements UMAClientInterface for testing
type MockUMAClient struct {
    // Function fields for behavior injection
    RegisterResourceFunc   func(context.Context, RegisterResourceRequest) (*RegisterResourceResponse, error)
    DeleteResourceFunc     func(context.Context, string) error
    RequestPermissionFunc  func(context.Context, PermissionRequest) (*PermissionResponse, error)
    GetResourceFunc        func(context.Context, string) (*Resource, error)
}

// RegisterResource implements UMAClientInterface
func (m *MockUMAClient) RegisterResource(ctx context.Context,
    req RegisterResourceRequest) (*RegisterResourceResponse, error) {

    if m.RegisterResourceFunc != nil {
        return m.RegisterResourceFunc(ctx, req)
    }

    // Default behavior (success)
    return &RegisterResourceResponse{
        ID:   "mock-resource-id",
        Name: req.Name,
        Type: req.Type,
    }, nil
}

// DeleteResource implements UMAClientInterface
func (m *MockUMAClient) DeleteResource(ctx context.Context, resourceID string) error {
    if m.DeleteResourceFunc != nil {
        return m.DeleteResourceFunc(ctx, resourceID)
    }

    // Default behavior (success)
    return nil
}

// RequestPermission implements UMAClientInterface
func (m *MockUMAClient) RequestPermission(ctx context.Context,
    req PermissionRequest) (*PermissionResponse, error) {

    if m.RequestPermissionFunc != nil {
        return m.RequestPermissionFunc(ctx, req)
    }

    // Default behavior (grant permission)
    return &PermissionResponse{
        Granted: true,
        Token:   "mock-token",
    }, nil
}

// GetResource implements UMAClientInterface
func (m *MockUMAClient) GetResource(ctx context.Context, resourceID string) (*Resource, error) {
    if m.GetResourceFunc != nil {
        return m.GetResourceFunc(ctx, resourceID)
    }

    // Default behavior (return mock resource)
    return &Resource{
        ID:   resourceID,
        Name: "Mock Resource",
        Type: "mock",
    }, nil
}
```

### 3. Use Mock in Tests

#### Simple Success Case

```go
func TestCreateBot_Success(t *testing.T) {
    resolver := setupTestResolver(t)

    // Use mock with default behavior (success)
    mockUMA := &keycloak.MockUMAClient{}

    ctx := context.Background()
    ctx = graph.SetUMAClientInContext(ctx, mockUMA)

    bot, err := resolver.Mutation().CreateBot(ctx, ent.CreateBotInput{
        Name: "TestBot",
    })

    require.NoError(t, err)
    assert.NotNil(t, bot)
}
```

#### Custom Behavior - Error Injection

```go
func TestCreateBot_KeycloakError(t *testing.T) {
    resolver := setupTestResolver(t)

    // Inject error behavior
    mockUMA := &keycloak.MockUMAClient{
        RegisterResourceFunc: func(ctx context.Context, req keycloak.RegisterResourceRequest) (*keycloak.RegisterResourceResponse, error) {
            return nil, fmt.Errorf("Keycloak unavailable")
        },
    }

    ctx := graph.SetUMAClientInContext(context.Background(), mockUMA)

    _, err := resolver.Mutation().CreateBot(ctx, ent.CreateBotInput{
        Name: "TestBot",
    })

    require.Error(t, err)
    assert.Contains(t, err.Error(), "Keycloak unavailable")
}
```

#### Assertion on Method Calls

```go
func TestCreateBot_CallsKeycloak(t *testing.T) {
    resolver := setupTestResolver(t)

    var capturedRequest keycloak.RegisterResourceRequest

    mockUMA := &keycloak.MockUMAClient{
        RegisterResourceFunc: func(ctx context.Context, req keycloak.RegisterResourceRequest) (*keycloak.RegisterResourceResponse, error) {
            // Capture request for assertions
            capturedRequest = req
            return &keycloak.RegisterResourceResponse{ID: "test-id"}, nil
        },
    }

    ctx := graph.SetUMAClientInContext(context.Background(), mockUMA)

    _, err := resolver.Mutation().CreateBot(ctx, ent.CreateBotInput{
        Name: "TestBot",
        Mode: enum.BotModeDryRun,
    })

    require.NoError(t, err)

    // Assert on captured request
    assert.Equal(t, "TestBot", capturedRequest.Name)
    assert.Equal(t, "bot", capturedRequest.Type)
}
```

### 4. Mock with Call Counting

```go
type MockUMAClientWithCounts struct {
    keycloak.MockUMAClient
    RegisterResourceCallCount int
    DeleteResourceCallCount   int
}

func (m *MockUMAClientWithCounts) RegisterResource(ctx context.Context,
    req keycloak.RegisterResourceRequest) (*keycloak.RegisterResourceResponse, error) {

    m.RegisterResourceCallCount++
    return m.MockUMAClient.RegisterResource(ctx, req)
}

func (m *MockUMAClientWithCounts) DeleteResource(ctx context.Context, resourceID string) error {
    m.DeleteResourceCallCount++
    return m.MockUMAClient.DeleteResource(ctx, resourceID)
}

// Test usage
func TestBotLifecycle_KeycloakCalls(t *testing.T) {
    resolver := setupTestResolver(t)

    mockUMA := &MockUMAClientWithCounts{}
    ctx := graph.SetUMAClientInContext(context.Background(), mockUMA)

    // Create bot
    bot, _ := resolver.Mutation().CreateBot(ctx, ent.CreateBotInput{Name: "Test"})
    assert.Equal(t, 1, mockUMA.RegisterResourceCallCount)

    // Delete bot
    resolver.Mutation().DeleteBot(ctx, bot.ID)
    assert.Equal(t, 1, mockUMA.DeleteResourceCallCount)
}
```

### 5. Table-Driven Tests with Mocks

```go
func TestAuthorization(t *testing.T) {
    tests := []struct {
        name        string
        mockSetup   func(*keycloak.MockUMAClient)
        expectedErr string
    }{
        {
            name: "permission granted",
            mockSetup: func(m *keycloak.MockUMAClient) {
                m.RequestPermissionFunc = func(ctx context.Context, req keycloak.PermissionRequest) (*keycloak.PermissionResponse, error) {
                    return &keycloak.PermissionResponse{Granted: true}, nil
                }
            },
            expectedErr: "",
        },
        {
            name: "permission denied",
            mockSetup: func(m *keycloak.MockUMAClient) {
                m.RequestPermissionFunc = func(ctx context.Context, req keycloak.PermissionRequest) (*keycloak.PermissionResponse, error) {
                    return &keycloak.PermissionResponse{Granted: false}, nil
                }
            },
            expectedErr: "permission denied",
        },
        {
            name: "keycloak error",
            mockSetup: func(m *keycloak.MockUMAClient) {
                m.RequestPermissionFunc = func(ctx context.Context, req keycloak.PermissionRequest) (*keycloak.PermissionResponse, error) {
                    return nil, fmt.Errorf("connection timeout")
                }
            },
            expectedErr: "connection timeout",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            mockUMA := &keycloak.MockUMAClient{}
            tt.mockSetup(mockUMA)

            ctx := graph.SetUMAClientInContext(context.Background(), mockUMA)

            // Test authorization logic...
            err := checkPermission(ctx, "bot:view", "test-bot-id")

            if tt.expectedErr != "" {
                require.Error(t, err)
                assert.Contains(t, err.Error(), tt.expectedErr)
            } else {
                require.NoError(t, err)
            }
        })
    }
}
```

## Benefits

1. **Type Safety**: Compiler verifies interface compliance
2. **Flexibility**: Each test can customize behavior
3. **No Code Generation**: Manual implementation, no tooling needed
4. **Clear Intent**: Mock behavior is explicit in test
5. **Default Behavior**: Sensible defaults reduce boilerplate
6. **Easy Debugging**: Mock code is readable and modifiable

## Trade-offs

### Pros

- Full control over mock behavior
- No external dependencies (mockgen, testify/mock)
- Simple to understand and maintain
- Works well with interfaces

### Cons

- Manual implementation (must update when interface changes)
- Verbose for interfaces with many methods
- No automatic call verification (must implement manually)
- Boilerplate for each interface

## Common Patterns

### Spy Pattern (Record Calls)

```go
type SpyUMAClient struct {
    keycloak.MockUMAClient
    Calls []string
}

func (s *SpyUMAClient) RegisterResource(ctx context.Context, req keycloak.RegisterResourceRequest) (*keycloak.RegisterResourceResponse, error) {
    s.Calls = append(s.Calls, fmt.Sprintf("RegisterResource(%s)", req.Name))
    return s.MockUMAClient.RegisterResource(ctx, req)
}

func (s *SpyUMAClient) DeleteResource(ctx context.Context, resourceID string) error {
    s.Calls = append(s.Calls, fmt.Sprintf("DeleteResource(%s)", resourceID))
    return s.MockUMAClient.DeleteResource(ctx, resourceID)
}

// Test usage
spy := &SpyUMAClient{}
// ... perform operations ...
assert.Equal(t, []string{
    "RegisterResource(TestBot)",
    "DeleteResource(test-resource-id)",
}, spy.Calls)
```

### Stub Pattern (Fixed Responses)

```go
// Stub that always grants permission
stubGranted := &keycloak.MockUMAClient{
    RequestPermissionFunc: func(ctx context.Context, req keycloak.PermissionRequest) (*keycloak.PermissionResponse, error) {
        return &keycloak.PermissionResponse{Granted: true}, nil
    },
}

// Stub that always denies permission
stubDenied := &keycloak.MockUMAClient{
    RequestPermissionFunc: func(ctx context.Context, req keycloak.PermissionRequest) (*keycloak.PermissionResponse, error) {
        return &keycloak.PermissionResponse{Granted: false}, nil
    },
}
```

### Fake Pattern (Working Implementation)

```go
// FakeUMAClient implements full working in-memory UMA
type FakeUMAClient struct {
    resources map[string]*keycloak.Resource
    mu        sync.RWMutex
}

func NewFakeUMAClient() *FakeUMAClient {
    return &FakeUMAClient{
        resources: make(map[string]*keycloak.Resource),
    }
}

func (f *FakeUMAClient) RegisterResource(ctx context.Context, req keycloak.RegisterResourceRequest) (*keycloak.RegisterResourceResponse, error) {
    f.mu.Lock()
    defer f.mu.Unlock()

    id := uuid.New().String()
    f.resources[id] = &keycloak.Resource{
        ID:   id,
        Name: req.Name,
        Type: req.Type,
    }

    return &keycloak.RegisterResourceResponse{ID: id}, nil
}

func (f *FakeUMAClient) GetResource(ctx context.Context, resourceID string) (*keycloak.Resource, error) {
    f.mu.RLock()
    defer f.mu.RUnlock()

    resource, ok := f.resources[resourceID]
    if !ok {
        return nil, fmt.Errorf("resource not found")
    }

    return resource, nil
}
```

## Alternative: Code Generation

For projects preferring code generation, consider:

- **mockgen** (gomock): `go install github.com/golang/mock/mockgen@latest`
- **testify/mock**: Provides mock assertion helpers

However, manual mocks are often simpler for small to medium projects.

## Best Practices

1. **Default to Success**: Mock default behavior should be successful path
2. **Single Responsibility**: Each mock method does one thing
3. **Clear Naming**: Use descriptive names for mock implementations
4. **Minimal Mocks**: Only mock what you need for the test
5. **No Logic**: Mocks should be simple, no business logic

## Testing the Mock

```go
// Verify mock implements interface at compile time
var _ keycloak.UMAClientInterface = (*keycloak.MockUMAClient)(nil)

func TestMockUMAClient_ImplementsInterface(t *testing.T) {
    mock := &keycloak.MockUMAClient{}

    // Verify all methods are callable
    _, err := mock.RegisterResource(ctx(), keycloak.RegisterResourceRequest{})
    assert.NoError(t, err)

    err = mock.DeleteResource(ctx(), "test-id")
    assert.NoError(t, err)

    _, err = mock.RequestPermission(ctx(), keycloak.PermissionRequest{})
    assert.NoError(t, err)

    _, err = mock.GetResource(ctx(), "test-id")
    assert.NoError(t, err)
}
```

## Related Patterns

- [Dependency Injection](dependency-injection.md) - Injecting mocks via context
- [Resolver Testing](resolver-testing.md) - Using mocks in resolver tests
- [Transaction Management](transactions.md) - Mocking transactional behavior

## References

- `internal/keycloak/mock.go` - UMA client mock implementation
- `internal/graph/*_test.go` - Mock usage examples
- Go Interfaces: https://go.dev/tour/methods/9
- Testing Best Practices: https://go.dev/doc/effective_go#testing
