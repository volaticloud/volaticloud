package channel

import (
	"context"
	"fmt"

	"github.com/sendgrid/sendgrid-go"
	"github.com/sendgrid/sendgrid-go/helpers/mail"
)

// SendGridChannel implements email delivery via SendGrid
type SendGridChannel struct {
	apiKey    string
	fromEmail string
	fromName  string
	client    *sendgrid.Client
}

// SendGridConfig holds configuration for SendGrid channel
type SendGridConfig struct {
	APIKey    string
	FromEmail string
	FromName  string
}

// NewSendGridChannel creates a new SendGrid email channel
func NewSendGridChannel(cfg SendGridConfig) (*SendGridChannel, error) {
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("SendGrid API key is required")
	}
	if cfg.FromEmail == "" {
		return nil, fmt.Errorf("from email is required")
	}

	return &SendGridChannel{
		apiKey:    cfg.APIKey,
		fromEmail: cfg.FromEmail,
		fromName:  cfg.FromName,
		client:    sendgrid.NewSendClient(cfg.APIKey),
	}, nil
}

// Type returns the channel type
func (c *SendGridChannel) Type() ChannelType {
	return ChannelTypeEmail
}

// Send delivers the message via SendGrid
func (c *SendGridChannel) Send(ctx context.Context, msg Message) error {
	if len(msg.Recipients) == 0 {
		return fmt.Errorf("no recipients specified")
	}

	from := mail.NewEmail(c.fromName, c.fromEmail)

	// Build personalization for all recipients
	personalization := mail.NewPersonalization()
	for _, recipient := range msg.Recipients {
		personalization.AddTos(mail.NewEmail("", recipient))
	}

	// Create mail message
	m := mail.NewV3Mail()
	m.SetFrom(from)
	m.Subject = msg.Subject
	m.AddPersonalizations(personalization)

	// Add content
	if msg.Body != "" {
		m.AddContent(mail.NewContent("text/plain", msg.Body))
	}
	if msg.HTMLBody != "" {
		m.AddContent(mail.NewContent("text/html", msg.HTMLBody))
	}

	// Send via SendGrid
	response, err := c.client.SendWithContext(ctx, m)
	if err != nil {
		return fmt.Errorf("sendgrid send failed: %w", err)
	}

	// Check response status
	if response.StatusCode >= 400 {
		return fmt.Errorf("sendgrid returned status %d: %s", response.StatusCode, response.Body)
	}

	return nil
}

// Test validates the SendGrid configuration by sending a test message to the specified recipient
func (c *SendGridChannel) Test(ctx context.Context, recipient string) error {
	if recipient == "" {
		recipient = c.fromEmail
	}

	msg := Message{
		Subject:    "VolatiCloud - Notification Channel Test",
		Body:       "Your notification channel has been configured successfully. You will receive alerts at this email address when events matching your alert rules occur.",
		Recipients: []string{recipient},
	}

	return c.Send(ctx, msg)
}
