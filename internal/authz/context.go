package authz

import (
	"context"

	"volaticloud/internal/ent"
	"volaticloud/internal/keycloak"
)

// Context keys for storing clients
type contextKey string

const (
	umaClientKey contextKey = "uma_client"
	entClientKey contextKey = "ent_client"
)

// SetUMAClientInContext stores the UMA client in context
func SetUMAClientInContext(ctx context.Context, client keycloak.UMAClientInterface) context.Context {
	return context.WithValue(ctx, umaClientKey, client)
}

// GetUMAClientFromContext retrieves the UMA client from context
func GetUMAClientFromContext(ctx context.Context) keycloak.UMAClientInterface {
	if client, ok := ctx.Value(umaClientKey).(keycloak.UMAClientInterface); ok {
		return client
	}
	return nil
}

// SetEntClientInContext stores the ENT client in context
func SetEntClientInContext(ctx context.Context, client *ent.Client) context.Context {
	return context.WithValue(ctx, entClientKey, client)
}

// GetEntClientFromContext retrieves the ENT client from context
func GetEntClientFromContext(ctx context.Context) *ent.Client {
	if client, ok := ctx.Value(entClientKey).(*ent.Client); ok {
		return client
	}
	return nil
}
