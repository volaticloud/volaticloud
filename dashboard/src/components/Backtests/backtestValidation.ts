import { type RunnerDataAvailable } from '../shared/RunnerSelector';

/**
 * Strategy config fields we care about for inheritance
 */
export interface StrategyConfigFields {
  timeframe?: string;
  pair_whitelist?: string[];
}

/**
 * Extract relevant fields from strategy config for inheritance.
 * Handles both top-level and nested (inside exchange) pair_whitelist.
 */
export const extractStrategyConfigFields = (config: Record<string, unknown> | null | undefined): StrategyConfigFields => {
  if (!config) return {};

  const result: StrategyConfigFields = {};

  // Extract timeframe
  if (typeof config.timeframe === 'string') {
    result.timeframe = config.timeframe;
  }

  // Extract pair_whitelist - can be at top level or inside exchange
  if (Array.isArray(config.pair_whitelist)) {
    result.pair_whitelist = config.pair_whitelist;
  } else if (config.exchange && typeof config.exchange === 'object') {
    const exchange = config.exchange as Record<string, unknown>;
    if (Array.isArray(exchange.pair_whitelist)) {
      result.pair_whitelist = exchange.pair_whitelist;
    }
  }

  return result;
};

/**
 * Supported exchanges for backtesting.
 * Must stay in sync with backend: internal/backtest/validation.go (SupportedExchanges)
 */
export const SUPPORTED_EXCHANGES = [
  { id: 'binance', name: 'Binance' },
  { id: 'binanceus', name: 'Binance US' },
  { id: 'kraken', name: 'Kraken' },
  { id: 'kucoin', name: 'KuCoin' },
  { id: 'bybit', name: 'Bybit' },
  { id: 'bitget', name: 'Bitget' },
  { id: 'gateio', name: 'Gate.io' },
  { id: 'okx', name: 'OKX' },
];

/**
 * Validates trading pair format: BASE/QUOTE or BASE/QUOTE:SETTLE
 * Examples:
 * - Spot: BTC/USDT, ETH/BTC
 * - Futures: BTC/USDT:USDT, ETH/USDT:USDT
 *
 * Returns null if valid, error message if invalid.
 *
 * IMPORTANT: This validation logic is duplicated in the backend for server-side validation.
 * If you modify this function, you MUST also update the backend validation:
 * - Backend: internal/backtest/validation.go (validateTradingPair)
 * Both implementations must stay in sync to ensure consistent behavior.
 */
export const validateTradingPair = (pair: string): string | null => {
  const trimmed = pair.trim();
  if (!trimmed) return 'Empty trading pair';

  // Check for futures format: BASE/QUOTE:SETTLE
  const settleMatch = trimmed.match(/^([^/]+)\/([^:]+):([^:]+)$/);
  if (settleMatch) {
    const [, base, quote, settle] = settleMatch;
    const alphanumeric = /^[A-Za-z0-9]+$/;
    if (!alphanumeric.test(base)) return `Invalid pair "${trimmed}": base currency contains invalid characters`;
    if (!alphanumeric.test(quote)) return `Invalid pair "${trimmed}": quote currency contains invalid characters`;
    if (!alphanumeric.test(settle)) return `Invalid pair "${trimmed}": settlement currency contains invalid characters`;
    return null;
  }

  // Check for spot format: BASE/QUOTE
  const parts = trimmed.split('/');
  if (parts.length !== 2) {
    return `Invalid format "${trimmed}": expected BASE/QUOTE (e.g., BTC/USDT) or BASE/QUOTE:SETTLE (e.g., BTC/USDT:USDT)`;
  }

  const [base, quote] = parts;
  if (!base || !base.trim()) return `Invalid pair "${trimmed}": empty base currency`;
  if (!quote || !quote.trim()) return `Invalid pair "${trimmed}": empty quote currency`;

  // Check for alphanumeric only (ASCII only for Freqtrade compatibility)
  const alphanumeric = /^[A-Za-z0-9]+$/;
  if (!alphanumeric.test(base.trim())) {
    return `Invalid pair "${trimmed}": base currency contains invalid characters`;
  }
  if (!alphanumeric.test(quote.trim())) {
    return `Invalid pair "${trimmed}": quote currency contains invalid characters`;
  }

  return null;
};

/**
 * Validates all trading pairs format.
 * Returns null if all valid, first error message if any invalid.
 */
export const validateTradingPairsFormat = (pairs: string[]): string | null => {
  if (pairs.length === 0) {
    return 'At least one trading pair is required';
  }

  for (const pair of pairs) {
    const error = validateTradingPair(pair);
    if (error) return error;
  }

  return null;
};

/**
 * Validation result for backtest config against runner data.
 */
export interface BacktestConfigValidationResult {
  exchangeError: string | null;
  pairsError: string | null;
  timeframeError: string | null;
  formatError: string | null;  // For pair format validation
}

/**
 * Unified validation function for backtest config against runner data.
 * Used by BOTH simple mode and advanced mode (JSON editor).
 *
 * Validates:
 * 1. Exchange is available on runner
 * 2. Pairs format is valid (BASE/QUOTE or BASE/QUOTE:SETTLE)
 * 3. Pairs are available on runner for selected exchange
 * 4. Timeframe is available for selected pairs on runner
 */
export const validateBacktestConfigAgainstRunner = (
  config: {
    exchange?: string;
    pairs?: string[];
    timeframe?: string;
  },
  runnerData: RunnerDataAvailable | null
): BacktestConfigValidationResult => {
  const result: BacktestConfigValidationResult = {
    exchangeError: null,
    pairsError: null,
    timeframeError: null,
    formatError: null,
  };

  // If no runner data, skip runner-based validation
  if (!runnerData?.exchanges?.length) {
    // Still validate pair format
    if (config.pairs && config.pairs.length > 0) {
      result.formatError = validateTradingPairsFormat(config.pairs);
    }
    return result;
  }

  const availableExchanges = runnerData.exchanges.map(e => e.name.toLowerCase());

  // Validate exchange
  if (config.exchange) {
    if (!availableExchanges.includes(config.exchange.toLowerCase())) {
      result.exchangeError = `Exchange "${config.exchange}" not available on this runner. Available: ${runnerData.exchanges.map(e => e.name).join(', ')}`;
    }
  }

  // Validate pairs format first
  if (config.pairs && config.pairs.length > 0) {
    result.formatError = validateTradingPairsFormat(config.pairs);
  }

  // Validate pairs against runner (only if exchange is valid and pairs format is valid)
  if (config.pairs && config.pairs.length > 0 && !result.exchangeError && !result.formatError) {
    const exchangeName = config.exchange ?? 'binance';
    const exchangeData = runnerData.exchanges.find(
      e => e.name.toLowerCase() === exchangeName.toLowerCase()
    );

    if (exchangeData?.pairs?.length) {
      const availablePairs = new Set(exchangeData.pairs.map(p => p.pair.toUpperCase()));
      const invalidPairs = config.pairs.filter(p => !availablePairs.has(p.toUpperCase()));
      if (invalidPairs.length > 0) {
        result.pairsError = `Pair(s) not available on runner: ${invalidPairs.join(', ')}`;
      }
    }
  }

  // Validate timeframe against runner (only if exchange and pairs are valid)
  if (config.timeframe && !result.exchangeError && !result.pairsError && !result.formatError) {
    const exchangeName = config.exchange ?? 'binance';
    const exchangeData = runnerData.exchanges.find(
      e => e.name.toLowerCase() === exchangeName.toLowerCase()
    );

    if (exchangeData?.pairs?.length && config.pairs && config.pairs.length > 0) {
      // Check if timeframe exists for all config pairs
      for (const pairName of config.pairs) {
        const pairData = exchangeData.pairs.find(p => p.pair.toUpperCase() === pairName.toUpperCase());
        if (pairData) {
          const pairTimeframes = pairData.timeframes?.map(t => t.timeframe) ?? [];
          if (!pairTimeframes.includes(config.timeframe)) {
            result.timeframeError = `Timeframe "${config.timeframe}" not available for pair ${pairName}`;
            break;
          }
        }
      }
    }
  }

  return result;
};
