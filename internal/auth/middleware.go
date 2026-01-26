package auth

import (
	"context"
	"log"
	"net/http"
	"strings"
)

// AuthMiddleware is a HTTP middleware that validates JWT tokens
// It extracts the Bearer token from the Authorization header,
// validates it using Keycloak, and stores user context for downstream handlers
type AuthMiddleware struct {
	keycloak *KeycloakClient
	optional bool // If true, allows requests without auth (for Playground)
}

// NewAuthMiddleware creates a new authentication middleware
func NewAuthMiddleware(keycloak *KeycloakClient, optional bool) *AuthMiddleware {
	return &AuthMiddleware{
		keycloak: keycloak,
		optional: optional,
	}
}

// Handler returns the HTTP middleware handler
func (m *AuthMiddleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// Skip auth for WebSocket upgrade requests
		// WebSocket connections are authenticated via connection_init payload in gqlgen's InitFunc
		if isWebSocketUpgrade(r) {
			next.ServeHTTP(w, r)
			return
		}

		// Extract Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			if m.optional {
				// Allow request to proceed without authentication
				next.ServeHTTP(w, r)
				return
			}
			m.unauthorized(w, "missing Authorization header")
			return
		}

		// Extract Bearer token
		token := extractBearerToken(authHeader)
		if token == "" {
			m.unauthorized(w, "invalid Authorization header format (expected: Bearer <token>)")
			return
		}

		// Verify token with Keycloak
		userCtx, err := m.keycloak.VerifyToken(ctx, token)
		if err != nil {
			log.Printf("Token verification failed: %v", err)
			m.unauthorized(w, "invalid or expired token")
			return
		}

		// Store user context for downstream handlers
		ctx = SetUserContext(ctx, userCtx)

		// Continue with authenticated request
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// isWebSocketUpgrade checks if the request is a WebSocket upgrade request
func isWebSocketUpgrade(r *http.Request) bool {
	// Check for WebSocket upgrade headers
	// Connection header should contain "upgrade" (case-insensitive)
	// Upgrade header should be "websocket" (case-insensitive)
	connection := strings.ToLower(r.Header.Get("Connection"))
	upgrade := strings.ToLower(r.Header.Get("Upgrade"))
	return strings.Contains(connection, "upgrade") && upgrade == "websocket"
}

// extractBearerToken extracts the token from "Bearer <token>" format
func extractBearerToken(authHeader string) string {
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return ""
	}
	return parts[1]
}

// unauthorized sends a 401 Unauthorized response
func (m *AuthMiddleware) unauthorized(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	w.Write([]byte(`{"error": "` + message + `"}`))
}

// RequireAuth is a convenience middleware that always requires authentication
func RequireAuth(keycloak *KeycloakClient) func(http.Handler) http.Handler {
	middleware := NewAuthMiddleware(keycloak, false)
	return middleware.Handler
}

// OptionalAuth is a convenience middleware that allows optional authentication
func OptionalAuth(keycloak *KeycloakClient) func(http.Handler) http.Handler {
	middleware := NewAuthMiddleware(keycloak, true)
	return middleware.Handler
}

// MustHaveKeycloak checks if Keycloak is properly configured
// Returns an error if required configuration is missing
func MustHaveKeycloak(config KeycloakConfig) error {
	if config.URL == "" {
		return nil // Keycloak not configured, authentication disabled
	}

	if config.Realm == "" {
		return ErrMissingConfig("keycloak-realm")
	}
	if config.ClientID == "" {
		return ErrMissingConfig("keycloak-client-id")
	}

	return nil
}

// ErrMissingConfig creates a missing configuration error
func ErrMissingConfig(field string) error {
	return &ConfigError{Field: field}
}

// ConfigError represents a configuration error
type ConfigError struct {
	Field string
}

func (e *ConfigError) Error() string {
	return "missing required configuration: " + e.Field
}

// InitKeycloak initializes Keycloak client if configured
// Returns nil if Keycloak is not configured (authentication disabled)
func InitKeycloak(ctx context.Context, config KeycloakConfig) (*KeycloakClient, error) {
	// If URL is not set, Keycloak is not configured
	if config.URL == "" {
		log.Println("⚠️  Keycloak not configured - authentication disabled")
		log.Println("   Set VOLATICLOUD_KEYCLOAK_URL to enable authentication")
		return nil, nil
	}

	// Validate required fields
	if err := MustHaveKeycloak(config); err != nil {
		return nil, err
	}

	// Initialize Keycloak client
	client, err := NewKeycloakClient(ctx, config)
	if err != nil {
		return nil, err
	}

	log.Printf("✓ Keycloak: %s (realm: %s)\n", config.URL, config.Realm)
	return client, nil
}
