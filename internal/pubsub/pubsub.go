package pubsub

import (
	"context"
)

// PubSub defines the interface for publish-subscribe messaging.
// Implementations must be safe for concurrent use.
type PubSub interface {
	// Publish sends a message to all subscribers of the given topic.
	// The payload is JSON-serialized before being sent.
	// Returns an error if the message cannot be published.
	Publish(ctx context.Context, topic string, payload interface{}) error

	// Subscribe returns a channel that receives messages for the given topic.
	// The returned cleanup function must be called when done to release resources.
	// Messages are received as raw JSON bytes.
	// The channel is closed when the context is cancelled or cleanup is called.
	Subscribe(ctx context.Context, topic string) (<-chan []byte, func())

	// Close releases all resources held by the pub/sub client.
	Close() error
}
