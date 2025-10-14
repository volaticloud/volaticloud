package graph

import "anytrade/internal/ent"

// This file will not be regenerated automatically.
//
// It serves as dependency injection for your app, add any dependencies you require here.

type Resolver struct {
	client *ent.Client
}

// NewResolver creates a new resolver with the ENT client
func NewResolver(client *ent.Client) *Resolver {
	return &Resolver{client: client}
}
