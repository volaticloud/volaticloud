// Package authz provides authorization utilities for UMA 2.0 resource management
package authz

// ResourceType represents the type of resource for authorization
type ResourceType string

const (
	ResourceTypeStrategy  ResourceType = "strategy"
	ResourceTypeBot       ResourceType = "bot"
	ResourceTypeExchange  ResourceType = "exchange"
	ResourceTypeBotRunner ResourceType = "bot_runner"
)

// Permission scopes for each resource type

// StrategyScopes defines the available permission scopes for Strategy resources
var StrategyScopes = []string{"view", "edit", "backtest", "delete"}

// BotScopes defines the available permission scopes for Bot resources
var BotScopes = []string{"view", "run", "stop", "delete", "edit"}

// ExchangeScopes defines the available permission scopes for Exchange resources
var ExchangeScopes = []string{"view", "edit", "delete"}

// BotRunnerScopes defines the available permission scopes for BotRunner resources
var BotRunnerScopes = []string{"view", "edit", "delete", "make-public"}

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
	default:
		return nil
	}
}
