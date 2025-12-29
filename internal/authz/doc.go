/*
Package authz provides authorization utilities for UMA 2.0 resource management.

# Overview

This package defines resource types, permission scopes, and authorization helpers
for VolatiCloud's multi-tenant authorization system built on Keycloak UMA 2.0.

# Architecture

```mermaid
flowchart TB

	subgraph GraphQL["GraphQL Layer"]
	    D1["@isAuthenticated"]
	    D2["@hasScope"]
	    D3["@requiresPermission"]
	end

	subgraph Authz["authz Package"]
	    RT["ResourceTypes<br/>Strategy, Bot, Exchange, BotRunner, Group"]
	    SC["Scopes<br/>view, edit, view-secrets"]
	    VF["Verify<br/>Permission Checks"]
	    SH["Self-Healing<br/>Scope Sync"]
	end

	subgraph Keycloak["Keycloak UMA 2.0"]
	    RP["Resource Protection API"]
	    PE["Permission Evaluation"]
	end

	GraphQL --> Authz
	Authz --> Keycloak

```

# Resource Types

VolatiCloud manages five main resource types:

  - Strategy:  Trading strategy code and configurations
  - Bot:       Running bot instances with exchange connections
  - Exchange:  Exchange API credentials and settings
  - BotRunner: Container runtime environments (Docker/Kubernetes)
  - Group:     Organization/tenant groups managed by Keycloak

Each resource type has associated permission scopes defined in this package.

# Permission Scopes

Scopes define what actions can be performed on resources:

```mermaid
graph LR

	subgraph Basic["Basic Scopes"]
	    view["view"]
	    edit["edit"]
	    delete["delete"]
	end

	subgraph Sensitive["Sensitive Data"]
	    secrets["view-secrets"]
	end

	subgraph Actions["Resource Actions"]
	    run["run"]
	    stop["stop"]
	    backtest["backtest"]
	end

```

| Scope | Description |
|-------|-------------|
| view | View resource metadata and basic info |
| view-secrets | View sensitive config (API keys, credentials) |
| edit | Modify resource configuration |
| delete | Remove resource permanently |
| run | Start bot execution (Bot only) |
| stop | Stop bot execution (Bot only) |
| backtest | Run backtests (Strategy only) |

# View-Secrets Scope

The view-secrets scope provides field-level authorization for sensitive data:

```mermaid
flowchart LR

	subgraph Public["Public Access (view scope)"]
	    A1["Resource ID, name, type"]
	    A2["Public metadata"]
	    A3["Non-sensitive config"]
	end

	subgraph Protected["Protected Access (view-secrets)"]
	    B1["Bot.config"]
	    B2["Exchange.config"]
	    B3["BotRunner.config"]
	end

```

Protected fields by entity:

| Entity | Field | Scope Required |
|--------|-------|----------------|
| Bot | config | view-secrets |
| Exchange | config | view-secrets |
| BotRunner | config | view-secrets |
| BotRunner | dataDownloadConfig | view |

# Public/Private Visibility

Resources can be made public to allow viewing by any authenticated user:

```mermaid
flowchart TB

	subgraph Private["Private Resource (default)"]
	    P1["Only owner and delegated users"]
	    P2["Full access with appropriate scopes"]
	end

	subgraph Public["Public Resource (public=true)"]
	    PU1["Any authenticated user can view"]
	    PU2["Secrets still protected"]
	    PU3["Only owner can edit/delete"]
	end

```

# Usage Examples

Getting scopes for a resource type:

	// Get all scopes for a strategy
	scopes := authz.GetScopesForType(authz.ResourceTypeStrategy)
	// Returns: ["view", "edit", "backtest", "delete"]

	// Get scopes for a bot (includes view-secrets)
	scopes := authz.GetScopesForType(authz.ResourceTypeBot)
	// Returns: ["view", "view-secrets", "run", "stop", "delete", "edit"]

Using scopes in resource registration:

	// Register UMA resource with appropriate scopes
	scopes := authz.GetScopesForType(authz.ResourceTypeBot)
	err := umaClient.CreateResource(ctx, bot.ID.String(), bot.Name, scopes, attrs)

ENT field-level authorization annotation:

	// In ENT schema - protect sensitive config field
	field.JSON("config", map[string]interface{}{}).
	    Annotations(
	        entgql.RequiresPermission(entgql.PermConfig{Scope: "view-secrets"}),
	    )

GraphQL directive usage:

	type Mutation {
	    // Requires view-secrets to access config
	    updateBotConfig(id: ID!, config: JSON!): Bot!
	        @hasScope(resource: "id", scope: "view-secrets")
	}

# Scope Definitions by Resource Type

Strategy Scopes: view, edit, run-backtest, stop-backtest, delete-backtest, delete

Bot Scopes: view, view-secrets, edit, run, stop, delete, freqtrade-api

Exchange Scopes: view, view-secrets, edit, delete

BotRunner Scopes: view, view-secrets, edit, delete, make-public

Group Scopes: view, edit, delete, mark-alert-as-read

# Self-Healing Scope Sync

When new scopes are added to the application, existing Keycloak resources may not
have them registered. The package provides helper functions to detect and handle
this situation:

  - IsInvalidScopeError: Checks if an error indicates an unregistered scope
  - ShouldTriggerSelfHealing: Determines if scope sync should be attempted

Example self-healing flow:

	hasPermission, err := umaClient.CheckPermission(ctx, token, resourceID, scope)
	if authz.ShouldTriggerSelfHealing(hasPermission, err) {
	    // Sync scopes to Keycloak and retry
	    scopes := authz.GetScopesForType(resourceType)
	    umaClient.SyncResourceScopes(ctx, resourceID, name, scopes, attrs)
	    hasPermission, err = umaClient.CheckPermission(ctx, token, resourceID, scope)
	}

# Related Packages

  - internal/keycloak: UMA 2.0 client for Keycloak integration
  - internal/graph: GraphQL resolvers with authorization directives
  - internal/ent/schema: ENT schemas with RequiresPermission annotations

# See Also

  - ADR-0008: Multi-Tenant Authorization with UMA 2.0
  - docs/patterns/field-level-authorization.md: Pattern documentation
*/
package authz
