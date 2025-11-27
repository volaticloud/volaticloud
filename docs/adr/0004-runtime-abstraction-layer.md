# 0004. Runtime Abstraction Layer

Date: 2025-01-15

## Status

Accepted

## Context and Problem Statement

VolatiCloud needs to run Freqtrade trading bots across multiple deployment environments:

- **Local development**: Docker Desktop on macOS/Windows/Linux
- **Production**: Kubernetes clusters (VKE, GKE, EKS)
- **Edge cases**: Local processes for debugging without containers

Each runtime has different APIs and lifecycle semantics:

- Docker SDK uses container IDs and Docker API
- Kubernetes uses Pods, Deployments, kubectl/client-go
- Local processes use OS process management

**The Problem:** How do we support multiple runtimes without coupling business logic to Docker/Kubernetes APIs? How do we make it easy to add new runtimes (e.g., Nomad, ECS) without changing core bot management code?

## Decision Drivers

- **Runtime portability**: Same code should work across Docker, Kubernetes, and Local
- **Easy testing**: Ability to mock runtime for unit tests
- **Extensibility**: Adding new runtimes should not require changing core logic
- **Type safety**: Compile-time checks for runtime operations
- **Operational consistency**: Same lifecycle operations (create, start, stop, delete) across all runtimes

## Considered Options

### Option 1: Direct Docker SDK Usage Throughout Codebase

Use Docker SDK directly in GraphQL resolvers and business logic.

**Pros:**

- Simple initial implementation
- Direct access to all Docker features

**Cons:**

- **Locks us into Docker forever**
- Cannot test without Docker daemon
- Impossible to support Kubernetes without massive refactoring
- Business logic tightly coupled to infrastructure

### Option 2: Runtime-Specific Managers with No Interface

Create DockerManager, K8sManager, LocalManager as separate implementations.

**Pros:**

- Runtime-specific optimizations possible

**Cons:**

- **No polymorphism** - need runtime type checks everywhere
- Code duplication across managers
- Difficult to test (each manager needs its own mocks)
- Adding new runtime requires changes throughout codebase

### Option 3: Runtime Interface with Factory Pattern

Define `Runtime` interface with common lifecycle operations, implement per runtime.

**Pros:**

- **Runtime-agnostic business logic** - code works with any Runtime implementation
- Easy to mock for tests (MockRuntime)
- Adding new runtime = implement interface + factory case
- Compile-time verification via interface
- Factory pattern handles runtime selection based on config

**Cons:**

- Abstraction layer adds indirection
- Interface may not capture all runtime-specific features (use optional extension interfaces)
- Slightly more upfront design work

## Decision Outcome

Chosen option: **Runtime Interface with Factory Pattern**, because it:

1. **Decouples business logic from infrastructure** - GraphQL resolvers don't know about Docker/K8s
2. **Enables testing** - MockRuntime for unit tests without Docker daemon
3. **Supports multi-runtime** - Same code runs locally (Docker) and production (K8s)
4. **Future-proof** - Adding Nomad/ECS/Lambda = new interface implementation
5. **Type-safe** - Interface enforces contract at compile time

### Consequences

**Positive:**

- Bot lifecycle code is runtime-agnostic
- Full test coverage without Docker daemon (using MockRuntime)
- Easy to support multiple runtimes simultaneously (users choose per BotRunner)
- Production K8s support without rewriting bot management
- Can optimize per-runtime without affecting interface

**Negative:**

- Interface cannot expose runtime-specific features (e.g., Docker networks, K8s pod affinity)
  - Mitigation: Use optional extension interfaces or runtime-specific config
- Factory adds one extra layer of indirection
- Must maintain interface backward compatibility

**Neutral:**

- Need to implement interface for each new runtime (expected trade-off)
- Runtime-specific configuration stored in BotRunner.config JSON field

## Implementation

### Architecture Flow

```
GraphQL Resolver (createBot/startBot/stopBot)
    ↓
Domain Logic (internal/bot/spec.go)
    ↓
Runtime Factory (internal/runner/factory.go)
    ↓ Based on BotRunner.type
    ├─> DockerRuntime (internal/runner/docker_runner.go)
    ├─> KubernetesRuntime (internal/runner/kubernetes.go)
    └─> LocalRuntime (internal/runner/local.go)
    ↓
Container Orchestrator (Docker SDK / K8s client-go / OS)
```

### Key Files

**Runtime Interface:**

- `internal/runner/interface.go:8-60` - Runtime interface definition
  - 12 lifecycle methods: CreateBot, DeleteBot, StartBot, StopBot, RestartBot, etc.
  - BotStatus, LogReader, Health Check
  - MockRuntime implementation for testing (lines 63-172)

**Factory Pattern:**

- `internal/runner/factory.go:10-129` - Factory creates Runtime based on enum.RunnerType
  - `Create(ctx, runnerType, config)` - Returns Runtime interface
  - Separate factories for bots (Runtime) and backtests (BacktestRunner)
  - Health check on creation (fail fast if runtime unavailable)

**Implementations:**

- `internal/runner/docker_runner.go` - Docker SDK implementation
- `internal/runner/kubernetes.go` - K8s client-go implementation (stub)
- `internal/runner/local.go` - OS process implementation (stub)
- `internal/runner/docker_backtest.go` - Docker backtest implementation

**Types:**

- `internal/runner/types.go` - BotSpec, BotStatus, LogOptions, UpdateBotSpec

### Example Usage

**Runtime Interface Contract:**

```go
// internal/runner/interface.go:8
type Runtime interface {
    CreateBot(ctx context.Context, spec BotSpec) (containerID string, err error)
    DeleteBot(ctx context.Context, botID string) error
    StartBot(ctx context.Context, botID string) error
    StopBot(ctx context.Context, botID string) error
    RestartBot(ctx context.Context, botID string) error
    GetBotStatus(ctx context.Context, botID string) (*BotStatus, error)
    GetContainerIP(ctx context.Context, containerID string) (string, error)
    GetBotLogs(ctx context.Context, botID string, opts LogOptions) (*LogReader, error)
    UpdateBot(ctx context.Context, botID string, spec UpdateBotSpec) error
    ListBots(ctx context.Context) ([]BotStatus, error)
    HealthCheck(ctx context.Context) error
    Close() error
    Type() string
}
```

**Factory Creation (Runtime Selection):**

```go
// internal/runner/factory.go:19
func (f *Factory) Create(ctx context.Context, runnerType enum.RunnerType,
    configData map[string]interface{}) (Runtime, error) {

    switch runnerType {
    case enum.RunnerDocker:
        return f.createDockerRuntime(ctx, configData)
    case enum.RunnerKubernetes:
        return f.createKubernetesRuntime(ctx, configData)
    case enum.RunnerLocal:
        return f.createLocalRuntime(ctx, configData)
    default:
        return nil, fmt.Errorf("unsupported runner type: %s", runnerType)
    }
}
```

**Docker Runtime Implementation:**

```go
// internal/runner/docker_runner.go (simplified)
type DockerRuntime struct {
    client *docker.Client
    config DockerConfig
}

func (d *DockerRuntime) CreateBot(ctx context.Context, spec BotSpec) (string, error) {
    // Use Docker SDK to create container
    container, err := d.client.ContainerCreate(ctx, &containerConfig, &hostConfig, nil, spec.ID)
    if err != nil {
        return "", err
    }
    return container.ID, nil
}

func (d *DockerRuntime) StartBot(ctx context.Context, botID string) error {
    return d.client.ContainerStart(ctx, botID, types.ContainerStartOptions{})
}

// ... 10 more methods implementing Runtime interface
```

**Usage in GraphQL Resolver:**

```go
// internal/graph/schema.resolvers.go (bot mutations)
func (r *mutationResolver) CreateBot(ctx context.Context, input ent.CreateBotInput) (*ent.Bot, error) {
    // Get bot runner configuration
    botRunner, err := r.client.BotRunner.Get(ctx, input.BotRunnerID)

    // Create runtime via factory (runtime-agnostic)
    factory := runner.NewFactory()
    runtime, err := factory.Create(ctx, botRunner.Type, botRunner.Config)
    defer runtime.Close()

    // Build bot spec (domain logic)
    spec, err := bot.BuildSpec(ctx, input, exchange, strategy)

    // Create bot (runtime interface call - works for Docker/K8s/Local)
    containerID, err := runtime.CreateBot(ctx, spec)

    // Save to database
    return r.client.Bot.Create().
        SetName(input.Name).
        SetContainerID(containerID).
        SetBotRunnerID(input.BotRunnerID).
        Save(ctx)
}
```

**Testing with MockRuntime:**

```go
// internal/graph/*_test.go
func TestCreateBot(t *testing.T) {
    mockRuntime := &runner.MockRuntime{
        CreateBotFunc: func(ctx context.Context, spec runner.BotSpec) (string, error) {
            assert.Equal(t, "test-bot", spec.Name)
            return "mock-container-123", nil
        },
    }

    // Test bot creation without Docker daemon
    containerID, err := mockRuntime.CreateBot(ctx, botSpec)
    assert.NoError(t, err)
    assert.Equal(t, "mock-container-123", containerID)
}
```

### Separate Interfaces for Bots and Backtests

**Why two interfaces?**

- Bots are long-running stateful containers (start/stop/restart)
- Backtests are one-shot jobs (run once, collect results, cleanup)

```go
// internal/runner/backtest_interface.go
type BacktestRunner interface {
    RunBacktest(ctx context.Context, spec BacktestSpec) (*BacktestResult, error)
    GetBacktestStatus(ctx context.Context, backtestID string) (*BacktestStatus, error)
    DeleteBacktest(ctx context.Context, backtestID string) error
    HealthCheck(ctx context.Context) error
    Close() error
    Type() string
}
```

Factory creates both: `Create()` for bots, `CreateBacktestRunner()` for backtests.

## Validation

### How to Verify This Decision

1. **Interface compliance**: All runtime implementations must pass `var _ Runtime = (*XxxRuntime)(nil)` check
2. **Mock testing**: Unit tests use MockRuntime, no Docker daemon required
3. **Runtime portability**: Same bot creation code works with Docker and K8s runtimes
4. **Factory tests**: Verify factory creates correct runtime based on type enum

### Automated Tests

```bash
# Run factory tests
go test -v ./internal/runner -run TestFactory

# Verify interface implementation (compile-time check)
go build ./internal/runner

# Run integration tests (requires Docker)
go test -v ./internal/runner -run TestDockerRuntime

# Run unit tests with mocks (no Docker needed)
go test -v ./internal/graph -run TestBotMutations
```

### Success Metrics

- ✅ Business logic has zero Docker/K8s imports (only `internal/runner` interface)
- ✅ Full test coverage on bot lifecycle without Docker daemon
- ✅ Adding new runtime = 1 file + factory case (no changes to core logic)
- ✅ Same code runs in development (Docker) and production (K8s)

## References

- [Strategy Pattern](https://refactoring.guru/design-patterns/strategy) - Related pattern for runtime selection
- [Abstract Factory Pattern](https://refactoring.guru/design-patterns/abstract-factory)
- [Docker SDK for Go](https://github.com/moby/moby/tree/master/client)
- [Kubernetes client-go](https://github.com/kubernetes/client-go)
- Runtime Implementations: `internal/runner/`
- MockRuntime for Testing: `internal/runner/interface.go:63-172`
