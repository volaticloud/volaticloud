package graph

import (
	"context"
	"fmt"
	"reflect"
	"strings"

	"github.com/99designs/gqlgen/graphql"
	"github.com/google/uuid"
	"volaticloud/internal/auth"
	"volaticloud/internal/ent"
	"volaticloud/internal/keycloak"
)

// IsAuthenticatedDirective checks if the user is authenticated
// Returns an error if no user context is found (no valid JWT)
func IsAuthenticatedDirective(ctx context.Context, obj interface{}, next graphql.Resolver) (interface{}, error) {
	// Check if user context exists
	_, err := auth.GetUserContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("authentication required: %w", err)
	}

	// User is authenticated, proceed with resolver
	return next(ctx)
}

// HasScopeDirective checks if the user has a specific permission scope on a resource
// Uses Keycloak UMA 2.0 for fine-grained authorization
func HasScopeDirective(
	ctx context.Context,
	obj interface{},
	next graphql.Resolver,
	resourceArg string, // The argument name containing resource ID (e.g., "id")
	scope string, // The permission scope to check (e.g., "edit", "delete")
) (interface{}, error) {
	// Get user context (should exist since auth middleware ran)
	userCtx, err := auth.GetUserContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("authentication required: %w", err)
	}

	// Get resource ID from GraphQL field arguments
	fc := graphql.GetFieldContext(ctx)
	if fc == nil {
		return nil, fmt.Errorf("no field context available")
	}

	// Extract resource ID from arguments
	resourceID, ok := fc.Args[resourceArg].(string)
	if !ok {
		return nil, fmt.Errorf("resource argument '%s' not found or not a string", resourceArg)
	}

	// Get UMA client from context
	umaClient := GetUMAClientFromContext(ctx)

	// Get ENT client from context (type assert from interface{})
	clientInterface := GetEntClientFromContext(ctx)
	if clientInterface == nil {
		return nil, fmt.Errorf("database client not available")
	}

	client, ok := clientInterface.(*ent.Client)
	if !ok {
		return nil, fmt.Errorf("invalid database client type")
	}

	hasPermission, err := VerifyStrategyPermission(ctx, client, umaClient, resourceID, userCtx.RawToken, scope)
	if err != nil {
		return nil, fmt.Errorf("permission check failed: %w", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("insufficient permissions: missing '%s' scope on resource %s", scope, resourceID)
	}

	// User has permission, proceed with resolver
	return next(ctx)
}

// RequiresPermissionDirective checks if the user has permission on the parent node/object
// This is designed for field-level authorization on individual nodes in lists or single queries
// The key difference from HasScopeDirective: extracts resource ID from parent object (obj), not arguments
func RequiresPermissionDirective(
	ctx context.Context,
	obj interface{},
	next graphql.Resolver,
	scope string, // The permission scope to check (e.g., "view", "edit")
	idField *string, // Optional field name containing resource ID (defaults to "id")
) (interface{}, error) {
	// Get user context
	userCtx, err := auth.GetUserContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("authentication required: %w", err)
	}

	// Determine the ID field name
	idFieldName := "id"
	if idField != nil {
		idFieldName = *idField
	}

	// Extract resource ID from the parent object (obj is the Strategy entity)
	resourceID, err := extractResourceID(obj, idFieldName)
	if err != nil {
		return nil, fmt.Errorf("failed to extract resource ID: %w", err)
	}

	// Get UMA client from context
	umaClient := GetUMAClientFromContext(ctx)
	if umaClient == nil {
		return nil, fmt.Errorf("UMA client not available")
	}

	// Get ENT client from context
	clientInterface := GetEntClientFromContext(ctx)
	if clientInterface == nil {
		return nil, fmt.Errorf("database client not available")
	}

	client, ok := clientInterface.(*ent.Client)
	if !ok {
		return nil, fmt.Errorf("invalid database client type")
	}

	// Check permission via Keycloak UMA
	hasPermission, err := VerifyStrategyPermission(ctx, client, umaClient, resourceID, userCtx.RawToken, scope)
	if err != nil {
		return nil, fmt.Errorf("permission check failed: %w", err)
	}

	if !hasPermission {
		// Return null for unauthorized nodes (GraphQL standard pattern)
		// This will show as null in the response with a partial error
		return nil, fmt.Errorf("insufficient permissions: missing '%s' scope on resource %s", scope, resourceID)
	}

	// User has permission, proceed with field resolver
	return next(ctx)
}

// extractResourceID extracts the resource ID from the parent object using reflection
func extractResourceID(obj interface{}, fieldName string) (string, error) {
	if obj == nil {
		return "", fmt.Errorf("parent object is nil")
	}

	// Handle ENT types directly (fast path for common types)
	if strategy, ok := obj.(*ent.Strategy); ok {
		return strategy.ID.String(), nil
	}
	if bot, ok := obj.(*ent.Bot); ok {
		return bot.ID.String(), nil
	}

	// Handle other ENT types by reflection
	v := reflect.ValueOf(obj)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}

	if v.Kind() != reflect.Struct {
		return "", fmt.Errorf("object is not a struct: %T", obj)
	}

	// Try to get the ID field (capitalize first letter for exported field)
	capitalizedFieldName := strings.ToUpper(fieldName[:1]) + fieldName[1:]
	idField := v.FieldByName(capitalizedFieldName)
	if !idField.IsValid() {
		return "", fmt.Errorf("field '%s' not found in object %T", capitalizedFieldName, obj)
	}

	// Handle UUID type
	if uuidVal, ok := idField.Interface().(uuid.UUID); ok {
		return uuidVal.String(), nil
	}

	// Handle string ID
	if idField.Kind() == reflect.String {
		return idField.String(), nil
	}

	return "", fmt.Errorf("unsupported ID field type: %v", idField.Type())
}

// Context keys for storing clients
type contextKey string

const (
	umaClientKey contextKey = "uma_client"
	entClientKey contextKey = "ent_client"
)

// SetUMAClientInContext stores the UMA client in context
func SetUMAClientInContext(ctx context.Context, client *keycloak.UMAClient) context.Context {
	return context.WithValue(ctx, umaClientKey, client)
}

// GetUMAClientFromContext retrieves the UMA client from context
func GetUMAClientFromContext(ctx context.Context) *keycloak.UMAClient {
	if client, ok := ctx.Value(umaClientKey).(*keycloak.UMAClient); ok {
		return client
	}
	return nil
}

// SetEntClientInContext stores the ENT client in context
func SetEntClientInContext(ctx context.Context, client interface{}) context.Context {
	return context.WithValue(ctx, entClientKey, client)
}

// GetEntClientFromContext retrieves the ENT client from context
func GetEntClientFromContext(ctx context.Context) interface{} {
	return ctx.Value(entClientKey)
}
