import { describe, it, expect } from 'vitest';
import {
  validateTradingPair,
  validateTradingPairsFormat,
  extractStrategyConfigFields,
  validateBacktestConfigAgainstRunner,
  computeAvailableDateRange,
  validateDateRange,
  areAllPairsSelected,
  clampDateToRange,
  SUPPORTED_EXCHANGES,
  type AvailableDateRange,
} from './backtestValidation';
import type { RunnerDataAvailable } from '../shared/RunnerSelector';

describe('Backtest Validation', () => {
  describe('validateTradingPair', () => {
    describe('valid spot pairs', () => {
      it('accepts standard spot pair format BTC/USDT', () => {
        expect(validateTradingPair('BTC/USDT')).toBeNull();
      });

      it('accepts lowercase pair format btc/usdt', () => {
        expect(validateTradingPair('btc/usdt')).toBeNull();
      });

      it('accepts mixed case pair ETH/Btc', () => {
        expect(validateTradingPair('ETH/Btc')).toBeNull();
      });

      it('accepts pair with numbers like SHIB1000/USDT', () => {
        expect(validateTradingPair('SHIB1000/USDT')).toBeNull();
      });

      it('trims whitespace around pair', () => {
        expect(validateTradingPair('  BTC/USDT  ')).toBeNull();
      });
    });

    describe('valid futures pairs', () => {
      it('accepts futures format BTC/USDT:USDT', () => {
        expect(validateTradingPair('BTC/USDT:USDT')).toBeNull();
      });

      it('accepts futures with different settlement BTC/USD:BTC', () => {
        expect(validateTradingPair('BTC/USD:BTC')).toBeNull();
      });

      it('accepts lowercase futures btc/usdt:usdt', () => {
        expect(validateTradingPair('btc/usdt:usdt')).toBeNull();
      });
    });

    describe('invalid pairs', () => {
      it('rejects empty string', () => {
        const result = validateTradingPair('');
        expect(result).toBe('Empty trading pair');
      });

      it('rejects whitespace only', () => {
        const result = validateTradingPair('   ');
        expect(result).toBe('Empty trading pair');
      });

      it('rejects pair without slash', () => {
        const result = validateTradingPair('BTCUSDT');
        expect(result).toContain('Invalid format');
        expect(result).toContain('expected BASE/QUOTE');
      });

      it('rejects pair with multiple slashes', () => {
        const result = validateTradingPair('BTC/USDT/ETH');
        expect(result).toContain('Invalid format');
      });

      it('rejects pair with empty base', () => {
        const result = validateTradingPair('/USDT');
        expect(result).toContain('empty base currency');
      });

      it('rejects pair with empty quote', () => {
        const result = validateTradingPair('BTC/');
        expect(result).toContain('empty quote currency');
      });

      it('rejects pair with special characters in base', () => {
        const result = validateTradingPair('BTC$/USDT');
        expect(result).toContain('base currency contains invalid characters');
      });

      it('rejects pair with special characters in quote', () => {
        const result = validateTradingPair('BTC/USDT@');
        expect(result).toContain('quote currency contains invalid characters');
      });

      it('rejects pair with unicode characters', () => {
        const result = validateTradingPair('BTÇ/USDT');
        expect(result).toContain('invalid characters');
      });

      it('rejects futures with invalid settlement currency', () => {
        const result = validateTradingPair('BTC/USDT:USD$');
        expect(result).toContain('settlement currency contains invalid characters');
      });

      it('rejects futures with multiple colons', () => {
        const result = validateTradingPair('BTC/USDT:USDT:BTC');
        // With multiple colons, the regex treats "USDT:BTC" as the settlement, which contains invalid char ":"
        expect(result).toContain('invalid characters');
      });
    });
  });

  describe('validateTradingPairsFormat', () => {
    it('returns null for valid array of pairs', () => {
      const result = validateTradingPairsFormat(['BTC/USDT', 'ETH/USDT', 'BNB/USDT']);
      expect(result).toBeNull();
    });

    it('returns null for valid mix of spot and futures pairs', () => {
      const result = validateTradingPairsFormat(['BTC/USDT', 'ETH/USDT:USDT']);
      expect(result).toBeNull();
    });

    it('returns error for empty array', () => {
      const result = validateTradingPairsFormat([]);
      expect(result).toBe('At least one trading pair is required');
    });

    it('returns first error when multiple pairs are invalid', () => {
      const result = validateTradingPairsFormat(['BTC/USDT', 'INVALID', 'ALSO-INVALID']);
      expect(result).toContain('INVALID');
    });

    it('stops at first invalid pair', () => {
      const result = validateTradingPairsFormat(['INVALID1', 'BTC/USDT']);
      expect(result).toContain('INVALID1');
    });
  });

  describe('extractStrategyConfigFields', () => {
    it('returns empty object for null config', () => {
      const result = extractStrategyConfigFields(null);
      expect(result).toEqual({});
    });

    it('returns empty object for undefined config', () => {
      const result = extractStrategyConfigFields(undefined);
      expect(result).toEqual({});
    });

    it('extracts timeframe from top level', () => {
      const result = extractStrategyConfigFields({ timeframe: '5m' });
      expect(result.timeframe).toBe('5m');
    });

    it('extracts pair_whitelist from top level', () => {
      const result = extractStrategyConfigFields({
        pair_whitelist: ['BTC/USDT', 'ETH/USDT'],
      });
      expect(result.pair_whitelist).toEqual(['BTC/USDT', 'ETH/USDT']);
    });

    it('extracts pair_whitelist from nested exchange object', () => {
      const result = extractStrategyConfigFields({
        exchange: {
          pair_whitelist: ['BTC/USDT', 'ETH/USDT'],
        },
      });
      expect(result.pair_whitelist).toEqual(['BTC/USDT', 'ETH/USDT']);
    });

    it('prefers top-level pair_whitelist over nested', () => {
      const result = extractStrategyConfigFields({
        pair_whitelist: ['TOP/LEVEL'],
        exchange: {
          pair_whitelist: ['NESTED/LEVEL'],
        },
      });
      expect(result.pair_whitelist).toEqual(['TOP/LEVEL']);
    });

    it('ignores non-string timeframe', () => {
      const result = extractStrategyConfigFields({ timeframe: 123 });
      expect(result.timeframe).toBeUndefined();
    });

    it('ignores non-array pair_whitelist', () => {
      const result = extractStrategyConfigFields({ pair_whitelist: 'BTC/USDT' });
      expect(result.pair_whitelist).toBeUndefined();
    });

    it('extracts both fields when present', () => {
      const result = extractStrategyConfigFields({
        timeframe: '1h',
        pair_whitelist: ['BTC/USDT'],
      });
      expect(result.timeframe).toBe('1h');
      expect(result.pair_whitelist).toEqual(['BTC/USDT']);
    });
  });

  describe('validateBacktestConfigAgainstRunner', () => {
    const createRunnerData = (
      exchanges: Array<{
        name: string;
        pairs: Array<{
          pair: string;
          timeframes: Array<{ timeframe: string }>;
        }>;
      }>
    ): RunnerDataAvailable => ({
      exchanges: exchanges.map((e) => ({
        name: e.name,
        pairs: e.pairs.map((p) => ({
          pair: p.pair,
          timeframes: p.timeframes,
        })),
      })),
    });

    describe('with no runner data', () => {
      it('returns no errors for valid config when no runner data', () => {
        const result = validateBacktestConfigAgainstRunner(
          { exchange: 'binance', pairs: ['BTC/USDT'], timeframe: '5m' },
          null
        );
        expect(result.exchangeError).toBeNull();
        expect(result.pairsError).toBeNull();
        expect(result.timeframeError).toBeNull();
      });

      it('still validates pair format when no runner data', () => {
        const result = validateBacktestConfigAgainstRunner(
          { pairs: ['INVALID'] },
          null
        );
        expect(result.formatError).toContain('Invalid format');
      });

      it('handles empty exchanges array', () => {
        const result = validateBacktestConfigAgainstRunner(
          { exchange: 'binance', pairs: ['BTC/USDT'] },
          { exchanges: [] }
        );
        expect(result.exchangeError).toBeNull();
      });
    });

    describe('exchange validation', () => {
      it('accepts available exchange', () => {
        const runnerData = createRunnerData([
          { name: 'binance', pairs: [] },
        ]);
        const result = validateBacktestConfigAgainstRunner(
          { exchange: 'binance' },
          runnerData
        );
        expect(result.exchangeError).toBeNull();
      });

      it('accepts exchange case-insensitively', () => {
        const runnerData = createRunnerData([
          { name: 'Binance', pairs: [] },
        ]);
        const result = validateBacktestConfigAgainstRunner(
          { exchange: 'BINANCE' },
          runnerData
        );
        expect(result.exchangeError).toBeNull();
      });

      it('rejects unavailable exchange', () => {
        const runnerData = createRunnerData([
          { name: 'binance', pairs: [] },
        ]);
        const result = validateBacktestConfigAgainstRunner(
          { exchange: 'kraken' },
          runnerData
        );
        expect(result.exchangeError).toContain('not available on this runner');
        expect(result.exchangeError).toContain('kraken');
      });
    });

    describe('pairs validation', () => {
      it('accepts available pairs', () => {
        const runnerData = createRunnerData([
          {
            name: 'binance',
            pairs: [
              { pair: 'BTC/USDT', timeframes: [] },
              { pair: 'ETH/USDT', timeframes: [] },
            ],
          },
        ]);
        const result = validateBacktestConfigAgainstRunner(
          { exchange: 'binance', pairs: ['BTC/USDT', 'ETH/USDT'] },
          runnerData
        );
        expect(result.pairsError).toBeNull();
      });

      it('validates pairs case-insensitively', () => {
        const runnerData = createRunnerData([
          {
            name: 'binance',
            pairs: [{ pair: 'BTC/USDT', timeframes: [] }],
          },
        ]);
        const result = validateBacktestConfigAgainstRunner(
          { exchange: 'binance', pairs: ['btc/usdt'] },
          runnerData
        );
        expect(result.pairsError).toBeNull();
      });

      it('reports unavailable pairs', () => {
        const runnerData = createRunnerData([
          {
            name: 'binance',
            pairs: [{ pair: 'BTC/USDT', timeframes: [] }],
          },
        ]);
        const result = validateBacktestConfigAgainstRunner(
          { exchange: 'binance', pairs: ['BTC/USDT', 'XRP/USDT'] },
          runnerData
        );
        expect(result.pairsError).toContain('XRP/USDT');
        expect(result.pairsError).toContain('not available on runner');
      });

      it('skips pairs validation when exchange is invalid', () => {
        const runnerData = createRunnerData([
          {
            name: 'binance',
            pairs: [{ pair: 'BTC/USDT', timeframes: [] }],
          },
        ]);
        const result = validateBacktestConfigAgainstRunner(
          { exchange: 'invalid', pairs: ['INVALID$/USDT'] },
          runnerData
        );
        // Exchange error takes precedence
        expect(result.exchangeError).not.toBeNull();
        // Pairs should still have format error ($ is invalid character in base)
        expect(result.formatError).not.toBeNull();
      });

      it('uses default binance exchange when none specified', () => {
        const runnerData = createRunnerData([
          {
            name: 'binance',
            pairs: [{ pair: 'BTC/USDT', timeframes: [] }],
          },
        ]);
        const result = validateBacktestConfigAgainstRunner(
          { pairs: ['BTC/USDT'] },
          runnerData
        );
        expect(result.pairsError).toBeNull();
      });
    });

    describe('timeframe validation', () => {
      it('accepts available timeframe', () => {
        const runnerData = createRunnerData([
          {
            name: 'binance',
            pairs: [
              { pair: 'BTC/USDT', timeframes: [{ timeframe: '5m' }, { timeframe: '1h' }] },
            ],
          },
        ]);
        const result = validateBacktestConfigAgainstRunner(
          { exchange: 'binance', pairs: ['BTC/USDT'], timeframe: '5m' },
          runnerData
        );
        expect(result.timeframeError).toBeNull();
      });

      it('reports unavailable timeframe for pair', () => {
        const runnerData = createRunnerData([
          {
            name: 'binance',
            pairs: [{ pair: 'BTC/USDT', timeframes: [{ timeframe: '5m' }] }],
          },
        ]);
        const result = validateBacktestConfigAgainstRunner(
          { exchange: 'binance', pairs: ['BTC/USDT'], timeframe: '1d' },
          runnerData
        );
        expect(result.timeframeError).toContain('1d');
        expect(result.timeframeError).toContain('not available');
      });

      it('skips timeframe validation when exchange or pairs are invalid', () => {
        const runnerData = createRunnerData([
          {
            name: 'binance',
            pairs: [{ pair: 'BTC/USDT', timeframes: [{ timeframe: '5m' }] }],
          },
        ]);
        const result = validateBacktestConfigAgainstRunner(
          { exchange: 'binance', pairs: ['INVALID'], timeframe: '5m' },
          runnerData
        );
        // Format error should be present for invalid pair
        expect(result.formatError).not.toBeNull();
      });

      it('validates timeframe across all selected pairs', () => {
        const runnerData = createRunnerData([
          {
            name: 'binance',
            pairs: [
              { pair: 'BTC/USDT', timeframes: [{ timeframe: '5m' }, { timeframe: '1h' }] },
              { pair: 'ETH/USDT', timeframes: [{ timeframe: '5m' }] }, // No 1h
            ],
          },
        ]);
        const result = validateBacktestConfigAgainstRunner(
          { exchange: 'binance', pairs: ['BTC/USDT', 'ETH/USDT'], timeframe: '1h' },
          runnerData
        );
        expect(result.timeframeError).toContain('1h');
        expect(result.timeframeError).toContain('ETH/USDT');
      });
    });

    describe('format validation', () => {
      it('validates pair format even when pairs are available', () => {
        const runnerData = createRunnerData([
          {
            name: 'binance',
            pairs: [{ pair: 'BTC/USDT', timeframes: [] }],
          },
        ]);
        const result = validateBacktestConfigAgainstRunner(
          { exchange: 'binance', pairs: ['BTC/USDT', 'INVALID PAIR'] },
          runnerData
        );
        expect(result.formatError).not.toBeNull();
      });
    });
  });

  describe('SUPPORTED_EXCHANGES', () => {
    it('contains expected exchanges', () => {
      const exchangeIds = SUPPORTED_EXCHANGES.map((e) => e.id);
      expect(exchangeIds).toContain('binance');
      expect(exchangeIds).toContain('kraken');
      expect(exchangeIds).toContain('bybit');
    });

    it('has valid structure for all exchanges', () => {
      SUPPORTED_EXCHANGES.forEach((exchange) => {
        expect(exchange).toHaveProperty('id');
        expect(exchange).toHaveProperty('name');
        expect(typeof exchange.id).toBe('string');
        expect(typeof exchange.name).toBe('string');
        expect(exchange.id.length).toBeGreaterThan(0);
        expect(exchange.name.length).toBeGreaterThan(0);
      });
    });

    it('has lowercase ids', () => {
      SUPPORTED_EXCHANGES.forEach((exchange) => {
        expect(exchange.id).toBe(exchange.id.toLowerCase());
      });
    });
  });

  describe('computeAvailableDateRange', () => {
    const createRunnerDataWithDates = (
      exchanges: Array<{
        name: string;
        pairs: Array<{
          pair: string;
          timeframes: Array<{ timeframe: string; from: string; to: string }>;
        }>;
      }>
    ): RunnerDataAvailable => ({
      exchanges: exchanges.map((e) => ({
        name: e.name,
        pairs: e.pairs.map((p) => ({
          pair: p.pair,
          timeframes: p.timeframes,
        })),
      })),
    });

    it('returns null when no runner data', () => {
      const result = computeAvailableDateRange(null, 'binance', ['BTC/USDT'], '5m');
      expect(result).toBeNull();
    });

    it('returns null when exchange not found', () => {
      const runnerData = createRunnerDataWithDates([
        {
          name: 'binance',
          pairs: [
            { pair: 'BTC/USDT', timeframes: [{ timeframe: '5m', from: '2024-01-01', to: '2024-12-31' }] },
          ],
        },
      ]);
      const result = computeAvailableDateRange(runnerData, 'kraken', ['BTC/USDT'], '5m');
      expect(result).toBeNull();
    });

    it('returns date range for single pair and timeframe', () => {
      const runnerData = createRunnerDataWithDates([
        {
          name: 'binance',
          pairs: [
            { pair: 'BTC/USDT', timeframes: [{ timeframe: '5m', from: '2024-01-01', to: '2024-12-31' }] },
          ],
        },
      ]);
      const result = computeAvailableDateRange(runnerData, 'binance', ['BTC/USDT'], '5m');
      expect(result).not.toBeNull();
      expect(result!.from.toISOString().split('T')[0]).toBe('2024-01-01');
      expect(result!.to.toISOString().split('T')[0]).toBe('2024-12-31');
    });

    it('returns intersection for multiple pairs', () => {
      const runnerData = createRunnerDataWithDates([
        {
          name: 'binance',
          pairs: [
            { pair: 'BTC/USDT', timeframes: [{ timeframe: '5m', from: '2024-01-01', to: '2024-12-31' }] },
            { pair: 'ETH/USDT', timeframes: [{ timeframe: '5m', from: '2024-03-01', to: '2024-09-30' }] },
          ],
        },
      ]);
      const result = computeAvailableDateRange(runnerData, 'binance', ['BTC/USDT', 'ETH/USDT'], '5m');
      expect(result).not.toBeNull();
      // Intersection: latest start (2024-03-01) to earliest end (2024-09-30)
      expect(result!.from.toISOString().split('T')[0]).toBe('2024-03-01');
      expect(result!.to.toISOString().split('T')[0]).toBe('2024-09-30');
    });

    it('returns null when no overlapping date range', () => {
      const runnerData = createRunnerDataWithDates([
        {
          name: 'binance',
          pairs: [
            { pair: 'BTC/USDT', timeframes: [{ timeframe: '5m', from: '2024-01-01', to: '2024-03-31' }] },
            { pair: 'ETH/USDT', timeframes: [{ timeframe: '5m', from: '2024-06-01', to: '2024-12-31' }] },
          ],
        },
      ]);
      const result = computeAvailableDateRange(runnerData, 'binance', ['BTC/USDT', 'ETH/USDT'], '5m');
      expect(result).toBeNull();
    });

    it('filters by timeframe when specified', () => {
      const runnerData = createRunnerDataWithDates([
        {
          name: 'binance',
          pairs: [
            {
              pair: 'BTC/USDT',
              timeframes: [
                { timeframe: '5m', from: '2024-01-01', to: '2024-06-30' },
                { timeframe: '1h', from: '2024-03-01', to: '2024-12-31' },
              ],
            },
          ],
        },
      ]);
      const result5m = computeAvailableDateRange(runnerData, 'binance', ['BTC/USDT'], '5m');
      expect(result5m!.to.toISOString().split('T')[0]).toBe('2024-06-30');

      const result1h = computeAvailableDateRange(runnerData, 'binance', ['BTC/USDT'], '1h');
      expect(result1h!.from.toISOString().split('T')[0]).toBe('2024-03-01');
    });

    it('considers all pairs when no pairs specified', () => {
      const runnerData = createRunnerDataWithDates([
        {
          name: 'binance',
          pairs: [
            { pair: 'BTC/USDT', timeframes: [{ timeframe: '5m', from: '2024-01-01', to: '2024-12-31' }] },
            { pair: 'ETH/USDT', timeframes: [{ timeframe: '5m', from: '2024-03-01', to: '2024-09-30' }] },
          ],
        },
      ]);
      const result = computeAvailableDateRange(runnerData, 'binance', [], '5m');
      // When no pairs specified, takes intersection of all
      expect(result!.from.toISOString().split('T')[0]).toBe('2024-03-01');
      expect(result!.to.toISOString().split('T')[0]).toBe('2024-09-30');
    });

    it('handles case-insensitive exchange matching', () => {
      const runnerData = createRunnerDataWithDates([
        {
          name: 'Binance',
          pairs: [
            { pair: 'BTC/USDT', timeframes: [{ timeframe: '5m', from: '2024-01-01', to: '2024-12-31' }] },
          ],
        },
      ]);
      const result = computeAvailableDateRange(runnerData, 'BINANCE', ['BTC/USDT'], '5m');
      expect(result).not.toBeNull();
    });

    it('handles case-insensitive pair matching', () => {
      const runnerData = createRunnerDataWithDates([
        {
          name: 'binance',
          pairs: [
            { pair: 'BTC/USDT', timeframes: [{ timeframe: '5m', from: '2024-01-01', to: '2024-12-31' }] },
          ],
        },
      ]);
      const result = computeAvailableDateRange(runnerData, 'binance', ['btc/usdt'], '5m');
      expect(result).not.toBeNull();
    });
  });

  describe('validateDateRange', () => {
    const availableRange: AvailableDateRange = {
      from: new Date('2024-03-01'),
      to: new Date('2024-09-30'),
    };

    it('returns no errors for dates within range', () => {
      const result = validateDateRange(
        new Date('2024-04-01'),
        new Date('2024-08-31'),
        availableRange
      );
      expect(result.startError).toBeNull();
      expect(result.endError).toBeNull();
    });

    it('returns no errors when no available range', () => {
      const result = validateDateRange(
        new Date('2024-01-01'),
        new Date('2024-12-31'),
        null
      );
      expect(result.startError).toBeNull();
      expect(result.endError).toBeNull();
    });

    it('returns start error when start is before available range', () => {
      const result = validateDateRange(
        new Date('2024-01-15'),
        new Date('2024-06-15'),
        availableRange
      );
      expect(result.startError).toContain('before available data');
      expect(result.startError).toContain('2024-03-01');
      expect(result.endError).toBeNull();
    });

    it('returns start error when start is after available range', () => {
      const result = validateDateRange(
        new Date('2024-12-01'),
        new Date('2024-12-31'),
        availableRange
      );
      expect(result.startError).toContain('after available data');
      expect(result.startError).toContain('2024-09-30');
    });

    it('returns end error when end is after available range', () => {
      const result = validateDateRange(
        new Date('2024-04-01'),
        new Date('2024-12-31'),
        availableRange
      );
      expect(result.startError).toBeNull();
      expect(result.endError).toContain('after available data');
      expect(result.endError).toContain('2024-09-30');
    });

    it('returns end error when end is before available range', () => {
      const result = validateDateRange(
        new Date('2024-01-01'),
        new Date('2024-02-15'),
        availableRange
      );
      expect(result.endError).toContain('before available data');
      expect(result.endError).toContain('2024-03-01');
    });

    it('returns both errors when both dates are invalid', () => {
      const result = validateDateRange(
        new Date('2024-01-01'),
        new Date('2024-12-31'),
        availableRange
      );
      expect(result.startError).not.toBeNull();
      expect(result.endError).not.toBeNull();
    });

    it('accepts boundary dates', () => {
      const result = validateDateRange(
        new Date('2024-03-01'),
        new Date('2024-09-30'),
        availableRange
      );
      expect(result.startError).toBeNull();
      expect(result.endError).toBeNull();
    });
  });

  describe('areAllPairsSelected', () => {
    it('returns true when all pairs are selected', () => {
      const result = areAllPairsSelected(
        ['BTC/USDT', 'ETH/USDT'],
        ['BTC/USDT', 'ETH/USDT']
      );
      expect(result).toBe(true);
    });

    it('returns false when lengths differ', () => {
      const result = areAllPairsSelected(
        ['BTC/USDT'],
        ['BTC/USDT', 'ETH/USDT']
      );
      expect(result).toBe(false);
    });

    it('returns false when pairs differ', () => {
      const result = areAllPairsSelected(
        ['BTC/USDT', 'XRP/USDT'],
        ['BTC/USDT', 'ETH/USDT']
      );
      expect(result).toBe(false);
    });

    it('handles case-insensitive comparison', () => {
      const result = areAllPairsSelected(
        ['btc/usdt', 'ETH/USDT'],
        ['BTC/USDT', 'eth/usdt']
      );
      expect(result).toBe(true);
    });

    it('returns true for empty arrays', () => {
      const result = areAllPairsSelected([], []);
      expect(result).toBe(true);
    });
  });

  describe('clampDateToRange', () => {
    const range: AvailableDateRange = {
      from: new Date('2024-03-01'),
      to: new Date('2024-09-30'),
    };

    it('returns original date when within range', () => {
      const date = new Date('2024-06-15');
      const result = clampDateToRange(date, range, true);
      expect(result).toBe(date);
    });

    it('returns range start when date is before range', () => {
      const result = clampDateToRange(new Date('2024-01-15'), range, true);
      expect(result).toBe(range.from);
    });

    it('returns range start when date is after range and preferStart is true', () => {
      const result = clampDateToRange(new Date('2024-12-15'), range, true);
      expect(result).toBe(range.from);
    });

    it('returns range end when date is after range and preferStart is false', () => {
      const result = clampDateToRange(new Date('2024-12-15'), range, false);
      expect(result).toBe(range.to);
    });

    it('returns range start for null date when preferStart is true', () => {
      const result = clampDateToRange(null, range, true);
      expect(result).toBe(range.from);
    });

    it('returns range end for null date when preferStart is false', () => {
      const result = clampDateToRange(null, range, false);
      expect(result).toBe(range.to);
    });

    it('accepts boundary dates', () => {
      const startDate = new Date('2024-03-01');
      const endDate = new Date('2024-09-30');
      expect(clampDateToRange(startDate, range, true)).toBe(startDate);
      expect(clampDateToRange(endDate, range, false)).toBe(endDate);
    });
  });
});
