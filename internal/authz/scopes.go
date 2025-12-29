// Package authz provides authorization utilities for UMA 2.0 resource management
package authz

import "strings"

// ResourceType represents the type of resource for authorization
type ResourceType string

const (
	ResourceTypeStrategy  ResourceType = "strategy"
	ResourceTypeBot       ResourceType = "bot"
	ResourceTypeExchange  ResourceType = "exchange"
	ResourceTypeBotRunner ResourceType = "bot_runner"
	ResourceTypeGroup     ResourceType = "group"
)

// Permission scopes for each resource type

// StrategyScopes defines the available permission scopes for Strategy resources
// Backtest operations (run-backtest, stop-backtest, delete-backtest) are checked against strategy
// because backtests don't have their own Keycloak resources
var StrategyScopes = []string{"view", "edit", "delete", "run-backtest", "stop-backtest", "delete-backtest"}

// BotScopes defines the available permission scopes for Bot resources
// view-secrets is for sensitive config fields (API keys, trading params)
// freqtrade-api is for obtaining Freqtrade API tokens (used by FreqUI)
var BotScopes = []string{"view", "view-secrets", "run", "stop", "delete", "edit", "freqtrade-api"}

// ExchangeScopes defines the available permission scopes for Exchange resources
// view-secrets is for sensitive config fields (API keys, secrets)
var ExchangeScopes = []string{"view", "view-secrets", "edit", "delete"}

// BotRunnerScopes defines the available permission scopes for BotRunner resources
// view-secrets is for sensitive config fields (connection credentials)
var BotRunnerScopes = []string{"view", "view-secrets", "edit", "delete", "make-public"}

// GroupScopes defines the available permission scopes for Group (organization) resources
// Groups are managed by Keycloak, not in the ENT database
// mark-alert-as-read is for marking alert events as read
var GroupScopes = []string{"view", "edit", "delete", "mark-alert-as-read"}

// GetScopesForType returns the permission scopes for a given resource type
func GetScopesForType(resourceType ResourceType) []string {
	switch resourceType {
	case ResourceTypeStrategy:
		return StrategyScopes
	case ResourceTypeBot:
		return BotScopes
	case ResourceTypeExchange:
		return ExchangeScopes
	case ResourceTypeBotRunner:
		return BotRunnerScopes
	case ResourceTypeGroup:
		return GroupScopes
	default:
		return nil
	}
}

// IsInvalidScopeError checks if an error indicates that a scope is not registered in Keycloak.
// This is used to trigger self-healing scope sync when new scopes are added to the application
// but haven't been synced to existing Keycloak resources yet.
func IsInvalidScopeError(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	return strings.Contains(errStr, "invalid_scope") ||
		strings.Contains(errStr, "invalid scope")
}

// ShouldTriggerSelfHealing determines if self-healing scope sync should be attempted.
// Self-healing is triggered when:
// - Permission was denied (hasPermission=false) AND
// - Either there was no error (simple denial) OR the error indicates invalid scope
func ShouldTriggerSelfHealing(hasPermission bool, err error) bool {
	if hasPermission {
		return false
	}
	return err == nil || IsInvalidScopeError(err)
}
