package authz

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"volaticloud/internal/ent"
	"volaticloud/internal/keycloak"
)

// VerifyPermission checks if user has permission on a resource via UMA
func VerifyPermission(
	ctx context.Context,
	umaClient *keycloak.UMAClient,
	resourceID, userToken, scope string,
) (bool, error) {
	if umaClient == nil {
		return false, fmt.Errorf("UMA client not available - authorization required")
	}

	hasPermission, err := umaClient.CheckPermission(ctx, userToken, resourceID, scope)
	if err != nil {
		return false, fmt.Errorf("permission check failed: %w", err)
	}

	return hasPermission, nil
}

// VerifyResourcePermission dynamically determines the resource type and verifies permission
func VerifyResourcePermission(
	ctx context.Context,
	client *ent.Client,
	umaClient *keycloak.UMAClient,
	resourceID, userToken, scope string,
) (bool, error) {
	id, err := uuid.Parse(resourceID)
	if err != nil {
		return false, fmt.Errorf("invalid resource ID: %w", err)
	}

	// Verify resource exists (any type)
	exists := false
	if _, err := client.Strategy.Get(ctx, id); err == nil {
		exists = true
	} else if _, err := client.Bot.Get(ctx, id); err == nil {
		exists = true
	} else if _, err := client.Exchange.Get(ctx, id); err == nil {
		exists = true
	} else if _, err := client.BotRunner.Get(ctx, id); err == nil {
		exists = true
	}

	if !exists {
		return false, fmt.Errorf("resource not found: %s", resourceID)
	}

	// All resource types use the same UMA permission check
	return VerifyPermission(ctx, umaClient, resourceID, userToken, scope)
}
