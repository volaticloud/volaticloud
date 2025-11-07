package monitor

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGenerateInstanceID(t *testing.T) {
	// Generate multiple IDs
	ids := make(map[string]bool)
	for i := 0; i < 100; i++ {
		id := GenerateInstanceID()

		// Should not be empty
		assert.NotEmpty(t, id)

		// Should contain hostname and timestamp
		parts := strings.Split(id, "-")
		assert.GreaterOrEqual(t, len(parts), 2, "ID should have hostname and timestamp")

		// Last part should be a number (nanosecond timestamp)
		lastPart := parts[len(parts)-1]
		assert.Regexp(t, `^\d+$`, lastPart, "Last part should be numeric timestamp")

		// Should not have dots or slashes
		assert.NotContains(t, id, ".")
		assert.NotContains(t, id, "/")

		// Each ID should be unique
		assert.False(t, ids[id], "Generated ID should be unique: %s", id)
		ids[id] = true
	}
}

func TestGenerateInstanceIDFormat(t *testing.T) {
	id := GenerateInstanceID()

	// Format: hostname-nanoseconds
	parts := strings.Split(id, "-")

	// Should have at least 2 parts
	assert.GreaterOrEqual(t, len(parts), 2)

	// Last part should be a valid nanosecond timestamp (long number)
	lastPart := parts[len(parts)-1]
	assert.Regexp(t, `^\d{19}$`, lastPart, "Timestamp should be 19 digits (nanoseconds)")
}
