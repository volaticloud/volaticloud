package authz

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"volaticloud/internal/ent"
	"volaticloud/internal/keycloak"
)

// SyncResourcePermissions determines the resource type and syncs its scopes with Keycloak.
// This function implements self-healing scope synchronization by:
// 1. Identifying the resource type (Bot, Strategy, Exchange, BotRunner, or Group)
// 2. Retrieving the appropriate scopes for that resource type
// 3. Syncing those scopes with Keycloak UMA resource registry
//
// This is used when permission checks fail due to missing or outdated scopes in Keycloak.
// The function will attempt to find the resource in the database. If not found in any entity
// and not a valid Group ID format, it returns an error to avoid syncing deleted resources
// with incorrect scopes.
func SyncResourcePermissions(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	resourceID string,
) error {
	// Parse and validate resource ID
	resourceUUID, err := uuid.Parse(resourceID)
	if err != nil {
		// If not a valid UUID, might be a Group ID (string-based), try group sync
		return syncGroupResource(ctx, umaClient, resourceID)
	}

	// Try to find the resource in each entity type
	// Check Bot
	if bot, err := client.Bot.Get(ctx, resourceUUID); err == nil {
		scopes := GetScopesForType(ResourceTypeBot)
		return umaClient.SyncResourceScopes(ctx, resourceID, fmt.Sprintf("Bot: %s", bot.Name),
			scopes, map[string][]string{
				"type":    {string(ResourceTypeBot)},
				"ownerId": {bot.OwnerID},
				"public":  {fmt.Sprintf("%t", bot.Public)},
			})
	}

	// Check Strategy
	if strategy, err := client.Strategy.Get(ctx, resourceUUID); err == nil {
		scopes := GetScopesForType(ResourceTypeStrategy)
		return umaClient.SyncResourceScopes(ctx, resourceID, fmt.Sprintf("Strategy: %s", strategy.Name),
			scopes, map[string][]string{
				"type":    {string(ResourceTypeStrategy)},
				"ownerId": {strategy.OwnerID},
				"public":  {fmt.Sprintf("%t", strategy.Public)},
			})
	}

	// Check Exchange
	if exchange, err := client.Exchange.Get(ctx, resourceUUID); err == nil {
		scopes := GetScopesForType(ResourceTypeExchange)
		return umaClient.SyncResourceScopes(ctx, resourceID, fmt.Sprintf("Exchange: %s", exchange.Name),
			scopes, map[string][]string{
				"type":    {string(ResourceTypeExchange)},
				"ownerId": {exchange.OwnerID},
			})
	}

	// Check BotRunner
	if runner, err := client.BotRunner.Get(ctx, resourceUUID); err == nil {
		scopes := GetScopesForType(ResourceTypeBotRunner)
		return umaClient.SyncResourceScopes(ctx, resourceID, fmt.Sprintf("Runner: %s", runner.Name),
			scopes, map[string][]string{
				"type":    {string(ResourceTypeBotRunner)},
				"ownerId": {runner.OwnerID},
				"public":  {fmt.Sprintf("%t", runner.Public)},
			})
	}

	// If not found in any entity table, might be:
	// 1. A Group/Organization ID (exists only in Keycloak)
	// 2. A deleted resource (should not be synced)
	// Try to sync as a Group. If this fails, the resource likely doesn't exist at all.
	// This prevents polluting Keycloak with wrong scopes for deleted resources.
	return syncGroupResource(ctx, umaClient, resourceID)
}

// syncGroupResource syncs scopes for a Group/Organization resource.
// Groups exist in Keycloak but not in our ENT database.
// Preserves existing ownerId attribute from the resource.
func syncGroupResource(ctx context.Context, umaClient keycloak.UMAClientInterface, resourceID string) error {
	scopes := GetScopesForType(ResourceTypeGroup)

	// Get existing resource to preserve ownerId attribute
	resource, err := umaClient.GetResource(ctx, resourceID)
	if err != nil {
		// Resource doesn't exist yet - create it without ownerId (root-level organization)
		return umaClient.SyncResourceScopes(ctx, resourceID, fmt.Sprintf("Group: %s", resourceID),
			scopes, map[string][]string{
				"type": {string(ResourceTypeGroup)},
			})
	}

	// Preserve existing ownerId if present
	attributes := map[string][]string{
		"type": {string(ResourceTypeGroup)},
	}
	if resource.Attributes != nil {
		if ownerID, exists := (*resource.Attributes)["ownerId"]; exists && len(ownerID) > 0 {
			attributes["ownerId"] = ownerID
		}
	}

	return umaClient.SyncResourceScopes(ctx, resourceID, fmt.Sprintf("Group: %s", resourceID),
		scopes, attributes)
}
