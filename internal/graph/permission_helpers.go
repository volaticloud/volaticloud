package graph

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"volaticloud/internal/authz"
	"volaticloud/internal/ent"
)

// SyncResourceScopes determines the resource type and syncs its scopes with Keycloak.
// This is used by the checkPermissions resolver to implement self-healing scope sync.
func SyncResourceScopes(ctx context.Context, client *ent.Client, resourceID string) error {
	resourceUUID, err := uuid.Parse(resourceID)
	if err != nil {
		return fmt.Errorf("invalid resource ID: %w", err)
	}

	// Get UMA client
	umaClient := GetUMAClientFromContext(ctx)
	if umaClient == nil {
		return fmt.Errorf("UMA client not available")
	}

	// Try to find the resource in each entity type
	// Check Bot
	if bot, err := client.Bot.Get(ctx, resourceUUID); err == nil {
		return umaClient.SyncResourceScopes(ctx, resourceID, fmt.Sprintf("Bot: %s", bot.Name),
			authz.BotScopes, map[string][]string{
				"type":    {string(authz.ResourceTypeBot)},
				"ownerId": {bot.OwnerID},
				"public":  {fmt.Sprintf("%t", bot.Public)},
			})
	}

	// Check Strategy
	if strategy, err := client.Strategy.Get(ctx, resourceUUID); err == nil {
		return umaClient.SyncResourceScopes(ctx, resourceID, fmt.Sprintf("Strategy: %s", strategy.Name),
			authz.StrategyScopes, map[string][]string{
				"type":    {string(authz.ResourceTypeStrategy)},
				"ownerId": {strategy.OwnerID},
				"public":  {fmt.Sprintf("%t", strategy.Public)},
			})
	}

	// Check Exchange
	if exchange, err := client.Exchange.Get(ctx, resourceUUID); err == nil {
		return umaClient.SyncResourceScopes(ctx, resourceID, fmt.Sprintf("Exchange: %s", exchange.Name),
			authz.ExchangeScopes, map[string][]string{
				"type":    {string(authz.ResourceTypeExchange)},
				"ownerId": {exchange.OwnerID},
			})
	}

	// Check BotRunner
	if runner, err := client.BotRunner.Get(ctx, resourceUUID); err == nil {
		return umaClient.SyncResourceScopes(ctx, resourceID, fmt.Sprintf("Runner: %s", runner.Name),
			authz.BotRunnerScopes, map[string][]string{
				"type":    {string(authz.ResourceTypeBotRunner)},
				"ownerId": {runner.OwnerID},
				"public":  {fmt.Sprintf("%t", runner.Public)},
			})
	}

	// If not found in any entity, it might be a Group/Organization ID (not in DB)
	// For groups, we sync with group scopes
	return umaClient.SyncResourceScopes(ctx, resourceID, fmt.Sprintf("Group: %s", resourceID),
		authz.GroupScopes, map[string][]string{
			"type": {string(authz.ResourceTypeGroup)},
		})
}
