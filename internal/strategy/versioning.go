// Package strategy provides strategy domain logic
package strategy

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/mixin"
	"volaticloud/internal/ent/strategy"
	"volaticloud/internal/enum"
)

// VersionInput contains optional fields for creating a new strategy version.
// If a field is nil, the parent's value will be used.
type VersionInput struct {
	Name        *string
	Description *string
	Code        *string
	Config      map[string]interface{}
	BuilderMode *string // Optional: "ui" or "code" - if nil, inherits from parent
}

// CreateInput contains the required fields for creating a new strategy.
type CreateInput struct {
	Name        string
	Description *string
	Code        string
	Config      map[string]interface{}
	BuilderMode enum.StrategyBuilderMode
	OwnerID     string
}

// Create creates a new strategy with the given input.
// For UI builder mode strategies, code is automatically generated from ui_builder config.
func Create(ctx context.Context, client *ent.Client, input *CreateInput) (*ent.Strategy, error) {
	code := input.Code

	// For UI builder mode, generate code from ui_builder config
	if input.BuilderMode == enum.StrategyBuilderModeUI {
		if input.Config == nil {
			return nil, fmt.Errorf("config is required for UI builder mode strategies")
		}
		generatedCode, err := GenerateCodeFromUIBuilder(input.Name, input.Config)
		if err != nil {
			return nil, fmt.Errorf("failed to generate strategy code: %w", err)
		}
		code = generatedCode
	}

	// Build the strategy
	builder := client.Strategy.Create().
		SetName(input.Name).
		SetCode(code).
		SetBuilderMode(input.BuilderMode).
		SetOwnerID(input.OwnerID)

	if input.Description != nil {
		builder.SetDescription(*input.Description)
	}

	if input.Config != nil {
		builder.SetConfig(input.Config)
	}

	return builder.Save(ctx)
}

// CreateVersion creates a new version of an existing strategy.
// It marks the parent as not latest and creates a new version with incremented version number.
// If input is nil, all fields are copied from the parent.
// If input is provided, non-nil fields override parent values.
// For UI builder mode strategies, code is automatically generated from ui_builder config.
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
	builderMode := parent.BuilderMode

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
		if input.BuilderMode != nil {
			builderMode = enum.StrategyBuilderMode(*input.BuilderMode)
		}
	}

	// For UI builder mode, generate code from ui_builder config
	if builderMode == enum.StrategyBuilderModeUI {
		generatedCode, err := GenerateCodeFromUIBuilder(name, config)
		if err != nil {
			return nil, fmt.Errorf("failed to generate strategy code: %w", err)
		}
		code = generatedCode
	}

	// Query for max version number (including soft-deleted records) to avoid unique constraint violation
	// The unique constraint on (name, version_number) includes soft-deleted records
	//
	// Race Condition Handling:
	// Race conditions are handled at the database level via the unique constraint.
	// If two concurrent requests try to insert the same version, one will fail with
	// a unique constraint violation. The caller should implement retry logic:
	//
	//   for attempt := 0; attempt < maxRetries; attempt++ {
	//       tx, _ := client.Tx(ctx)
	//       _, err := strategy.CreateVersion(ctx, tx, parent, input)
	//       if err == nil {
	//           return tx.Commit()
	//       }
	//       tx.Rollback()
	//       if !ent.IsConstraintError(err) {
	//           return err // Non-retryable error
	//       }
	//       time.Sleep(time.Millisecond * time.Duration(50 << attempt)) // Exponential backoff
	//   }
	includeDeletedCtx := mixin.IncludeDeleted(ctx)
	maxVersion, err := tx.Strategy.Query().
		Where(strategy.Name(name)).
		Aggregate(ent.Max(strategy.FieldVersionNumber)).
		Int(includeDeletedCtx)
	if err != nil {
		// If no versions exist, start at 1
		maxVersion = 0
	}
	nextVersion := maxVersion + 1

	// Create new version with resolved fields
	builder := tx.Strategy.Create().
		SetName(name).
		SetDescription(description).
		SetCode(code).
		SetVersionNumber(nextVersion).
		SetParentID(parent.ID).
		SetIsLatest(true).
		SetOwnerID(parent.OwnerID). // Preserve owner_id from parent
		SetPublic(parent.Public).   // Preserve public visibility from parent
		SetBuilderMode(builderMode) // Use new builder mode if provided, else preserve parent's

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

// DeleteAllVersions soft-deletes a strategy and all its versions.
// It finds the root version and recursively deletes all children.
// Uses the soft-delete hook automatically via DeleteOneID.
func DeleteAllVersions(ctx context.Context, client *ent.Client, strategyID uuid.UUID) error {
	// Include soft-deleted records when traversing version tree
	// This ensures we find all versions even if some were previously deleted
	includeDeletedCtx := mixin.IncludeDeleted(ctx)

	// Get the strategy
	s, err := client.Strategy.Get(includeDeletedCtx, strategyID)
	if err != nil {
		return fmt.Errorf("failed to get strategy: %w", err)
	}

	// Find the root strategy (the one with no parent)
	root := s
	for root.ParentID != nil {
		parent, err := client.Strategy.Get(includeDeletedCtx, *root.ParentID)
		if err != nil {
			return fmt.Errorf("failed to get parent strategy: %w", err)
		}
		root = parent
	}

	// Collect all versions starting from root (including soft-deleted ones)
	allVersions, err := collectAllVersions(includeDeletedCtx, client, root.ID)
	if err != nil {
		return err
	}

	// Soft-delete all versions (the hook will convert to UPDATE SET deleted_at)
	// Use includeDeletedCtx so we can find and re-delete already soft-deleted versions
	for _, id := range allVersions {
		if err := client.Strategy.DeleteOneID(id).Exec(includeDeletedCtx); err != nil {
			return fmt.Errorf("failed to delete strategy version %s: %w", id, err)
		}
	}

	return nil
}

// collectAllVersions recursively collects all version IDs starting from the given strategy.
func collectAllVersions(ctx context.Context, client *ent.Client, strategyID uuid.UUID) ([]uuid.UUID, error) {
	result := []uuid.UUID{strategyID}

	// Find all children
	children, err := client.Strategy.Query().
		Where(strategy.ParentID(strategyID)).
		IDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to query children: %w", err)
	}

	// Recursively collect children's versions
	for _, childID := range children {
		childVersions, err := collectAllVersions(ctx, client, childID)
		if err != nil {
			return nil, err
		}
		result = append(result, childVersions...)
	}

	return result, nil
}
