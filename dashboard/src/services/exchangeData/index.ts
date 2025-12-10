/**
 * Exchange Data Service
 *
 * Main entry point for fetching OHLCV data from exchanges.
 * Provides caching, error handling, and a unified API.
 */

import type { OHLCVRequest, OHLCVResponse, ExchangeId } from './types';
import { ohlcvCache, generateCacheKey } from './ohlcvCache';
import { exchangeRegistry } from './exchangeRegistry';

// Re-export types
export type { OHLCVCandle, OHLCVRequest, OHLCVResponse, ExchangeId, Timeframe } from './types';

// Re-export utilities
export { exchangeRegistry } from './exchangeRegistry';
export { ohlcvCache, generateCacheKey } from './ohlcvCache';

// Re-export React hook
export { useOHLCVData } from './useOHLCVData';
export type { UseOHLCVDataOptions, UseOHLCVDataResult } from './useOHLCVData';

/**
 * Parse time input to Unix timestamp in milliseconds
 */
function parseTime(time: string | number): number {
  if (typeof time === 'number') {
    // If timestamp is in seconds, convert to milliseconds
    return time < 1e12 ? time * 1000 : time;
  }
  return new Date(time).getTime();
}

/**
 * Fetch OHLCV data from exchange with caching
 */
export async function fetchOHLCV(request: OHLCVRequest): Promise<OHLCVResponse> {
  const { exchange, symbol, timeframe, startTime, endTime } = request;

  // Parse times
  const startMs = parseTime(startTime);
  const endMs = parseTime(endTime);

  // Validate times
  if (isNaN(startMs) || isNaN(endMs)) {
    throw new Error('Invalid start or end time');
  }

  if (startMs >= endMs) {
    throw new Error('Start time must be before end time');
  }

  // Generate cache key
  const cacheKey = generateCacheKey(exchange, symbol, timeframe, startMs, endMs);

  // Try to get from cache first
  try {
    const cachedCandles = await ohlcvCache.get(cacheKey);
    if (cachedCandles && cachedCandles.length > 0) {
      return {
        exchange,
        symbol,
        timeframe,
        candles: cachedCandles,
        fromCache: true,
        fetchedAt: Date.now(),
      };
    }
  } catch (error) {
    console.warn('Cache read error:', error);
    // Continue to fetch from exchange
  }

  // Get exchange adapter
  const adapter = exchangeRegistry.getAdapter(exchange);
  if (!adapter) {
    throw new Error(`Unsupported exchange: ${exchange}`);
  }

  // Fetch from exchange
  const candles = await adapter.fetchOHLCV(symbol, timeframe, startMs, endMs);

  // Cache the result
  try {
    if (candles.length > 0) {
      await ohlcvCache.set(cacheKey, candles);
    }
  } catch (error) {
    console.warn('Cache write error:', error);
    // Continue without caching
  }

  return {
    exchange,
    symbol,
    timeframe,
    candles,
    fromCache: false,
    fetchedAt: Date.now(),
  };
}

/**
 * Fetch OHLCV for multiple symbols in parallel
 */
export async function fetchMultipleOHLCV(
  requests: OHLCVRequest[]
): Promise<Map<string, OHLCVResponse>> {
  const results = new Map<string, OHLCVResponse>();

  // Process in parallel with concurrency limit
  const CONCURRENCY = 3;
  const chunks: OHLCVRequest[][] = [];

  for (let i = 0; i < requests.length; i += CONCURRENCY) {
    chunks.push(requests.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (request) => {
      try {
        const response = await fetchOHLCV(request);
        const key = `${request.exchange}:${request.symbol}:${request.timeframe}`;
        results.set(key, response);
      } catch (error) {
        console.error(`Failed to fetch ${request.symbol}:`, error);
        // Don't throw, continue with other requests
      }
    });

    await Promise.all(promises);
  }

  return results;
}

/**
 * Check if exchange is supported
 */
export function isExchangeSupported(exchangeId: string): boolean {
  return exchangeRegistry.isSupported(exchangeId);
}

/**
 * Get list of supported exchanges
 */
export function getSupportedExchanges(): ExchangeId[] {
  return exchangeRegistry.getSupportedExchanges();
}

/**
 * Clear OHLCV cache
 */
export async function clearOHLVCache(): Promise<void> {
  await ohlcvCache.clearAll();
}

/**
 * Clear expired cache entries
 */
export async function clearExpiredCache(): Promise<number> {
  return ohlcvCache.clearExpired();
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{ count: number; oldestEntry: number | null }> {
  return ohlcvCache.getStats();
}