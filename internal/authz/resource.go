package authz

import (
	"context"
	"fmt"
	"log"

	"github.com/google/uuid"
	"volaticloud/internal/db"
	"volaticloud/internal/ent"
	"volaticloud/internal/keycloak"
)

// ============================================================================
// Strategy Resource Management
// ============================================================================

// CreateStrategyWithResource creates a Strategy entity and registers it as a Keycloak resource
// Uses database-first approach with transaction rollback on Keycloak failure
func CreateStrategyWithResource(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	input ent.CreateStrategyInput,
	ownerID string,
) (*ent.Strategy, error) {
	var strategy *ent.Strategy
	err := db.WithTx(ctx, client, func(tx *ent.Tx) error {
		var err error
		strategy, err = tx.Strategy.Create().
			SetInput(input).
			SetOwnerID(ownerID).
			Save(ctx)
		if err != nil {
			return fmt.Errorf("failed to create strategy: %w", err)
		}

		if umaClient != nil {
			resourceName := fmt.Sprintf("%s (v%d)", strategy.Name, strategy.VersionNumber)
			attributes := map[string][]string{
				"ownerId": {ownerID},
				"type":    {string(ResourceTypeStrategy)},
			}

			err = umaClient.CreateResource(ctx, strategy.ID.String(), resourceName, StrategyScopes, attributes)
			if err != nil {
				log.Printf("Failed to create Keycloak resource for strategy %s: %v", strategy.ID, err)
				return fmt.Errorf("failed to create Keycloak resource (transaction will rollback): %w", err)
			}

			err = umaClient.CreatePermission(ctx, strategy.ID.String(), strategy.OwnerID)
			if err != nil {
				log.Printf("Failed to create permission policy for strategy %s: %v", strategy.ID, err)
				return fmt.Errorf("failed to create permission policy (transaction will rollback): %w", err)
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
func DeleteStrategyWithResource(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	strategyID string,
) error {
	id, err := uuid.Parse(strategyID)
	if err != nil {
		return fmt.Errorf("invalid strategy ID: %w", err)
	}

	err = client.Strategy.DeleteOneID(id).Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to delete strategy: %w", err)
	}

	if umaClient != nil {
		err = umaClient.DeleteResource(ctx, strategyID)
		if err != nil {
			log.Printf("Warning: Strategy %s deleted from database but Keycloak cleanup failed: %v", strategyID, err)
		}
	}

	log.Printf("Successfully deleted strategy %s and cleaned up Keycloak resource", strategyID)
	return nil
}

// SyncStrategyVersionResource creates Keycloak resource for a new strategy version
func SyncStrategyVersionResource(
	ctx context.Context,
	umaClient keycloak.UMAClientInterface,
	strategy *ent.Strategy,
) error {
	if umaClient == nil {
		return nil
	}

	resourceName := fmt.Sprintf("%s (v%d)", strategy.Name, strategy.VersionNumber)
	attributes := map[string][]string{
		"ownerId": {strategy.OwnerID},
		"type":    {string(ResourceTypeStrategy)},
	}

	err := umaClient.CreateResource(ctx, strategy.ID.String(), resourceName, StrategyScopes, attributes)
	if err != nil {
		return fmt.Errorf("failed to sync Keycloak resource for strategy version: %w", err)
	}

	err = umaClient.CreatePermission(ctx, strategy.ID.String(), strategy.OwnerID)
	if err != nil {
		return fmt.Errorf("failed to create permission policy for strategy version: %w", err)
	}

	log.Printf("Synced Keycloak resource for strategy version %s (v%d)", strategy.ID, strategy.VersionNumber)
	return nil
}

// ============================================================================
// Bot Resource Management
// ============================================================================

// CreateBotWithResource creates a Bot entity and registers it as a Keycloak resource
func CreateBotWithResource(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	input ent.CreateBotInput,
	ownerID string,
) (*ent.Bot, error) {
	var bot *ent.Bot
	err := db.WithTx(ctx, client, func(tx *ent.Tx) error {
		var err error
		bot, err = tx.Bot.Create().
			SetInput(input).
			SetOwnerID(ownerID).
			Save(ctx)
		if err != nil {
			return fmt.Errorf("failed to create bot: %w", err)
		}

		if umaClient != nil {
			attributes := map[string][]string{
				"ownerId": {ownerID},
				"type":    {string(ResourceTypeBot)},
			}

			err = umaClient.CreateResource(ctx, bot.ID.String(), bot.Name, BotScopes, attributes)
			if err != nil {
				log.Printf("Failed to create Keycloak resource for bot %s: %v", bot.ID, err)
				return fmt.Errorf("failed to create Keycloak resource (transaction will rollback): %w", err)
			}

			err = umaClient.CreatePermission(ctx, bot.ID.String(), bot.OwnerID)
			if err != nil {
				log.Printf("Failed to create permission policy for bot %s: %v", bot.ID, err)
				return fmt.Errorf("failed to create permission policy (transaction will rollback): %w", err)
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
func DeleteBotWithResource(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	botID string,
) error {
	id, err := uuid.Parse(botID)
	if err != nil {
		return fmt.Errorf("invalid bot ID: %w", err)
	}

	err = client.Bot.DeleteOneID(id).Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to delete bot: %w", err)
	}

	if umaClient != nil {
		err = umaClient.DeleteResource(ctx, botID)
		if err != nil {
			log.Printf("Warning: Bot %s deleted from database but Keycloak cleanup failed: %v", botID, err)
		}
	}

	log.Printf("Successfully deleted bot %s and cleaned up Keycloak resource", botID)
	return nil
}

// ============================================================================
// Exchange Resource Management
// ============================================================================

// CreateExchangeWithResource creates an Exchange entity and registers it as a Keycloak resource
func CreateExchangeWithResource(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	input ent.CreateExchangeInput,
	ownerID string,
) (*ent.Exchange, error) {
	var exchange *ent.Exchange
	err := db.WithTx(ctx, client, func(tx *ent.Tx) error {
		var err error
		exchange, err = tx.Exchange.Create().
			SetInput(input).
			SetOwnerID(ownerID).
			Save(ctx)
		if err != nil {
			return fmt.Errorf("failed to create exchange: %w", err)
		}

		if umaClient != nil {
			attributes := map[string][]string{
				"ownerId": {ownerID},
				"type":    {string(ResourceTypeExchange)},
			}

			err = umaClient.CreateResource(ctx, exchange.ID.String(), exchange.Name, ExchangeScopes, attributes)
			if err != nil {
				log.Printf("Failed to create Keycloak resource for exchange %s: %v", exchange.ID, err)
				return fmt.Errorf("failed to create Keycloak resource (transaction will rollback): %w", err)
			}

			err = umaClient.CreatePermission(ctx, exchange.ID.String(), exchange.OwnerID)
			if err != nil {
				log.Printf("Failed to create permission policy for exchange %s: %v", exchange.ID, err)
				return fmt.Errorf("failed to create permission policy (transaction will rollback): %w", err)
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
func DeleteExchangeWithResource(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	exchangeID string,
) error {
	id, err := uuid.Parse(exchangeID)
	if err != nil {
		return fmt.Errorf("invalid exchange ID: %w", err)
	}

	err = client.Exchange.DeleteOneID(id).Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to delete exchange: %w", err)
	}

	if umaClient != nil {
		err = umaClient.DeleteResource(ctx, exchangeID)
		if err != nil {
			log.Printf("Warning: Exchange %s deleted from database but Keycloak cleanup failed: %v", exchangeID, err)
		}
	}

	log.Printf("Successfully deleted exchange %s and cleaned up Keycloak resource", exchangeID)
	return nil
}

// ============================================================================
// BotRunner Resource Management
// ============================================================================

// CreateBotRunnerWithResource creates a BotRunner entity and registers it as a Keycloak resource
func CreateBotRunnerWithResource(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	input ent.CreateBotRunnerInput,
	ownerID string,
) (*ent.BotRunner, error) {
	var runner *ent.BotRunner
	err := db.WithTx(ctx, client, func(tx *ent.Tx) error {
		var err error
		runner, err = tx.BotRunner.Create().
			SetInput(input).
			SetOwnerID(ownerID).
			Save(ctx)
		if err != nil {
			return fmt.Errorf("failed to create bot runner: %w", err)
		}

		if umaClient != nil {
			attributes := map[string][]string{
				"ownerId": {ownerID},
				"type":    {string(ResourceTypeBotRunner)},
			}

			err = umaClient.CreateResource(ctx, runner.ID.String(), runner.Name, BotRunnerScopes, attributes)
			if err != nil {
				log.Printf("Failed to create Keycloak resource for bot runner %s: %v", runner.ID, err)
				return fmt.Errorf("failed to create Keycloak resource (transaction will rollback): %w", err)
			}

			err = umaClient.CreatePermission(ctx, runner.ID.String(), runner.OwnerID)
			if err != nil {
				log.Printf("Failed to create permission policy for bot runner %s: %v", runner.ID, err)
				return fmt.Errorf("failed to create permission policy (transaction will rollback): %w", err)
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
func DeleteBotRunnerWithResource(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	runnerID string,
) error {
	id, err := uuid.Parse(runnerID)
	if err != nil {
		return fmt.Errorf("invalid bot runner ID: %w", err)
	}

	err = client.BotRunner.DeleteOneID(id).Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to delete bot runner: %w", err)
	}

	if umaClient != nil {
		err = umaClient.DeleteResource(ctx, runnerID)
		if err != nil {
			log.Printf("Warning: BotRunner %s deleted from database but Keycloak cleanup failed: %v", runnerID, err)
		}
	}

	log.Printf("Successfully deleted bot runner %s and cleaned up Keycloak resource", runnerID)
	return nil
}
