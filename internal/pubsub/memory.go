package pubsub

import (
	"context"
	"encoding/json"
	"log"
	"sync"
)

// MemoryPubSub implements PubSub using in-memory channels.
// This is useful for single-instance deployments and testing.
type MemoryPubSub struct {
	mu     sync.RWMutex
	subs   map[string][]chan []byte
	closed bool
}

// NewMemoryPubSub creates a new in-memory pub/sub client.
func NewMemoryPubSub() *MemoryPubSub {
	return &MemoryPubSub{
		subs: make(map[string][]chan []byte),
	}
}

// Publish sends a message to all subscribers of the given topic.
func (ps *MemoryPubSub) Publish(ctx context.Context, topic string, payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	ps.mu.RLock()
	defer ps.mu.RUnlock()

	if ps.closed {
		return nil
	}

	subscribers := ps.subs[topic]
	for _, ch := range subscribers {
		select {
		case ch <- data:
		default:
			// Channel full, drop message to prevent blocking
			log.Printf("pubsub: dropping message for topic %s (channel full)", topic)
		}
	}
	return nil
}

// Subscribe returns a channel that receives messages for the given topic.
func (ps *MemoryPubSub) Subscribe(ctx context.Context, topic string) (<-chan []byte, func()) {
	ch := make(chan []byte, 100)

	ps.mu.Lock()
	ps.subs[topic] = append(ps.subs[topic], ch)
	ps.mu.Unlock()

	// Use sync.Once to prevent double-close panic if cleanup is called
	// both manually and via context cancellation
	var once sync.Once
	cleanup := func() {
		once.Do(func() {
			ps.mu.Lock()
			defer ps.mu.Unlock()
			// Check if Close() was already called - it closes all channels
			if ps.closed {
				return
			}
			subscribers := ps.subs[topic]
			for i, c := range subscribers {
				if c == ch {
					ps.subs[topic] = append(subscribers[:i], subscribers[i+1:]...)
					close(ch)
					break
				}
			}
		})
	}

	// Handle context cancellation
	go func() {
		<-ctx.Done()
		cleanup()
	}()

	return ch, cleanup
}

// Close releases all resources held by the pub/sub client.
func (ps *MemoryPubSub) Close() error {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	ps.closed = true
	for _, subscribers := range ps.subs {
		for _, ch := range subscribers {
			close(ch)
		}
	}
	ps.subs = nil
	return nil
}
