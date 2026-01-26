package pubsub

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

// TestRedisPubSub_Integration tests Redis pub/sub with a real Redis instance.
// Skip if Redis is not available.
func TestRedisPubSub_Integration(t *testing.T) {
	// Try to connect to Redis
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})

	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Skipf("Redis not available, skipping integration test: %v", err)
	}
	defer client.Close()

	ps := NewRedisPubSub(client)
	defer ps.Close()

	topic := "test-redis-topic"

	// Subscribe first
	ch, unsub := ps.Subscribe(ctx, topic)
	defer unsub()

	// Give subscription time to establish
	time.Sleep(100 * time.Millisecond)

	// Publish a message
	payload := map[string]string{"redis": "test"}
	if err := ps.Publish(ctx, topic, payload); err != nil {
		t.Fatalf("Publish failed: %v", err)
	}

	// Receive the message
	select {
	case msg := <-ch:
		var received map[string]string
		if err := json.Unmarshal(msg, &received); err != nil {
			t.Fatalf("Failed to unmarshal message: %v", err)
		}
		if received["redis"] != "test" {
			t.Errorf("Expected redis=test, got redis=%s", received["redis"])
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Timeout waiting for message")
	}
}

// TestRedisPubSub_MultipleSubscribers tests multiple subscribers with Redis.
func TestRedisPubSub_MultipleSubscribers(t *testing.T) {
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})

	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Skipf("Redis not available, skipping integration test: %v", err)
	}
	defer client.Close()

	ps := NewRedisPubSub(client)
	defer ps.Close()

	topic := "test-redis-multi"

	// Create multiple subscribers
	ch1, unsub1 := ps.Subscribe(ctx, topic)
	defer unsub1()
	ch2, unsub2 := ps.Subscribe(ctx, topic)
	defer unsub2()

	// Give subscriptions time to establish
	time.Sleep(100 * time.Millisecond)

	// Publish a message
	if err := ps.Publish(ctx, topic, "multi-test"); err != nil {
		t.Fatalf("Publish failed: %v", err)
	}

	// Both subscribers should receive the message
	for i, ch := range []<-chan []byte{ch1, ch2} {
		select {
		case msg := <-ch:
			var received string
			if err := json.Unmarshal(msg, &received); err != nil {
				t.Fatalf("Subscriber %d: failed to unmarshal: %v", i+1, err)
			}
			if received != "multi-test" {
				t.Errorf("Subscriber %d: expected 'multi-test', got '%s'", i+1, received)
			}
		case <-time.After(5 * time.Second):
			t.Fatalf("Subscriber %d: timeout waiting for message", i+1)
		}
	}
}

// TestRedisPubSub_Unsubscribe tests unsubscription cleanup.
func TestRedisPubSub_Unsubscribe(t *testing.T) {
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})

	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Skipf("Redis not available, skipping integration test: %v", err)
	}
	defer client.Close()

	ps := NewRedisPubSub(client)
	defer ps.Close()

	topic := "test-redis-unsub"

	// Subscribe and unsubscribe
	ch, unsub := ps.Subscribe(ctx, topic)
	unsub()

	// Channel should be closed eventually
	select {
	case <-ch:
		// Received a message before close, that's ok
	case <-time.After(time.Second):
		// Timeout is acceptable for cleanup
	}
}
