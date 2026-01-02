/*
Package alert provides a comprehensive alerting and notification system for VolatiCloud.

# Architecture Overview

The alert package implements a generic, multi-tenant alerting system that monitors resources
(bots, strategies, runners) and delivers notifications through email (extensible to webhook, push).

```mermaid
flowchart TB

	subgraph Sources["Event Sources"]
	    BM[BotMonitor]
	    TS[TradeSync]
	    BTM[BacktestMonitor]
	end

	subgraph AlertManager["Alert Manager"]
	    EV[Evaluator<br/>Rule Matching<br/>Cooldown Check]
	    DP[Dispatcher<br/>Event Routing<br/>Alert Building]
	    BA[Batcher<br/>Digest Batching<br/>Interval Flush]
	    EC[Email Channel<br/>SendGrid]
	end

	subgraph Storage["ENT Entities"]
	    AR[AlertRule]
	    AE[AlertEvent]
	end

	BM --> EV
	TS --> EV
	BTM --> EV
	EV --> DP
	DP --> BA
	BA --> EC
	DP --> EC
	DP --> AE
	EV --> AR

```

# Component Responsibilities

Manager:
  - Orchestrates all alerting components (evaluator, dispatcher, batcher)
  - Manages lifecycle (Start/Stop)
  - Exposes event handler methods for integration with monitor package
  - Context-based dependency injection for gqlgen resolvers

Evaluator:
  - Matches incoming events against alert rules
  - Evaluates rule conditions (thresholds, status values)
  - Checks cooldown periods to prevent alert storms
  - Returns matching rules for event processing

Dispatcher:
  - Routes events to email channel
  - Builds alert content (subject, body) from templates
  - Creates AlertEvent records for audit trail
  - Handles immediate vs batched delivery modes

Batcher:
  - Aggregates alerts for batched delivery mode
  - Flushes batches at configured intervals
  - Creates digest emails with multiple alerts

Channel:
  - Interface for delivery mechanisms
  - Email channel (SendGrid) configured at app level
  - Extensible for webhook, push notifications (future)

# Authorization & Self-Healing

The alert service implements UMA 2.0 authorization with automatic self-healing scope synchronization.

Permission Checks:
  - All CRUD operations (CreateRule, UpdateRule, DeleteRule, ToggleRule) require permission checks
  - Permissions are checked against the alert's target resource (bot, strategy, runner, organization)
  - Uses scopes: create-alert-rule, update-alert-rule, delete-alert-rule

Resource Scoping:
  - Organization-level alerts: permission checked against ownerID (organization/group ID)
  - Resource-specific alerts: permission checked against resourceID (bot/strategy/runner UUID)

Self-Healing Behavior:
  - When permission check fails with "invalid_scope" or "resource does not exist" error
  - Service calls authz.SyncResourcePermissions to sync scopes with Keycloak UMA registry
  - After successful sync, permission check is automatically retried
  - Sync failures are logged but don't block the request (fail open for stale cache)
  - Prevents permission errors caused by missing or outdated scopes in Keycloak

Implementation:
  - checkAlertPermission() method (service.go:43-86)
  - Uses authz.ShouldTriggerSelfHealing() to detect scope issues
  - Uses authz.SyncResourcePermissions() to sync scopes
  - Logs self-healing attempts for audit trail

Example Flow:

	1. User creates alert rule on bot-123
	2. Permission check: UMA returns "invalid_scope: create-alert-rule"
	3. Self-healing triggered: sync bot-123 scopes with Keycloak
	4. Permission re-checked: UMA grants access
	5. Alert rule created successfully

This ensures alert operations work even when Keycloak scopes are out of sync with database resources.

# Event Types

Event types are defined in their source domains (following DDD):

  - monitor.BotStatusEvent: Status changes from BotMonitor
  - monitor.TradeEvent: Trade opened/closed from TradeSync
  - monitor.BacktestEvent: Backtest completion from BacktestMonitor

The alert package defines only alert-specific types (Alert, RuleMatch, etc.).

# Usage Patterns

## Integration with Monitor Package

The alert manager is injected into context and accessed by monitors:

	// In cmd/server/main.go
	alertManager, err := alert.NewManager(alert.Config{
		DatabaseClient: entClient,
	})

	// Configure email channel
	emailChannel, _ := channel.NewSendGridChannel(channel.SendGridConfig{
		APIKey:    os.Getenv("SENDGRID_API_KEY"),
		FromEmail: "alerts@volaticloud.com",
		FromName:  "VolatiCloud Alerts",
	})
	alertManager.SetEmailChannel(emailChannel)

	alertManager.Start(ctx)
	defer alertManager.Stop(ctx)

	// Inject into context
	ctx = alert.SetManagerInContext(ctx, alertManager)

	// In internal/monitor/bot_monitor.go
	if oldStatus != newStatus {
		alertMgr := alert.GetManagerFromContext(ctx)
		if alertMgr != nil {
			alertMgr.HandleBotStatus(ctx, monitor.BotStatusEvent{
				BotID:      botID,
				BotName:    b.Name,
				OwnerID:    b.OwnerID,
				OldStatus:  oldStatus,
				NewStatus:  newStatus,
				Timestamp:  time.Now(),
			})
		}
	}

## Resolver Usage

GraphQL resolvers access the manager from context:

	func (r *mutationResolver) TestAlertRule(ctx context.Context, id uuid.UUID) (bool, error) {
		alertMgr := alert.GetManagerFromContext(ctx)
		if alertMgr == nil {
			return false, fmt.Errorf("alert manager not configured")
		}
		return alertMgr.TestRule(ctx, id)
	}

# Alert Rule Configuration

Rules are stored in the database and support:

	Resource Binding:
	  - Organization-level: applies to all resources of type
	  - Resource-specific: applies to single bot/strategy/runner

	Conditions (JSON):
	  - status_change: {"trigger_on": ["error", "stopped"]}
	  - large_profit_loss: {"threshold_percent": 5.0, "direction": "loss"}
	  - drawdown_threshold: {"max_drawdown_percent": 10.0}
	  - daily_loss_limit: {"max_loss_percent": 5.0}

	Delivery:
	  - Immediate: send instantly
	  - Batched: aggregate over interval

	Rate Limiting:
	  - Cooldown period per rule per resource
	  - Prevents alert storms

	Recipients:
	  - Email addresses stored in the rule
	  - Alert sent to all configured recipients

# Default Alerts

When resources are created, default alert rules are automatically created:

	Bot Creation:
	  1. "Bot Error Alert" - status_change when error (critical, enabled)
	  2. "Bot Stopped Alert" - status_change when stopped (warning, disabled)
	  3. "Trade Alert" - trade_closed (info, disabled)

Default rules require user to configure recipients before they become active.

# Severity Levels

	Critical:
	  - Immediate attention required
	  - Examples: bot error, connection lost, large loss
	  - Default: immediate delivery

	Warning:
	  - Action may be required
	  - Examples: bot stopped, drawdown approaching limit
	  - Default: batched delivery

	Info:
	  - Informational notifications
	  - Examples: trade closed, backtest completed
	  - Default: batched delivery

# Files

	doc.go              - This file (package documentation)
	types.go            - Alert-specific types (Alert, RuleMatch, Conditions)
	context.go          - Context-based DI helpers
	evaluator.go        - Rule matching and condition evaluation
	dispatcher.go       - Event routing and alert delivery
	manager.go          - Lifecycle management
	batcher.go          - Batched alert aggregation
	service.go          - CRUD operations for rules
	channel/
	  ├── channel.go    - Channel interface
	  └── sendgrid.go   - SendGrid implementation

# Related Packages

	internal/monitor    - Event source (bot status, trades, backtests)
	internal/ent        - Alert entities (AlertRule, AlertEvent)
	internal/enum       - Alert enums (AlertType, AlertSeverity, etc.)

# References

  - internal/ent/schema/alert_rule.go (Rule entity)
  - internal/ent/schema/alert_event.go (Event entity)
  - internal/enum/alert.go (Alert enums)
*/
package alert
