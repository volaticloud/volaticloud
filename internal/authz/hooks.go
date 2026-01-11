// Package authz provides authorization utilities for UMA 2.0 resource management
package authz

import (
	"context"
	"fmt"
	"log"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/hook"
)

// RegisterKeycloakHooks registers ENT runtime hooks that sync entity lifecycle with Keycloak UMA resources.
// These hooks handle Create and Delete operations:
//   - On Create: Creates a corresponding Keycloak resource after entity is saved
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
	client.Strategy.Use(strategyDeleteHook())

	// Bot hooks
	client.Bot.Use(botCreateHook())
	client.Bot.Use(botDeleteHook())

	// Exchange hooks
	client.Exchange.Use(exchangeCreateHook())
	client.Exchange.Use(exchangeDeleteHook())

	// BotRunner hooks
	client.BotRunner.Use(botRunnerCreateHook())
	client.BotRunner.Use(botRunnerDeleteHook())

	log.Println("Registered Keycloak resource sync hooks for Strategy, Bot, Exchange, BotRunner")
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

				// Get UMA client from context
				umaClient := GetUMAClientFromContext(ctx)
				if umaClient == nil {
					return v, nil
				}

				// Type assert the returned value
				strategy, ok := v.(*ent.Strategy)
				if !ok {
					return v, nil
				}

				// Create Keycloak resource
				resourceName := fmt.Sprintf("%s (v%d)", strategy.Name, strategy.VersionNumber)
				scopes := GetScopesForType(ResourceTypeStrategy)
				attributes := map[string][]string{
					"ownerId": {strategy.OwnerID},
					"type":    {string(ResourceTypeStrategy)},
					"public":  {fmt.Sprintf("%t", strategy.Public)},
					"title":   {resourceName}, // For GROUP_TITLE attribute
				}

				err = umaClient.CreateResource(ctx, strategy.ID.String(), resourceName, scopes, attributes)
				if err != nil {
					log.Printf("Failed to create Keycloak resource for strategy %s: %v", strategy.ID, err)
					return nil, fmt.Errorf("failed to create Keycloak resource (transaction will rollback): %w", err)
				}

				log.Printf("Successfully created strategy %s with Keycloak resource", strategy.ID)
				return v, nil
			})
		},
		ent.OpCreate,
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

				// Clean up Keycloak resource (best-effort)
				umaClient := GetUMAClientFromContext(ctx)
				if umaClient != nil {
					cleanupErr := umaClient.DeleteResource(ctx, id.String())
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

				// Get UMA client from context
				umaClient := GetUMAClientFromContext(ctx)
				if umaClient == nil {
					return v, nil
				}

				// Type assert the returned value
				bot, ok := v.(*ent.Bot)
				if !ok {
					return v, nil
				}

				// Create Keycloak resource
				scopes := GetScopesForType(ResourceTypeBot)
				attributes := map[string][]string{
					"ownerId": {bot.OwnerID},
					"type":    {string(ResourceTypeBot)},
					"public":  {fmt.Sprintf("%t", bot.Public)},
					"title":   {bot.Name}, // For GROUP_TITLE attribute
				}

				err = umaClient.CreateResource(ctx, bot.ID.String(), bot.Name, scopes, attributes)
				if err != nil {
					log.Printf("Failed to create Keycloak resource for bot %s: %v", bot.ID, err)
					return nil, fmt.Errorf("failed to create Keycloak resource (transaction will rollback): %w", err)
				}

				log.Printf("Successfully created bot %s with Keycloak resource", bot.ID)
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

				// Clean up Keycloak resource (best-effort)
				umaClient := GetUMAClientFromContext(ctx)
				if umaClient != nil {
					cleanupErr := umaClient.DeleteResource(ctx, id.String())
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

				// Get UMA client from context
				umaClient := GetUMAClientFromContext(ctx)
				if umaClient == nil {
					return v, nil
				}

				// Type assert the returned value
				exchange, ok := v.(*ent.Exchange)
				if !ok {
					return v, nil
				}

				// Create Keycloak resource
				scopes := GetScopesForType(ResourceTypeExchange)
				attributes := map[string][]string{
					"ownerId": {exchange.OwnerID},
					"type":    {string(ResourceTypeExchange)},
					"title":   {exchange.Name}, // For GROUP_TITLE attribute
				}

				err = umaClient.CreateResource(ctx, exchange.ID.String(), exchange.Name, scopes, attributes)
				if err != nil {
					log.Printf("Failed to create Keycloak resource for exchange %s: %v", exchange.ID, err)
					return nil, fmt.Errorf("failed to create Keycloak resource (transaction will rollback): %w", err)
				}

				log.Printf("Successfully created exchange %s with Keycloak resource", exchange.ID)
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

				// Clean up Keycloak resource (best-effort)
				umaClient := GetUMAClientFromContext(ctx)
				if umaClient != nil {
					cleanupErr := umaClient.DeleteResource(ctx, id.String())
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

				// Get UMA client from context
				umaClient := GetUMAClientFromContext(ctx)
				if umaClient == nil {
					return v, nil
				}

				// Type assert the returned value
				runner, ok := v.(*ent.BotRunner)
				if !ok {
					return v, nil
				}

				// Create Keycloak resource
				scopes := GetScopesForType(ResourceTypeBotRunner)
				attributes := map[string][]string{
					"ownerId": {runner.OwnerID},
					"type":    {string(ResourceTypeBotRunner)},
					"public":  {fmt.Sprintf("%t", runner.Public)},
					"title":   {runner.Name}, // For GROUP_TITLE attribute
				}

				err = umaClient.CreateResource(ctx, runner.ID.String(), runner.Name, scopes, attributes)
				if err != nil {
					log.Printf("Failed to create Keycloak resource for bot runner %s: %v", runner.ID, err)
					return nil, fmt.Errorf("failed to create Keycloak resource (transaction will rollback): %w", err)
				}

				log.Printf("Successfully created bot runner %s with Keycloak resource", runner.ID)
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

				// Clean up Keycloak resource (best-effort)
				umaClient := GetUMAClientFromContext(ctx)
				if umaClient != nil {
					cleanupErr := umaClient.DeleteResource(ctx, id.String())
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
