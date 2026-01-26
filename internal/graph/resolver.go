package graph

import (
	"volaticloud/internal/auth"
	"volaticloud/internal/ent"
	"volaticloud/internal/keycloak"
	"volaticloud/internal/pubsub"
)

// This file will not be regenerated automatically.
//
// It serves as dependency injection for your app, add any dependencies you require here.

type Resolver struct {
	client    *ent.Client
	auth      *auth.KeycloakClient
	umaClient keycloak.UMAClientInterface
	pubsub    pubsub.PubSub
}

// NewResolver creates a new resolver with the ENT client and auth clients
func NewResolver(client *ent.Client, authClient *auth.KeycloakClient, umaClient keycloak.UMAClientInterface, ps pubsub.PubSub) *Resolver {
	return &Resolver{
		client:    client,
		auth:      authClient,
		umaClient: umaClient,
		pubsub:    ps,
	}
}
