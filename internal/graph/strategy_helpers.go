package graph

import (
	"context"
	"fmt"

	"volaticloud/internal/ent"
	"volaticloud/internal/keycloak"
)

// createStrategyVersionWithResource creates a new version of an existing strategy
// and syncs it with Keycloak UMA.
// This is the primary helper function that should be used when creating strategy versions.
func createStrategyVersionWithResource(
	ctx context.Context,
	tx *ent.Tx,
	umaClient keycloak.UMAClientInterface,
	parent *ent.Strategy,
) (*ent.Strategy, error) {
	// Create the new version in database
	newVersion, err := createStrategyVersionDB(ctx, tx, parent)
	if err != nil {
		return nil, err
	}

	// Sync Keycloak resource for new version
	if err := SyncStrategyVersionResource(ctx, umaClient, newVersion); err != nil {
		// Keycloak sync failed - return error to rollback transaction
		return nil, fmt.Errorf("failed to sync Keycloak resource (transaction will rollback): %w", err)
	}

	return newVersion, nil
}

// createStrategyVersionDB creates a new version of an existing strategy in the database only.
// This is the low-level helper that handles DB operations without Keycloak sync.
// Use createStrategyVersionWithResource for full resource management.
func createStrategyVersionDB(ctx context.Context, tx *ent.Tx, parent *ent.Strategy) (*ent.Strategy, error) {
	// Mark parent strategy as not latest
	err := tx.Strategy.UpdateOneID(parent.ID).SetIsLatest(false).Exec(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to mark parent strategy as not latest: %w", err)
	}

	// Create new version with all parent fields
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

	// Save new version (this will trigger validation hook)
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
