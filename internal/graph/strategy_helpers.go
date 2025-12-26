package graph

import (
	"context"

	"volaticloud/internal/ent"
	"volaticloud/internal/strategy"
)

// createStrategyVersionDB creates a new version of an existing strategy in the database.
// The ENT hook in internal/authz/hooks.go handles Keycloak resource sync automatically.
// This is a thin wrapper around the strategy domain function.
func createStrategyVersionDB(ctx context.Context, tx *ent.Tx, parent *ent.Strategy) (*ent.Strategy, error) {
	// Use domain function with nil input to copy all fields from parent
	return strategy.CreateVersion(ctx, tx, parent, nil)
}
