package pubsub

import (
	"context"
	"encoding/json"
	"log"
	"sync"

	"github.com/redis/go-redis/v9"
)

// RedisPubSub implements PubSub using Redis pub/sub.
type RedisPubSub struct {
	client *redis.Client
	mu     sync.Mutex
	subs   []*redis.PubSub
}

// NewRedisPubSub creates a new Redis-backed pub/sub client.
func NewRedisPubSub(client *redis.Client) *RedisPubSub {
	return &RedisPubSub{
		client: client,
		subs:   make([]*redis.PubSub, 0),
	}
}

// Publish sends a message to all subscribers of the given topic.
func (ps *RedisPubSub) Publish(ctx context.Context, topic string, payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return ps.client.Publish(ctx, topic, data).Err()
}

// Subscribe returns a channel that receives messages for the given topic.
func (ps *RedisPubSub) Subscribe(ctx context.Context, topic string) (<-chan []byte, func()) {
	sub := ps.client.Subscribe(ctx, topic)

	// Track subscription for cleanup
	ps.mu.Lock()
	ps.subs = append(ps.subs, sub)
	ps.mu.Unlock()

	ch := make(chan []byte, 100)

	go func() {
		defer close(ch)
		msgCh := sub.Channel()
		for {
			select {
			case <-ctx.Done():
				return
			case msg, ok := <-msgCh:
				if !ok {
					return
				}
				select {
				case ch <- []byte(msg.Payload):
				default:
					// Channel full, drop message to prevent blocking
					log.Printf("pubsub: dropping message for topic %s (channel full)", topic)
				}
			}
		}
	}()

	cleanup := func() {
		_ = sub.Close()
		ps.mu.Lock()
		for i, s := range ps.subs {
			if s == sub {
				ps.subs = append(ps.subs[:i], ps.subs[i+1:]...)
				break
			}
		}
		ps.mu.Unlock()
	}

	return ch, cleanup
}

// Close releases all resources held by the pub/sub client.
func (ps *RedisPubSub) Close() error {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	for _, sub := range ps.subs {
		_ = sub.Close()
	}
	ps.subs = nil
	return ps.client.Close()
}
