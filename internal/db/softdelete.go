// Package db provides database utilities including soft-delete hooks.
package db

import (
	"context"
	"fmt"
	"reflect"
	"time"

	"entgo.io/ent"
	"github.com/google/uuid"

	entclient "volaticloud/internal/ent"
)

// hardDeleteKey is the context key for hard delete operations.
type hardDeleteKey struct{}

// WithHardDelete returns a context that bypasses soft-delete and performs permanent deletion.
// Use sparingly - only for cleanup tasks or explicit permanent deletion requests.
func WithHardDelete(ctx context.Context) context.Context {
	return context.WithValue(ctx, hardDeleteKey{}, true)
}

// isHardDelete checks if the context allows permanent deletion.
func isHardDelete(ctx context.Context) bool {
	hardDelete, ok := ctx.Value(hardDeleteKey{}).(bool)
	return ok && hardDelete
}

// softDeletableMutation defines the interface for mutations that support soft-delete.
// Any ENT mutation with SoftDeleteMixin automatically implements this interface.
type softDeletableMutation interface {
	ent.Mutation
	IDs(context.Context) ([]uuid.UUID, error)
	SetDeletedAt(time.Time)
}

// SetupSoftDelete configures soft-delete hooks on the ENT client.
// This hook automatically applies to ALL entities that have the SoftDeleteMixin.
// No explicit entity listing is required - it detects soft-delete support at runtime
// via the softDeletableMutation interface.
//
// The hook intercepts Delete operations and converts them to UPDATE SET deleted_at.
//
// With this hook:
//   - client.Strategy.DeleteOneID(id).Exec(ctx) → sets deleted_at = now
//   - client.Strategy.Delete().Where(...).Exec(ctx) → sets deleted_at = now for matching
//
// To perform permanent deletion:
//
//	ctx := db.WithHardDelete(ctx)
//	ctx = mixin.IncludeDeleted(ctx) // needed to find soft-deleted records
//	client.Strategy.DeleteOneID(id).Exec(ctx)
func SetupSoftDelete(client *entclient.Client) {
	// Single hook applied to all entity types
	hook := func(next ent.Mutator) ent.Mutator {
		return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
			// Only intercept delete operations
			if !m.Op().Is(ent.OpDelete | ent.OpDeleteOne) {
				return next.Mutate(ctx, m)
			}

			// Allow hard delete via context
			if isHardDelete(ctx) {
				return next.Mutate(ctx, m)
			}

			// Check if mutation supports soft-delete (has SetDeletedAt method)
			sdm, ok := m.(softDeletableMutation)
			if !ok {
				// Entity doesn't have SoftDeleteMixin, proceed with hard delete
				return next.Mutate(ctx, m)
			}

			// Get IDs to soft-delete
			ids, err := sdm.IDs(ctx)
			if err != nil {
				return nil, fmt.Errorf("soft-delete: failed to get IDs: %w", err)
			}

			if len(ids) == 0 {
				return nil, nil
			}

			// Execute soft-delete using reflection to call the correct Update method
			entityType := m.Type()
			now := time.Now()

			for _, id := range ids {
				if err := softDeleteByReflection(ctx, client, entityType, id, now); err != nil {
					return nil, err
				}
			}

			// Return count of affected rows (Delete operations expect int, not entity)
			return len(ids), nil
		})
	}

	// Apply hook to all entities
	client.Use(hook)
}

// softDeleteByReflection uses reflection to call client.<EntityType>.UpdateOneID(id).SetDeletedAt(now).Save(ctx)
func softDeleteByReflection(ctx context.Context, client *entclient.Client, entityType string, id uuid.UUID, deletedAt time.Time) error {
	// Get the entity client field (e.g., client.Strategy)
	clientValue := reflect.ValueOf(client).Elem()
	entityClient := clientValue.FieldByName(entityType)

	if !entityClient.IsValid() {
		return fmt.Errorf("soft-delete: unknown entity type %q", entityType)
	}

	// Call UpdateOneID(id)
	updateMethod := entityClient.MethodByName("UpdateOneID")
	if !updateMethod.IsValid() {
		return fmt.Errorf("soft-delete: entity %q has no UpdateOneID method", entityType)
	}

	updateBuilder := updateMethod.Call([]reflect.Value{reflect.ValueOf(id)})[0]

	// Call SetDeletedAt(deletedAt)
	setDeletedAt := updateBuilder.MethodByName("SetDeletedAt")
	if !setDeletedAt.IsValid() {
		return fmt.Errorf("soft-delete: entity %q has no SetDeletedAt method", entityType)
	}

	updateBuilder = setDeletedAt.Call([]reflect.Value{reflect.ValueOf(deletedAt)})[0]

	// Call Save(ctx)
	saveMethod := updateBuilder.MethodByName("Save")
	if !saveMethod.IsValid() {
		return fmt.Errorf("soft-delete: entity %q update builder has no Save method", entityType)
	}

	results := saveMethod.Call([]reflect.Value{reflect.ValueOf(ctx)})

	// Check for error (second return value)
	if len(results) >= 2 && !results[1].IsNil() {
		if err, ok := results[1].Interface().(error); ok {
			return err
		}
	}

	return nil
}
