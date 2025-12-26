package mixin

import (
	"context"
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/sql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/mixin"

	"volaticloud/internal/ent/intercept"
)

// SoftDeleteMixin implements soft-delete pattern for ENT entities.
// Instead of permanently deleting records, it sets a deleted_at timestamp.
//
// # Architecture
//
// The soft-delete implementation has two parts:
//  1. This mixin: Provides schema-level features (deleted_at field, query filtering)
//  2. Runtime hooks in db.SetupSoftDelete(): Intercepts Delete() calls and converts to UPDATE
//
// # Features
//
//   - Adds deleted_at field (nullable timestamp)
//   - Automatically filters out soft-deleted records on queries (interceptors)
//   - Automatically converts Delete() to UPDATE SET deleted_at (runtime hooks)
//   - Supports including deleted records via context key
//
// # Usage in schema
//
//	func (MySchema) Mixin() []ent.Mixin {
//	    return []ent.Mixin{
//	        mixin.SoftDeleteMixin{},
//	    }
//	}
//
// # Runtime hook setup (in main.go after ent.Open())
//
//	client, _ := ent.Open(driver, dsn)
//	db.SetupSoftDelete(client)  // Enables automatic soft-delete for Delete() calls
//
// # Deleting records
//
// With runtime hooks configured, Delete() automatically soft-deletes:
//
//	client.Entity.DeleteOneID(id).Exec(ctx)  // Sets deleted_at = now
//
// To include deleted records in queries:
//
//	ctx := mixin.IncludeDeleted(ctx)
//	entities, err := client.Entity.Query().All(ctx)
//
// To hard delete (permanent):
//
//	ctx := db.WithHardDelete(ctx)
//	ctx = mixin.IncludeDeleted(ctx) // needed to find soft-deleted records
//	client.Entity.DeleteOneID(id).Exec(ctx)
type SoftDeleteMixin struct {
	mixin.Schema
}

// softDeleteKey is the context key for including deleted records.
type softDeleteKey struct{}

// IncludeDeleted returns a context that includes soft-deleted records in queries
// and enables queries to find soft-deleted entities (for hard delete or restore).
func IncludeDeleted(ctx context.Context) context.Context {
	return context.WithValue(ctx, softDeleteKey{}, true)
}

// isIncludeDeleted checks if the context allows soft-deleted records.
func isIncludeDeleted(ctx context.Context) bool {
	include, ok := ctx.Value(softDeleteKey{}).(bool)
	return ok && include
}

// Fields returns the deleted_at field for soft-delete.
func (SoftDeleteMixin) Fields() []ent.Field {
	return []ent.Field{
		field.Time("deleted_at").
			Optional().
			Nillable().
			Comment("Soft-delete timestamp. If set, record is considered deleted."),
	}
}

// Interceptors returns the soft-delete interceptors.
// These interceptors filter out soft-deleted records on queries (unless IncludeDeleted is set).
func (SoftDeleteMixin) Interceptors() []ent.Interceptor {
	return []ent.Interceptor{
		intercept.TraverseFunc(func(ctx context.Context, q intercept.Query) error {
			// Skip filtering if context includes deleted records
			if isIncludeDeleted(ctx) {
				return nil
			}
			// Apply soft-delete filter: WHERE deleted_at IS NULL
			q.WhereP(func(s *sql.Selector) {
				s.Where(sql.IsNull(s.C("deleted_at")))
			})
			return nil
		}),
	}
}

// Now returns current time for soft-delete operations.
// Convenient helper for: client.Entity.UpdateOneID(id).SetDeletedAt(mixin.Now()).Save(ctx)
func Now() time.Time {
	return time.Now()
}
