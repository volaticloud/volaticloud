/**
 * OHLCV Cache using IndexedDB
 *
 * Provides browser-side caching for OHLCV data to reduce API calls
 * and improve performance.
 */

import type { OHLCVCandle, CacheEntry, CacheConfig, ExchangeId, Timeframe } from './types';

const DEFAULT_CONFIG: CacheConfig = {
  ttl: 24 * 60 * 60 * 1000, // 24 hours
  maxSize: 50 * 1024 * 1024, // 50MB
  dbName: 'ohlcv-cache',
  storeName: 'candles',
};

/**
 * Generate cache key from request parameters
 */
export function generateCacheKey(
  exchange: ExchangeId,
  symbol: string,
  timeframe: Timeframe,
  startTime: number,
  endTime: number
): string {
  // Normalize symbol (remove slashes, uppercase)
  const normalizedSymbol = symbol.replace('/', '').toUpperCase();
  // Round times to nearest candle boundary for better cache hits
  return `${exchange}:${normalizedSymbol}:${timeframe}:${startTime}:${endTime}`;
}

/**
 * OHLCV Cache Manager
 */
class OHLCVCacheManager {
  private db: IDBDatabase | null = null;
  private config: CacheConfig;
  private initPromise: Promise<void> | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize IndexedDB connection
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, 1);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store with key index
        if (!db.objectStoreNames.contains(this.config.storeName)) {
          const store = db.createObjectStore(this.config.storeName, { keyPath: 'key' });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Get cached candles
   */
  async get(key: string): Promise<OHLCVCandle[] | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(this.config.storeName, 'readonly');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.get(key);

      request.onerror = () => {
        console.error('Cache get error:', request.error);
        resolve(null);
      };

      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;

        if (!entry) {
          resolve(null);
          return;
        }

        // Check if expired
        if (entry.expiresAt < Date.now()) {
          // Delete expired entry asynchronously
          this.delete(key).catch(console.error);
          resolve(null);
          return;
        }

        resolve(entry.candles);
      };
    });
  }

  /**
   * Store candles in cache
   */
  async set(key: string, candles: OHLCVCandle[]): Promise<void> {
    await this.init();
    if (!this.db) return;

    const entry: CacheEntry = {
      key,
      candles,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.config.ttl,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, 'readwrite');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.put(entry);

      request.onerror = () => {
        console.error('Cache set error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Delete cache entry
   */
  async delete(key: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(this.config.storeName, 'readwrite');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.delete(key);

      request.onerror = () => {
        console.error('Cache delete error:', request.error);
        resolve();
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Clear all expired entries
   */
  async clearExpired(): Promise<number> {
    await this.init();
    if (!this.db) return 0;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(this.config.storeName, 'readwrite');
      const store = transaction.objectStore(this.config.storeName);
      const index = store.index('expiresAt');
      const range = IDBKeyRange.upperBound(Date.now());
      const request = index.openCursor(range);
      let deletedCount = 0;

      request.onerror = () => {
        console.error('Clear expired error:', request.error);
        resolve(deletedCount);
      };

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };
    });
  }

  /**
   * Clear all cache entries
   */
  async clearAll(): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, 'readwrite');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.clear();

      request.onerror = () => {
        console.error('Clear all error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ count: number; oldestEntry: number | null }> {
    await this.init();
    if (!this.db) return { count: 0, oldestEntry: null };

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(this.config.storeName, 'readonly');
      const store = transaction.objectStore(this.config.storeName);
      const countRequest = store.count();
      let count = 0;
      let oldestEntry: number | null = null;

      countRequest.onsuccess = () => {
        count = countRequest.result;
      };

      // Get oldest entry
      const cursorRequest = store.openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          const entry = cursor.value as CacheEntry;
          if (oldestEntry === null || entry.createdAt < oldestEntry) {
            oldestEntry = entry.createdAt;
          }
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        resolve({ count, oldestEntry });
      };
    });
  }
}

// Export singleton instance
export const ohlcvCache = new OHLCVCacheManager();

export default ohlcvCache;