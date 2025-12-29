package graph

import (
	"context"
	"fmt"
	"log"
	"reflect"
	"strings"

	"github.com/99designs/gqlgen/graphql"
	"github.com/google/uuid"
	"volaticloud/internal/auth"
	"volaticloud/internal/authz"
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
// This is a generic helper that works with all resource types (Strategy, Bot, Exchange, BotRunner, Backtest, Group)
// For Backtest: permission is checked against the parent Strategy (backtests don't have their own Keycloak resources)
//
// Self-healing: If permission check fails, syncs the resource's scopes to Keycloak and retries once.
// This handles cases where new scopes were added to the application but Keycloak resources are stale.
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
	if s, err := client.Strategy.Get(ctx, id); err == nil {
		hasPermission, permErr := VerifyStrategyPermission(ctx, client, umaClient, resourceID, userToken, scope)
		if !hasPermission && permErr == nil {
			// Permission denied - try self-healing sync and retry
			if syncAndRetry := trySyncStrategy(ctx, s, umaClient); syncAndRetry {
				return VerifyStrategyPermission(ctx, client, umaClient, resourceID, userToken, scope)
			}
		}
		return hasPermission, permErr
	}

	// Check Bot
	if b, err := client.Bot.Get(ctx, id); err == nil {
		hasPermission, permErr := VerifyBotPermission(ctx, client, umaClient, resourceID, userToken, scope)
		if !hasPermission && permErr == nil {
			if syncAndRetry := trySyncBot(ctx, b, umaClient); syncAndRetry {
				return VerifyBotPermission(ctx, client, umaClient, resourceID, userToken, scope)
			}
		}
		return hasPermission, permErr
	}

	// Check Exchange
	if e, err := client.Exchange.Get(ctx, id); err == nil {
		hasPermission, permErr := VerifyExchangePermission(ctx, client, umaClient, resourceID, userToken, scope)
		if !hasPermission && permErr == nil {
			if syncAndRetry := trySyncExchange(ctx, e, umaClient); syncAndRetry {
				return VerifyExchangePermission(ctx, client, umaClient, resourceID, userToken, scope)
			}
		}
		return hasPermission, permErr
	}

	// Check BotRunner
	if r, err := client.BotRunner.Get(ctx, id); err == nil {
		hasPermission, permErr := VerifyBotRunnerPermission(ctx, client, umaClient, resourceID, userToken, scope)
		if !hasPermission && permErr == nil {
			if syncAndRetry := trySyncBotRunner(ctx, r, umaClient); syncAndRetry {
				return VerifyBotRunnerPermission(ctx, client, umaClient, resourceID, userToken, scope)
			}
		}
		return hasPermission, permErr
	}

	// Check Backtest - authorization is delegated to the parent Strategy
	// Backtests don't have their own Keycloak resources; they inherit permissions from Strategy
	if bt, err := client.Backtest.Get(ctx, id); err == nil {
		// Load strategy for potential self-healing
		strategyID := bt.StrategyID
		strategy, stratErr := client.Strategy.Get(ctx, strategyID)
		if stratErr != nil {
			return false, fmt.Errorf("backtest's strategy not found: %w", stratErr)
		}

		hasPermission, permErr := VerifyStrategyPermission(ctx, client, umaClient, strategyID.String(), userToken, scope)
		if !hasPermission && permErr == nil {
			if syncAndRetry := trySyncStrategy(ctx, strategy, umaClient); syncAndRetry {
				return VerifyStrategyPermission(ctx, client, umaClient, strategyID.String(), userToken, scope)
			}
		}
		return hasPermission, permErr
	}

	// If not found in database, it might be a Group resource (managed by Keycloak, not ENT)
	// Groups are registered as resources in Keycloak but not stored in our database
	// Check directly with Keycloak UMA
	if umaClient != nil {
		hasPermission, permErr := umaClient.CheckPermission(ctx, userToken, resourceID, scope)
		// Self-heal if permission denied or error indicates invalid scope
		if authz.ShouldTriggerSelfHealing(hasPermission, permErr) {
			if syncAndRetry := trySyncGroup(ctx, resourceID, umaClient); syncAndRetry {
				return umaClient.CheckPermission(ctx, userToken, resourceID, scope)
			}
		}
		return hasPermission, permErr
	}

	return false, fmt.Errorf("resource not found: %s", resourceID)
}

// ============================================================================
// Self-healing sync helpers
// These sync resource scopes to Keycloak when permission check fails
// ============================================================================

func trySyncStrategy(ctx context.Context, s *ent.Strategy, umaClient keycloak.UMAClientInterface) bool {
	if umaClient == nil {
		return false
	}

	resourceName := fmt.Sprintf("%s (v%d)", s.Name, s.VersionNumber)
	scopes := authz.GetScopesForType(authz.ResourceTypeStrategy)
	attributes := map[string][]string{
		"ownerId": {s.OwnerID},
		"type":    {string(authz.ResourceTypeStrategy)},
		"public":  {fmt.Sprintf("%t", s.Public)},
	}

	err := umaClient.SyncResourceScopes(ctx, s.ID.String(), resourceName, scopes, attributes)
	if err != nil {
		log.Printf("Self-healing: failed to sync strategy %s scopes: %v", s.ID, err)
		return false
	}

	log.Printf("Self-healing: synced strategy %s scopes, retrying permission check", s.ID)
	return true
}

func trySyncBot(ctx context.Context, b *ent.Bot, umaClient keycloak.UMAClientInterface) bool {
	if umaClient == nil {
		return false
	}

	scopes := authz.GetScopesForType(authz.ResourceTypeBot)
	attributes := map[string][]string{
		"ownerId": {b.OwnerID},
		"type":    {string(authz.ResourceTypeBot)},
		"public":  {fmt.Sprintf("%t", b.Public)},
	}

	err := umaClient.SyncResourceScopes(ctx, b.ID.String(), b.Name, scopes, attributes)
	if err != nil {
		log.Printf("Self-healing: failed to sync bot %s scopes: %v", b.ID, err)
		return false
	}

	log.Printf("Self-healing: synced bot %s scopes, retrying permission check", b.ID)
	return true
}

func trySyncExchange(ctx context.Context, e *ent.Exchange, umaClient keycloak.UMAClientInterface) bool {
	if umaClient == nil {
		return false
	}

	scopes := authz.GetScopesForType(authz.ResourceTypeExchange)
	attributes := map[string][]string{
		"ownerId": {e.OwnerID},
		"type":    {string(authz.ResourceTypeExchange)},
	}

	err := umaClient.SyncResourceScopes(ctx, e.ID.String(), e.Name, scopes, attributes)
	if err != nil {
		log.Printf("Self-healing: failed to sync exchange %s scopes: %v", e.ID, err)
		return false
	}

	log.Printf("Self-healing: synced exchange %s scopes, retrying permission check", e.ID)
	return true
}

func trySyncBotRunner(ctx context.Context, r *ent.BotRunner, umaClient keycloak.UMAClientInterface) bool {
	if umaClient == nil {
		return false
	}

	scopes := authz.GetScopesForType(authz.ResourceTypeBotRunner)
	attributes := map[string][]string{
		"ownerId": {r.OwnerID},
		"type":    {string(authz.ResourceTypeBotRunner)},
		"public":  {fmt.Sprintf("%t", r.Public)},
	}

	err := umaClient.SyncResourceScopes(ctx, r.ID.String(), r.Name, scopes, attributes)
	if err != nil {
		log.Printf("Self-healing: failed to sync bot runner %s scopes: %v", r.ID, err)
		return false
	}

	log.Printf("Self-healing: synced bot runner %s scopes, retrying permission check", r.ID)
	return true
}

func trySyncGroup(ctx context.Context, groupID string, umaClient keycloak.UMAClientInterface) bool {
	if umaClient == nil {
		return false
	}

	scopes := authz.GetScopesForType(authz.ResourceTypeGroup)
	attributes := map[string][]string{
		"type": {string(authz.ResourceTypeGroup)},
	}

	// For groups, we use the groupID as both the resource ID and name
	// Groups are managed by Keycloak, so we only sync scopes (not create the resource)
	err := umaClient.SyncResourceScopes(ctx, groupID, groupID, scopes, attributes)
	if err != nil {
		log.Printf("Self-healing: failed to sync group %s scopes: %v", groupID, err)
		return false
	}

	log.Printf("Self-healing: synced group %s scopes, retrying permission check", groupID)
	return true
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
		return nil, fmt.Errorf("you don't have %q access to resource %q", scope, resourceID)
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
		return nil, fmt.Errorf("you don't have %q access to resource %q", scope, resourceID)
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
