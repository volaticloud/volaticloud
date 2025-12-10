/**
 * OKX Exchange Adapter
 *
 * Fetches OHLCV data from OKX public API.
 * No API key required for public market data.
 */

import type { ExchangeAdapter, OHLCVCandle, Timeframe } from './types';

// OKX API base URL
const OKX_API_URL = 'https://www.okx.com/api/v5/market';

// Timeframe mapping to OKX bar intervals
// OKX uses different format: 1m, 3m, 5m, 15m, 30m, 1H, 2H, 4H, 6H, 12H, 1D, 1W, 1M
const TIMEFRAME_MAP: Record<Timeframe, string> = {
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1H',
  '2h': '2H',
  '4h': '4H',
  '6h': '6Hutc', // UTC timezone
  '8h': '8Hutc',
  '12h': '12Hutc',
  '1d': '1Dutc',
  '3d': '3Dutc',
  '1w': '1Wutc',
  '1M': '1Mutc',
};

/**
 * OKX OHLCV response format
 * [timestamp, open, high, low, close, volume, volCcy, volCcyQuote, confirm]
 */
type OKXCandle = [
  string, // 0: Timestamp (ms string)
  string, // 1: Open
  string, // 2: High
  string, // 3: Low
  string, // 4: Close
  string, // 5: Volume (in base currency)
  string, // 6: Volume in currency
  string, // 7: Volume in quote currency
  string, // 8: Candle state: 0 = incomplete, 1 = complete
];

interface OKXResponse {
  code: string;
  msg: string;
  data: OKXCandle[];
}

/**
 * Parse OKX candle response to OHLCVCandle
 */
function parseCandle(candle: OKXCandle): OHLCVCandle {
  return {
    timestamp: parseInt(candle[0], 10),
    open: parseFloat(candle[1]),
    high: parseFloat(candle[2]),
    low: parseFloat(candle[3]),
    close: parseFloat(candle[4]),
    volume: parseFloat(candle[5]),
  };
}

/**
 * OKX Exchange Adapter
 */
export const okxAdapter: ExchangeAdapter = {
  id: 'okx',
  name: 'OKX',

  formatSymbol(symbol: string): string {
    // Convert "BTC/USDT" to "BTC-USDT" (OKX format)
    return symbol.replace('/', '-').toUpperCase();
  },

  formatTimeframe(timeframe: Timeframe): string {
    return TIMEFRAME_MAP[timeframe] || '1H';
  },

  getMaxCandlesPerRequest(): number {
    // OKX allows up to 300 candles per request
    return 300;
  },

  async fetchOHLCV(
    symbol: string,
    timeframe: Timeframe,
    startTime: number,
    endTime: number
  ): Promise<OHLCVCandle[]> {
    const formattedSymbol = this.formatSymbol(symbol);
    const bar = this.formatTimeframe(timeframe);
    const maxCandles = this.getMaxCandlesPerRequest();

    const allCandles: OHLCVCandle[] = [];
    let currentEndTime = endTime;

    // OKX returns candles in reverse order (newest first)
    // and uses 'after' parameter for pagination (get candles before this time)
    while (currentEndTime > startTime) {
      const params = new URLSearchParams({
        instId: formattedSymbol,
        bar,
        after: currentEndTime.toString(),
        limit: maxCandles.toString(),
      });

      const url = `${OKX_API_URL}/candles?${params}`;

      try {
        const response = await fetch(url);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OKX API error: ${response.status} - ${errorText}`);
        }

        const data: OKXResponse = await response.json();

        if (data.code !== '0') {
          throw new Error(`OKX API error: ${data.code} - ${data.msg}`);
        }

        if (!data.data || data.data.length === 0) {
          break;
        }

        // Parse and filter candles within our time range
        const candles = data.data
          .map(parseCandle)
          .filter((c) => c.timestamp >= startTime && c.timestamp <= endTime);

        if (candles.length === 0) {
          break;
        }

        allCandles.push(...candles);

        // Update end time for next batch (get older candles)
        // OKX returns newest first, so we need the oldest timestamp
        const oldestTimestamp = Math.min(...candles.map((c) => c.timestamp));
        currentEndTime = oldestTimestamp - 1;

        // If we got fewer candles than max, we've reached the end
        if (data.data.length < maxCandles) {
          break;
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error('OKX fetch error:', error);
        throw error;
      }
    }

    // Sort candles by timestamp (ascending) since OKX returns newest first
    allCandles.sort((a, b) => a.timestamp - b.timestamp);

    return allCandles;
  },
};

export default okxAdapter;