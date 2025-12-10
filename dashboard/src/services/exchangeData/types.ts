/**
 * Exchange Data Types
 *
 * Type definitions for OHLCV data fetching from exchanges.
 */

/**
 * OHLCV (Open, High, Low, Close, Volume) candle data
 */
export interface OHLCVCandle {
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Opening price */
  open: number;
  /** Highest price */
  high: number;
  /** Lowest price */
  low: number;
  /** Closing price */
  close: number;
  /** Volume traded */
  volume: number;
}

/**
 * Supported timeframes for OHLCV data
 */
export type Timeframe =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '6h'
  | '8h'
  | '12h'
  | '1d'
  | '3d'
  | '1w'
  | '1M';

/**
 * Supported exchanges
 */
export type ExchangeId = 'binance' | 'binanceus' | 'bybit' | 'okx' | 'kraken' | 'kucoin';

/**
 * Request parameters for fetching OHLCV data
 */
export interface OHLCVRequest {
  /** Exchange identifier */
  exchange: ExchangeId;
  /** Trading pair (e.g., "BTC/USDT") */
  symbol: string;
  /** Candle timeframe */
  timeframe: Timeframe;
  /** Start time (ISO string or timestamp) */
  startTime: string | number;
  /** End time (ISO string or timestamp) */
  endTime: string | number;
}

/**
 * Response from OHLCV fetch
 */
export interface OHLCVResponse {
  /** Exchange identifier */
  exchange: ExchangeId;
  /** Trading pair */
  symbol: string;
  /** Candle timeframe */
  timeframe: Timeframe;
  /** Candle data */
  candles: OHLCVCandle[];
  /** Whether data was served from cache */
  fromCache: boolean;
  /** Request timestamp */
  fetchedAt: number;
}

/**
 * Exchange adapter interface
 */
export interface ExchangeAdapter {
  /** Exchange identifier */
  id: ExchangeId;
  /** Exchange display name */
  name: string;
  /** Fetch OHLCV data from exchange */
  fetchOHLCV(
    symbol: string,
    timeframe: Timeframe,
    startTime: number,
    endTime: number
  ): Promise<OHLCVCandle[]>;
  /** Convert symbol to exchange format (e.g., "BTC/USDT" -> "BTCUSDT") */
  formatSymbol(symbol: string): string;
  /** Convert timeframe to exchange format */
  formatTimeframe(timeframe: Timeframe): string;
  /** Get maximum candles per request */
  getMaxCandlesPerRequest(): number;
}

/**
 * Cache entry for IndexedDB
 */
export interface CacheEntry {
  /** Cache key */
  key: string;
  /** Cached candles */
  candles: OHLCVCandle[];
  /** When the cache was created */
  createdAt: number;
  /** When the cache expires */
  expiresAt: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Time-to-live in milliseconds (default: 24 hours) */
  ttl: number;
  /** Maximum cache size in bytes (default: 50MB) */
  maxSize: number;
  /** Database name */
  dbName: string;
  /** Store name */
  storeName: string;
}