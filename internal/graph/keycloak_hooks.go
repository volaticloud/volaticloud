package graph

import (
	"context"
	"fmt"
	"log"

	"github.com/google/uuid"
	"volaticloud/internal/ent"
	strategyPredicate "volaticloud/internal/ent/strategy"
	"volaticloud/internal/keycloak"
)

// StrategyScopes defines the available permission scopes for Strategy resources
// Includes backtest lifecycle scopes since backtests inherit permissions from their parent strategy
var StrategyScopes = []string{"view", "edit", "delete", "run-backtest", "stop-backtest", "delete-backtest"}

// BotScopes defines the available permission scopes for Bot resources
var BotScopes = []string{"view", "run", "stop", "delete", "edit"}

// ExchangeScopes defines the available permission scopes for Exchange resources
var ExchangeScopes = []string{"view", "edit", "delete"}

// BotRunnerScopes defines the available permission scopes for BotRunner resources
var BotRunnerScopes = []string{"view", "edit", "delete", "make-public"}

// CreateStrategyWithResource creates a Strategy entity and registers it as a Keycloak resource
// Uses database-first approach with transaction rollback on Keycloak failure
func CreateStrategyWithResource(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	input ent.CreateStrategyInput,
	ownerID string,
) (*ent.Strategy, error) {
	// Database-first approach: Create Strategy within transaction
	var strategy *ent.Strategy
	err := WithTx(ctx, client, func(tx *ent.Tx) error {
		// Create Strategy in database using transaction client
		var err error
		strategy, err = tx.Strategy.Create().
			SetInput(input).
			SetOwnerID(ownerID).
			Save(ctx)
		if err != nil {
			return fmt.Errorf("failed to create strategy: %w", err)
		}

		// If UMA client is configured, create Keycloak resource
		if umaClient != nil {
			resourceName := fmt.Sprintf("%s (v%d)", strategy.Name, strategy.VersionNumber)

			// Set resource attributes: ownerId (group) and type
			attributes := map[string][]string{
				"ownerId": {ownerID}, // ownerID is now the group ID
				"type":    {"strategy"},
			}

			err = umaClient.CreateResource(ctx, strategy.ID.String(), resourceName, StrategyScopes, attributes)
			if err != nil {
				// Keycloak resource creation failed - rollback transaction
				log.Printf("Failed to create Keycloak resource for strategy %s: %v", strategy.ID, err)
				return fmt.Errorf("failed to create Keycloak resource (transaction will rollback): %w", err)
			}

		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	log.Printf("Successfully created strategy %s with Keycloak resource", strategy.ID)
	return strategy, nil
}

// DeleteStrategyWithResource deletes a Strategy entity and removes its Keycloak resource
// Also deletes associated backtest (cascade delete)
// Deletion is more forgiving - Keycloak cleanup failure is logged but doesn't block DB deletion
func DeleteStrategyWithResource(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	strategyID string,
) error {
	// Parse string UUID
	id, err := uuid.Parse(strategyID)
	if err != nil {
		return fmt.Errorf("invalid strategy ID: %w", err)
	}

	// Load strategy with backtest to check for cascade delete
	strategy, err := client.Strategy.Query().
		Where(strategyPredicate.ID(id)).
		WithBacktest().
		Only(ctx)
	if err != nil {
		return fmt.Errorf("failed to load strategy: %w", err)
	}

	// Delete associated backtest first (cascade delete)
	if strategy.Edges.Backtest != nil {
		err = client.Backtest.DeleteOneID(strategy.Edges.Backtest.ID).Exec(ctx)
		if err != nil {
			return fmt.Errorf("failed to delete associated backtest: %w", err)
		}
		log.Printf("Deleted backtest %s associated with strategy %s", strategy.Edges.Backtest.ID, strategyID)
	}

	// Delete strategy from database
	err = client.Strategy.DeleteOneID(id).Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to delete strategy: %w", err)
	}

	// Attempt to delete Keycloak resource (best effort)
	if umaClient != nil {
		err = umaClient.DeleteResource(ctx, strategyID)
		if err != nil {
			// Log but don't fail - database deletion already succeeded
			log.Printf("Warning: Strategy %s deleted from database but Keycloak cleanup failed: %v", strategyID, err)
		}
	}

	log.Printf("Successfully deleted strategy %s and cleaned up Keycloak resource", strategyID)
	return nil
}

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

// SyncStrategyVersionResource creates Keycloak resource for a new strategy version
// Used when UpdateStrategy creates a new version
func SyncStrategyVersionResource(
	ctx context.Context,
	umaClient keycloak.UMAClientInterface,
	strategy *ent.Strategy,
) error {
	if umaClient == nil {
		return nil // UMA not configured
	}

	resourceName := fmt.Sprintf("%s (v%d)", strategy.Name, strategy.VersionNumber)

	// Set resource attributes: ownerId (group) and type
	attributes := map[string][]string{
		"ownerId": {strategy.OwnerID}, // ownerID is the group ID
		"type":    {"strategy"},
	}

	err := umaClient.CreateResource(ctx, strategy.ID.String(), resourceName, StrategyScopes, attributes)
	if err != nil {
		return fmt.Errorf("failed to sync Keycloak resource for strategy version: %w", err)
	}

	log.Printf("Synced Keycloak resource for strategy version %s (v%d)", strategy.ID, strategy.VersionNumber)
	return nil
}

// ============================================================================
// Bot Resource Management
// ============================================================================

// CreateBotWithResource creates a Bot entity and registers it as a Keycloak resource
// Uses database-first approach with transaction rollback on Keycloak failure
func CreateBotWithResource(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	input ent.CreateBotInput,
	ownerID string,
) (*ent.Bot, error) {
	// Database-first approach: Create Bot within transaction
	var bot *ent.Bot
	err := WithTx(ctx, client, func(tx *ent.Tx) error {
		// Create Bot in database using transaction client
		var err error
		bot, err = tx.Bot.Create().
			SetInput(input).
			SetOwnerID(ownerID).
			Save(ctx)
		if err != nil {
			return fmt.Errorf("failed to create bot: %w", err)
		}

		// If UMA client is configured, create Keycloak resource
		if umaClient != nil {
			resourceName := bot.Name

			// Set resource attributes: ownerId (group) and type
			attributes := map[string][]string{
				"ownerId": {ownerID},
				"type":    {"bot"},
			}

			err = umaClient.CreateResource(ctx, bot.ID.String(), resourceName, BotScopes, attributes)
			if err != nil {
				// Keycloak resource creation failed - rollback transaction
				log.Printf("Failed to create Keycloak resource for bot %s: %v", bot.ID, err)
				return fmt.Errorf("failed to create Keycloak resource (transaction will rollback): %w", err)
			}

		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	log.Printf("Successfully created bot %s with Keycloak resource", bot.ID)
	return bot, nil
}

// DeleteBotWithResource deletes a Bot entity and removes its Keycloak resource
// Deletion is more forgiving - Keycloak cleanup failure is logged but doesn't block DB deletion
func DeleteBotWithResource(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	botID string,
) error {
	// Parse string UUID
	id, err := uuid.Parse(botID)
	if err != nil {
		return fmt.Errorf("invalid bot ID: %w", err)
	}

	// Delete from database first
	err = client.Bot.DeleteOneID(id).Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to delete bot: %w", err)
	}

	// Attempt to delete Keycloak resource (best effort)
	if umaClient != nil {
		err = umaClient.DeleteResource(ctx, botID)
		if err != nil {
			// Log but don't fail - database deletion already succeeded
			log.Printf("Warning: Bot %s deleted from database but Keycloak cleanup failed: %v", botID, err)
		}
	}

	log.Printf("Successfully deleted bot %s and cleaned up Keycloak resource", botID)
	return nil
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

// ============================================================================
// Exchange Resource Management
// ============================================================================

// CreateExchangeWithResource creates an Exchange entity and registers it as a Keycloak resource
// Uses database-first approach with transaction rollback on Keycloak failure
func CreateExchangeWithResource(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	input ent.CreateExchangeInput,
	ownerID string,
) (*ent.Exchange, error) {
	// Database-first approach: Create Exchange within transaction
	var exchange *ent.Exchange
	err := WithTx(ctx, client, func(tx *ent.Tx) error {
		// Create Exchange in database using transaction client
		var err error
		exchange, err = tx.Exchange.Create().
			SetInput(input).
			SetOwnerID(ownerID).
			Save(ctx)
		if err != nil {
			return fmt.Errorf("failed to create exchange: %w", err)
		}

		// If UMA client is configured, create Keycloak resource
		if umaClient != nil {
			resourceName := exchange.Name

			// Set resource attributes: ownerId (group) and type
			attributes := map[string][]string{
				"ownerId": {ownerID},
				"type":    {"exchange"},
			}

			err = umaClient.CreateResource(ctx, exchange.ID.String(), resourceName, ExchangeScopes, attributes)
			if err != nil {
				// Keycloak resource creation failed - rollback transaction
				log.Printf("Failed to create Keycloak resource for exchange %s: %v", exchange.ID, err)
				return fmt.Errorf("failed to create Keycloak resource (transaction will rollback): %w", err)
			}

		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	log.Printf("Successfully created exchange %s with Keycloak resource", exchange.ID)
	return exchange, nil
}

// DeleteExchangeWithResource deletes an Exchange entity and removes its Keycloak resource
// Deletion is more forgiving - Keycloak cleanup failure is logged but doesn't block DB deletion
func DeleteExchangeWithResource(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	exchangeID string,
) error {
	// Parse string UUID
	id, err := uuid.Parse(exchangeID)
	if err != nil {
		return fmt.Errorf("invalid exchange ID: %w", err)
	}

	// Delete from database first
	err = client.Exchange.DeleteOneID(id).Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to delete exchange: %w", err)
	}

	// Attempt to delete Keycloak resource (best effort)
	if umaClient != nil {
		err = umaClient.DeleteResource(ctx, exchangeID)
		if err != nil {
			// Log but don't fail - database deletion already succeeded
			log.Printf("Warning: Exchange %s deleted from database but Keycloak cleanup failed: %v", exchangeID, err)
		}
	}

	log.Printf("Successfully deleted exchange %s and cleaned up Keycloak resource", exchangeID)
	return nil
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

// ============================================================================
// BotRunner Resource Management
// ============================================================================

// CreateBotRunnerWithResource creates a BotRunner entity and registers it as a Keycloak resource
// Uses database-first approach with transaction rollback on Keycloak failure
func CreateBotRunnerWithResource(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	input ent.CreateBotRunnerInput,
	ownerID string,
) (*ent.BotRunner, error) {
	// Database-first approach: Create BotRunner within transaction
	var runner *ent.BotRunner
	err := WithTx(ctx, client, func(tx *ent.Tx) error {
		// Create BotRunner in database using transaction client
		var err error
		runner, err = tx.BotRunner.Create().
			SetInput(input).
			SetOwnerID(ownerID).
			Save(ctx)
		if err != nil {
			return fmt.Errorf("failed to create bot runner: %w", err)
		}

		// If UMA client is configured, create Keycloak resource
		if umaClient != nil {
			resourceName := runner.Name

			// Set resource attributes: ownerId (group) and type
			attributes := map[string][]string{
				"ownerId": {ownerID},
				"type":    {"bot_runner"},
			}

			err = umaClient.CreateResource(ctx, runner.ID.String(), resourceName, BotRunnerScopes, attributes)
			if err != nil {
				// Keycloak resource creation failed - rollback transaction
				log.Printf("Failed to create Keycloak resource for bot runner %s: %v", runner.ID, err)
				return fmt.Errorf("failed to create Keycloak resource (transaction will rollback): %w", err)
			}

		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	log.Printf("Successfully created bot runner %s with Keycloak resource", runner.ID)
	return runner, nil
}

// DeleteBotRunnerWithResource deletes a BotRunner entity and removes its Keycloak resource
// Deletion is more forgiving - Keycloak cleanup failure is logged but doesn't block DB deletion
func DeleteBotRunnerWithResource(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	runnerID string,
) error {
	// Parse string UUID
	id, err := uuid.Parse(runnerID)
	if err != nil {
		return fmt.Errorf("invalid bot runner ID: %w", err)
	}

	// Delete from database first
	err = client.BotRunner.DeleteOneID(id).Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to delete bot runner: %w", err)
	}

	// Attempt to delete Keycloak resource (best effort)
	if umaClient != nil {
		err = umaClient.DeleteResource(ctx, runnerID)
		if err != nil {
			// Log but don't fail - database deletion already succeeded
			log.Printf("Warning: BotRunner %s deleted from database but Keycloak cleanup failed: %v", runnerID, err)
		}
	}

	log.Printf("Successfully deleted bot runner %s and cleaned up Keycloak resource", runnerID)
	return nil
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
