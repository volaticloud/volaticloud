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
