package alert

import "context"

// contextKey is used for context values to avoid collisions
type contextKey string

const (
	// managerContextKey is the context key for the alert manager
	managerContextKey contextKey = "alert_manager"
	// serviceContextKey is the context key for the alert service
	serviceContextKey contextKey = "alert_service"
)

// SetManagerInContext returns a new context with the alert manager set
func SetManagerInContext(ctx context.Context, manager *Manager) context.Context {
	return context.WithValue(ctx, managerContextKey, manager)
}

// GetManagerFromContext retrieves the alert manager from context
// Returns nil if no manager is set
func GetManagerFromContext(ctx context.Context) *Manager {
	manager, ok := ctx.Value(managerContextKey).(*Manager)
	if !ok {
		return nil
	}
	return manager
}

// SetServiceInContext returns a new context with the alert service set
func SetServiceInContext(ctx context.Context, service *Service) context.Context {
	return context.WithValue(ctx, serviceContextKey, service)
}

// GetServiceFromContext retrieves the alert service from context
// Returns nil if no service is set
func GetServiceFromContext(ctx context.Context) *Service {
	service, ok := ctx.Value(serviceContextKey).(*Service)
	if !ok {
		return nil
	}
	return service
}
