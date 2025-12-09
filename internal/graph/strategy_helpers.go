package graph

import (
	"context"
	"fmt"

	"volaticloud/internal/ent"
)

// createStrategyVersionDB creates a new version of an existing strategy in the database.
// The ENT hook in internal/authz/hooks.go handles Keycloak resource sync automatically.
func createStrategyVersionDB(ctx context.Context, tx *ent.Tx, parent *ent.Strategy) (*ent.Strategy, error) {
	// Mark parent strategy as not latest
	err := tx.Strategy.UpdateOneID(parent.ID).SetIsLatest(false).Exec(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to mark parent strategy as not latest: %w", err)
	}

	// Create new version with all parent fields
	// ENT hook will automatically create Keycloak resource for this new version
	builder := tx.Strategy.Create().
		SetName(parent.Name).
		SetDescription(parent.Description).
		SetCode(parent.Code).
		SetVersionNumber(parent.VersionNumber + 1).
		SetParentID(parent.ID).
		SetIsLatest(true).
		SetOwnerID(parent.OwnerID) // Preserve owner_id from parent

	// Copy config if exists
	if parent.Config != nil {
		builder.SetConfig(parent.Config)
	}

	// Save new version (this will trigger validation hook AND Keycloak hook)
	return builder.Save(ctx)
}

// coalesce returns the first non-nil value from the provided pointers
// This is a helper for handling optional fields in UpdateStrategy
func coalesce[T any](newVal, oldVal *T) T {
	if newVal != nil {
		return *newVal
	}
	return *oldVal
}