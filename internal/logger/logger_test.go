package logger

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"go.uber.org/zap"
)

func TestPrepareLogger(t *testing.T) {
	ctx := context.Background()
	newCtx, logger := PrepareLogger(ctx)

	assert.NotNil(t, logger)
	assert.NotNil(t, newCtx)
	assert.NotEqual(t, ctx, newCtx)

	// Verify logger is stored in context
	retrievedLogger := GetLogger(newCtx)
	assert.Equal(t, logger, retrievedLogger)
}

func TestGetLogger_WithLogger(t *testing.T) {
	ctx := context.Background()
	ctx, logger := PrepareLogger(ctx)

	retrievedLogger := GetLogger(ctx)
	assert.NotNil(t, retrievedLogger)
	assert.Equal(t, logger, retrievedLogger)
}

func TestGetLogger_WithoutLogger(t *testing.T) {
	ctx := context.Background()

	// Should return a new logger if none exists
	logger := GetLogger(ctx)
	assert.NotNil(t, logger)
}

func TestGetLogger_NilContext(t *testing.T) {
	// Should handle nil context gracefully
	logger := GetLogger(nil)
	assert.NotNil(t, logger)
}

func TestWithFields(t *testing.T) {
	ctx := context.Background()
	ctx, _ = PrepareLogger(ctx)

	// Add fields to create sub-logger
	newCtx := WithFields(ctx, zap.String("user_id", "123"), zap.Int("request_id", 456))

	logger := GetLogger(newCtx)
	assert.NotNil(t, logger)

	// The logger should have the fields (we can't easily verify this without capturing logs)
	// But at least verify it doesn't panic
	logger.Info("Test message")
}

func TestWithComponent(t *testing.T) {
	ctx := context.Background()
	ctx, _ = PrepareLogger(ctx)

	newCtx := WithComponent(ctx, "test-component")

	logger := GetLogger(newCtx)
	assert.NotNil(t, logger)

	logger.Info("Test message with component")
}

func TestWithLogger(t *testing.T) {
	ctx := context.Background()
	customLogger := NewDevelopmentLogger()

	newCtx := WithLogger(ctx, customLogger)

	retrievedLogger := GetLogger(newCtx)
	assert.Equal(t, customLogger, retrievedLogger)
}

func TestNewProductionLogger(t *testing.T) {
	logger := NewProductionLogger()
	assert.NotNil(t, logger)

	// Should not panic when logging
	logger.Info("Test production logger")
}

func TestNewDevelopmentLogger(t *testing.T) {
	logger := NewDevelopmentLogger()
	assert.NotNil(t, logger)

	// Should not panic when logging
	logger.Debug("Test development logger")
}

func TestSync(t *testing.T) {
	ctx := context.Background()
	ctx, _ = PrepareLogger(ctx)

	// Should not panic
	err := Sync(ctx)
	// Sync may return an error on some systems (e.g., syncing stdout), so we don't assert
	_ = err
}

func TestPrepareLoggerWithConfig(t *testing.T) {
	ctx := context.Background()
	config := zap.NewDevelopmentConfig()

	newCtx, logger := PrepareLoggerWithConfig(ctx, config)

	assert.NotNil(t, logger)
	assert.NotNil(t, newCtx)

	retrievedLogger := GetLogger(newCtx)
	assert.Equal(t, logger, retrievedLogger)
}
