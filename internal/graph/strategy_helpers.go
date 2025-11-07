package graph

import (
	"context"
	"fmt"

	"anytrade/internal/ent"
)

// coalesce returns the new value if provided, otherwise returns the old value
func coalesce[T any](newVal, oldVal *T) T {
	if newVal != nil {
		return *newVal
	}
	return *oldVal
}

// createStrategyVersion creates a new version of a strategy (helper function)
func (r *mutationResolver) createStrategyVersion(ctx context.Context, old *ent.Strategy) (*ent.Strategy, error) {
	// Mark old version as not latest
	err := r.client.Strategy.UpdateOneID(old.ID).SetIsLatest(false).Exec(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to mark old strategy as not latest: %w", err)
	}

	// Create new version (exact copy with incremented version number)
	newVersion := r.client.Strategy.Create().
		SetName(old.Name).
		SetDescription(old.Description).
		SetCode(old.Code).
		SetVersion(old.Version).
		SetVersionNumber(old.VersionNumber + 1).
		SetParentID(old.ID).
		SetIsLatest(true)

	if old.Config != nil {
		newVersion.SetConfig(old.Config)
	}

	return newVersion.Save(ctx)
}
