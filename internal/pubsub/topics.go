package pubsub

import "fmt"

// Topic constants and helper functions for subscription topics.
// Topics follow a hierarchical naming convention: {resource}:{id}

const (
	// Topic prefixes for entity-specific subscriptions
	prefixBot      = "bot"
	prefixBacktest = "backtest"
	prefixAlert    = "alert"
	prefixTrade    = "trade"
	prefixRunner   = "runner"

	// Topic prefixes for organization-level subscriptions (list views)
	prefixOrgBots    = "org:bots"
	prefixOrgTrades  = "org:trades"
	prefixOrgRunners = "org:runners"
)

// BotTopic returns the topic for bot status changes.
// Subscribers receive BotEvent messages.
func BotTopic(botID string) string {
	return fmt.Sprintf("%s:%s", prefixBot, botID)
}

// BacktestTopic returns the topic for backtest progress updates.
// Subscribers receive BacktestEvent messages.
func BacktestTopic(backtestID string) string {
	return fmt.Sprintf("%s:%s", prefixBacktest, backtestID)
}

// AlertTopic returns the topic for alert events for an organization.
// Subscribers receive AlertEvent messages.
func AlertTopic(ownerID string) string {
	return fmt.Sprintf("%s:%s", prefixAlert, ownerID)
}

// TradeTopic returns the topic for trade updates on a specific bot.
// Subscribers receive TradeEvent messages.
func TradeTopic(botID string) string {
	return fmt.Sprintf("%s:%s", prefixTrade, botID)
}

// RunnerTopic returns the topic for runner status changes.
// Subscribers receive RunnerEvent messages.
func RunnerTopic(runnerID string) string {
	return fmt.Sprintf("%s:%s", prefixRunner, runnerID)
}

// Organization-level topics for list views

// OrgBotsTopic returns the topic for all bot changes in an organization.
// Used by list views to receive updates for any bot.
func OrgBotsTopic(ownerID string) string {
	return fmt.Sprintf("%s:%s", prefixOrgBots, ownerID)
}

// OrgTradesTopic returns the topic for all trade changes in an organization.
// Used by list views to receive updates for any trade.
func OrgTradesTopic(ownerID string) string {
	return fmt.Sprintf("%s:%s", prefixOrgTrades, ownerID)
}

// OrgRunnersTopic returns the topic for all runner changes in an organization.
// Used by list views to receive updates for any runner.
func OrgRunnersTopic(ownerID string) string {
	return fmt.Sprintf("%s:%s", prefixOrgRunners, ownerID)
}
