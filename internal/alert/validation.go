package alert

import (
	"fmt"
	"strings"
)

// ValidateEventData validates and sanitizes event data before processing.
// It ensures data lengths are within acceptable limits and truncates if needed.
func ValidateEventData(data map[string]interface{}) error {
	if data == nil {
		return nil
	}

	// Validate and truncate bot_name
	if name, ok := data["bot_name"].(string); ok {
		if len(name) > MaxNameLength {
			data["bot_name"] = name[:MaxNameLength]
		}
	}

	// Validate and truncate strategy_name
	if name, ok := data["strategy_name"].(string); ok {
		if len(name) > MaxNameLength {
			data["strategy_name"] = name[:MaxNameLength]
		}
	}

	// Validate and truncate error_message
	if errMsg, ok := data["error_message"].(string); ok {
		if len(errMsg) > MaxErrorMessageLength {
			data["error_message"] = errMsg[:MaxErrorMessageLength] + "... (truncated)"
		}
	}

	return nil
}

// ValidateRecipients validates the recipient list
func ValidateRecipients(recipients []string) error {
	if len(recipients) == 0 {
		return fmt.Errorf("at least one recipient is required")
	}

	if len(recipients) > MaxRecipientsPerAlert {
		return fmt.Errorf("too many recipients: %d (max: %d)", len(recipients), MaxRecipientsPerAlert)
	}

	for _, r := range recipients {
		if !isValidEmail(r) {
			return fmt.Errorf("invalid email address: %s", r)
		}
	}

	return nil
}

// isValidEmail performs basic email validation
func isValidEmail(email string) bool {
	if email == "" {
		return false
	}

	// Simple validation: must contain @ and have parts before and after
	atIndex := strings.Index(email, "@")
	if atIndex < 1 {
		return false
	}

	domain := email[atIndex+1:]
	if len(domain) < 3 || !strings.Contains(domain, ".") {
		return false
	}

	return true
}
