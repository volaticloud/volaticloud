package graph

import (
	"context"
	"fmt"

	"volaticloud/internal/ent"
)

// createStrategyVersion creates a new version of an existing strategy
// This is a helper function used by both UpdateStrategy and CreateBacktest mutations
func createStrategyVersion(ctx context.Context, tx *ent.Tx, parent *ent.Strategy) (*ent.Strategy, error) {
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
		SetIsLatest(true)

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
