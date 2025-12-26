// Package strategy provides strategy domain logic
package strategy

import (
	"context"
	"fmt"

	"volaticloud/internal/ent"
)

// VersionInput contains optional fields for creating a new strategy version.
// If a field is nil, the parent's value will be used.
type VersionInput struct {
	Name        *string
	Description *string
	Code        *string
	Config      map[string]interface{}
}

// CreateVersion creates a new version of an existing strategy.
// It marks the parent as not latest and creates a new version with incremented version number.
// If input is nil, all fields are copied from the parent.
// If input is provided, non-nil fields override parent values.
func CreateVersion(ctx context.Context, tx *ent.Tx, parent *ent.Strategy, input *VersionInput) (*ent.Strategy, error) {
	// Mark parent strategy as not latest
	err := tx.Strategy.UpdateOneID(parent.ID).SetIsLatest(false).Exec(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to mark parent strategy as not latest: %w", err)
	}

	// Apply input updates or fall back to parent values
	name := parent.Name
	description := parent.Description
	code := parent.Code
	config := parent.Config

	if input != nil {
		if input.Name != nil {
			name = *input.Name
		}
		if input.Description != nil {
			description = *input.Description
		}
		if input.Code != nil {
			code = *input.Code
		}
		if input.Config != nil {
			config = input.Config
		}
	}

	// Create new version with resolved fields
	builder := tx.Strategy.Create().
		SetName(name).
		SetDescription(description).
		SetCode(code).
		SetVersionNumber(parent.VersionNumber + 1).
		SetParentID(parent.ID).
		SetIsLatest(true).
		SetOwnerID(parent.OwnerID). // Preserve owner_id from parent
		SetPublic(parent.Public)    // Preserve public visibility from parent

	// Copy config if exists
	if config != nil {
		builder.SetConfig(config)
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
