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

  // Exchange settings
  exchange?: ExchangeConnectionConfig;

  // Allow additional fields from Freqtrade schema
  [key: string]: unknown;
}

export interface ExchangeConnectionConfig {
  name: string;
  key: string;
  secret: string;
  password?: string;
  uid?: string;
  account_id?: string;
  wallet_address?: string;
  private_key?: string;
  pair_whitelist: string[];
  pair_blacklist?: string[];
  log_responses?: boolean;
  enable_ws?: boolean;
  unknown_fee_rate?: number;
  outdated_offset?: number;
  markets_refresh_interval?: number;
  ccxt_config?: Record<string, unknown>;
  ccxt_async_config?: Record<string, unknown>;
  ccxt_sync_config?: Record<string, unknown>;
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
export type ConfigSection = 'exchange' | 'basic' | 'trading' | 'orders' | 'pricing' | 'risk' | 'exits';

/**
 * All available sections in the structured config form (excluding exchange)
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

/**
 * Recommended sections for exchange configuration
 * - exchange: Exchange credentials and pair whitelist
 */
export const EXCHANGE_SECTIONS: ConfigSection[] = ['exchange'];

/**
 * All sections including exchange (for exchange management context)
 */
export const ALL_SECTIONS_WITH_EXCHANGE: ConfigSection[] = ['exchange', ...ALL_SECTIONS];

/**
 * Supported exchange providers for the dropdown
 */
export const EXCHANGE_PROVIDERS = [
  { value: 'binance', label: 'Binance' },
  { value: 'binanceus', label: 'Binance US' },
  { value: 'bybit', label: 'Bybit' },
  { value: 'okx', label: 'OKX' },
  { value: 'kraken', label: 'Kraken' },
  { value: 'kucoin', label: 'KuCoin' },
  { value: 'bitget', label: 'Bitget' },
  { value: 'gate', label: 'Gate.io' },
  { value: 'huobi', label: 'Huobi' },
] as const;

/**
 * Mapping of each config section to the FreqtradeConfig keys it owns.
 * Used to filter the config object to only include fields from enabled sections.
 */
export const SECTION_FIELDS: Record<ConfigSection, string[]> = {
  exchange: ['exchange'],
  basic: ['stake_currency', 'stake_amount', 'timeframe', 'max_open_trades'],
  trading: ['dry_run', 'dry_run_wallet', 'trading_mode', 'margin_mode', 'liquidation_buffer'],
  orders: ['order_types', 'order_time_in_force'],
  pricing: ['entry_pricing', 'exit_pricing'],
  risk: ['stoploss', 'trailing_stop', 'trailing_stop_positive', 'trailing_stop_positive_offset', 'trailing_only_offset_is_reached', 'minimal_roi'],
  exits: ['use_exit_signal', 'exit_profit_only', 'exit_profit_offset', 'ignore_roi_if_entry_signal'],
};

/**
 * Filters a config object to only include fields belonging to the given sections.
 * If enabledSections is undefined or empty, returns the config unchanged.
 */
export function filterConfigBySections(
  config: Record<string, unknown>,
  enabledSections?: ConfigSection[],
): Record<string, unknown> {
  if (!enabledSections || enabledSections.length === 0) {
    return config;
  }
  const allowedKeys = new Set(enabledSections.flatMap(s => SECTION_FIELDS[s]));
  return Object.fromEntries(
    Object.entries(config).filter(([key]) => allowedKeys.has(key)),
  );
}

/**
 * Creates a default exchange configuration
 */
export function createDefaultExchangeConfig(): Partial<FreqtradeConfig> {
  return {
    exchange: {
      name: 'binance',
      key: '',
      secret: '',
      pair_whitelist: ['.*'],
    },
  };
}
