package channel

import (
	"context"
)

// ChannelType represents the delivery channel type
type ChannelType string

const (
	ChannelTypeEmail   ChannelType = "email"
	ChannelTypeWebhook ChannelType = "webhook" // Reserved for future
	ChannelTypePush    ChannelType = "push"    // Reserved for future
)

// Message represents an alert message ready for delivery
type Message struct {
	Subject    string
	Body       string
	HTMLBody   string
	Recipients []string
	Metadata   map[string]interface{}
}

// Channel defines the interface for alert delivery mechanisms
type Channel interface {
	// Type returns the channel type (email, webhook, push)
	Type() ChannelType

	// Send delivers the message through this channel
	Send(ctx context.Context, msg Message) error

	// Test validates the channel configuration by sending a test message to the specified recipient
	Test(ctx context.Context, recipient string) error
}

// EmailConfig holds configuration for email channels
type EmailConfig struct {
	FromEmail string
	FromName  string
}
