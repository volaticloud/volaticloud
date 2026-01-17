/**
 * Strategy UI Builder Type Definitions
 *
 * Types are generated from GraphQL schema (single source of truth).
 * See internal/graph/schema.graphqls for the authoritative definitions.
 *
 * This file re-exports generated enums and defines interfaces/helpers
 * that follow industry patterns from JSON Logic, React Query Builder, and DMN.
 */

// ============================================================================
// Generated Enums (from GraphQL schema - single source of truth)
// ============================================================================

// Re-export generated enums for external consumers
export {
  ConditionNodeType,
  OperandType,
  OperandCategory,
  ComparisonOperator,
  ComputedOperation,
  IndicatorType,
  PriceField,
  TradeContextField,
  TimeField,
} from '../../generated/types';

// Import for local use (need runtime values for OPERATOR_LABELS/OPERATOR_SYMBOLS)
import {
  ConditionNodeType,
  OperandType,
  OperandCategory,
  ComparisonOperator,
  ComputedOperation,
  IndicatorType,
} from '../../generated/types';

// Type alias for backward compatibility
export type NodeType = ConditionNodeType;

// ============================================================================
// Operator Labels & Symbols (for UI display)
// ============================================================================

export const OPERATOR_LABELS: Record<ComparisonOperator, string> = {
  [ComparisonOperator.Eq]: 'equals',
  [ComparisonOperator.Neq]: 'not equals',
  [ComparisonOperator.Gt]: 'greater than',
  [ComparisonOperator.Gte]: 'greater than or equal',
  [ComparisonOperator.Lt]: 'less than',
  [ComparisonOperator.Lte]: 'less than or equal',
  [ComparisonOperator.In]: 'in',
  [ComparisonOperator.NotIn]: 'not in',
};

export const OPERATOR_SYMBOLS: Record<ComparisonOperator, string> = {
  [ComparisonOperator.Eq]: '=',
  [ComparisonOperator.Neq]: '!=',
  [ComparisonOperator.Gt]: '>',
  [ComparisonOperator.Gte]: '>=',
  [ComparisonOperator.Lt]: '<',
  [ComparisonOperator.Lte]: '<=',
  [ComparisonOperator.In]: 'in',
  [ComparisonOperator.NotIn]: 'not in',
};

// ============================================================================
// Base Interfaces
// ============================================================================

export interface BaseNode {
  id: string;
  label?: string;
  disabled?: boolean;
}

export interface BaseOperand {
  type: OperandType;
  category?: OperandCategory;
  label?: string;
}

// ============================================================================
// Operand Types
// ============================================================================

export interface ConstantOperand extends BaseOperand {
  type: typeof OperandType.Constant;
  value: number | string | boolean | null;
  valueType?: 'number' | 'percent' | 'string' | 'boolean' | 'duration' | 'currency';
}

export interface IndicatorOperand extends BaseOperand {
  type: typeof OperandType.Indicator;
  indicatorId: string;
  field?: string;
  offset?: number;
}

export interface PriceOperand extends BaseOperand {
  type: typeof OperandType.Price;
  field: 'open' | 'high' | 'low' | 'close' | 'volume' | 'ohlc4' | 'hlc3' | 'hl2';
  offset?: number;
  timeframe?: string;
}

export interface TradeContextOperand extends BaseOperand {
  type: typeof OperandType.TradeContext;
  field:
    | 'current_profit'
    | 'current_profit_pct'
    | 'entry_rate'
    | 'current_rate'
    | 'trade_duration'
    | 'nr_of_entries'
    | 'stake_amount'
    | 'pair'
    | 'is_short';
}

export interface TimeOperand extends BaseOperand {
  type: typeof OperandType.Time;
  field:
    | 'hour'
    | 'minute'
    | 'day_of_week'
    | 'day_of_month'
    | 'month'
    | 'timestamp'
    | 'is_weekend';
  timezone?: string;
}

export interface ExternalOperand extends BaseOperand {
  type: typeof OperandType.External;
  sourceId: string;
  field: string;
  cache_ttl?: number;
}

export interface ComputedOperand extends BaseOperand {
  type: typeof OperandType.Computed;
  operation: ComputedOperation;
  operands: Operand[];
  precision?: number;
}

export interface CustomOperand extends BaseOperand {
  type: typeof OperandType.Custom;
  pluginId: string;
  config: Record<string, unknown>;
}

export type Operand =
  | ConstantOperand
  | IndicatorOperand
  | PriceOperand
  | TradeContextOperand
  | TimeOperand
  | ExternalOperand
  | ComputedOperand
  | CustomOperand;

// ============================================================================
// Condition Node Types
// ============================================================================

export interface AndNode extends BaseNode {
  type: 'AND';
  children: ConditionNode[];
}

export interface OrNode extends BaseNode {
  type: 'OR';
  children: ConditionNode[];
}

export interface NotNode extends BaseNode {
  type: 'NOT';
  child: ConditionNode;
}

export interface IfThenElseNode extends BaseNode {
  type: 'IF_THEN_ELSE';
  condition: ConditionNode;
  then: ConditionNode;
  else?: ConditionNode;
}

export interface CompareNode extends BaseNode {
  type: 'COMPARE';
  left: Operand;
  operator: ComparisonOperator;
  right: Operand;
}

export interface CrossoverNode extends BaseNode {
  type: 'CROSSOVER';
  series1: Operand;
  series2: Operand;
}

export interface CrossunderNode extends BaseNode {
  type: 'CROSSUNDER';
  series1: Operand;
  series2: Operand;
}

export interface InRangeNode extends BaseNode {
  type: 'IN_RANGE';
  value: Operand;
  min: Operand;
  max: Operand;
  inclusive?: boolean;
}

export type ConditionNode =
  | AndNode
  | OrNode
  | NotNode
  | IfThenElseNode
  | CompareNode
  | CrossoverNode
  | CrossunderNode
  | InRangeNode;

// ============================================================================
// Indicator Types (IndicatorType enum is exported from generated types above)
// ============================================================================

export interface IndicatorPlugin {
  source: 'builtin' | 'community' | 'custom';
  version?: string;
  pythonCode?: string;
  requiredImports?: string[];
}

export interface IndicatorDefinition {
  id: string;
  type: IndicatorType;
  params: Record<string, unknown>;
  label?: string;
  plugin?: IndicatorPlugin;
}

// ============================================================================
// Indicator Metadata (for UI)
// ============================================================================

export interface IndicatorParamDef {
  name: string;
  type: 'number' | 'string' | 'select';
  label: string;
  default: unknown;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
  description?: string;
}

export interface IndicatorMeta {
  type: IndicatorType;
  name: string;
  description: string;
  category: 'trend' | 'momentum' | 'volatility' | 'volume' | 'custom';
  params: IndicatorParamDef[];
  outputs: { name: string; field?: string; description: string }[];
}

// ============================================================================
// Callback Configurations
// ============================================================================

export interface StoplossRule {
  id: string;
  condition: ConditionNode;
  stoploss: number;
}

export interface TrailingConfig {
  enabled: boolean;
  positive: number;
  positive_offset: number;
}

export interface CustomStoplossConfig {
  enabled: boolean;
  rules: StoplossRule[];
  default_stoploss: number;
  trailing?: TrailingConfig;
}

export interface ConfirmEntryConfig {
  enabled: boolean;
  rules: ConditionNode;
}

export interface DCARule {
  price_drop_percent: number;
  stake_multiplier: number;
}

export interface DCAConfig {
  enabled: boolean;
  max_entries: number;
  rules: DCARule[];
  cooldown_minutes?: number;
}

export interface ExitStrategy {
  id: string;
  entry_tag: string;
  exit_condition: ConditionNode;
  exit_tag: string;
}

export interface CustomExitConfig {
  enabled: boolean;
  exit_strategies: ExitStrategy[];
}

export interface CallbacksConfig {
  custom_stoploss?: CustomStoplossConfig;
  confirm_entry?: ConfirmEntryConfig;
  dca?: DCAConfig;
  custom_exit?: CustomExitConfig;
}

// ============================================================================
// Strategy Parameters
// ============================================================================

export interface StrategyParameters {
  stoploss: number;
  minimal_roi: Record<string, number>;
  trailing_stop: boolean;
  trailing_stop_positive?: number;
  trailing_stop_positive_offset?: number;
  use_exit_signal: boolean;
}

// ============================================================================
// UI Builder Config
// ============================================================================

export interface UIBuilderConfig {
  version: number;
  schema_version?: string;
  indicators: IndicatorDefinition[];
  entry_conditions: ConditionNode;
  exit_conditions: ConditionNode;
  parameters: StrategyParameters;
  callbacks: CallbacksConfig;
}

// ============================================================================
// Full Strategy Config
// ============================================================================

export interface StrategyConfig {
  stake_currency: string;
  stake_amount: number;
  timeframe: string;
  ui_builder?: UIBuilderConfig;
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createCompareNode(
  left: Operand,
  operator: ComparisonOperator,
  right: Operand
): CompareNode {
  return {
    id: createId(),
    type: 'COMPARE',
    left,
    operator,
    right,
  };
}

export function createAndNode(children: ConditionNode[] = []): AndNode {
  return {
    id: createId(),
    type: 'AND',
    children,
  };
}

export function createOrNode(children: ConditionNode[] = []): OrNode {
  return {
    id: createId(),
    type: 'OR',
    children,
  };
}

export function createNotNode(child: ConditionNode): NotNode {
  return {
    id: createId(),
    type: 'NOT',
    child,
  };
}

export function createConstantOperand(value: number | string | boolean | null): ConstantOperand {
  return {
    type: OperandType.Constant,
    value,
  };
}

export function createIndicatorOperand(
  indicatorId: string,
  field?: string,
  offset?: number
): IndicatorOperand {
  return {
    type: OperandType.Indicator,
    indicatorId,
    field,
    offset,
  };
}

export function createPriceOperand(
  field: PriceOperand['field'],
  offset?: number
): PriceOperand {
  return {
    type: OperandType.Price,
    field,
    offset,
  };
}

export function createCrossoverNode(series1: Operand, series2: Operand): CrossoverNode {
  return {
    id: createId(),
    type: 'CROSSOVER',
    series1,
    series2,
  };
}

export function createCrossunderNode(series1: Operand, series2: Operand): CrossunderNode {
  return {
    id: createId(),
    type: 'CROSSUNDER',
    series1,
    series2,
  };
}

// Default empty UI builder config
export function createDefaultUIBuilderConfig(): UIBuilderConfig {
  return {
    version: 1,
    schema_version: '1.0.0',
    indicators: [],
    entry_conditions: createAndNode([]),
    exit_conditions: createAndNode([]),
    parameters: {
      stoploss: -0.10,
      minimal_roi: { '0': 0.10, '30': 0.05, '60': 0.02 },
      trailing_stop: false,
      use_exit_signal: true,
    },
    callbacks: {},
  };
}

// Type guards
export function isAndNode(node: ConditionNode): node is AndNode {
  return node.type === 'AND';
}

export function isOrNode(node: ConditionNode): node is OrNode {
  return node.type === 'OR';
}

export function isNotNode(node: ConditionNode): node is NotNode {
  return node.type === 'NOT';
}

export function isIfThenElseNode(node: ConditionNode): node is IfThenElseNode {
  return node.type === 'IF_THEN_ELSE';
}

export function isCompareNode(node: ConditionNode): node is CompareNode {
  return node.type === 'COMPARE';
}

export function isCrossoverNode(node: ConditionNode): node is CrossoverNode {
  return node.type === 'CROSSOVER';
}

export function isCrossunderNode(node: ConditionNode): node is CrossunderNode {
  return node.type === 'CROSSUNDER';
}

export function isInRangeNode(node: ConditionNode): node is InRangeNode {
  return node.type === 'IN_RANGE';
}

export function isLogicalNode(node: ConditionNode): node is AndNode | OrNode {
  return isAndNode(node) || isOrNode(node);
}

export function hasChildren(node: ConditionNode): node is AndNode | OrNode {
  return isLogicalNode(node);
}
