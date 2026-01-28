/**
 * Trade Context Field Metadata
 *
 * Defines metadata for trade context fields used in condition comparisons.
 * This metadata drives smart UI rendering:
 * - Boolean fields: hide operator, show True/False toggle
 * - Enum fields: show dropdown with predefined options
 * - String fields: show text input
 * - Number fields: show full comparison operators and number input
 */

/**
 * Field value type determines how the field is compared and what input to show
 */
export type TradeContextValueType = 'number' | 'boolean' | 'enum' | 'string';

export interface TradeContextFieldMeta {
  value: string;
  label: string;
  description: string;
  valueType: TradeContextValueType;
  /** For enum types, the list of valid options */
  enumOptions?: readonly { value: string; label: string }[];
  /** Whether to show the comparison operator (default: true for number/string, false for boolean) */
  showOperator?: boolean;
}

/**
 * Trade context fields with full metadata for smart UI rendering
 */
export const TRADE_CONTEXT_FIELDS: readonly TradeContextFieldMeta[] = [
  // Number fields - show full comparison operator
  { value: 'current_profit', label: 'Current Profit', description: 'Decimal (0.05 = 5%)', valueType: 'number' },
  { value: 'current_profit_pct', label: 'Profit %', description: 'Percentage value', valueType: 'number' },
  { value: 'entry_rate', label: 'Entry Price', description: 'Trade entry rate', valueType: 'number' },
  { value: 'current_rate', label: 'Current Price', description: 'Current market price', valueType: 'number' },
  { value: 'trade_duration', label: 'Duration (min)', description: 'Trade duration in minutes', valueType: 'number' },
  { value: 'nr_of_entries', label: 'Entry Count', description: 'Number of entries (DCA)', valueType: 'number' },
  { value: 'stake_amount', label: 'Stake Amount', description: 'Current stake', valueType: 'number' },
  // Boolean field - hide operator, show toggle
  { value: 'is_short', label: 'Is Short', description: 'True if short position', valueType: 'boolean', showOperator: false },
  // Enum field - show dropdown with options
  {
    value: 'side',
    label: 'Side',
    description: 'Trade direction',
    valueType: 'enum',
    enumOptions: [
      { value: 'long', label: 'Long' },
      { value: 'short', label: 'Short' },
    ] as const,
  },
  // String field - show text input
  { value: 'pair', label: 'Pair', description: 'Trading pair (e.g., BTC/USDT)', valueType: 'string' },
] as const;

/**
 * Get metadata for a trade context field
 */
export function getTradeContextFieldMeta(field: string): TradeContextFieldMeta | undefined {
  return TRADE_CONTEXT_FIELDS.find(f => f.value === field);
}

/**
 * Check if a field requires showing the comparison operator
 */
export function shouldShowOperator(field: string): boolean {
  const meta = getTradeContextFieldMeta(field);
  if (!meta) return true; // Default to showing operator for unknown fields
  if (meta.showOperator !== undefined) return meta.showOperator;
  // Default behavior based on type
  return meta.valueType !== 'boolean';
}

/**
 * Get the default constant value for a trade context field
 */
export function getDefaultConstantForField(field: string): boolean | string | number {
  const meta = getTradeContextFieldMeta(field);
  if (!meta) return 0;
  switch (meta.valueType) {
    case 'boolean': return true;
    case 'enum': return meta.enumOptions?.[0]?.value ?? '';
    case 'string': return '';
    case 'number':
    default: return 0;
  }
}
