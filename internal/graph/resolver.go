package graph

import (
	"volaticloud/internal/auth"
	"volaticloud/internal/ent"
	"volaticloud/internal/keycloak"
)

// This file will not be regenerated automatically.
//
// It serves as dependency injection for your app, add any dependencies you require here.

type Resolver struct {
	client    *ent.Client
	auth      *auth.KeycloakClient
	umaClient keycloak.UMAClientInterface
}

// NewResolver creates a new resolver with the ENT client and auth clients
func NewResolver(client *ent.Client, authClient *auth.KeycloakClient, umaClient keycloak.UMAClientInterface) *Resolver {
	return &Resolver{
		client:    client,
		auth:      authClient,
		umaClient: umaClient,
	}
}
