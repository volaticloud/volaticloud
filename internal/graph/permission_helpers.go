package graph

import (
	"context"
	"fmt"
	"sync"

	"volaticloud/internal/authz"
	"volaticloud/internal/ent"
)

// syncInProgress tracks in-flight sync operations to prevent concurrent syncs of the same resource.
// Key is resourceID, value is a channel that signals completion.
var syncInProgress sync.Map

// SyncResourceScopes is a thin wrapper around authz.SyncResourcePermissions with deduplication.
// It extracts the UMA client from the GraphQL context and delegates to the authz package.
// This function prevents concurrent syncs of the same resource using a sync.Map.
// If a sync is already in progress for a resource, subsequent calls will wait for it to complete.
func SyncResourceScopes(ctx context.Context, client *ent.Client, resourceID string) error {
	// Get UMA client from GraphQL context
	umaClient := GetUMAClientFromContext(ctx)
	if umaClient == nil {
		return fmt.Errorf("UMA client not available")
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
	return authz.SyncResourcePermissions(ctx, client, umaClient, resourceID)
}
