/**
 * Exchange Registry
 *
 * Central registry for exchange adapters.
 * Allows adding new exchanges easily via adapter pattern.
 */

import type { ExchangeAdapter, ExchangeId } from './types';
import { binanceAdapter } from './binanceAdapter';
import { okxAdapter } from './okxAdapter';

/**
 * Registry of exchange adapters
 */
class ExchangeRegistry {
  private adapters: Map<ExchangeId, ExchangeAdapter> = new Map();

  constructor() {
    // Register default adapters
    this.register(binanceAdapter);
    this.register(okxAdapter);
  }

  /**
   * Register an exchange adapter
   */
  register(adapter: ExchangeAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  /**
   * Get an exchange adapter by ID
   */
  getAdapter(exchangeId: ExchangeId): ExchangeAdapter | undefined {
    return this.adapters.get(exchangeId);
  }

  /**
   * Check if an exchange is supported
   */
  isSupported(exchangeId: string): exchangeId is ExchangeId {
    return this.adapters.has(exchangeId as ExchangeId);
  }

  /**
   * Get all supported exchange IDs
   */
  getSupportedExchanges(): ExchangeId[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get exchange display name
   */
  getExchangeName(exchangeId: ExchangeId): string {
    const adapter = this.adapters.get(exchangeId);
    return adapter?.name || exchangeId;
  }
}

// Export singleton instance
export const exchangeRegistry = new ExchangeRegistry();

export default exchangeRegistry;