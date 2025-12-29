package alert

import "time"

// Default configuration values for alert rules
const (
	// DefaultCooldownMinutes is the default time between alerts for the same rule
	DefaultCooldownMinutes = 5

	// DefaultBatchIntervalMinutes is the default interval for batched alert delivery
	DefaultBatchIntervalMinutes = 60

	// DefaultBatchInterval is the default interval for batch processing
	DefaultBatchInterval = time.Hour
)

// Validation limits
const (
	// MaxRecipientsPerAlert is the maximum number of recipients per alert
	MaxRecipientsPerAlert = 100

	// MaxAlertBodyLength is the maximum length for alert body content
	MaxAlertBodyLength = 10000

	// MaxNameLength is the maximum length for bot/strategy names in alerts
	MaxNameLength = 255

	// MaxErrorMessageLength is the maximum length for error messages
	MaxErrorMessageLength = 5000

	// MaxConditionsSize is the maximum size for conditions JSON
	MaxConditionsSize = 10000
)

// SendGrid API key validation
const (
	// SendGridAPIKeyPrefix is the expected prefix for SendGrid API keys
	SendGridAPIKeyPrefix = "SG."
)
