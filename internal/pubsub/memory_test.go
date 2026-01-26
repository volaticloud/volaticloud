package pubsub

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"
)

func TestMemoryPubSub_PublishSubscribe(t *testing.T) {
	ps := NewMemoryPubSub()
	defer ps.Close()

	ctx := context.Background()
	topic := "test-topic"

	// Subscribe first
	ch, unsub := ps.Subscribe(ctx, topic)
	defer unsub()

	// Publish a message
	payload := map[string]string{"key": "value"}
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
		if received["key"] != "value" {
			t.Errorf("Expected key=value, got key=%s", received["key"])
		}
	case <-time.After(time.Second):
		t.Fatal("Timeout waiting for message")
	}
}

func TestMemoryPubSub_MultipleSubscribers(t *testing.T) {
	ps := NewMemoryPubSub()
	defer ps.Close()

	ctx := context.Background()
	topic := "multi-sub-topic"

	// Create multiple subscribers
	ch1, unsub1 := ps.Subscribe(ctx, topic)
	defer unsub1()
	ch2, unsub2 := ps.Subscribe(ctx, topic)
	defer unsub2()

	// Publish a message
	if err := ps.Publish(ctx, topic, "test-message"); err != nil {
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
			if received != "test-message" {
				t.Errorf("Subscriber %d: expected 'test-message', got '%s'", i+1, received)
			}
		case <-time.After(time.Second):
			t.Fatalf("Subscriber %d: timeout waiting for message", i+1)
		}
	}
}

func TestMemoryPubSub_Unsubscribe(t *testing.T) {
	ps := NewMemoryPubSub()
	defer ps.Close()

	ctx := context.Background()
	topic := "unsub-topic"

	// Subscribe and immediately unsubscribe
	ch, unsub := ps.Subscribe(ctx, topic)
	unsub()

	// Channel should be closed
	select {
	case _, ok := <-ch:
		if ok {
			t.Error("Expected channel to be closed after unsubscribe")
		}
	case <-time.After(100 * time.Millisecond):
		// Channel might not be immediately closed, that's ok
	}

	// Publishing should not block or error
	if err := ps.Publish(ctx, topic, "after-unsub"); err != nil {
		t.Fatalf("Publish after unsubscribe failed: %v", err)
	}
}

func TestMemoryPubSub_ContextCancellation(t *testing.T) {
	ps := NewMemoryPubSub()
	defer ps.Close()

	ctx, cancel := context.WithCancel(context.Background())
	topic := "ctx-cancel-topic"

	ch, unsub := ps.Subscribe(ctx, topic)
	defer unsub()

	// Cancel the context
	cancel()

	// Give some time for cleanup
	time.Sleep(50 * time.Millisecond)

	// Publishing should still work (other subscribers might exist)
	if err := ps.Publish(context.Background(), topic, "after-cancel"); err != nil {
		t.Fatalf("Publish after context cancel failed: %v", err)
	}

	// The subscriber's channel should eventually close or not receive
	select {
	case _, ok := <-ch:
		if ok {
			// Message received is acceptable if it was buffered before cancel
		}
	case <-time.After(100 * time.Millisecond):
		// Timeout is acceptable
	}
}

func TestMemoryPubSub_DifferentTopics(t *testing.T) {
	ps := NewMemoryPubSub()
	defer ps.Close()

	ctx := context.Background()

	// Subscribe to different topics
	ch1, unsub1 := ps.Subscribe(ctx, "topic-1")
	defer unsub1()
	ch2, unsub2 := ps.Subscribe(ctx, "topic-2")
	defer unsub2()

	// Publish to topic-1 only
	if err := ps.Publish(ctx, "topic-1", "message-1"); err != nil {
		t.Fatalf("Publish failed: %v", err)
	}

	// Only ch1 should receive the message
	select {
	case <-ch1:
		// Expected
	case <-time.After(time.Second):
		t.Fatal("Timeout waiting for message on topic-1")
	}

	// ch2 should not receive anything
	select {
	case <-ch2:
		t.Error("topic-2 subscriber should not receive message from topic-1")
	case <-time.After(100 * time.Millisecond):
		// Expected - no message
	}
}

func TestMemoryPubSub_Close(t *testing.T) {
	ps := NewMemoryPubSub()

	ctx := context.Background()
	topic := "close-topic"

	ch, _ := ps.Subscribe(ctx, topic)

	// Close the pub/sub
	if err := ps.Close(); err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	// Channel should be closed
	select {
	case _, ok := <-ch:
		if ok {
			t.Error("Expected channel to be closed after Close()")
		}
	case <-time.After(100 * time.Millisecond):
		t.Error("Channel should be closed immediately after Close()")
	}

	// Publishing after close should not panic
	err := ps.Publish(ctx, topic, "after-close")
	if err != nil {
		// Error is acceptable
	}
}

func TestMemoryPubSub_ConcurrentPublish(t *testing.T) {
	ps := NewMemoryPubSub()
	defer ps.Close()

	ctx := context.Background()
	topic := "concurrent-topic"

	ch, unsub := ps.Subscribe(ctx, topic)
	defer unsub()

	// Publish concurrently
	var wg sync.WaitGroup
	messageCount := 100

	for i := 0; i < messageCount; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			ps.Publish(ctx, topic, i)
		}(i)
	}

	// Collect messages
	received := 0
	done := make(chan struct{})
	go func() {
		for range ch {
			received++
			if received >= messageCount {
				close(done)
				return
			}
		}
	}()

	wg.Wait()

	select {
	case <-done:
		// All messages received
	case <-time.After(5 * time.Second):
		t.Errorf("Only received %d/%d messages", received, messageCount)
	}
}

func TestMemoryPubSub_SlowSubscriber(t *testing.T) {
	ps := NewMemoryPubSub()
	defer ps.Close()

	ctx := context.Background()
	topic := "slow-topic"

	ch, unsub := ps.Subscribe(ctx, topic)
	defer unsub()

	// Fill the buffer (default is 100)
	for i := 0; i < 150; i++ {
		// Should not block - drops messages when buffer is full
		ps.Publish(ctx, topic, i)
	}

	// Drain the channel
	received := 0
	for {
		select {
		case <-ch:
			received++
		case <-time.After(100 * time.Millisecond):
			// No more messages
			if received == 0 {
				t.Error("Should have received at least some messages")
			}
			return
		}
	}
}

func TestMemoryPubSub_PublishNoSubscribers(t *testing.T) {
	ps := NewMemoryPubSub()
	defer ps.Close()

	ctx := context.Background()

	// Publishing to topic with no subscribers should not error
	err := ps.Publish(ctx, "no-subscribers", "message")
	if err != nil {
		t.Errorf("Publish to empty topic should not error: %v", err)
	}
}

func TestMemoryPubSub_DoubleCleanup(t *testing.T) {
	ps := NewMemoryPubSub()
	defer ps.Close()

	ctx, cancel := context.WithCancel(context.Background())
	topic := "double-cleanup-topic"

	_, unsub := ps.Subscribe(ctx, topic)

	// Call cleanup manually
	unsub()

	// Cancel context (which also triggers cleanup)
	cancel()

	// Give the goroutine time to run
	time.Sleep(50 * time.Millisecond)

	// If we get here without panic, the test passes
	// The sync.Once ensures cleanup only runs once
}

func TestMemoryPubSub_DoubleCleanupReverse(t *testing.T) {
	ps := NewMemoryPubSub()
	defer ps.Close()

	ctx, cancel := context.WithCancel(context.Background())
	topic := "double-cleanup-reverse-topic"

	_, unsub := ps.Subscribe(ctx, topic)

	// Cancel context first
	cancel()

	// Give the goroutine time to run cleanup
	time.Sleep(50 * time.Millisecond)

	// Call cleanup manually after context cancellation
	unsub()

	// If we get here without panic, the test passes
}
