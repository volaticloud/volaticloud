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

// AlertRuleScopes are shared scopes for alert rule management on resources
// These are added to resource types that support alert rules (Bot, Strategy, BotRunner, Group)
var AlertRuleScopes = []string{"create-alert-rule", "update-alert-rule", "delete-alert-rule", "view-alert-rules"}

// StrategyScopes defines the available permission scopes for Strategy resources
// Backtest operations (run-backtest, stop-backtest, delete-backtest) are checked against strategy
// because backtests don't have their own Keycloak resources
// Alert rule scopes are included for strategy-level alerts
var StrategyScopes = []string{"view", "edit", "delete", "run-backtest", "stop-backtest", "delete-backtest", "make-public",
	"create-alert-rule", "update-alert-rule", "delete-alert-rule", "view-alert-rules", "view-users"}

// BotScopes defines the available permission scopes for Bot resources
// view-secrets is for sensitive config fields (API keys, trading params)
// freqtrade-api is for obtaining Freqtrade API tokens (used by FreqUI)
// Alert rule scopes are included for bot-level alerts
var BotScopes = []string{"view", "view-secrets", "run", "stop", "delete", "edit", "freqtrade-api", "make-public",
	"create-alert-rule", "update-alert-rule", "delete-alert-rule", "view-alert-rules", "view-users"}

// ExchangeScopes defines the available permission scopes for Exchange resources
// view-secrets is for sensitive config fields (API keys, secrets)
var ExchangeScopes = []string{"view", "view-secrets", "edit", "delete", "view-users"}

// BotRunnerScopes defines the available permission scopes for BotRunner resources
// view-secrets is for sensitive config fields (connection credentials)
// Alert rule scopes are included for runner-level alerts
var BotRunnerScopes = []string{"view", "view-secrets", "edit", "delete", "make-public",
	"create-alert-rule", "update-alert-rule", "delete-alert-rule", "view-alert-rules", "view-users"}

// GroupScopes defines the available permission scopes for Group (organization) resources
// Groups are managed by Keycloak, not in the ENT database
// mark-alert-as-read is for marking alert events as read
// view-users is for viewing organization members
// invite-user is for inviting new users to the organization
// change-user-roles is for changing user roles within the organization
// create-* scopes are for creating new entities within the organization
// Alert rule scopes are included for organization-wide alerts
var GroupScopes = []string{"view", "edit", "delete", "mark-alert-as-read", "view-users", "invite-user", "change-user-roles",
	"create-strategy", "create-bot", "create-exchange", "create-runner",
	"create-alert-rule", "update-alert-rule", "delete-alert-rule", "view-alert-rules",
	"view-billing", "manage-billing"}

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

// IsInvalidScopeError checks if an error indicates that a scope or resource is not properly
// registered in Keycloak. This is used to trigger self-healing scope sync when new scopes
// are added to the application but haven't been synced to existing Keycloak resources yet.
// Note: Keycloak may return "invalid_resource" when a scope doesn't exist on a resource.
func IsInvalidScopeError(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	return strings.Contains(errStr, "invalid_scope") ||
		strings.Contains(errStr, "invalid scope") ||
		strings.Contains(errStr, "invalid_resource") ||
		strings.Contains(errStr, "does not exist")
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
