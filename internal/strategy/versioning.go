// Package strategy provides strategy domain logic
package strategy

import (
	"context"
	"fmt"

	"volaticloud/internal/ent"
)

// CreateVersion creates a new version of an existing strategy
// It marks the parent as not latest and creates a new version with incremented version number
func CreateVersion(ctx context.Context, tx *ent.Tx, parent *ent.Strategy) (*ent.Strategy, error) {
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

// Coalesce returns the first non-nil value from the provided pointers
// This is a helper for handling optional fields in updates
func Coalesce[T any](newVal, oldVal *T) T {
	if newVal != nil {
		return *newVal
	}
	return *oldVal
}
