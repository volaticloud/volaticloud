package graph

import (
	"context"
	"fmt"
	"log"

	"github.com/google/uuid"
	"volaticloud/internal/ent"
	"volaticloud/internal/keycloak"
)

// StrategyScopes defines the available permission scopes for Strategy resources
var StrategyScopes = []string{"view", "edit", "backtest", "delete"}

// CreateStrategyWithResource creates a Strategy entity and registers it as a Keycloak resource
// Uses database-first approach with transaction rollback on Keycloak failure
func CreateStrategyWithResource(
	ctx context.Context,
	client *ent.Client,
	umaClient *keycloak.UMAClient,
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

			// Create permission policy for owner
			err = umaClient.CreatePermission(ctx, strategy.ID.String(), strategy.OwnerID)
			if err != nil {
				// Permission policy failed - rollback transaction
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
// Deletion is more forgiving - Keycloak cleanup failure is logged but doesn't block DB deletion
func DeleteStrategyWithResource(
	ctx context.Context,
	client *ent.Client,
	umaClient *keycloak.UMAClient,
	strategyID string,
) error {
	// Parse string UUID
	id, err := uuid.Parse(strategyID)
	if err != nil {
		return fmt.Errorf("invalid strategy ID: %w", err)
	}

	// Delete from database first
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
	umaClient *keycloak.UMAClient,
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
	umaClient *keycloak.UMAClient,
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

	// Create permission policy for owner (inherited from parent)
	err = umaClient.CreatePermission(ctx, strategy.ID.String(), strategy.OwnerID)
	if err != nil {
		return fmt.Errorf("failed to create permission policy for strategy version: %w", err)
	}

	log.Printf("Synced Keycloak resource for strategy version %s (v%d)", strategy.ID, strategy.VersionNumber)
	return nil
}
