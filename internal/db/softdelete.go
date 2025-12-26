// Package db provides database utilities including soft-delete hooks.
package db

import (
	"context"
	"time"

	"entgo.io/ent"
	entclient "volaticloud/internal/ent"
)

// softDeleteKey is the context key for hard delete operations.
type hardDeleteKey struct{}

// WithHardDelete returns a context that bypasses soft-delete and performs permanent deletion.
// Use sparingly - only for cleanup tasks or explicit permanent deletion requests.
func WithHardDelete(ctx context.Context) context.Context {
	return context.WithValue(ctx, hardDeleteKey{}, true)
}

// isHardDelete checks if the context allows permanent deletion.
func isHardDelete(ctx context.Context) bool {
	hardDelete, ok := ctx.Value(hardDeleteKey{}).(bool)
	return ok && hardDelete
}

// SetupSoftDelete configures soft-delete hooks on the ENT client.
// This should be called after ent.Open() to enable automatic soft-delete
// for all Delete operations.
//
// With this hook:
//   - client.Strategy.DeleteOneID(id).Exec(ctx) → sets deleted_at = now
//   - client.Strategy.Delete().Where(...).Exec(ctx) → sets deleted_at = now for matching
//
// To perform permanent deletion:
//
//	ctx := db.WithHardDelete(ctx)
//	ctx = mixin.IncludeDeleted(ctx) // needed to find soft-deleted records
//	client.Strategy.DeleteOneID(id).Exec(ctx)
func SetupSoftDelete(client *entclient.Client) {
	// Add soft-delete hook to Strategy
	client.Strategy.Use(func(next ent.Mutator) ent.Mutator {
		return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
			mut, ok := m.(*entclient.StrategyMutation)
			if !ok {
				return next.Mutate(ctx, m)
			}
			// Only intercept delete operations
			if !mut.Op().Is(ent.OpDelete | ent.OpDeleteOne) {
				return next.Mutate(ctx, m)
			}
			// Allow hard delete via context
			if isHardDelete(ctx) {
				return next.Mutate(ctx, m)
			}
			// Soft delete: update deleted_at instead of deleting
			ids, err := mut.IDs(ctx)
			if err != nil {
				return nil, err
			}
			now := time.Now()
			for _, id := range ids {
				if _, err := mut.Client().Strategy.UpdateOneID(id).SetDeletedAt(now).Save(ctx); err != nil {
					return nil, err
				}
			}
			return nil, nil
		})
	})

	// Add soft-delete hook to Bot
	client.Bot.Use(func(next ent.Mutator) ent.Mutator {
		return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
			mut, ok := m.(*entclient.BotMutation)
			if !ok {
				return next.Mutate(ctx, m)
			}
			if !mut.Op().Is(ent.OpDelete | ent.OpDeleteOne) {
				return next.Mutate(ctx, m)
			}
			if isHardDelete(ctx) {
				return next.Mutate(ctx, m)
			}
			ids, err := mut.IDs(ctx)
			if err != nil {
				return nil, err
			}
			now := time.Now()
			for _, id := range ids {
				if _, err := mut.Client().Bot.UpdateOneID(id).SetDeletedAt(now).Save(ctx); err != nil {
					return nil, err
				}
			}
			return nil, nil
		})
	})

	// Add soft-delete hook to BotRunner
	client.BotRunner.Use(func(next ent.Mutator) ent.Mutator {
		return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
			mut, ok := m.(*entclient.BotRunnerMutation)
			if !ok {
				return next.Mutate(ctx, m)
			}
			if !mut.Op().Is(ent.OpDelete | ent.OpDeleteOne) {
				return next.Mutate(ctx, m)
			}
			if isHardDelete(ctx) {
				return next.Mutate(ctx, m)
			}
			ids, err := mut.IDs(ctx)
			if err != nil {
				return nil, err
			}
			now := time.Now()
			for _, id := range ids {
				if _, err := mut.Client().BotRunner.UpdateOneID(id).SetDeletedAt(now).Save(ctx); err != nil {
					return nil, err
				}
			}
			return nil, nil
		})
	})

	// Add soft-delete hook to Exchange
	client.Exchange.Use(func(next ent.Mutator) ent.Mutator {
		return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
			mut, ok := m.(*entclient.ExchangeMutation)
			if !ok {
				return next.Mutate(ctx, m)
			}
			if !mut.Op().Is(ent.OpDelete | ent.OpDeleteOne) {
				return next.Mutate(ctx, m)
			}
			if isHardDelete(ctx) {
				return next.Mutate(ctx, m)
			}
			ids, err := mut.IDs(ctx)
			if err != nil {
				return nil, err
			}
			now := time.Now()
			for _, id := range ids {
				if _, err := mut.Client().Exchange.UpdateOneID(id).SetDeletedAt(now).Save(ctx); err != nil {
					return nil, err
				}
			}
			return nil, nil
		})
	})

	// Add soft-delete hook to Backtest
	client.Backtest.Use(func(next ent.Mutator) ent.Mutator {
		return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
			mut, ok := m.(*entclient.BacktestMutation)
			if !ok {
				return next.Mutate(ctx, m)
			}
			if !mut.Op().Is(ent.OpDelete | ent.OpDeleteOne) {
				return next.Mutate(ctx, m)
			}
			if isHardDelete(ctx) {
				return next.Mutate(ctx, m)
			}
			ids, err := mut.IDs(ctx)
			if err != nil {
				return nil, err
			}
			now := time.Now()
			for _, id := range ids {
				if _, err := mut.Client().Backtest.UpdateOneID(id).SetDeletedAt(now).Save(ctx); err != nil {
					return nil, err
				}
			}
			return nil, nil
		})
	})

	// Add soft-delete hook to Trade
	client.Trade.Use(func(next ent.Mutator) ent.Mutator {
		return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
			mut, ok := m.(*entclient.TradeMutation)
			if !ok {
				return next.Mutate(ctx, m)
			}
			if !mut.Op().Is(ent.OpDelete | ent.OpDeleteOne) {
				return next.Mutate(ctx, m)
			}
			if isHardDelete(ctx) {
				return next.Mutate(ctx, m)
			}
			ids, err := mut.IDs(ctx)
			if err != nil {
				return nil, err
			}
			now := time.Now()
			for _, id := range ids {
				if _, err := mut.Client().Trade.UpdateOneID(id).SetDeletedAt(now).Save(ctx); err != nil {
					return nil, err
				}
			}
			return nil, nil
		})
	})

	// Add soft-delete hook to BotMetrics
	client.BotMetrics.Use(func(next ent.Mutator) ent.Mutator {
		return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
			mut, ok := m.(*entclient.BotMetricsMutation)
			if !ok {
				return next.Mutate(ctx, m)
			}
			if !mut.Op().Is(ent.OpDelete | ent.OpDeleteOne) {
				return next.Mutate(ctx, m)
			}
			if isHardDelete(ctx) {
				return next.Mutate(ctx, m)
			}
			ids, err := mut.IDs(ctx)
			if err != nil {
				return nil, err
			}
			now := time.Now()
			for _, id := range ids {
				if _, err := mut.Client().BotMetrics.UpdateOneID(id).SetDeletedAt(now).Save(ctx); err != nil {
					return nil, err
				}
			}
			return nil, nil
		})
	})

	// Add soft-delete hook to ResourceUsageSample
	client.ResourceUsageSample.Use(func(next ent.Mutator) ent.Mutator {
		return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
			mut, ok := m.(*entclient.ResourceUsageSampleMutation)
			if !ok {
				return next.Mutate(ctx, m)
			}
			if !mut.Op().Is(ent.OpDelete | ent.OpDeleteOne) {
				return next.Mutate(ctx, m)
			}
			if isHardDelete(ctx) {
				return next.Mutate(ctx, m)
			}
			ids, err := mut.IDs(ctx)
			if err != nil {
				return nil, err
			}
			now := time.Now()
			for _, id := range ids {
				if _, err := mut.Client().ResourceUsageSample.UpdateOneID(id).SetDeletedAt(now).Save(ctx); err != nil {
					return nil, err
				}
			}
			return nil, nil
		})
	})

	// Add soft-delete hook to ResourceUsageAggregation
	client.ResourceUsageAggregation.Use(func(next ent.Mutator) ent.Mutator {
		return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
			mut, ok := m.(*entclient.ResourceUsageAggregationMutation)
			if !ok {
				return next.Mutate(ctx, m)
			}
			if !mut.Op().Is(ent.OpDelete | ent.OpDeleteOne) {
				return next.Mutate(ctx, m)
			}
			if isHardDelete(ctx) {
				return next.Mutate(ctx, m)
			}
			ids, err := mut.IDs(ctx)
			if err != nil {
				return nil, err
			}
			now := time.Now()
			for _, id := range ids {
				if _, err := mut.Client().ResourceUsageAggregation.UpdateOneID(id).SetDeletedAt(now).Save(ctx); err != nil {
					return nil, err
				}
			}
			return nil, nil
		})
	})
}