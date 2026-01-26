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

/**
 * Available date range for backtesting
 */
export interface AvailableDateRange {
  from: Date;
  to: Date;
}

/**
 * Computes the available date range based on selected exchange, pairs, and timeframe.
 * Uses INTERSECTION logic: finds the overlapping date range where data exists for ALL
 * selected pairs FOR THE SELECTED TIMEFRAME.
 *
 * IMPORTANT: A timeframe MUST be selected to compute the date range. This ensures
 * accurate results - without a specific timeframe, combining ranges across different
 * timeframes would give misleading results (e.g., showing a range that includes dates
 * where some pairs lack data for the eventually-selected timeframe).
 *
 * @param runnerData - Runner's data availability metadata
 * @param exchange - Selected exchange name
 * @param pairs - Selected trading pairs (empty = consider all pairs)
 * @param timeframe - Selected timeframe (null = returns null, timeframe required)
 * @returns The intersection date range, or null if no valid overlap exists or no timeframe selected
 */
export const computeAvailableDateRange = (
  runnerData: RunnerDataAvailable | null,
  exchange: string,
  pairs: string[],
  timeframe: string | null
): AvailableDateRange | null => {
  if (!runnerData?.exchanges?.length) return null;

  // Timeframe is required to compute accurate date range
  // Without it, we'd mix ranges from different timeframes which is misleading
  if (!timeframe) return null;

  // No pairs selected = invalid state for date range computation
  // Return null to indicate no valid range (UI should disable date pickers)
  if (pairs.length === 0) return null;

  const exchangeData = runnerData.exchanges.find(
    e => e.name.toLowerCase() === exchange.toLowerCase()
  );
  if (!exchangeData?.pairs?.length) return null;

  const selectedPairSet = new Set(pairs.map(p => p.toUpperCase()));

  // ==================== INTERSECTION ALGORITHM ====================
  // For backtesting, we need data available for ALL selected pairs at the
  // SAME time for the SAME timeframe. This requires finding the INTERSECTION
  // of all per-pair date ranges.
  //
  // Intersection logic:
  // - latestStart: The LATEST "from" date across all pairs (max of all starts)
  // - earliestEnd: The EARLIEST "to" date across all pairs (min of all ends)
  //
  // Example:
  //   BTC/USDT 5m: 2024-01-01 to 2024-09-30
  //   ETH/USDT 5m: 2024-03-01 to 2024-12-31
  //   Intersection: 2024-03-01 to 2024-09-30 (overlap where BOTH have data)
  //
  // If latestStart > earliestEnd, there's NO overlap → return null
  // ==================================================================

  let latestStart: Date | null = null;
  let earliestEnd: Date | null = null;
  let pairsWithData = 0;

  for (const pair of exchangeData.pairs) {
    // Skip pairs not in user's selection (case-insensitive)
    if (!selectedPairSet.has(pair.pair.toUpperCase())) {
      continue;
    }

    // Find the date range for the SELECTED timeframe only
    const tfData = pair.timeframes?.find(tf => tf.timeframe === timeframe);
    if (!tfData?.from || !tfData?.to) {
      // This pair doesn't have data for the selected timeframe - skip it
      // Note: The UI should warn users if selected pairs lack the timeframe
      continue;
    }

    pairsWithData++;
    const fromDate = new Date(tfData.from);
    const toDate = new Date(tfData.to);

    // Update intersection bounds: take LATEST start (max) and EARLIEST end (min)
    if (!latestStart || fromDate > latestStart) {
      latestStart = fromDate;
    }
    if (!earliestEnd || toDate < earliestEnd) {
      earliestEnd = toDate;
    }
  }

  // Intersection is valid only if we have data AND start <= end (ranges overlap)
  if (pairsWithData > 0 && latestStart && earliestEnd && latestStart <= earliestEnd) {
    return { from: latestStart, to: earliestEnd };
  }

  return null;
};

/**
 * Date range validation result
 */
export interface DateRangeValidationResult {
  startError: string | null;
  endError: string | null;
}

/**
 * Creates a UTC day timestamp for consistent timezone-independent comparison.
 * Strips time component by using UTC date parts.
 */
const toUTCDay = (date: Date): number => {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

/**
 * Validates if selected dates are within the available date range.
 * Uses UTC for timezone-independent day-level comparison.
 *
 * @param startDate - Selected start date
 * @param endDate - Selected end date
 * @param availableRange - Available date range from runner
 * @returns Validation result with error messages for start and end dates
 */
export const validateDateRange = (
  startDate: Date | null,
  endDate: Date | null,
  availableRange: AvailableDateRange | null
): DateRangeValidationResult => {
  if (!availableRange || !startDate || !endDate) {
    return { startError: null, endError: null };
  }

  const { from: availableFrom, to: availableTo } = availableRange;
  let startError: string | null = null;
  let endError: string | null = null;

  // Compare dates at day granularity using UTC
  const startDay = toUTCDay(startDate);
  const endDay = toUTCDay(endDate);
  const fromDay = toUTCDay(availableFrom);
  const toDay = toUTCDay(availableTo);

  if (startDay < fromDay) {
    startError = `Start date is before available data (${formatDate(availableFrom)})`;
  } else if (startDay > toDay) {
    startError = `Start date is after available data (${formatDate(availableTo)})`;
  }

  if (endDay > toDay) {
    endError = `End date is after available data (${formatDate(availableTo)})`;
  } else if (endDay < fromDay) {
    endError = `End date is before available data (${formatDate(availableFrom)})`;
  }

  return { startError, endError };
};

/**
 * Formats a date as YYYY-MM-DD
 */
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Checks if all available pairs are selected (case-insensitive comparison).
 *
 * @param selectedPairs - Currently selected pairs
 * @param availablePairs - All available pairs from runner
 * @returns true if all available pairs are selected
 */
export const areAllPairsSelected = (
  selectedPairs: string[],
  availablePairs: string[]
): boolean => {
  if (selectedPairs.length !== availablePairs.length) {
    return false;
  }

  const selectedSet = new Set(selectedPairs.map(p => p.toUpperCase()));
  return availablePairs.every(p => selectedSet.has(p.toUpperCase()));
};

