// Package pubsub provides a publish-subscribe interface for GraphQL subscriptions.
//
// # Overview
//
// This package provides a unified interface for pub/sub messaging that supports
// GraphQL subscriptions. The primary implementation uses Redis for horizontal
// scaling across multiple server instances.
//
// # Architecture
//
// ```
// ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
// │  Monitor    │     │   Redis     │     │ Subscription│
// │  (Publish)  │────▶│   Pub/Sub   │────▶│  Resolver   │
// └─────────────┘     └─────────────┘     └─────────────┘
//
//	│                    │                   │
//	│                    │                   │
//
// ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
// │ Bot Monitor │     │  Topic:     │     │ WebSocket   │
// │ Backtest Mon│     │ bot:{id}    │     │  Client     │
// │ Alert Mgr   │     │ backtest:{} │     │             │
// └─────────────┘     └─────────────┘     └─────────────┘
// ```
//
// # Usage
//
// Initialize the pub/sub client:
//
//	redisClient := redis.NewClient(&redis.Options{
//		Addr: "localhost:6379",
//	})
//	ps := pubsub.NewRedisPubSub(redisClient)
//
// Publish an event:
//
//	err := ps.Publish(ctx, pubsub.BotTopic(botID), &pubsub.BotEvent{
//		BotID:  botID,
//		Status: "running",
//	})
//
// Subscribe to events:
//
//	ch, unsub := ps.Subscribe(ctx, pubsub.BotTopic(botID))
//	defer unsub()
//	for msg := range ch {
//		var event pubsub.BotEvent
//		json.Unmarshal(msg, &event)
//		// Handle event
//	}
//
// # Topics
//
// Topics follow a hierarchical naming convention:
//   - bot:{id} - Bot status changes
//   - backtest:{id} - Backtest progress updates
//   - alert:{ownerID} - Alert events for an organization
//   - trade:{botID} - Trade updates for a bot
//
// # Event Types
//
// Each topic has corresponding event types defined in events.go:
//   - BotEvent - Bot status, health, and lifecycle changes
//   - BacktestEvent - Backtest progress and completion
//   - AlertEvent - Alert notifications
//   - TradeEvent - Trade executions and updates
package pubsub
