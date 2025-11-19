package logger

import (
	"context"
	"fmt"
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// contextKey is a custom type for context keys to avoid collisions
type contextKey string

const loggerKey contextKey = "logger"

// PrepareLogger creates a new ZAP logger and stores it in the context.
// It returns a new context with the logger and the logger itself.
//
// Usage:
//   ctx, logger := logger.PrepareLogger(ctx)
//   logger.Info("Application started")
func PrepareLogger(ctx context.Context) (context.Context, *zap.Logger) {
	logger := NewProductionLogger()
	return context.WithValue(ctx, loggerKey, logger), logger
}

// PrepareLoggerWithConfig creates a new ZAP logger with custom config and stores it in the context.
// It returns a new context with the logger and the logger itself.
func PrepareLoggerWithConfig(ctx context.Context, config zap.Config) (context.Context, *zap.Logger) {
	logger, err := config.Build()
	if err != nil {
		// Fallback to production logger if config fails
		logger = NewProductionLogger()
		logger.Error("Failed to build logger from config, using production logger", zap.Error(err))
	}
	return context.WithValue(ctx, loggerKey, logger), logger
}

// GetLogger retrieves the logger from the context.
// If no logger is found, it creates a new production logger and returns it.
// This ensures GetLogger never returns nil.
//
// Usage:
//   logger := logger.GetLogger(ctx)
//   logger.Info("Processing request")
func GetLogger(ctx context.Context) *zap.Logger {
	if ctx == nil {
		return NewProductionLogger()
	}

	if logger, ok := ctx.Value(loggerKey).(*zap.Logger); ok && logger != nil {
		return logger
	}

	// Return a new production logger if none exists in context
	return NewProductionLogger()
}

// WithFields creates a sub-logger with additional fields from the parent logger in context.
// The sub-logger is stored back in the context.
//
// Usage:
//   ctx = logger.WithFields(ctx, zap.String("bot_id", botID), zap.String("bot_name", botName))
//   logger := logger.GetLogger(ctx)
//   logger.Info("Bot started") // Will include bot_id and bot_name fields
func WithFields(ctx context.Context, fields ...zap.Field) context.Context {
	logger := GetLogger(ctx)
	subLogger := logger.With(fields...)
	return context.WithValue(ctx, loggerKey, subLogger)
}

// WithComponent creates a sub-logger with a "component" field.
// Useful for organizing logs by component/module.
//
// Usage:
//   ctx = logger.WithComponent(ctx, "bot-monitor")
//   logger := logger.GetLogger(ctx)
//   logger.Info("Monitor started") // Will include component=bot-monitor
func WithComponent(ctx context.Context, component string) context.Context {
	return WithFields(ctx, zap.String("component", component))
}

// NewProductionLogger creates a new production-ready ZAP logger.
// It logs at INFO level and above to stdout in JSON format.
func NewProductionLogger() *zap.Logger {
	config := zap.NewProductionConfig()
	config.EncoderConfig.TimeKey = "timestamp"
	config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	logger, err := config.Build()
	if err != nil {
		// Fallback to nop logger if all else fails (should never happen)
		return zap.NewNop()
	}

	return logger
}

// NewDevelopmentLogger creates a new development-friendly ZAP logger.
// It logs at DEBUG level and above to stdout in human-readable console format.
func NewDevelopmentLogger() *zap.Logger {
	config := zap.NewDevelopmentConfig()
	config.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder

	logger, err := config.Build()
	if err != nil {
		// Fallback to nop logger if all else fails
		return zap.NewNop()
	}

	return logger
}

// NewLoggerFromEnv creates a logger based on the VOLATICLOUD_ENV environment variable.
// If VOLATICLOUD_ENV=development, it creates a development logger.
// Otherwise, it creates a production logger.
func NewLoggerFromEnv() *zap.Logger {
	env := os.Getenv("VOLATICLOUD_ENV")
	if env == "development" || env == "dev" {
		return NewDevelopmentLogger()
	}
	return NewProductionLogger()
}

// Sync flushes any buffered log entries from the logger in the context.
// This should be called before application shutdown.
//
// Usage:
//   defer logger.Sync(ctx)
func Sync(ctx context.Context) error {
	logger := GetLogger(ctx)
	return logger.Sync()
}

// Fatal logs a fatal message and exits the application.
// It's a convenience wrapper around logger.Fatal that ensures the logger is synced before exit.
func Fatal(ctx context.Context, msg string, fields ...zap.Field) {
	logger := GetLogger(ctx)
	logger.Fatal(msg, fields...)
}

// Fatalf logs a fatal message with fmt.Sprintf formatting and exits the application.
func Fatalf(ctx context.Context, format string, args ...interface{}) {
	logger := GetLogger(ctx)
	logger.Fatal(fmt.Sprintf(format, args...))
}

// WithLogger stores an existing logger in the context.
// Useful when you already have a logger instance you want to propagate.
func WithLogger(ctx context.Context, logger *zap.Logger) context.Context {
	return context.WithValue(ctx, loggerKey, logger)
}

// EntAdapter creates a logging adapter for ENT ORM that uses ZAP logger.
// ENT expects a func(...any) for logging, this adapter converts ZAP logger to that interface.
//
// Usage with ENT client:
//
//	logger := logger.NewProductionLogger()
//	client := ent.NewClient(
//	    ent.Log(logger.EntAdapter(logger)),
//	    ent.Driver(driver),
//	)
func EntAdapter(logger *zap.Logger) func(...any) {
	return func(args ...any) {
		// ENT logs are typically debug-level SQL queries
		// Format args as a single message string
		msg := fmt.Sprint(args...)
		logger.Debug(msg)
	}
}

// EntAdapterFromContext retrieves logger from context and creates an ENT adapter.
// This is a convenience function for creating ENT clients with context-based logger.
//
// Usage:
//
//	client := ent.NewClient(
//	    ent.Log(logger.EntAdapterFromContext(ctx)),
//	    ent.Driver(driver),
//	)
func EntAdapterFromContext(ctx context.Context) func(...any) {
	logger := GetLogger(ctx)
	return EntAdapter(logger)
}
