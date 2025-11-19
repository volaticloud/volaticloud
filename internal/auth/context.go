package auth

import (
	"context"
	"errors"
)

// contextKey is a private type for context keys to avoid collisions
type contextKey string

const userContextKey contextKey = "user"

// UserContext contains authenticated user information extracted from JWT
type UserContext struct {
	UserID            string   // Subject claim (sub) from JWT
	Email             string   // Email claim
	PreferredUsername string   // Preferred username
	Roles             []string // Realm roles from JWT
	RawToken          string   // Original JWT token for UMA permission checks
}

// SetUserContext stores user information in the context
func SetUserContext(ctx context.Context, user *UserContext) context.Context {
	return context.WithValue(ctx, userContextKey, user)
}

// GetUserContext retrieves user information from the context
// Returns an error if no user context is found (unauthenticated request)
func GetUserContext(ctx context.Context) (*UserContext, error) {
	user, ok := ctx.Value(userContextKey).(*UserContext)
	if !ok || user == nil {
		return nil, errors.New("no user context found - request is not authenticated")
	}
	return user, nil
}

// MustGetUserContext retrieves user information from the context
// Panics if no user context is found (should only be used after @isAuthenticated directive)
func MustGetUserContext(ctx context.Context) *UserContext {
	user, err := GetUserContext(ctx)
	if err != nil {
		panic("MustGetUserContext called on unauthenticated request")
	}
	return user
}

// HasRole checks if the user has a specific realm role
func (u *UserContext) HasRole(role string) bool {
	for _, r := range u.Roles {
		if r == role {
			return true
		}
	}
	return false
}

// IsAdmin checks if the user has the admin role
func (u *UserContext) IsAdmin() bool {
	return u.HasRole("admin")
}
