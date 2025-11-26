// Package db provides database utilities for ENT ORM
package db

import (
	"context"
	"fmt"

	"volaticloud/internal/ent"
)

// WithTx wraps a function in a database transaction following ENT best practices.
// It handles transaction creation, commit, rollback, and panic recovery.
//
// Usage:
//
//	err := WithTx(ctx, client, func(tx *ent.Tx) error {
//	    // Your transactional code here
//	    return tx.User.Create().SetName("foo").Exec(ctx)
//	})
//
// If the function returns an error, the transaction is rolled back.
// If a panic occurs, the transaction is rolled back and the panic is re-raised.
// If the function completes successfully, the transaction is committed.
func WithTx(ctx context.Context, client *ent.Client, fn func(tx *ent.Tx) error) error {
	tx, err := client.Tx(ctx)
	if err != nil {
		return err
	}

	// Defer handles both panics and rollbacks
	defer func() {
		if v := recover(); v != nil {
			//nolint:errcheck // Rollback on panic is best-effort
			tx.Rollback()
			panic(v)
		}
	}()

	// Execute the function
	if err := fn(tx); err != nil {
		// Attempt rollback and wrap errors
		if rerr := tx.Rollback(); rerr != nil {
			err = fmt.Errorf("%w: rolling back transaction: %v", err, rerr)
		}
		return err
	}

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}
