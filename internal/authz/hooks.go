// Package authz provides authorization utilities for UMA 2.0 resource management
package authz

import (
	"context"
	"fmt"
	"log"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/hook"
	"volaticloud/internal/keycloak"
)

// RegisterKeycloakHooks registers ENT runtime hooks that sync entity lifecycle with Keycloak UMA resources.
// These hooks handle Create, Update, and Delete operations:
//   - On Create: Creates a corresponding Keycloak resource after entity is saved
//   - On Update: Updates GROUP_TITLE attribute in Keycloak when name is changed
//   - On Delete: Deletes the Keycloak resource after entity is deleted (best-effort)
//
// The hooks run within the transaction, so if Keycloak resource creation fails,
// the entire transaction is rolled back and the entity is not persisted.
//
// This function should be called once during application initialization after
// the ENT client is created.
func RegisterKeycloakHooks(client *ent.Client) {
	// Strategy hooks
	client.Strategy.Use(strategyCreateHook())
	client.Strategy.Use(strategyUpdateHook())
	client.Strategy.Use(strategyDeleteHook())

	// Bot hooks
	client.Bot.Use(botCreateHook())
	client.Bot.Use(botUpdateHook())
	client.Bot.Use(botDeleteHook())

	// Exchange hooks
	client.Exchange.Use(exchangeCreateHook())
	client.Exchange.Use(exchangeUpdateHook())
	client.Exchange.Use(exchangeDeleteHook())

	// BotRunner hooks
	client.BotRunner.Use(botRunnerCreateHook())
	client.BotRunner.Use(botRunnerUpdateHook())
	client.BotRunner.Use(botRunnerDeleteHook())

	log.Println("Registered Keycloak resource sync hooks for Strategy, Bot, Exchange, BotRunner (Create, Update, Delete)")
}

// ============================================================================
// Strategy Hooks
// ============================================================================

func strategyCreateHook() ent.Hook {
	return hook.On(
		func(next ent.Mutator) ent.Mutator {
			return hook.StrategyFunc(func(ctx context.Context, m *ent.StrategyMutation) (ent.Value, error) {
				// Execute the mutation first
				v, err := next.Mutate(ctx, m)
				if err != nil {
					return nil, err
				}

				// Get Admin client from context
				adminClient := GetAdminClientFromContext(ctx)
				if adminClient == nil {
					return v, nil
				}

				// Type assert the returned value
				strategy, ok := v.(*ent.Strategy)
				if !ok {
					return v, nil
				}

				// Create unified resource (UMA + group) via Keycloak extension
				resourceName := fmt.Sprintf("%s (v%d)", strategy.Name, strategy.VersionNumber)
				scopes := GetScopesForType(ResourceTypeStrategy)

				request := keycloak.ResourceCreateRequest{
					ID:      strategy.ID.String(),
					Title:   resourceName,
					Type:    string(ResourceTypeStrategy),
					OwnerID: strategy.OwnerID,
					Scopes:  scopes,
					Attributes: map[string][]string{
						"public": {fmt.Sprintf("%t", strategy.Public)},
					},
				}

				_, err = adminClient.CreateResource(ctx, request)
				if err != nil {
					log.Printf("Failed to create unified Keycloak resource for strategy %s: %v", strategy.ID, err)
					return nil, fmt.Errorf("failed to create Keycloak resource (transaction will rollback): %w", err)
				}

				log.Printf("Successfully created strategy %s with unified Keycloak resource", strategy.ID)
				return v, nil
			})
		},
		ent.OpCreate,
	)
}

func strategyUpdateHook() ent.Hook {
	return hook.On(
		func(next ent.Mutator) ent.Mutator {
			return hook.StrategyFunc(func(ctx context.Context, m *ent.StrategyMutation) (ent.Value, error) {
				// Check if name is being updated
				// Note: Only name changes need syncing to Keycloak GROUP_TITLE attribute.
				// Other fields (config, public, etc.) are synced via separate visibility mutations.
				name, nameExists := m.Name()
				if !nameExists {
					// Name not being updated, skip sync
					return next.Mutate(ctx, m)
				}

				// Capture ID
				id, idExists := m.ID()
				if !idExists {
					return next.Mutate(ctx, m)
				}

				// Execute the mutation first
				v, err := next.Mutate(ctx, m)
				if err != nil {
					return nil, err
				}

				// Get Admin client from context
				adminClient := GetAdminClientFromContext(ctx)
				if adminClient == nil {
					return v, nil
				}

				// Type assert to get version number for title
				strategy, ok := v.(*ent.Strategy)
				if !ok {
					return v, nil
				}

				// Update unified resource (UMA + group) via Keycloak extension
				// NOTE: Best-effort synchronization strategy
				// - Database is the source of truth
				// - Keycloak sync failures are logged as warnings but don't fail the transaction
				// - This prevents database rollback from Keycloak being unavailable
				// - Monitoring/alerting should track sync failures for manual intervention
				resourceName := fmt.Sprintf("%s (v%d)", name, strategy.VersionNumber)
				request := keycloak.ResourceUpdateRequest{
					Title: resourceName,
				}

				_, err = adminClient.UpdateResource(ctx, id.String(), request)
				if err != nil {
					log.Printf("Warning: failed to update unified Keycloak resource for strategy %s: %v", id, err)
					// TODO: Add metrics/alerting for sync failures
					// TODO: Consider implementing retry mechanism with exponential backoff
				} else {
					log.Printf("Successfully updated unified Keycloak resource for strategy %s", id)
				}

				return v, nil
			})
		},
		ent.OpUpdateOne,
	)
}

func strategyDeleteHook() ent.Hook {
	return hook.On(
		func(next ent.Mutator) ent.Mutator {
			// Use MutateFunc instead of StrategyFunc to handle nil returns from soft-delete
			return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
				sm, ok := m.(*ent.StrategyMutation)
				if !ok {
					return next.Mutate(ctx, m)
				}

				// Capture ID before deletion
				id, exists := sm.ID()
				if !exists {
					return next.Mutate(ctx, m)
				}

				// Execute the mutation (soft-delete returns nil, nil)
				v, err := next.Mutate(ctx, m)
				if err != nil {
					return nil, err
				}

				// Clean up unified Keycloak resource (best-effort)
				adminClient := GetAdminClientFromContext(ctx)
				if adminClient != nil {
					cleanupErr := adminClient.DeleteResource(ctx, id.String())
					if cleanupErr != nil {
						log.Printf("Warning: strategy %s deleted but Keycloak cleanup failed: %v", id, cleanupErr)
					} else {
						log.Printf("Successfully deleted strategy %s and cleaned up Keycloak resource", id)
					}
				}

				return v, nil
			})
		},
		ent.OpDeleteOne,
	)
}

// ============================================================================
// Bot Hooks
// ============================================================================

func botCreateHook() ent.Hook {
	return hook.On(
		func(next ent.Mutator) ent.Mutator {
			return hook.BotFunc(func(ctx context.Context, m *ent.BotMutation) (ent.Value, error) {
				// Execute the mutation first
				v, err := next.Mutate(ctx, m)
				if err != nil {
					return nil, err
				}

				// Get Admin client from context
				adminClient := GetAdminClientFromContext(ctx)
				if adminClient == nil {
					return v, nil
				}

				// Type assert the returned value
				bot, ok := v.(*ent.Bot)
				if !ok {
					return v, nil
				}

				// Create unified resource (UMA + group) via Keycloak extension
				scopes := GetScopesForType(ResourceTypeBot)

				request := keycloak.ResourceCreateRequest{
					ID:      bot.ID.String(),
					Title:   bot.Name,
					Type:    string(ResourceTypeBot),
					OwnerID: bot.OwnerID,
					Scopes:  scopes,
					Attributes: map[string][]string{
						"public": {fmt.Sprintf("%t", bot.Public)},
					},
				}

				_, err = adminClient.CreateResource(ctx, request)
				if err != nil {
					log.Printf("Failed to create unified Keycloak resource for bot %s: %v", bot.ID, err)
					return nil, fmt.Errorf("failed to create Keycloak resource (transaction will rollback): %w", err)
				}

				log.Printf("Successfully created bot %s with unified Keycloak resource", bot.ID)
				return v, nil
			})
		},
		ent.OpCreate,
	)
}

func botDeleteHook() ent.Hook {
	return hook.On(
		func(next ent.Mutator) ent.Mutator {
			// Use MutateFunc instead of BotFunc to handle nil returns from soft-delete
			return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
				bm, ok := m.(*ent.BotMutation)
				if !ok {
					return next.Mutate(ctx, m)
				}

				// Capture ID before deletion
				id, exists := bm.ID()
				if !exists {
					return next.Mutate(ctx, m)
				}

				// Execute the mutation (soft-delete returns nil, nil)
				v, err := next.Mutate(ctx, m)
				if err != nil {
					return nil, err
				}

				// Clean up unified Keycloak resource (best-effort)
				adminClient := GetAdminClientFromContext(ctx)
				if adminClient != nil {
					cleanupErr := adminClient.DeleteResource(ctx, id.String())
					if cleanupErr != nil {
						log.Printf("Warning: bot %s deleted but Keycloak cleanup failed: %v", id, cleanupErr)
					} else {
						log.Printf("Successfully deleted bot %s and cleaned up Keycloak resource", id)
					}
				}

				return v, nil
			})
		},
		ent.OpDeleteOne,
	)
}

func botUpdateHook() ent.Hook {
	return hook.On(
		func(next ent.Mutator) ent.Mutator {
			return hook.BotFunc(func(ctx context.Context, m *ent.BotMutation) (ent.Value, error) {
				// Check if name is being updated
				name, nameExists := m.Name()
				if !nameExists {
					// Name not being updated, skip sync
					return next.Mutate(ctx, m)
				}

				// Capture ID
				id, idExists := m.ID()
				if !idExists {
					return next.Mutate(ctx, m)
				}

				// Execute the mutation first
				v, err := next.Mutate(ctx, m)
				if err != nil {
					return nil, err
				}

				// Get Admin client from context
				adminClient := GetAdminClientFromContext(ctx)
				if adminClient == nil {
					return v, nil
				}

				// Update unified resource (UMA + group) via Keycloak extension
				request := keycloak.ResourceUpdateRequest{
					Title: name,
				}

				_, err = adminClient.UpdateResource(ctx, id.String(), request)
				if err != nil {
					log.Printf("Warning: failed to update unified Keycloak resource for bot %s: %v", id, err)
				} else {
					log.Printf("Successfully updated unified Keycloak resource for bot %s", id)
				}

				return v, nil
			})
		},
		ent.OpUpdateOne,
	)
}

// ============================================================================
// Exchange Hooks
// ============================================================================

func exchangeCreateHook() ent.Hook {
	return hook.On(
		func(next ent.Mutator) ent.Mutator {
			return hook.ExchangeFunc(func(ctx context.Context, m *ent.ExchangeMutation) (ent.Value, error) {
				// Execute the mutation first
				v, err := next.Mutate(ctx, m)
				if err != nil {
					return nil, err
				}

				// Get Admin client from context
				adminClient := GetAdminClientFromContext(ctx)
				if adminClient == nil {
					return v, nil
				}

				// Type assert the returned value
				exchange, ok := v.(*ent.Exchange)
				if !ok {
					return v, nil
				}

				// Create unified resource (UMA + group) via Keycloak extension
				scopes := GetScopesForType(ResourceTypeExchange)

				request := keycloak.ResourceCreateRequest{
					ID:      exchange.ID.String(),
					Title:   exchange.Name,
					Type:    string(ResourceTypeExchange),
					OwnerID: exchange.OwnerID,
					Scopes:  scopes,
				}

				_, err = adminClient.CreateResource(ctx, request)
				if err != nil {
					log.Printf("Failed to create unified Keycloak resource for exchange %s: %v", exchange.ID, err)
					return nil, fmt.Errorf("failed to create Keycloak resource (transaction will rollback): %w", err)
				}

				log.Printf("Successfully created exchange %s with unified Keycloak resource", exchange.ID)
				return v, nil
			})
		},
		ent.OpCreate,
	)
}

func exchangeDeleteHook() ent.Hook {
	return hook.On(
		func(next ent.Mutator) ent.Mutator {
			// Use MutateFunc instead of ExchangeFunc to handle nil returns from soft-delete
			return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
				em, ok := m.(*ent.ExchangeMutation)
				if !ok {
					return next.Mutate(ctx, m)
				}

				// Capture ID before deletion
				id, exists := em.ID()
				if !exists {
					return next.Mutate(ctx, m)
				}

				// Execute the mutation (soft-delete returns nil, nil)
				v, err := next.Mutate(ctx, m)
				if err != nil {
					return nil, err
				}

				// Clean up unified Keycloak resource (best-effort)
				adminClient := GetAdminClientFromContext(ctx)
				if adminClient != nil {
					cleanupErr := adminClient.DeleteResource(ctx, id.String())
					if cleanupErr != nil {
						log.Printf("Warning: exchange %s deleted but Keycloak cleanup failed: %v", id, cleanupErr)
					} else {
						log.Printf("Successfully deleted exchange %s and cleaned up Keycloak resource", id)
					}
				}

				return v, nil
			})
		},
		ent.OpDeleteOne,
	)
}

func exchangeUpdateHook() ent.Hook {
	return hook.On(
		func(next ent.Mutator) ent.Mutator {
			return hook.ExchangeFunc(func(ctx context.Context, m *ent.ExchangeMutation) (ent.Value, error) {
				// Check if name is being updated
				name, nameExists := m.Name()
				if !nameExists {
					// Name not being updated, skip sync
					return next.Mutate(ctx, m)
				}

				// Capture ID
				id, idExists := m.ID()
				if !idExists {
					return next.Mutate(ctx, m)
				}

				// Execute the mutation first
				v, err := next.Mutate(ctx, m)
				if err != nil {
					return nil, err
				}

				// Get Admin client from context
				adminClient := GetAdminClientFromContext(ctx)
				if adminClient == nil {
					return v, nil
				}

				// Update unified resource (UMA + group) via Keycloak extension
				request := keycloak.ResourceUpdateRequest{
					Title: name,
				}

				_, err = adminClient.UpdateResource(ctx, id.String(), request)
				if err != nil {
					log.Printf("Warning: failed to update unified Keycloak resource for exchange %s: %v", id, err)
				} else {
					log.Printf("Successfully updated unified Keycloak resource for exchange %s", id)
				}

				return v, nil
			})
		},
		ent.OpUpdateOne,
	)
}

// ============================================================================
// BotRunner Hooks
// ============================================================================

func botRunnerCreateHook() ent.Hook {
	return hook.On(
		func(next ent.Mutator) ent.Mutator {
			return hook.BotRunnerFunc(func(ctx context.Context, m *ent.BotRunnerMutation) (ent.Value, error) {
				// Execute the mutation first
				v, err := next.Mutate(ctx, m)
				if err != nil {
					return nil, err
				}

				// Get Admin client from context
				adminClient := GetAdminClientFromContext(ctx)
				if adminClient == nil {
					return v, nil
				}

				// Type assert the returned value
				runner, ok := v.(*ent.BotRunner)
				if !ok {
					return v, nil
				}

				// Create unified resource (UMA + group) via Keycloak extension
				scopes := GetScopesForType(ResourceTypeBotRunner)

				request := keycloak.ResourceCreateRequest{
					ID:      runner.ID.String(),
					Title:   runner.Name,
					Type:    string(ResourceTypeBotRunner),
					OwnerID: runner.OwnerID,
					Scopes:  scopes,
					Attributes: map[string][]string{
						"public": {fmt.Sprintf("%t", runner.Public)},
					},
				}

				_, err = adminClient.CreateResource(ctx, request)
				if err != nil {
					log.Printf("Failed to create unified Keycloak resource for bot runner %s: %v", runner.ID, err)
					return nil, fmt.Errorf("failed to create Keycloak resource (transaction will rollback): %w", err)
				}

				log.Printf("Successfully created bot runner %s with unified Keycloak resource", runner.ID)
				return v, nil
			})
		},
		ent.OpCreate,
	)
}

func botRunnerDeleteHook() ent.Hook {
	return hook.On(
		func(next ent.Mutator) ent.Mutator {
			// Use MutateFunc instead of BotRunnerFunc to handle nil returns from soft-delete
			return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
				brm, ok := m.(*ent.BotRunnerMutation)
				if !ok {
					return next.Mutate(ctx, m)
				}

				// Capture ID before deletion
				id, exists := brm.ID()
				if !exists {
					return next.Mutate(ctx, m)
				}

				// Execute the mutation (soft-delete returns nil, nil)
				v, err := next.Mutate(ctx, m)
				if err != nil {
					return nil, err
				}

				// Clean up unified Keycloak resource (best-effort)
				adminClient := GetAdminClientFromContext(ctx)
				if adminClient != nil {
					cleanupErr := adminClient.DeleteResource(ctx, id.String())
					if cleanupErr != nil {
						log.Printf("Warning: bot runner %s deleted but Keycloak cleanup failed: %v", id, cleanupErr)
					} else {
						log.Printf("Successfully deleted bot runner %s and cleaned up Keycloak resource", id)
					}
				}

				return v, nil
			})
		},
		ent.OpDeleteOne,
	)
}

func botRunnerUpdateHook() ent.Hook {
	return hook.On(
		func(next ent.Mutator) ent.Mutator {
			return hook.BotRunnerFunc(func(ctx context.Context, m *ent.BotRunnerMutation) (ent.Value, error) {
				// Check if name is being updated
				name, nameExists := m.Name()
				if !nameExists {
					// Name not being updated, skip sync
					return next.Mutate(ctx, m)
				}

				// Capture ID
				id, idExists := m.ID()
				if !idExists {
					return next.Mutate(ctx, m)
				}

				// Execute the mutation first
				v, err := next.Mutate(ctx, m)
				if err != nil {
					return nil, err
				}

				// Get Admin client from context
				adminClient := GetAdminClientFromContext(ctx)
				if adminClient == nil {
					return v, nil
				}

				// Update unified resource (UMA + group) via Keycloak extension
				request := keycloak.ResourceUpdateRequest{
					Title: name,
				}

				_, err = adminClient.UpdateResource(ctx, id.String(), request)
				if err != nil {
					log.Printf("Warning: failed to update unified Keycloak resource for bot runner %s: %v", id, err)
				} else {
					log.Printf("Successfully updated unified Keycloak resource for bot runner %s", id)
				}

				return v, nil
			})
		},
		ent.OpUpdateOne,
	)
}
