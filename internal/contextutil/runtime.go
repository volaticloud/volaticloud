package contextutil

import (
	"context"
	"fmt"

	"anytrade/internal/ent"
	"anytrade/internal/runner"
)

type contextKey string

const (
	runtimeKey contextKey = "runtime"
)

// InitRuntime initializes a runtime from a BotRuntime entity and stores it in context
// Returns the updated context and any error
func InitRuntime(ctx context.Context, botRuntime *ent.BotRuntime) (context.Context, error) {
	if botRuntime == nil {
		return ctx, fmt.Errorf("botRuntime cannot be nil")
	}

	// Create factory
	factory := runner.NewFactory()

	// Create runtime from entity config
	rt, err := factory.Create(ctx, botRuntime.Type, botRuntime.Config)
	if err != nil {
		return ctx, fmt.Errorf("failed to create runtime: %w", err)
	}

	// Store in context
	return context.WithValue(ctx, runtimeKey, rt), nil
}

// InitRuntimeDirect initializes a runtime directly and stores it in context
// Useful for testing or when you already have a runtime instance
func InitRuntimeDirect(ctx context.Context, rt runner.Runtime) context.Context {
	return context.WithValue(ctx, runtimeKey, rt)
}

// GetRuntime retrieves the runtime from context
// Panics if runtime is not found (fail-fast pattern per ARCHITECTURE.md)
func GetRuntime(ctx context.Context) runner.Runtime {
	rt, ok := ctx.Value(runtimeKey).(runner.Runtime)
	if !ok || rt == nil {
		panic("runtime not found in context - did you forget to call InitRuntime?")
	}
	return rt
}

// GetRuntimeSafe retrieves the runtime from context, returning an error instead of panicking
// Use this when you want to handle missing runtime gracefully
func GetRuntimeSafe(ctx context.Context) (runner.Runtime, error) {
	rt, ok := ctx.Value(runtimeKey).(runner.Runtime)
	if !ok || rt == nil {
		return nil, fmt.Errorf("runtime not found in context")
	}
	return rt, nil
}

// HasRuntime checks if a runtime is present in the context
func HasRuntime(ctx context.Context) bool {
	rt, ok := ctx.Value(runtimeKey).(runner.Runtime)
	return ok && rt != nil
}
