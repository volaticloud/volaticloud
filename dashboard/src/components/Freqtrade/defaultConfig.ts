/**
 * Default Freqtrade configuration values.
 *
 * These defaults satisfy all mandatory Freqtrade fields required for
 * running backtests without additional configuration.
 *
 * Mandatory fields (from backend validation):
 * - stake_currency: string
 * - stake_amount: number
 * - entry_pricing: { price_side, use_order_book, order_book_top }
 * - exit_pricing: { price_side, use_order_book, order_book_top }
 */

export interface PricingConfig {
  price_side: 'same' | 'other' | 'bid' | 'ask';
  use_order_book: boolean;
  order_book_top: number;
}

export interface MinimalROI {
  [key: string]: number;
}

export interface OrderTypesConfig {
  entry: 'limit' | 'market';
  exit: 'limit' | 'market';
  stoploss: 'limit' | 'market';
  stoploss_on_exchange: boolean;
}

export interface OrderTimeInForceConfig {
  entry: 'GTC' | 'FOK' | 'IOC' | 'PO';
  exit: 'GTC' | 'FOK' | 'IOC' | 'PO';
}

export interface FreqtradeConfig {
  // Basic settings
  stake_currency: string;
  stake_amount: number;
  timeframe?: string;
  max_open_trades?: number;

  // Trading mode settings
  dry_run?: boolean;
  dry_run_wallet?: number;
  trading_mode?: 'spot' | 'margin' | 'futures';
  margin_mode?: 'cross' | 'isolated';
  liquidation_buffer?: number;

  // Order settings
  order_types?: OrderTypesConfig;
  order_time_in_force?: OrderTimeInForceConfig;

  // Pricing settings
  entry_pricing: PricingConfig;
  exit_pricing: PricingConfig;

  // Risk management
  stoploss?: number;
  trailing_stop?: boolean;
  trailing_stop_positive?: number;
  trailing_stop_positive_offset?: number;
  trailing_only_offset_is_reached?: boolean;
  minimal_roi?: MinimalROI;

  // Exit strategy settings
  use_exit_signal?: boolean;
  exit_profit_only?: boolean;
  exit_profit_offset?: number;
  ignore_roi_if_entry_signal?: boolean;

  // Allow additional fields from Freqtrade schema
  [key: string]: unknown;
}

/**
 * Creates a default Freqtrade configuration with all mandatory fields populated.
 *
 * This config is sufficient to run backtests immediately without editing.
 */
export function createDefaultFreqtradeConfig(): FreqtradeConfig {
  return {
    stake_currency: 'USDT',
    stake_amount: 10,
    timeframe: '5m',
    max_open_trades: 3,
    entry_pricing: {
      price_side: 'other',
      use_order_book: true,
      order_book_top: 1,
    },
    exit_pricing: {
      price_side: 'other',
      use_order_book: true,
      order_book_top: 1,
    },
    stoploss: -0.1,
    minimal_roi: {
      '0': 0.1,
    },
  };
}

/**
 * Merges an existing config with defaults, filling in only missing mandatory fields.
 *
 * This ensures existing strategies retain their config values while gaining
 * any missing fields required for backtesting.
 *
 * @param config - Partial config that may be missing fields
 * @returns Complete config with all mandatory fields
 */
export function mergeWithDefaults(config: Partial<FreqtradeConfig> | null | undefined): FreqtradeConfig {
  const defaults = createDefaultFreqtradeConfig();

  if (!config) {
    return defaults;
  }

  return {
    ...defaults,
    ...config,
    // Deep merge pricing configs to ensure nested fields are present
    entry_pricing: {
      ...defaults.entry_pricing,
      ...(config.entry_pricing || {}),
    },
    exit_pricing: {
      ...defaults.exit_pricing,
      ...(config.exit_pricing || {}),
    },
  };
}

/**
 * Common stake currencies for the dropdown
 */
export const STAKE_CURRENCIES = ['USDT', 'BTC', 'ETH', 'BUSD', 'USD', 'EUR'] as const;

/**
 * Common timeframes for the dropdown
 */
export const TIMEFRAMES = [
  { value: '1m', label: '1 minute' },
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
  { value: '1d', label: '1 day' },
] as const;

/**
 * Price side options for entry/exit pricing
 */
export const PRICE_SIDES = [
  { value: 'same', label: 'Same', description: 'Use bid for buy, ask for sell' },
  { value: 'other', label: 'Other', description: 'Use ask for buy, bid for sell' },
  { value: 'bid', label: 'Bid', description: 'Always use bid price' },
  { value: 'ask', label: 'Ask', description: 'Always use ask price' },
] as const;

/**
 * Available section identifiers for the config form
 *
 * - basic: Core trading parameters (stake_currency, stake_amount, timeframe, max_open_trades)
 * - trading: Trading mode settings (dry_run, trading_mode, margin_mode)
 * - orders: Order types and time-in-force settings
 * - pricing: Entry/exit pricing configuration
 * - risk: Stop loss and trailing stop settings
 * - exits: Exit strategy behavior (use_exit_signal, exit_profit_only, etc.)
 */
export type ConfigSection = 'basic' | 'trading' | 'orders' | 'pricing' | 'risk' | 'exits';

/**
 * All available sections in the structured config form
 */
export const ALL_SECTIONS: ConfigSection[] = ['basic', 'trading', 'orders', 'pricing', 'risk', 'exits'];

/**
 * Recommended sections for strategy creation
 * - basic: Core parameters
 * - risk: Stop loss, trailing stop, minimal ROI
 * - exits: Exit signal behavior
 */
export const STRATEGY_SECTIONS: ConfigSection[] = ['basic', 'risk', 'exits'];

/**
 * Recommended sections for bot creation
 * - basic: Core trading parameters
 * - trading: Dry run, trading mode
 * - orders: Order types configuration
 */
export const BOT_SECTIONS: ConfigSection[] = ['basic', 'trading', 'orders'];
