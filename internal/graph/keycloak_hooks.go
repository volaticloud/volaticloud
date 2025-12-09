package graph

import (
	"context"
	"fmt"
	"log"

	"volaticloud/internal/ent"
	"volaticloud/internal/keycloak"

	"github.com/google/uuid"
)

// ============================================================================
// Permission Verification Functions
// ============================================================================

// VerifyStrategyOwnership checks if the user owns the strategy
// This is a fast local check before hitting Keycloak UMA
func VerifyStrategyOwnership(ctx context.Context, client *ent.Client, strategyID, userID string) (bool, error) {
	id, err := uuid.Parse(strategyID)
	if err != nil {
		return false, fmt.Errorf("invalid strategy ID: %w", err)
	}

	strategy, err := client.Strategy.Get(ctx, id)
	if err != nil {
		return false, fmt.Errorf("strategy not found: %w", err)
	}

	return strategy.OwnerID == userID, nil
}

// VerifyStrategyPermission checks if user has permission via UMA
// UMA client is required - no fallback
func VerifyStrategyPermission(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	strategyID, userToken, scope string,
) (bool, error) {
	// UMA client is always configured (server won't start without it)
	if umaClient == nil {
		return false, fmt.Errorf("UMA client not available - authorization required")
	}

	// Check permission via Keycloak UMA
	hasPermission, err := umaClient.CheckPermission(ctx, userToken, strategyID, scope)
	if err != nil {
		return false, fmt.Errorf("permission check failed: %w", err)
	}

	return hasPermission, nil
}

// VerifyBotOwnership checks if the user owns the bot
// This is a fast local check before hitting Keycloak UMA
func VerifyBotOwnership(ctx context.Context, client *ent.Client, botID, userID string) (bool, error) {
	id, err := uuid.Parse(botID)
	if err != nil {
		return false, fmt.Errorf("invalid bot ID: %w", err)
	}

	bot, err := client.Bot.Get(ctx, id)
	if err != nil {
		return false, fmt.Errorf("bot not found: %w", err)
	}

	return bot.OwnerID == userID, nil
}

// VerifyBotPermission checks if user has permission via UMA
// UMA client is required - no fallback
func VerifyBotPermission(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	botID, userToken, scope string,
) (bool, error) {
	// UMA client is always configured (server won't start without it)
	if umaClient == nil {
		return false, fmt.Errorf("UMA client not available - authorization required")
	}

	// Check permission via Keycloak UMA
	hasPermission, err := umaClient.CheckPermission(ctx, userToken, botID, scope)
	if err != nil {
		return false, fmt.Errorf("permission check failed: %w", err)
	}

	return hasPermission, nil
}

// VerifyExchangeOwnership checks if the user owns the exchange
// This is a fast local check before hitting Keycloak UMA
func VerifyExchangeOwnership(ctx context.Context, client *ent.Client, exchangeID, userID string) (bool, error) {
	id, err := uuid.Parse(exchangeID)
	if err != nil {
		return false, fmt.Errorf("invalid exchange ID: %w", err)
	}

	exchange, err := client.Exchange.Get(ctx, id)
	if err != nil {
		return false, fmt.Errorf("exchange not found: %w", err)
	}

	return exchange.OwnerID == userID, nil
}

// VerifyExchangePermission checks if user has permission via UMA
// UMA client is required - no fallback
func VerifyExchangePermission(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	exchangeID, userToken, scope string,
) (bool, error) {
	// UMA client is always configured (server won't start without it)
	if umaClient == nil {
		return false, fmt.Errorf("UMA client not available - authorization required")
	}

	// Check permission via Keycloak UMA
	hasPermission, err := umaClient.CheckPermission(ctx, userToken, exchangeID, scope)
	if err != nil {
		return false, fmt.Errorf("permission check failed: %w", err)
	}

	return hasPermission, nil
}

// VerifyBotRunnerOwnership checks if the user owns the bot runner
// This is a fast local check before hitting Keycloak UMA
func VerifyBotRunnerOwnership(ctx context.Context, client *ent.Client, runnerID, userID string) (bool, error) {
	id, err := uuid.Parse(runnerID)
	if err != nil {
		return false, fmt.Errorf("invalid bot runner ID: %w", err)
	}

	runner, err := client.BotRunner.Get(ctx, id)
	if err != nil {
		return false, fmt.Errorf("bot runner not found: %w", err)
	}

	return runner.OwnerID == userID, nil
}

// VerifyBotRunnerPermission checks if user has permission via UMA
// UMA client is required - no fallback
func VerifyBotRunnerPermission(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	runnerID, userToken, scope string,
) (bool, error) {
	// UMA client is always configured (server won't start without it)
	if umaClient == nil {
		return false, fmt.Errorf("UMA client not available - authorization required")
	}

	// Check permission via Keycloak UMA
	hasPermission, err := umaClient.CheckPermission(ctx, userToken, runnerID, scope)
	if err != nil {
		return false, fmt.Errorf("permission check failed: %w", err)
	}

	return hasPermission, nil
}

// ============================================================================
// Resource Attribute Helpers
// ============================================================================

// buildResourceAttributes creates the standard attribute map for Keycloak resources
// ownerID is the group ID that owns the resource
// resourceType is the type of resource (strategy, bot, exchange, bot_runner)
// isPublic indicates if the resource should be publicly visible
func buildResourceAttributes(ownerID, resourceType string, isPublic bool) map[string][]string {
	attrs := map[string][]string{
		"ownerId": {ownerID},
		"type":    {resourceType},
	}
	if isPublic {
		attrs["public"] = []string{"true"}
	}
	return attrs
}

// ============================================================================
// Visibility Update Functions
// ============================================================================

// UpdateStrategyVisibility updates both DB and Keycloak for strategy visibility
func UpdateStrategyVisibility(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	strategyID string,
	isPublic bool,
) (*ent.Strategy, error) {
	// Parse string UUID
	id, err := uuid.Parse(strategyID)
	if err != nil {
		return nil, fmt.Errorf("invalid strategy ID: %w", err)
	}

	// Get strategy first to get owner_id
	existingStrategy, err := client.Strategy.Get(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("strategy not found: %w", err)
	}
	ownerID := existingStrategy.OwnerID

	// Update database
	strategy, err := client.Strategy.UpdateOneID(id).
		SetPublic(isPublic).
		Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to update strategy visibility: %w", err)
	}

	// Update Keycloak resource attributes
	if umaClient != nil {
		attrs := buildResourceAttributes(ownerID, "strategy", isPublic)
		if err := umaClient.UpdateResource(ctx, strategyID, attrs); err != nil {
			log.Printf("Warning: failed to update Keycloak resource for strategy %s: %v", strategyID, err)
			// Don't fail the operation - DB is the source of truth
		}
	}

	log.Printf("Updated strategy %s visibility to public=%v", strategyID, isPublic)
	return strategy, nil
}

// UpdateBotVisibility updates both DB and Keycloak for bot visibility
func UpdateBotVisibility(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	botID string,
	isPublic bool,
) (*ent.Bot, error) {
	// Parse string UUID
	id, err := uuid.Parse(botID)
	if err != nil {
		return nil, fmt.Errorf("invalid bot ID: %w", err)
	}

	// Get bot first to get owner_id
	existingBot, err := client.Bot.Get(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("bot not found: %w", err)
	}
	ownerID := existingBot.OwnerID

	// Update database
	bot, err := client.Bot.UpdateOneID(id).
		SetPublic(isPublic).
		Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to update bot visibility: %w", err)
	}

	// Update Keycloak resource attributes
	if umaClient != nil {
		attrs := buildResourceAttributes(ownerID, "bot", isPublic)
		if err := umaClient.UpdateResource(ctx, botID, attrs); err != nil {
			log.Printf("Warning: failed to update Keycloak resource for bot %s: %v", botID, err)
			// Don't fail the operation - DB is the source of truth
		}
	}

	log.Printf("Updated bot %s visibility to public=%v", botID, isPublic)
	return bot, nil
}

// UpdateBotRunnerVisibility updates both DB and Keycloak for runner visibility
func UpdateBotRunnerVisibility(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	runnerID string,
	isPublic bool,
) (*ent.BotRunner, error) {
	// Parse string UUID
	id, err := uuid.Parse(runnerID)
	if err != nil {
		return nil, fmt.Errorf("invalid runner ID: %w", err)
	}

	// Get runner first to get owner_id
	existingRunner, err := client.BotRunner.Get(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("runner not found: %w", err)
	}
	ownerID := existingRunner.OwnerID

	// Update database
	runner, err := client.BotRunner.UpdateOneID(id).
		SetPublic(isPublic).
		Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to update runner visibility: %w", err)
	}

	// Update Keycloak resource attributes
	if umaClient != nil {
		attrs := buildResourceAttributes(ownerID, "bot_runner", isPublic)
		if err := umaClient.UpdateResource(ctx, runnerID, attrs); err != nil {
			log.Printf("Warning: failed to update Keycloak resource for runner %s: %v", runnerID, err)
			// Don't fail the operation - DB is the source of truth
		}
	}

	log.Printf("Updated runner %s visibility to public=%v", runnerID, isPublic)
	return runner, nil
}
