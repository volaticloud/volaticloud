/**
 * React Hook for OHLCV Data
 *
 * Provides easy access to OHLCV data in React components with
 * loading states, error handling, and automatic caching.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { OHLCVCandle, ExchangeId, Timeframe } from './types';
import { fetchOHLCV, isExchangeSupported } from './index';

export interface UseOHLCVDataOptions {
  /** Exchange identifier */
  exchange: ExchangeId | string;
  /** Trading pair (e.g., "BTC/USDT") */
  symbol: string;
  /** Candle timeframe */
  timeframe: Timeframe;
  /** Start time (ISO string or timestamp) */
  startTime: string | number;
  /** End time (ISO string or timestamp) */
  endTime: string | number;
  /** Whether to fetch automatically on mount */
  enabled?: boolean;
}

export interface UseOHLCVDataResult {
  /** OHLCV candle data */
  candles: OHLCVCandle[];
  /** Loading state */
  loading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Whether data was served from cache */
  fromCache: boolean;
  /** Manually trigger refetch */
  refetch: () => Promise<void>;
  /** Clear the current data */
  clear: () => void;
}

/**
 * Hook for fetching OHLCV data from exchanges
 */
export function useOHLCVData(options: UseOHLCVDataOptions): UseOHLCVDataResult {
  const { exchange, symbol, timeframe, startTime, endTime, enabled = true } = options;

  const [candles, setCandles] = useState<OHLCVCandle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);

  // Track if component is mounted to avoid state updates after unmount
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    // Validate exchange
    if (!isExchangeSupported(exchange)) {
      setError(new Error(`Unsupported exchange: ${exchange}`));
      return;
    }

    // Validate symbol
    if (!symbol) {
      setError(new Error('Symbol is required'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetchOHLCV({
        exchange: exchange as ExchangeId,
        symbol,
        timeframe,
        startTime,
        endTime,
      });

      if (isMounted.current) {
        setCandles(response.candles);
        setFromCache(response.fromCache);
        setError(null);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch OHLCV data'));
        setCandles([]);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [exchange, symbol, timeframe, startTime, endTime]);

  // Auto-fetch on options change
  useEffect(() => {
    if (enabled && symbol && startTime && endTime) {
      fetchData();
    }
  }, [enabled, fetchData, symbol, startTime, endTime]);

  const clear = useCallback(() => {
    setCandles([]);
    setError(null);
    setFromCache(false);
  }, []);

  return {
    candles,
    loading,
    error,
    fromCache,
    refetch: fetchData,
    clear,
  };
}

export default useOHLCVData;