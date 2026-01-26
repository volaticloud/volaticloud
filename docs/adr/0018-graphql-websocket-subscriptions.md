# ADR-0018: GraphQL WebSocket Subscriptions

## Status

Accepted

## Context

VolatiCloud's dashboard uses polling-based updates for real-time data like bot status, backtest progress, and alerts. This approach has several limitations:

1. **Latency**: Users experience 3-30 second delays depending on poll interval
2. **Resource waste**: Frequent polling generates unnecessary API calls when nothing changes
3. **Scalability**: High poll frequencies multiply server load with user count
4. **UX**: Users actively monitoring bots expect instant feedback

Per [Apollo Docs](https://www.apollographql.com/docs/react/data/subscriptions), subscriptions are ideal for "low-latency updates where users expect real-time feedback" - exactly matching our bot/backtest monitoring use case.

## Decision

Implement GraphQL WebSocket subscriptions using the `graphql-ws` protocol with Redis pub/sub for horizontal scaling.

### Architecture

```mermaid
flowchart TB
    subgraph Frontend
        AC[Apollo Client] -->|HTTP| GQL[GraphQL Endpoint]
        AC -->|WebSocket| WS[/ws Endpoint]
    end

    subgraph Backend
        GQL --> R[Resolvers]
        WS --> WSH[WebSocket Handler]
        WSH -->|JWT Auth| KC[Keycloak]
        WSH --> SR[Subscription Resolvers]
        SR --> PS[Pub/Sub Interface]
    end

    subgraph PubSub
        PS --> Redis[(Redis/Valkey)]
        PS --> Mem[In-Memory Fallback]
    end

    subgraph Monitors
        BM[Bot Monitor] --> PS
        BTM[Backtest Monitor] --> PS
        RM[Runner Monitor] --> PS
        AM[Alert Manager] --> PS
    end
```

### Protocol Choice: graphql-ws

| Protocol | Status | Apollo Support | Features |
|----------|--------|----------------|----------|
| `graphql-ws` | Active | Native | Modern, maintained |
| `subscriptions-transport-ws` | Deprecated | Legacy | Outdated |

Selected `graphql-ws` as the industry standard with native Apollo Client support.

### Pub/Sub Choice: Redis

| Option | Horizontal Scaling | Latency | Complexity |
|--------|-------------------|---------|------------|
| In-memory channels | ❌ Single instance | <1ms | Low |
| Redis pub/sub | ✅ Multi-instance | ~1ms | Medium |
| Kafka | ✅ Multi-instance | 5-10ms | High |

Selected Redis for:

- Industry standard for GraphQL subscriptions
- Sub-millisecond latency
- Simple deployment (Vultr offers managed Valkey, Redis-compatible)
- Built-in connection pooling and reconnection

### Subscriptions Implemented

| Subscription | Trigger | Use Case |
|-------------|---------|----------|
| `botStatusChanged(botId)` | Bot status updates | Bot detail page |
| `backtestProgress(backtestId)` | Progress updates | Strategy Studio |
| `alertEventCreated(ownerId)` | New alerts | Notifications dropdown |
| `tradeUpdated(botId)` | Trade events | Trades list |
| `runnerStatusChanged(runnerId)` | Runner status | Runners list |

### Authentication

JWT authentication via `connection_init` payload:

```typescript
// Frontend
const wsLink = new GraphQLWsLink(
  createClient({
    url: wsUrl,
    connectionParams: () => ({
      authToken: `Bearer ${getAccessToken()}`,
    }),
  })
);
```

```go
// Backend WebSocket InitFunc
func websocketInit(ctx context.Context, payload transport.InitPayload) (context.Context, *transport.InitPayload, error) {
    token := payload.Authorization()
    claims, err := keycloakClient.VerifyToken(ctx, token)
    if err != nil {
        return nil, nil, fmt.Errorf("authentication failed")
    }
    return auth.SetUserContext(ctx, claims), &payload, nil
}
```

Authorization uses existing `@hasScope` directive on subscription fields.

### Graceful Degradation

If Redis is unavailable at startup:

1. Log warning
2. Fall back to in-memory pub/sub
3. Continue operating (subscriptions work within single instance)

This ensures the application remains functional during Redis outages.

## Consequences

### Positive

- **Instant updates**: Sub-second latency for status changes
- **Reduced load**: No polling overhead, events only when changes occur
- **Better UX**: Real-time feedback matches user expectations
- **Scalable**: Redis pub/sub supports horizontal scaling
- **Fallback**: In-memory mode for development/single-instance

### Negative

- **Complexity**: Additional infrastructure (Redis/Valkey)
- **Connection management**: WebSocket connections require monitoring
- **State**: Long-lived connections need careful error handling

### Mitigations

- Panic recovery in subscription goroutines
- Proper cleanup on context cancellation
- Connection status indicator in UI
- Graceful degradation without Redis

## Alternatives Considered

### 1. Server-Sent Events (SSE)

**Rejected because:**

- One-way only (server to client)
- Less GraphQL ecosystem support
- Would require separate transport

### 2. Long Polling

**Rejected because:**

- Higher latency than WebSockets
- More complex server-side implementation
- Higher resource usage

### 3. No Fallback (Require Redis)

**Rejected because:**

- Reduces development experience
- Single point of failure
- Unnecessary for single-instance deployments

## Implementation Details

### Event Publishers

Events are published from the following locations:

| Component | File | Events Published |
|-----------|------|------------------|
| Bot Monitor | `internal/monitor/bot_monitor.go` | `botStatusChanged`, `botChanged` |
| Backtest Monitor | `internal/monitor/backtest_monitor.go` | `backtestProgress` |
| Alert Manager | `internal/alert/manager.go` | `alertEventCreated` |
| Trade Monitor | `internal/monitor/trade_monitor.go` | `tradeUpdated`, `tradeChanged` |
| Runner Monitor | `internal/monitor/runner_monitor.go` | `runnerStatusChanged`, `runnerChanged` |

### Topic Schema

Topics follow a consistent naming convention:

```
{resource_type}:{resource_id}
```

Examples:

- `bot:550e8400-e29b-41d4-a716-446655440000` - Single bot updates
- `backtest:550e8400-e29b-41d4-a716-446655440001` - Backtest progress
- `alert:org_12345` - Alerts for an organization
- `trade:550e8400-e29b-41d4-a716-446655440002` - Trade updates for a bot
- `runner:550e8400-e29b-41d4-a716-446655440003` - Runner status

Topic functions are defined in `internal/pubsub/topics.go`.

### Token Lifetime Considerations

**Current Behavior:**

- JWT is validated once at WebSocket connection (`connection_init`)
- Token claims are stored in context for the connection lifetime
- Subscription resolvers use the stored claims for authorization checks

**Token Expiration:**

- Default Keycloak access token TTL: 5 minutes
- WebSocket connections may outlive token lifetime
- Authorization checks use the @hasScope directive, which validates against the stored context

**Recommendations for Production:**

1. Frontend should track token expiry and reconnect before timeout
2. Consider implementing periodic re-authentication for long-lived connections
3. Critical operations should validate freshness of authorization

### Message Buffer Behavior

Both Redis and in-memory implementations use a buffered channel:

- **Buffer size**: 100 messages (hardcoded)
- **Overflow behavior**: Messages are dropped when buffer is full
- **No backpressure**: Publishers are not blocked

This is intentional to prevent slow subscribers from blocking publishers. For critical alerts, the `alertEventCreated` subscription should be combined with a fallback query to catch missed messages.

### Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Connection overhead | ~2KB per connection | WebSocket + goroutine |
| Message latency | <10ms (Redis), <1ms (memory) | End-to-end |
| Throughput | ~10,000 msg/sec (Redis) | Per server instance |
| Max connections | Limited by OS file descriptors | Typically 1024-65535 |

### File Structure

```
internal/
├── pubsub/
│   ├── doc.go           # Package documentation
│   ├── pubsub.go        # PubSub interface
│   ├── memory.go        # In-memory implementation
│   ├── redis.go         # Redis implementation
│   ├── topics.go        # Topic naming functions
│   └── helpers.go       # Panic recovery helpers
├── graph/
│   ├── websocket.go     # WebSocket transport setup
│   └── schema.resolvers.go  # Subscription resolvers
└── monitor/
    └── *.go             # Event publishers
```

## References

- [Apollo Subscriptions Documentation](https://www.apollographql.com/docs/react/data/subscriptions)
- [gqlgen Subscriptions Recipe](https://gqlgen.com/recipes/subscriptions/)
- [graphql-ws Protocol](https://github.com/enisdenjo/graphql-ws)
- [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/)
