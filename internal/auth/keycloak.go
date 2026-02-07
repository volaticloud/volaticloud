package auth

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/oauth2"
)

// KeycloakConfig contains Keycloak client configuration
type KeycloakConfig struct {
	URL               string // Keycloak server URL for API calls (e.g., https://keycloak.volaticloud.com)
	IssuerURL         string // Expected token issuer URL (if different from URL, e.g., behind proxy)
	Realm             string // Realm name (e.g., volaticloud)
	ClientID          string // Client ID for this backend API
	ClientSecret      string // Client secret for UMA resource management
	DashboardClientID string // Client ID for dashboard (used in invitation redirects)
	TLSSkipVerify     bool   // Skip TLS certificate verification (for E2E tests with self-signed certs)
}

// KeycloakClient handles JWT validation and UMA operations
type KeycloakClient struct {
	config   KeycloakConfig
	provider *oidc.Provider
	verifier *oidc.IDTokenVerifier
	oauth2   *oauth2.Config
}

// NewKeycloakClient initializes a new Keycloak client with OIDC discovery
func NewKeycloakClient(ctx context.Context, config KeycloakConfig) (*KeycloakClient, error) {
	if config.URL == "" {
		return nil, fmt.Errorf("keycloak URL is required")
	}
	if config.Realm == "" {
		return nil, fmt.Errorf("keycloak realm is required")
	}
	if config.ClientID == "" {
		return nil, fmt.Errorf("keycloak client ID is required")
	}

	// Construct discovery URL (where to fetch OIDC config from)
	discoveryURL := fmt.Sprintf("%s/realms/%s", config.URL, config.Realm)

	// If IssuerURL is different (e.g., behind proxy), use InsecureIssuerURLContext
	// to accept tokens with a different issuer than the discovery URL
	if config.IssuerURL != "" && config.IssuerURL != config.URL {
		expectedIssuer := fmt.Sprintf("%s/realms/%s", config.IssuerURL, config.Realm)
		ctx = oidc.InsecureIssuerURLContext(ctx, expectedIssuer)
	}

	// Use insecure HTTP client for E2E tests with self-signed certs
	if config.TLSSkipVerify {
		insecureClient := &http.Client{
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, //nolint:gosec // E2E only
			},
		}
		ctx = oidc.ClientContext(ctx, insecureClient)
	}

	// Discover OIDC provider configuration
	provider, err := oidc.NewProvider(ctx, discoveryURL)
	if err != nil {
		return nil, fmt.Errorf("failed to discover OIDC provider: %w", err)
	}

	// Create JWT verifier
	// Note: SkipClientIDCheck is enabled for development to accept tokens from frontend client
	// In production, configure Keycloak to add backend client ID to audience claim
	verifier := provider.Verifier(&oidc.Config{
		ClientID:          config.ClientID,
		SkipClientIDCheck: true, // Accept tokens with any audience (e.g., "account")
	})

	// Configure OAuth2
	oauth2Config := &oauth2.Config{
		ClientID:     config.ClientID,
		ClientSecret: config.ClientSecret,
		Endpoint:     provider.Endpoint(),
	}

	return &KeycloakClient{
		config:   config,
		provider: provider,
		verifier: verifier,
		oauth2:   oauth2Config,
	}, nil
}

// VerifyToken validates a JWT access token and extracts claims
// Returns UserContext with user information or an error
func (k *KeycloakClient) VerifyToken(ctx context.Context, tokenString string) (*UserContext, error) {
	// Parse JWT without verification first to check token type
	parser := jwt.NewParser()
	token, _, err := parser.ParseUnverified(tokenString, jwt.MapClaims{})
	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims")
	}

	// Check if this is an access token (typ claim)
	typ, ok := claims["typ"].(string)
	if !ok || typ != "Bearer" {
		// If not explicitly Bearer, check for azp claim (client assertion)
		if _, hasAzp := claims["azp"]; !hasAzp {
			return nil, fmt.Errorf("invalid token type: expected Bearer access token")
		}
	}

	// Verify token using OIDC verifier
	// Note: For access tokens, we use Verify instead of VerifyIDToken
	idToken, err := k.verifier.Verify(ctx, tokenString)
	if err != nil {
		return nil, fmt.Errorf("token verification failed: %w", err)
	}

	// Extract standard claims
	var oidcClaims struct {
		Sub               string   `json:"sub"`
		Email             string   `json:"email"`
		PreferredUsername string   `json:"preferred_username"`
		RealmRoles        []string `json:"realm_access.roles"`
	}

	if err := idToken.Claims(&oidcClaims); err != nil {
		return nil, fmt.Errorf("failed to extract claims: %w", err)
	}

	// Extract realm roles from nested structure
	var roles []string
	if realmAccess, ok := claims["realm_access"].(map[string]interface{}); ok {
		if rolesInterface, ok := realmAccess["roles"].([]interface{}); ok {
			for _, role := range rolesInterface {
				if roleStr, ok := role.(string); ok {
					roles = append(roles, roleStr)
				}
			}
		}
	}

	// Extract groups from JWT claims
	// Groups format: ["/uuid/resource/role:admin", "/uuid/role:admin"]
	var groups []string
	if groupsInterface, ok := claims["groups"].([]interface{}); ok {
		for _, group := range groupsInterface {
			if groupStr, ok := group.(string); ok {
				groups = append(groups, groupStr)
			}
		}
	}

	// Build user context
	userCtx := &UserContext{
		UserID:            oidcClaims.Sub,
		Email:             oidcClaims.Email,
		PreferredUsername: oidcClaims.PreferredUsername,
		Roles:             roles,
		Groups:            groups,
		RawToken:          tokenString,
	}

	return userCtx, nil
}

// GetClientToken retrieves a client credentials token for UMA operations
// This token is used by the backend to manage resources on behalf of users
func (k *KeycloakClient) GetClientToken(ctx context.Context) (*oauth2.Token, error) {
	if k.config.ClientSecret == "" {
		return nil, fmt.Errorf("client secret is required for client credentials flow")
	}

	token, err := k.oauth2.PasswordCredentialsToken(ctx, k.config.ClientID, k.config.ClientSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to get client token: %w", err)
	}

	return token, nil
}

// GetIssuerURL returns the OIDC issuer URL
func (k *KeycloakClient) GetIssuerURL() string {
	return fmt.Sprintf("%s/realms/%s", k.config.URL, k.config.Realm)
}

// GetRealm returns the configured realm name
func (k *KeycloakClient) GetRealm() string {
	return k.config.Realm
}

// GetConfig returns the Keycloak configuration
func (k *KeycloakClient) GetConfig() KeycloakConfig {
	return k.config
}
