package graph

import (
	"context"
	"log"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/99designs/gqlgen/graphql"
	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/lru"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/gorilla/websocket"
	"github.com/vektah/gqlparser/v2/ast"

	"volaticloud/internal/auth"
)

// WebSocketConfig holds configuration for WebSocket transport.
type WebSocketConfig struct {
	// AllowedOrigins is the list of allowed origins for WebSocket connections.
	AllowedOrigins []string
	// KeepAlivePingInterval is the interval between keep-alive pings.
	KeepAlivePingInterval time.Duration
	// AuthClient is the Keycloak client for JWT validation.
	AuthClient *auth.KeycloakClient
}

// NewServerWithWebSocket creates a new GraphQL handler with WebSocket support.
// This replaces handler.NewDefaultServer() for subscription support.
func NewServerWithWebSocket(es graphql.ExecutableSchema, cfg WebSocketConfig) *handler.Server {
	srv := handler.New(es)

	// Add POST transport for queries/mutations
	srv.AddTransport(transport.POST{})

	// Add WebSocket transport for subscriptions
	srv.AddTransport(transport.Websocket{
		KeepAlivePingInterval: cfg.KeepAlivePingInterval,
		Upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				origin := r.Header.Get("Origin")
				if origin == "" {
					// Empty origin only allowed in development mode
					// (when localhost is in allowed origins or no origins configured)
					return isDevMode(cfg.AllowedOrigins)
				}
				return slices.Contains(cfg.AllowedOrigins, origin)
			},
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		},
		InitFunc: createWebsocketInitFunc(cfg.AuthClient),
	})

	// Add standard extensions
	srv.SetQueryCache(lru.New[*ast.QueryDocument](1000))
	srv.Use(extension.Introspection{})
	srv.Use(extension.AutomaticPersistedQuery{
		Cache: lru.New[string](100),
	})

	return srv
}

// createWebsocketInitFunc creates the InitFunc for WebSocket authentication.
// It validates the JWT token from the connection_init payload and injects
// the user context for subsequent subscription operations.
func createWebsocketInitFunc(authClient *auth.KeycloakClient) transport.WebsocketInitFunc {
	return func(ctx context.Context, initPayload transport.InitPayload) (context.Context, *transport.InitPayload, error) {
		// Extract auth token from payload
		// Format: { "authToken": "Bearer <jwt>" }
		authToken, ok := initPayload["authToken"].(string)
		if !ok || authToken == "" {
			log.Printf("websocket: no authToken in connection_init payload")
			return nil, nil, &WebSocketAuthError{Message: "missing authToken in connection_init payload"}
		}

		// Remove "Bearer " prefix if present
		token := strings.TrimPrefix(authToken, "Bearer ")
		if token == authToken {
			// Try lowercase
			token = strings.TrimPrefix(authToken, "bearer ")
		}

		// Validate the JWT token
		userCtx, err := authClient.VerifyToken(ctx, token)
		if err != nil {
			log.Printf("websocket: token validation failed: %v", err)
			return nil, nil, &WebSocketAuthError{Message: "invalid or expired token"}
		}

		// Inject user context for subscription resolvers
		ctx = auth.SetUserContext(ctx, userCtx)

		log.Printf("websocket: authenticated user %s (%s)", userCtx.PreferredUsername, userCtx.UserID)

		return ctx, &initPayload, nil
	}
}

// WebSocketAuthError represents an authentication error during WebSocket connection.
type WebSocketAuthError struct {
	Message string
}

func (e *WebSocketAuthError) Error() string {
	return e.Message
}

// isDevMode checks if the server is running in development mode.
// Returns true if no origins are configured or if localhost is in the allowed origins.
func isDevMode(allowedOrigins []string) bool {
	if len(allowedOrigins) == 0 {
		return true
	}
	for _, origin := range allowedOrigins {
		if strings.Contains(origin, "localhost") || strings.Contains(origin, "127.0.0.1") {
			return true
		}
	}
	return false
}
