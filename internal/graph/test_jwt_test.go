package graph

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"volaticloud/internal/auth"
)

// GenerateTestJWT creates a test JWT token with custom claims
// For testing purposes, the token is not cryptographically signed (uses "none" algorithm)
// since we're bypassing actual Keycloak validation in tests
func GenerateTestJWT(t *testing.T, userID, email string, groups []string) string {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":                userID,
		"email":              email,
		"preferred_username": "testuser",
		"realm_access": map[string]interface{}{
			"roles": []string{"user"},
		},
		"groups": groups,
		"iat":    now.Unix(),
		"exp":    now.Add(1 * time.Hour).Unix(),
		"iss":    "http://localhost:8081/realms/volaticloud",
		"aud":    "volaticloud-backend",
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Sign with a test secret (not used in production)
	tokenString, err := token.SignedString([]byte("test-secret-key"))
	if err != nil {
		t.Fatalf("Failed to generate test JWT: %v", err)
	}

	return tokenString
}

// CreateUserContext creates a UserContext directly (bypassing JWT parsing)
// Useful for tests that need to inject user context without HTTP headers
func CreateUserContext(userID, email string, groups []string, roles []string, rawToken string) *auth.UserContext {
	if roles == nil {
		roles = []string{"user"}
	}

	return &auth.UserContext{
		UserID:            userID,
		Email:             email,
		PreferredUsername: "testuser",
		Roles:             roles,
		Groups:            groups,
		RawToken:          rawToken,
	}
}
