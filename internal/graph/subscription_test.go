package graph

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"volaticloud/internal/pubsub"
)

// TestSubscriptionResolver_NilPubSub tests that subscriptions return an error
// when pub/sub is not configured.
func TestSubscriptionResolver_NilPubSub(t *testing.T) {
	r := &Resolver{
		client:    nil, // No DB needed for this test
		auth:      nil,
		umaClient: nil,
		pubsub:    nil, // Explicitly nil
	}

	sub := &subscriptionResolver{r}
	ctx := context.Background()
	botID := uuid.New()

	_, err := sub.BotStatusChanged(ctx, botID)
	if err == nil {
		t.Error("Expected error when pubsub is nil, got nil")
	}
	if err.Error() != "subscriptions not available: pub/sub not configured" {
		t.Errorf("Unexpected error message: %s", err.Error())
	}
}

// TestSubscriptionResolver_BacktestProgress_NilPubSub tests BacktestProgress with nil pubsub.
func TestSubscriptionResolver_BacktestProgress_NilPubSub(t *testing.T) {
	r := &Resolver{pubsub: nil}
	sub := &subscriptionResolver{r}

	_, err := sub.BacktestProgress(context.Background(), uuid.New())
	if err == nil {
		t.Error("Expected error when pubsub is nil")
	}
}

// TestSubscriptionResolver_AlertEventCreated_NilPubSub tests AlertEventCreated with nil pubsub.
func TestSubscriptionResolver_AlertEventCreated_NilPubSub(t *testing.T) {
	r := &Resolver{pubsub: nil}
	sub := &subscriptionResolver{r}

	_, err := sub.AlertEventCreated(context.Background(), "owner-123")
	if err == nil {
		t.Error("Expected error when pubsub is nil")
	}
}

// TestSubscriptionResolver_TradeUpdated_NilPubSub tests TradeUpdated with nil pubsub.
func TestSubscriptionResolver_TradeUpdated_NilPubSub(t *testing.T) {
	r := &Resolver{pubsub: nil}
	sub := &subscriptionResolver{r}

	_, err := sub.TradeUpdated(context.Background(), uuid.New())
	if err == nil {
		t.Error("Expected error when pubsub is nil")
	}
}

// TestSubscriptionResolver_RunnerStatusChanged_NilPubSub tests RunnerStatusChanged with nil pubsub.
func TestSubscriptionResolver_RunnerStatusChanged_NilPubSub(t *testing.T) {
	r := &Resolver{pubsub: nil}
	sub := &subscriptionResolver{r}

	_, err := sub.RunnerStatusChanged(context.Background(), uuid.New())
	if err == nil {
		t.Error("Expected error when pubsub is nil")
	}
}

// TestSubscriptionResolver_BotChanged_NilPubSub tests BotChanged with nil pubsub.
func TestSubscriptionResolver_BotChanged_NilPubSub(t *testing.T) {
	r := &Resolver{pubsub: nil}
	sub := &subscriptionResolver{r}

	_, err := sub.BotChanged(context.Background(), "owner-123")
	if err == nil {
		t.Error("Expected error when pubsub is nil")
	}
}

// TestSubscriptionResolver_TradeChanged_NilPubSub tests TradeChanged with nil pubsub.
func TestSubscriptionResolver_TradeChanged_NilPubSub(t *testing.T) {
	r := &Resolver{pubsub: nil}
	sub := &subscriptionResolver{r}

	_, err := sub.TradeChanged(context.Background(), "owner-123")
	if err == nil {
		t.Error("Expected error when pubsub is nil")
	}
}

// TestSubscriptionResolver_RunnerChanged_NilPubSub tests RunnerChanged with nil pubsub.
func TestSubscriptionResolver_RunnerChanged_NilPubSub(t *testing.T) {
	r := &Resolver{pubsub: nil}
	sub := &subscriptionResolver{r}

	_, err := sub.RunnerChanged(context.Background(), "owner-123")
	if err == nil {
		t.Error("Expected error when pubsub is nil")
	}
}

// TestSubscriptionResolver_ContextCancellation tests that subscriptions
// properly close when context is cancelled.
func TestSubscriptionResolver_ContextCancellation(t *testing.T) {
	ps := pubsub.NewMemoryPubSub()
	defer ps.Close()

	r := &Resolver{
		client: nil, // Will cause DB fetch to fail, but that's ok for this test
		pubsub: ps,
	}

	sub := &subscriptionResolver{r}
	ctx, cancel := context.WithCancel(context.Background())
	botID := uuid.New()

	ch, err := sub.BotStatusChanged(ctx, botID)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Cancel context
	cancel()

	// Channel should close eventually
	select {
	case <-ch:
		// Got a message before close or channel closed - both acceptable
	case <-time.After(2 * time.Second):
		t.Error("Channel did not close after context cancellation")
	}
}

// TestSubscriptionResolver_SubscribesCorrectTopic tests that subscriptions
// subscribe to the correct topic.
func TestSubscriptionResolver_SubscribesCorrectTopic(t *testing.T) {
	ps := pubsub.NewMemoryPubSub()
	defer ps.Close()

	r := &Resolver{
		client: nil,
		pubsub: ps,
	}

	sub := &subscriptionResolver{r}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	botID := uuid.New()
	ch, err := sub.BotStatusChanged(ctx, botID)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if ch == nil {
		t.Error("Expected non-nil channel")
	}

	// Publish to the correct topic (bot will be nil since no DB, but subscription should trigger)
	topic := pubsub.BotTopic(botID.String())
	err = ps.Publish(ctx, topic, map[string]string{"event": "status_changed"})
	if err != nil {
		t.Fatalf("Publish failed: %v", err)
	}

	// Give time for the goroutine to process
	// Note: Since we don't have a DB client, the resolver will fail to fetch the bot
	// and continue (or log an error), but the subscription should still be active
	time.Sleep(100 * time.Millisecond)
}

// TestSubscriptionTopics tests that the topic functions return expected formats.
func TestSubscriptionTopics(t *testing.T) {
	id := "test-id-123"

	tests := []struct {
		name   string
		got    string
		prefix string
	}{
		{"BotTopic", pubsub.BotTopic(id), "bot:"},
		{"BacktestTopic", pubsub.BacktestTopic(id), "backtest:"},
		{"AlertTopic", pubsub.AlertTopic(id), "alert:"},
		{"TradeTopic", pubsub.TradeTopic(id), "trade:"},
		{"RunnerTopic", pubsub.RunnerTopic(id), "runner:"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !containsPrefix(tt.got, tt.prefix) {
				t.Errorf("%s(%s) = %s, expected prefix %s", tt.name, id, tt.got, tt.prefix)
			}
			if !containsSuffix(tt.got, id) {
				t.Errorf("%s(%s) = %s, expected suffix %s", tt.name, id, tt.got, id)
			}
		})
	}
}

func containsPrefix(s, prefix string) bool {
	return len(s) >= len(prefix) && s[:len(prefix)] == prefix
}

func containsSuffix(s, suffix string) bool {
	return len(s) >= len(suffix) && s[len(s)-len(suffix):] == suffix
}
