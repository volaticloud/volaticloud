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

// verifyResourcePermission dynamically determines the resource type and verifies permission
// This is a generic helper that works with all resource types (Strategy, Bot, Exchange, BotRunner, Group)
func verifyResourcePermission(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	resourceID, userToken, scope string,
) (bool, error) {
	// Parse resource ID to UUID
	id, err := uuid.Parse(resourceID)
	if err != nil {
		return false, fmt.Errorf("invalid resource ID: %w", err)
	}

	// Try to find the resource and determine its type
	// Check Strategy
	if _, err := client.Strategy.Get(ctx, id); err == nil {
		return VerifyStrategyPermission(ctx, client, umaClient, resourceID, userToken, scope)
	}

	// Check Bot
	if _, err := client.Bot.Get(ctx, id); err == nil {
		return VerifyBotPermission(ctx, client, umaClient, resourceID, userToken, scope)
	}

	// Check Exchange
	if _, err := client.Exchange.Get(ctx, id); err == nil {
		return VerifyExchangePermission(ctx, client, umaClient, resourceID, userToken, scope)
	}

	// Check BotRunner
	if _, err := client.BotRunner.Get(ctx, id); err == nil {
		return VerifyBotRunnerPermission(ctx, client, umaClient, resourceID, userToken, scope)
	}

	// If not found in database, it might be a Group resource (managed by Keycloak, not ENT)
	// Groups are registered as resources in Keycloak but not stored in our database
	// Check directly with Keycloak UMA
	if umaClient != nil {
		return umaClient.CheckPermission(ctx, userToken, resourceID, scope)
	}

	return false, fmt.Errorf("resource not found: %s", resourceID)
}

// HasScopeDirective checks if the user has a specific permission scope on a resource
// Uses Keycloak UMA 2.0 for fine-grained authorization
// Supports nested argument paths like "where.ownerID" for list queries
func HasScopeDirective(
	ctx context.Context,
	obj interface{},
	next graphql.Resolver,
	resourceArg string, // The argument path containing resource ID (e.g., "id" or "where.ownerID")
	scope string, // The permission scope to check (e.g., "edit", "delete", "view")
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

	// Extract resource ID from arguments (supports nested paths like "where.ownerID")
	resourceID, err := extractArgumentValue(fc.Args, resourceArg)
	if err != nil {
		// For list queries, if ownerID is not provided, deny access
		// This ensures users must explicitly specify which group they're querying
		return nil, fmt.Errorf("resource argument '%s' is required: %w", resourceArg, err)
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

	// Use generic permission verification that supports all resource types
	hasPermission, err := verifyResourcePermission(ctx, client, umaClient, resourceID, userCtx.RawToken, scope)
	if err != nil {
		return nil, fmt.Errorf("permission check failed: %w", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("insufficient permissions: missing '%s' scope on resource %s", scope, resourceID)
	}

	// User has permission, proceed with resolver
	return next(ctx)
}

// extractArgumentValue extracts a value from GraphQL arguments using a dot-notation path
// Supports: "id" (direct), "where.ownerID" (nested), "input.strategyID" (nested)
func extractArgumentValue(args map[string]interface{}, path string) (string, error) {
	parts := strings.Split(path, ".")
	var current interface{} = args

	for i, part := range parts {
		switch v := current.(type) {
		case map[string]interface{}:
			val, exists := v[part]
			if !exists {
				return "", fmt.Errorf("path '%s' not found at '%s'", path, part)
			}
			current = val
		default:
			// Try reflection for struct types (e.g., WhereInput structs)
			rv := reflect.ValueOf(current)
			if rv.Kind() == reflect.Ptr {
				if rv.IsNil() {
					return "", fmt.Errorf("path '%s' is nil at '%s'", path, part)
				}
				rv = rv.Elem()
			}
			if rv.Kind() == reflect.Struct {
				// Try to find field by name (case-insensitive first letter)
				fieldName := strings.ToUpper(part[:1]) + part[1:]
				field := rv.FieldByName(fieldName)
				if !field.IsValid() {
					// Try exact match
					field = rv.FieldByName(part)
				}
				if !field.IsValid() {
					return "", fmt.Errorf("field '%s' not found in struct at path '%s'", part, path)
				}
				current = field.Interface()
			} else {
				return "", fmt.Errorf("cannot navigate path '%s' at '%s' (type: %T)", path, parts[i-1], current)
			}
		}
	}

	// Convert final value to string
	switch v := current.(type) {
	case string:
		if v == "" {
			return "", fmt.Errorf("value at path '%s' is empty", path)
		}
		return v, nil
	case *string:
		if v == nil || *v == "" {
			return "", fmt.Errorf("value at path '%s' is nil or empty", path)
		}
		return *v, nil
	default:
		// Try fmt.Stringer interface
		if stringer, ok := current.(fmt.Stringer); ok {
			s := stringer.String()
			if s == "" {
				return "", fmt.Errorf("value at path '%s' is empty", path)
			}
			return s, nil
		}
		return "", fmt.Errorf("value at path '%s' is not a string (type: %T)", path, current)
	}
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

	// Use generic permission verification that supports all resource types
	hasPermission, err := verifyResourcePermission(ctx, client, umaClient, resourceID, userCtx.RawToken, scope)
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
	if exchange, ok := obj.(*ent.Exchange); ok {
		return exchange.ID.String(), nil
	}
	if runner, ok := obj.(*ent.BotRunner); ok {
		return runner.ID.String(), nil
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
func SetUMAClientInContext(ctx context.Context, client keycloak.UMAClientInterface) context.Context {
	return context.WithValue(ctx, umaClientKey, client)
}

// GetUMAClientFromContext retrieves the UMA client from context
func GetUMAClientFromContext(ctx context.Context) keycloak.UMAClientInterface {
	if client, ok := ctx.Value(umaClientKey).(keycloak.UMAClientInterface); ok {
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
