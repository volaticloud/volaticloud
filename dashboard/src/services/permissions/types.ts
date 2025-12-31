/**
 * Permission types for Keycloak UMA 2.0 authorization
 */

// Alert rule scopes (shared across resource types that support alerts)
export type AlertRuleScope =
  | 'create-alert-rule'
  | 'update-alert-rule'
  | 'delete-alert-rule'
  | 'view-alert-rules';

// Bot-specific scopes
export type BotScope =
  | 'view'
  | 'view-secrets'
  | 'run'
  | 'stop'
  | 'delete'
  | 'edit'
  | 'freqtrade-api'
  | 'make-public'
  | AlertRuleScope;

// Strategy-specific scopes
export type StrategyScope =
  | 'view'
  | 'edit'
  | 'delete'
  | 'run-backtest'
  | 'stop-backtest'
  | 'delete-backtest'
  | 'make-public'
  | AlertRuleScope;

// Exchange-specific scopes
export type ExchangeScope = 'view' | 'view-secrets' | 'edit' | 'delete';

// BotRunner-specific scopes
export type BotRunnerScope =
  | 'view'
  | 'view-secrets'
  | 'edit'
  | 'delete'
  | 'make-public'
  | AlertRuleScope;

// Group/Organization-specific scopes
export type GroupScope =
  | 'view'
  | 'edit'
  | 'delete'
  | 'mark-alert-as-read'
  | AlertRuleScope;

// Union of all permission scopes
export type PermissionScope =
  | BotScope
  | StrategyScope
  | ExchangeScope
  | BotRunnerScope
  | GroupScope;

/**
 * Request to check a permission
 */
export interface PermissionRequest {
  resourceId: string;
  scope: PermissionScope;
}

/**
 * Result of a permission check
 */
export interface PermissionResult {
  resourceId: string;
  scope: string;
  granted: boolean;
}

/**
 * Granted permission from Keycloak RPT
 */
export interface GrantedPermission {
  rsid: string; // resource ID
  rsname: string; // resource name
  scopes: string[];
}

/**
 * Create a cache key for permission lookups
 */
export const createPermissionKey = (resourceId: string, scope: string): string =>
  `${resourceId}:${scope}`;
