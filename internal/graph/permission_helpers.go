package graph

import (
	"context"
	"fmt"
	"sync"
	"time"

	"volaticloud/internal/authz"
	"volaticloud/internal/ent"
)

// syncInProgress tracks in-flight sync operations to prevent concurrent syncs of the same resource.
// Key is resourceID, value is a channel that signals completion.
var syncInProgress sync.Map

// syncFailures tracks failed sync attempts to prevent infinite retry loops.
// Key is resourceID, value is the timestamp of the last failed sync.
var syncFailures sync.Map

const syncFailureCooldown = 5 * time.Minute // Don't retry failed syncs within 5 minutes

// SyncResourceScopes is a thin wrapper around authz.SyncResourcePermissions with deduplication.
// It extracts the UMA client from the GraphQL context and delegates to the authz package.
// This function prevents concurrent syncs of the same resource using a sync.Map.
// If a sync is already in progress for a resource, subsequent calls will wait for it to complete.
// It also tracks failed syncs to prevent infinite retry loops (5-minute cooldown).
func SyncResourceScopes(ctx context.Context, client *ent.Client, resourceID string) error {
	// Get UMA client from GraphQL context
	umaClient := GetUMAClientFromContext(ctx)
	if umaClient == nil {
		return fmt.Errorf("UMA client not available")
	}

	// Check if we recently failed to sync this resource
	if lastFailure, ok := syncFailures.Load(resourceID); ok {
		failureTime, ok := lastFailure.(time.Time)
		if ok && time.Since(failureTime) < syncFailureCooldown {
			// Still in cooldown period, don't retry
			return fmt.Errorf("sync recently failed for resource %s, retry after %v",
				resourceID, syncFailureCooldown-time.Since(failureTime))
		}
	}

	// Try to load or store a channel for this resource
	doneCh := make(chan struct{})
	actual, loaded := syncInProgress.LoadOrStore(resourceID, doneCh)

	if loaded {
		// Another goroutine is already syncing this resource, wait for it
		existingCh, ok := actual.(chan struct{})
		if !ok {
			return fmt.Errorf("unexpected type in sync map for resource %s", resourceID)
		}
		select {
		case <-existingCh:
			// Sync completed by another goroutine
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	}

	// We're the first to sync this resource, do it and signal others
	defer func() {
		close(doneCh)
		syncInProgress.Delete(resourceID)
	}()

	// Delegate to authz package for the actual sync logic
	err := authz.SyncResourcePermissions(ctx, client, umaClient, resourceID)

	if err != nil {
		// Track this failure to prevent infinite retry loops
		syncFailures.Store(resourceID, time.Now())
	} else {
		// Clear any previous failure on success
		syncFailures.Delete(resourceID)
	}

	return err
}
