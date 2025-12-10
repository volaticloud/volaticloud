/**
 * Binance Exchange Adapter
 *
 * Fetches OHLCV data from Binance public API.
 * No API key required for public market data.
 */

import type { ExchangeAdapter, OHLCVCandle, Timeframe } from './types';

// Binance API base URL
const BINANCE_API_URL = 'https://api.binance.com/api/v3';

// Timeframe mapping to Binance intervals
const TIMEFRAME_MAP: Record<Timeframe, string> = {
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '2h': '2h',
  '4h': '4h',
  '6h': '6h',
  '8h': '8h',
  '12h': '12h',
  '1d': '1d',
  '3d': '3d',
  '1w': '1w',
  '1M': '1M',
};

/**
 * Binance OHLCV response format
 * [
 *   openTime, open, high, low, close, volume,
 *   closeTime, quoteVolume, trades, takerBuyBase, takerBuyQuote, ignore
 * ]
 */
type BinanceKline = [
  number, // 0: Open time
  string, // 1: Open
  string, // 2: High
  string, // 3: Low
  string, // 4: Close
  string, // 5: Volume
  number, // 6: Close time
  string, // 7: Quote asset volume
  number, // 8: Number of trades
  string, // 9: Taker buy base asset volume
  string, // 10: Taker buy quote asset volume
  string, // 11: Ignore
];

/**
 * Parse Binance kline response to OHLCVCandle
 */
function parseKline(kline: BinanceKline): OHLCVCandle {
  return {
    timestamp: kline[0],
    open: parseFloat(kline[1]),
    high: parseFloat(kline[2]),
    low: parseFloat(kline[3]),
    close: parseFloat(kline[4]),
    volume: parseFloat(kline[5]),
  };
}

/**
 * Binance Exchange Adapter
 */
export const binanceAdapter: ExchangeAdapter = {
  id: 'binance',
  name: 'Binance',

  formatSymbol(symbol: string): string {
    // Convert "BTC/USDT" to "BTCUSDT"
    return symbol.replace('/', '').toUpperCase();
  },

  formatTimeframe(timeframe: Timeframe): string {
    return TIMEFRAME_MAP[timeframe] || '1h';
  },

  getMaxCandlesPerRequest(): number {
    // Binance allows up to 1000 candles per request
    return 1000;
  },

  async fetchOHLCV(
    symbol: string,
    timeframe: Timeframe,
    startTime: number,
    endTime: number
  ): Promise<OHLCVCandle[]> {
    const formattedSymbol = this.formatSymbol(symbol);
    const interval = this.formatTimeframe(timeframe);
    const maxCandles = this.getMaxCandlesPerRequest();

    const allCandles: OHLCVCandle[] = [];
    let currentStartTime = startTime;

    // Fetch in batches due to API limit
    while (currentStartTime < endTime) {
      const params = new URLSearchParams({
        symbol: formattedSymbol,
        interval,
        startTime: currentStartTime.toString(),
        endTime: endTime.toString(),
        limit: maxCandles.toString(),
      });

      const url = `${BINANCE_API_URL}/klines?${params}`;

      try {
        const response = await fetch(url);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Binance API error: ${response.status} - ${errorText}`);
        }

        const klines: BinanceKline[] = await response.json();

        if (klines.length === 0) {
          break;
        }

        const candles = klines.map(parseKline);
        allCandles.push(...candles);

        // Update start time for next batch
        const lastCandle = candles[candles.length - 1];
        currentStartTime = lastCandle.timestamp + 1;

        // If we got fewer candles than max, we've reached the end
        if (klines.length < maxCandles) {
          break;
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Binance fetch error:', error);
        throw error;
      }
    }

    return allCandles;
  },
};

export default binanceAdapter;