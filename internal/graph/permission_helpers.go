package graph

import (
	"context"
	"fmt"

	"volaticloud/internal/authz"
	"volaticloud/internal/ent"
)

// SyncResourceScopes is a thin wrapper around authz.SyncResourcePermissions.
// It extracts the UMA client from the GraphQL context and delegates to the authz package.
// This is used by the checkPermissions resolver to implement self-healing scope sync.
func SyncResourceScopes(ctx context.Context, client *ent.Client, resourceID string) error {
	// Get UMA client from GraphQL context
	umaClient := GetUMAClientFromContext(ctx)
	if umaClient == nil {
		return fmt.Errorf("UMA client not available")
	}

	// Delegate to authz package for the actual sync logic
	return authz.SyncResourcePermissions(ctx, client, umaClient, resourceID)
}
