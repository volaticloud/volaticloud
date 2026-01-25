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
  PositionMode,
  StrategySignalDirection,
} from '../../generated/types';

// Import for local use (need runtime values for OPERATOR_LABELS/OPERATOR_SYMBOLS)
import {
  ConditionNodeType,
  OperandType,
  OperandCategory,
  ComparisonOperator,
  ComputedOperation,
  IndicatorType,
  PositionMode,
  StrategySignalDirection,
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
// Long/Short Signal Support
// ============================================================================

/**
 * Signal configuration for a single direction (entry and exit conditions)
 */
export interface SignalConfig {
  entry_conditions: ConditionNode;
  exit_conditions: ConditionNode;
}

/**
 * Configuration for auto-mirroring signals from one direction to another
 */
export interface MirrorConfig {
  enabled: boolean;
  source: StrategySignalDirection;
  invert_comparisons: boolean;
  invert_crossovers: boolean;
}

// ============================================================================
// UI Builder Config
// ============================================================================

/**
 * UI Builder configuration (v2 with nested signal config)
 * For backwards compatibility, version 1 fields are also supported
 */
export interface UIBuilderConfig {
  version: number;
  schema_version?: string;
  indicators: IndicatorDefinition[];
  parameters: StrategyParameters;
  callbacks: CallbacksConfig;

  // Version 2 fields (nested signal config)
  position_mode?: PositionMode;
  long?: SignalConfig;
  short?: SignalConfig;
  mirror_config?: MirrorConfig;

  // Version 1 fields (deprecated, kept for backwards compatibility)
  // These are migrated to long.entry_conditions/exit_conditions during normalization
  entry_conditions?: ConditionNode;
  exit_conditions?: ConditionNode;
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

// Default empty UI builder config (v2 format with nested signal config)
export function createDefaultUIBuilderConfig(): UIBuilderConfig {
  return {
    version: 2,
    schema_version: '2.0.0',
    indicators: [],
    position_mode: PositionMode.LongOnly,
    long: {
      entry_conditions: createAndNode([]),
      exit_conditions: createAndNode([]),
    },
    parameters: {
      stoploss: -0.10,
      minimal_roi: { '0': 0.10, '30': 0.05, '60': 0.02 },
      trailing_stop: false,
      use_exit_signal: true,
    },
    callbacks: {},
  };
}

// Default mirror configuration
export function createDefaultMirrorConfig(): MirrorConfig {
  return {
    enabled: false,
    source: StrategySignalDirection.Long,
    invert_comparisons: true,
    invert_crossovers: true,
  };
}

// Default signal configuration
export function createDefaultSignalConfig(): SignalConfig {
  return {
    entry_conditions: createAndNode([]),
    exit_conditions: createAndNode([]),
  };
}

/**
 * Normalize v1 config to v2 format for backwards compatibility
 * This ensures all configs work with the new UI structure
 */
export function normalizeUIBuilderConfig(config: UIBuilderConfig): UIBuilderConfig {
  // Already v2 format
  if (config.long || config.short) {
    return {
      ...config,
      position_mode: config.position_mode || PositionMode.LongOnly,
    };
  }

  // Migrate v1 → v2
  const normalized: UIBuilderConfig = {
    ...config,
    version: 2,
    position_mode: PositionMode.LongOnly,
    long: {
      entry_conditions: config.entry_conditions || createAndNode([]),
      exit_conditions: config.exit_conditions || createAndNode([]),
    },
    // Clear deprecated fields
    entry_conditions: undefined,
    exit_conditions: undefined,
  };

  return normalized;
}

/**
 * Check if long signals should be generated based on position mode
 */
export function shouldGenerateLongSignals(config: UIBuilderConfig): boolean {
  const mode = config.position_mode || PositionMode.LongOnly;
  return mode === PositionMode.LongOnly || mode === PositionMode.LongAndShort;
}

/**
 * Check if short signals should be generated based on position mode
 */
export function shouldGenerateShortSignals(config: UIBuilderConfig): boolean {
  const mode = config.position_mode || PositionMode.LongOnly;
  return mode === PositionMode.ShortOnly || mode === PositionMode.LongAndShort;
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

/**
 * Count the number of leaf conditions in a condition tree.
 * AND/OR nodes don't count themselves, only their leaf children.
 */
export function getConditionCount(node: ConditionNode | undefined): number {
  if (!node) return 0;
  if (node.type === 'AND' || node.type === 'OR') {
    return (node as AndNode | OrNode).children.reduce(
      (acc, child) => acc + getConditionCount(child),
      0
    );
  }
  return 1;
}

// ============================================================================
// Mirror/Inversion Logic (for UI display of mirrored signals)
// ============================================================================

/**
 * Invert a comparison operator
 */
function invertOperator(op: ComparisonOperator): ComparisonOperator {
  switch (op) {
    case ComparisonOperator.Gt:
      return ComparisonOperator.Lt;
    case ComparisonOperator.Gte:
      return ComparisonOperator.Lte;
    case ComparisonOperator.Lt:
      return ComparisonOperator.Gt;
    case ComparisonOperator.Lte:
      return ComparisonOperator.Gte;
    // eq, neq, in, not_in stay the same
    default:
      return op;
  }
}

/**
 * Recursively invert a condition node based on mirror config
 */
function invertConditionNode(
  node: ConditionNode,
  invertComparisons: boolean,
  invertCrossovers: boolean
): ConditionNode {
  // Handle AND/OR nodes - recurse into children
  if (isAndNode(node) || isOrNode(node)) {
    return {
      ...node,
      children: node.children.map((child) =>
        invertConditionNode(child, invertComparisons, invertCrossovers)
      ),
    } as AndNode | OrNode;
  }

  // Handle NOT node - recurse into child
  if (isNotNode(node)) {
    return {
      ...node,
      child: invertConditionNode(node.child, invertComparisons, invertCrossovers),
    } as NotNode;
  }

  // Handle COMPARE node - invert operator
  if (isCompareNode(node) && invertComparisons) {
    return {
      ...node,
      operator: invertOperator(node.operator),
    } as CompareNode;
  }

  // Handle CROSSOVER/CROSSUNDER - swap types
  if (isCrossoverNode(node) && invertCrossovers) {
    return {
      ...node,
      type: 'CROSSUNDER',
    } as CrossunderNode;
  }

  if (isCrossunderNode(node) && invertCrossovers) {
    return {
      ...node,
      type: 'CROSSOVER',
    } as CrossoverNode;
  }

  // Handle IF_THEN_ELSE - recurse into condition, then, else
  if (isIfThenElseNode(node)) {
    return {
      ...node,
      condition: invertConditionNode(node.condition, invertComparisons, invertCrossovers),
      then: invertConditionNode(node.then, invertComparisons, invertCrossovers),
      else: node.else
        ? invertConditionNode(node.else, invertComparisons, invertCrossovers)
        : undefined,
    } as IfThenElseNode;
  }

  // IN_RANGE and other nodes - return as-is
  return node;
}

/**
 * Apply mirror config to compute the mirrored signal config for UI display
 */
export function applyMirrorConfig(config: UIBuilderConfig): UIBuilderConfig {
  if (!config.mirror_config?.enabled) {
    return config;
  }

  const mc = config.mirror_config;
  const invertComparisons = mc.invert_comparisons ?? true;
  const invertCrossovers = mc.invert_crossovers ?? true;

  // Mirror Long → Short
  if (mc.source === StrategySignalDirection.Long && config.long) {
    const mirroredShort: SignalConfig = {
      entry_conditions: invertConditionNode(
        config.long.entry_conditions,
        invertComparisons,
        invertCrossovers
      ),
      exit_conditions: invertConditionNode(
        config.long.exit_conditions,
        invertComparisons,
        invertCrossovers
      ),
    };
    return {
      ...config,
      short: mirroredShort,
    };
  }

  // Mirror Short → Long
  if (mc.source === StrategySignalDirection.Short && config.short) {
    const mirroredLong: SignalConfig = {
      entry_conditions: invertConditionNode(
        config.short.entry_conditions,
        invertComparisons,
        invertCrossovers
      ),
      exit_conditions: invertConditionNode(
        config.short.exit_conditions,
        invertComparisons,
        invertCrossovers
      ),
    };
    return {
      ...config,
      long: mirroredLong,
    };
  }

  return config;
}
