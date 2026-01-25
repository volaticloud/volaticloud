# 0017. Hybrid Testing Strategy with Testcontainers

Date: 2026-01-26

## Status

Accepted

## Context and Problem Statement

VolatiCloud integrates deeply with Keycloak for authentication and authorization using UMA 2.0 resource protection. Testing this integration presents challenges:

- **Unit tests need speed**: Developers need fast feedback (<5 seconds)
- **Integration tests need fidelity**: Authorization logic must be verified against real Keycloak
- **CI/CD needs reliability**: Tests must be reproducible across environments
- **Mocking limitations**: Mocking Keycloak entirely risks missing real authorization behavior

**The Problem:** How do we test Keycloak integration effectively without sacrificing either test speed or production fidelity?

## Decision Drivers

- **Fast feedback loop**: Unit tests must run in seconds, not minutes
- **Production fidelity**: Integration tests must use real Keycloak to catch auth issues
- **Reproducibility**: Tests must work identically on developer machines and CI
- **Isolation**: Tests must not pollute each other or require external services
- **Maintainability**: Testing infrastructure must be easy to understand and extend

## Considered Options

### Option 1: Mock Everything

Mock all Keycloak interactions in all tests.

**Pros:**

- Very fast execution
- No Docker dependency
- Simple test setup

**Cons:**

- **Risk of mock drift** - mocks may not match real Keycloak behavior
- **Missing edge cases** - authorization policies not exercised
- **False confidence** - tests pass but production fails

### Option 2: Real Keycloak for All Tests

Use real Keycloak (via testcontainers) for all tests.

**Pros:**

- Maximum production fidelity
- Catches real authorization issues

**Cons:**

- **Slow test execution** - container startup adds 20-40 seconds
- **Flaky tests** - network and container issues
- **Developer friction** - requires Docker for all tests

### Option 3: Hybrid Approach with Build Tags (Chosen)

Use mocks for fast unit tests and testcontainers for integration tests, separated by build tags.

**Pros:**

- **Best of both worlds** - fast unit tests + high-fidelity integration tests
- **Clear separation** - `//go:build integration` isolates slow tests
- **Developer choice** - run unit tests quickly, integration tests when needed
- **CI optimization** - integration tests can run in parallel job
- **Interface-based design** - `AdminClientInterface` enables both approaches

**Cons:**

- Slightly more complex test infrastructure
- Must maintain both mocks and testcontainer setup

## Decision

Use a **hybrid testing strategy** with:

1. **Mocks** (`MockAdminClient`, `MockUMAClient`) for unit tests
2. **Testcontainers** for integration tests with real Keycloak
3. **Build tags** (`//go:build integration`) to separate test types

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Test Types                           │
├─────────────────────────────┬───────────────────────────────┤
│       Unit Tests            │      Integration Tests        │
│   (go test ./...)           │  (go test -tags=integration)  │
├─────────────────────────────┼───────────────────────────────┤
│  • MockAdminClient          │  • Real AdminClient           │
│  • MockUMAClient            │  • Real UMAClient             │
│  • In-memory SQLite         │  • Testcontainers Keycloak    │
│  • Fast (<5s)               │  • Slower (~30-60s)           │
│  • No Docker required       │  • Requires Docker            │
└─────────────────────────────┴───────────────────────────────┘
```

### Interface-Based Design

```go
// AdminClientInterface enables dependency injection
type AdminClientInterface interface {
    CreateResource(ctx context.Context, req ResourceCreateRequest) (*ResourceResponse, error)
    UpdateResource(ctx context.Context, id string, req ResourceUpdateRequest) (*ResourceResponse, error)
    DeleteResource(ctx context.Context, id string) error
    // ... other methods
}

// Production: real Keycloak client
var _ AdminClientInterface = (*AdminClient)(nil)

// Tests: mock implementation
var _ AdminClientInterface = (*MockAdminClient)(nil)
```

### Build Tag Strategy

```go
// internal/graph/integration_test.go
//go:build integration

package graph

func TestIntegration_ResourceLifecycle(t *testing.T) {
    // Uses real Keycloak via testcontainers
}
```

```go
// internal/graph/directives_test.go
// No build tag - runs with regular tests

func TestHasScopeDirective(t *testing.T) {
    // Uses MockAdminClient
}
```

### Testcontainer Configuration

```go
// internal/testutil/keycloak_container.go
type KeycloakContainer struct {
    Container testcontainers.Container
    Config    auth.KeycloakConfig
    URL       string
}

func StartKeycloakContainer(ctx context.Context) (*KeycloakContainer, error) {
    // Uses local Dockerfile for production parity
    // Imports realm configuration
    // Waits for health check
}
```

### CI/CD Integration

```yaml
# .github/workflows/_ci-go.yml
jobs:
  test:
    # Fast unit tests - always run
    run: go test -v ./...

  integration-test:
    # Slower integration tests - opt-in
    if: ${{ inputs.run-integration-tests }}
    run: go test -v -tags=integration ./internal/graph/...
```

## Consequences

### Positive

- **Fast developer feedback**: Unit tests run in seconds
- **High confidence**: Integration tests catch real Keycloak issues
- **Clear separation**: Build tags make test intent explicit
- **Extensible**: New mocks and integration tests follow established patterns
- **CI optimization**: Integration tests don't block fast feedback

### Negative

- **Dual maintenance**: Must keep mocks and real clients in sync
- **Docker dependency**: Integration tests require Docker
- **Learning curve**: Developers must understand when to use each approach

### Mitigation

- **Interface contracts**: `AdminClientInterface` ensures mock/real parity
- **CI enforcement**: Integration tests run on every PR
- **Documentation**: This ADR and CLAUDE.md explain the strategy

## Implementation

### Running Tests

```bash
# Unit tests (fast, no Docker)
make test

# Integration tests (requires Docker)
make test-integration

# All tests
make test-all
```

### Adding New Tests

1. **Unit test** (default): Use `MockAdminClient` for authorization tests
2. **Integration test**: Add `//go:build integration` tag, use real Keycloak

### Realm Configuration

The test realm (`internal/testutil/testdata/volaticloud-realm.json`) contains:

- Volaticloud client configuration
- Dashboard client for cross-origin requests
- Authorization scopes (view, edit, delete, etc.)
- Resource server settings

**Maintenance**: When Keycloak configuration changes in production, update the test realm to match.

## References

- [ADR-0001: Context-Based Dependency Injection](0001-context-based-dependency-injection.md)
- [ADR-0008: Multi-Tenant Authorization](0008-multi-tenant-authorization.md)
- [Testcontainers for Go](https://golang.testcontainers.org/)
- [Keycloak Authorization Services](https://www.keycloak.org/docs/latest/authorization_services/)
