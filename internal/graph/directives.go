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
	"volaticloud/internal/graph/model"
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

// verifyResourcePermission verifies permission for a resource using the provided type hint for O(1) lookup
// This is a generic helper that works with all resource types (Strategy, Bot, Exchange, BotRunner, Backtest, Group)
// For Backtest: permission is checked against the parent Strategy (backtests don't have their own Keycloak resources)
//
// Self-healing: If permission check fails, syncs the resource's scopes to Keycloak and retries once.
// This handles cases where new scopes were added to the application but Keycloak resources are stale.
func verifyResourcePermission(
	ctx context.Context,
	client *ent.Client,
	umaClient keycloak.UMAClientInterface,
	resourceID, userID, userToken, scope string,
	resourceType model.ResourceType,
) (bool, error) {
	switch resourceType {
	case model.ResourceTypeStrategy:
		id, err := uuid.Parse(resourceID)
		if err != nil {
			return false, fmt.Errorf("invalid strategy ID: %w", err)
		}
		s, err := client.Strategy.Get(ctx, id)
		if err != nil {
			return false, fmt.Errorf("strategy not found: %w", err)
		}
		hasPermission, permErr := VerifyStrategyPermission(ctx, client, umaClient, resourceID, userToken, scope)
		if !hasPermission && permErr == nil {
			if syncAndRetry := trySyncStrategy(ctx, s, umaClient, userID, scope); syncAndRetry {
				return VerifyStrategyPermission(ctx, client, umaClient, resourceID, userToken, scope)
			}
		}
		return hasPermission, permErr

	case model.ResourceTypeBot:
		id, err := uuid.Parse(resourceID)
		if err != nil {
			return false, fmt.Errorf("invalid bot ID: %w", err)
		}
		b, err := client.Bot.Get(ctx, id)
		if err != nil {
			return false, fmt.Errorf("bot not found: %w", err)
		}
		hasPermission, permErr := VerifyBotPermission(ctx, client, umaClient, resourceID, userToken, scope)
		if !hasPermission && permErr == nil {
			if syncAndRetry := trySyncBot(ctx, b, umaClient, userID, scope); syncAndRetry {
				return VerifyBotPermission(ctx, client, umaClient, resourceID, userToken, scope)
			}
		}
		return hasPermission, permErr

	case model.ResourceTypeExchange:
		id, err := uuid.Parse(resourceID)
		if err != nil {
			return false, fmt.Errorf("invalid exchange ID: %w", err)
		}
		e, err := client.Exchange.Get(ctx, id)
		if err != nil {
			return false, fmt.Errorf("exchange not found: %w", err)
		}
		hasPermission, permErr := VerifyExchangePermission(ctx, client, umaClient, resourceID, userToken, scope)
		if !hasPermission && permErr == nil {
			if syncAndRetry := trySyncExchange(ctx, e, umaClient, userID, scope); syncAndRetry {
				return VerifyExchangePermission(ctx, client, umaClient, resourceID, userToken, scope)
			}
		}
		return hasPermission, permErr

	case model.ResourceTypeBotRunner:
		id, err := uuid.Parse(resourceID)
		if err != nil {
			return false, fmt.Errorf("invalid bot runner ID: %w", err)
		}
		r, err := client.BotRunner.Get(ctx, id)
		if err != nil {
			return false, fmt.Errorf("bot runner not found: %w", err)
		}
		hasPermission, permErr := VerifyBotRunnerPermission(ctx, client, umaClient, resourceID, userToken, scope)
		if !hasPermission && permErr == nil {
			if syncAndRetry := trySyncBotRunner(ctx, r, umaClient, userID, scope); syncAndRetry {
				return VerifyBotRunnerPermission(ctx, client, umaClient, resourceID, userToken, scope)
			}
		}
		return hasPermission, permErr

	case model.ResourceTypeBacktest:
		id, err := uuid.Parse(resourceID)
		if err != nil {
			return false, fmt.Errorf("invalid backtest ID: %w", err)
		}
		bt, err := client.Backtest.Get(ctx, id)
		if err != nil {
			return false, fmt.Errorf("backtest not found: %w", err)
		}
		// Backtests inherit permissions from their parent Strategy
		strategyID := bt.StrategyID
		strategy, stratErr := client.Strategy.Get(ctx, strategyID)
		if stratErr != nil {
			return false, fmt.Errorf("backtest's strategy not found: %w", stratErr)
		}
		hasPermission, permErr := VerifyStrategyPermission(ctx, client, umaClient, strategyID.String(), userToken, scope)
		if !hasPermission && permErr == nil {
			if syncAndRetry := trySyncStrategy(ctx, strategy, umaClient, userID, scope); syncAndRetry {
				return VerifyStrategyPermission(ctx, client, umaClient, strategyID.String(), userToken, scope)
			}
		}
		return hasPermission, permErr

	case model.ResourceTypeOrganization:
		// Organizations are registered as resources in Keycloak but not stored in our database
		// Check directly with Keycloak UMA (resourceID can be UUID or alias)
		if umaClient == nil {
			return false, fmt.Errorf("UMA client not available for group permission check")
		}
		hasPermission, permErr := umaClient.CheckPermission(ctx, userToken, resourceID, scope)
		if authz.ShouldTriggerSelfHealing(hasPermission, permErr) {
			if syncAndRetry := trySyncGroup(ctx, resourceID, umaClient, userID, scope); syncAndRetry {
				return umaClient.CheckPermission(ctx, userToken, resourceID, scope)
			}
		}
		return hasPermission, permErr

	default:
		return false, fmt.Errorf("unknown resource type: %s", resourceType)
	}
}

// ============================================================================
// Self-healing sync helpers
// These sync resource scopes to Keycloak when permission check fails
// ============================================================================

// trySyncResource is a generic helper that syncs a resource's scopes to Keycloak.
// It handles the common pattern of:
// 1. Getting scopes for the resource type
// 2. Building attributes with ownerId, type, and optionally public flag
// 3. Calling SyncResourceScopes
// 4. Logging success/failure with user context for observability
//
// Parameters:
//   - resourceID: The unique identifier of the resource
//   - resourceName: Human-readable name for the resource
//   - resourceType: The type of resource (for scopes and attributes)
//   - ownerID: The owner's ID (empty string for resources without owners like groups)
//   - public: Whether the resource is public (only used for types that support public visibility)
//   - userID: The ID of the user who triggered the sync (for audit logging)
//   - scope: The permission scope being checked (for audit logging)
func trySyncResource(
	ctx context.Context,
	umaClient keycloak.UMAClientInterface,
	resourceID, resourceName string,
	resourceType authz.ResourceType,
	ownerID string,
	public *bool,
	userID, scope string,
) bool {
	if umaClient == nil {
		return false
	}

	scopes := authz.GetScopesForType(resourceType)
	attributes := map[string][]string{
		"type": {string(resourceType)},
	}

	// Add ownerId for resources that have owners
	if ownerID != "" {
		attributes["ownerId"] = []string{ownerID}
	}

	// Add public flag for resources that support visibility
	if public != nil {
		attributes["public"] = []string{fmt.Sprintf("%t", *public)}
	}

	err := umaClient.SyncResourceScopes(ctx, resourceID, resourceName, scopes, attributes)
	if err != nil {
		log.Printf("Self-healing: failed to sync %s %s scopes (user=%s, scope=%s): %v",
			resourceType, resourceID, userID, scope, err)
		return false
	}

	log.Printf("Self-healing: synced %s %s scopes (user=%s, scope=%s), retrying permission check",
		resourceType, resourceID, userID, scope)
	return true
}

func trySyncStrategy(ctx context.Context, s *ent.Strategy, umaClient keycloak.UMAClientInterface, userID, scope string) bool {
	resourceName := fmt.Sprintf("%s (v%d)", s.Name, s.VersionNumber)
	return trySyncResource(ctx, umaClient, s.ID.String(), resourceName, authz.ResourceTypeStrategy, s.OwnerID, &s.Public, userID, scope)
}

func trySyncBot(ctx context.Context, b *ent.Bot, umaClient keycloak.UMAClientInterface, userID, scope string) bool {
	return trySyncResource(ctx, umaClient, b.ID.String(), b.Name, authz.ResourceTypeBot, b.OwnerID, &b.Public, userID, scope)
}

func trySyncExchange(ctx context.Context, e *ent.Exchange, umaClient keycloak.UMAClientInterface, userID, scope string) bool {
	return trySyncResource(ctx, umaClient, e.ID.String(), e.Name, authz.ResourceTypeExchange, e.OwnerID, nil, userID, scope)
}

func trySyncBotRunner(ctx context.Context, r *ent.BotRunner, umaClient keycloak.UMAClientInterface, userID, scope string) bool {
	return trySyncResource(ctx, umaClient, r.ID.String(), r.Name, authz.ResourceTypeBotRunner, r.OwnerID, &r.Public, userID, scope)
}

func trySyncGroup(ctx context.Context, groupID string, umaClient keycloak.UMAClientInterface, userID, scope string) bool {
	// For groups, we use the groupID as both the resource ID and name
	// Groups are managed by Keycloak, so we only sync scopes (not create the resource)
	return trySyncResource(ctx, umaClient, groupID, groupID, authz.ResourceTypeGroup, "", nil, userID, scope)
}

// HasScopeDirective checks if the user has a specific permission scope on a resource
// Uses Keycloak UMA 2.0 for fine-grained authorization
//
// Two modes of operation:
// 1. Argument mode (fromParent=false): Extracts resource ID from GraphQL arguments
//   - Supports nested paths like "where.ownerID" for list queries
//   - Used for mutations and queries
//
// 2. Field mode (fromParent=true): Extracts resource ID from parent object
//   - Used for field-level permissions on types
//   - Example: Backtest.result checking permission on parent Strategy
//
// The resourceType parameter is required for O(1) resource lookup
func HasScopeDirective(
	ctx context.Context,
	obj interface{},
	next graphql.Resolver,
	resourceArg string, // The resource ID source (argument path or field name)
	scope string, // The permission scope to check (e.g., "edit", "delete", "view")
	resourceType model.ResourceType, // Required type hint for O(1) lookup (e.g., STRATEGY, BOT)
	fromParent *bool, // If true, extract resource ID from parent object instead of arguments
) (interface{}, error) {
	// Get user context (should exist since auth middleware ran)
	userCtx, err := auth.GetUserContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("authentication required: %w", err)
	}

	var resourceID string

	// Determine extraction mode
	extractFromParent := fromParent != nil && *fromParent

	if extractFromParent {
		// Field mode: extract resource ID from parent object's field
		resourceID, err = extractResourceID(obj, resourceArg)
		if err != nil {
			return nil, fmt.Errorf("failed to extract resource ID from parent: %w", err)
		}
	} else {
		// Argument mode: extract resource ID from GraphQL arguments
		fc := graphql.GetFieldContext(ctx)
		if fc == nil {
			return nil, fmt.Errorf("no field context available")
		}

		resourceID, err = extractArgumentValue(fc.Args, resourceArg)
		if err != nil {
			// For list queries, if ownerID is not provided, deny access
			// This ensures users must explicitly specify which group they're querying
			return nil, fmt.Errorf("resource argument '%s' is required: %w", resourceArg, err)
		}
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

	// Use permission verification with the provided resource type for O(1) lookup
	hasPermission, err := verifyResourcePermission(ctx, client, umaClient, resourceID, userCtx.UserID, userCtx.RawToken, scope, resourceType)
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
	umaClientKey   contextKey = "uma_client"
	entClientKey   contextKey = "ent_client"
	adminClientKey contextKey = "admin_client"
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

// SetAdminClientInContext stores the Keycloak Admin client in context
func SetAdminClientInContext(ctx context.Context, client keycloak.AdminClientInterface) context.Context {
	return context.WithValue(ctx, adminClientKey, client)
}

// GetAdminClientFromContext retrieves the Keycloak Admin client from context
func GetAdminClientFromContext(ctx context.Context) keycloak.AdminClientInterface {
	if client, ok := ctx.Value(adminClientKey).(keycloak.AdminClientInterface); ok {
		return client
	}
	return nil
}
