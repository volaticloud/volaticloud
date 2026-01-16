/**
 * Indicator Metadata for UI Builder
 *
 * Defines all available indicators with their parameters and outputs
 * for the indicator selector and configuration UI.
 */

import { IndicatorMeta, IndicatorType } from './types';

export const INDICATOR_CATEGORIES = {
  trend: { label: 'Trend', description: 'Identify market direction' },
  momentum: { label: 'Momentum', description: 'Measure speed of price changes' },
  volatility: { label: 'Volatility', description: 'Measure price variability' },
  volume: { label: 'Volume', description: 'Analyze trading volume' },
  custom: { label: 'Custom', description: 'User-defined indicators' },
} as const;

export const INDICATORS: Record<IndicatorType, IndicatorMeta> = {
  // ============================================================================
  // Trend Indicators
  // ============================================================================
  SMA: {
    type: 'SMA',
    name: 'Simple Moving Average',
    description: 'Average price over a specified number of periods',
    category: 'trend',
    params: [
      { name: 'period', type: 'number', label: 'Period', default: 20, min: 1, max: 500 },
      {
        name: 'source',
        type: 'select',
        label: 'Source',
        default: 'close',
        options: [
          { value: 'open', label: 'Open' },
          { value: 'high', label: 'High' },
          { value: 'low', label: 'Low' },
          { value: 'close', label: 'Close' },
        ],
      },
    ],
    outputs: [{ name: 'Value', description: 'SMA value' }],
  },

  EMA: {
    type: 'EMA',
    name: 'Exponential Moving Average',
    description: 'Weighted average giving more weight to recent prices',
    category: 'trend',
    params: [
      { name: 'period', type: 'number', label: 'Period', default: 20, min: 1, max: 500 },
      {
        name: 'source',
        type: 'select',
        label: 'Source',
        default: 'close',
        options: [
          { value: 'open', label: 'Open' },
          { value: 'high', label: 'High' },
          { value: 'low', label: 'Low' },
          { value: 'close', label: 'Close' },
        ],
      },
    ],
    outputs: [{ name: 'Value', description: 'EMA value' }],
  },

  WMA: {
    type: 'WMA',
    name: 'Weighted Moving Average',
    description: 'Moving average with linearly weighted periods',
    category: 'trend',
    params: [
      { name: 'period', type: 'number', label: 'Period', default: 20, min: 1, max: 500 },
      {
        name: 'source',
        type: 'select',
        label: 'Source',
        default: 'close',
        options: [
          { value: 'open', label: 'Open' },
          { value: 'high', label: 'High' },
          { value: 'low', label: 'Low' },
          { value: 'close', label: 'Close' },
        ],
      },
    ],
    outputs: [{ name: 'Value', description: 'WMA value' }],
  },

  DEMA: {
    type: 'DEMA',
    name: 'Double Exponential Moving Average',
    description: 'Faster EMA with reduced lag',
    category: 'trend',
    params: [
      { name: 'period', type: 'number', label: 'Period', default: 20, min: 1, max: 500 },
      {
        name: 'source',
        type: 'select',
        label: 'Source',
        default: 'close',
        options: [
          { value: 'open', label: 'Open' },
          { value: 'high', label: 'High' },
          { value: 'low', label: 'Low' },
          { value: 'close', label: 'Close' },
        ],
      },
    ],
    outputs: [{ name: 'Value', description: 'DEMA value' }],
  },

  TEMA: {
    type: 'TEMA',
    name: 'Triple Exponential Moving Average',
    description: 'Even faster EMA with further reduced lag',
    category: 'trend',
    params: [
      { name: 'period', type: 'number', label: 'Period', default: 20, min: 1, max: 500 },
      {
        name: 'source',
        type: 'select',
        label: 'Source',
        default: 'close',
        options: [
          { value: 'open', label: 'Open' },
          { value: 'high', label: 'High' },
          { value: 'low', label: 'Low' },
          { value: 'close', label: 'Close' },
        ],
      },
    ],
    outputs: [{ name: 'Value', description: 'TEMA value' }],
  },

  KAMA: {
    type: 'KAMA',
    name: 'Kaufman Adaptive Moving Average',
    description: 'Moving average that adapts to market noise',
    category: 'trend',
    params: [
      { name: 'period', type: 'number', label: 'Period', default: 10, min: 1, max: 500 },
    ],
    outputs: [{ name: 'Value', description: 'KAMA value' }],
  },

  MACD: {
    type: 'MACD',
    name: 'Moving Average Convergence Divergence',
    description: 'Shows relationship between two EMAs',
    category: 'trend',
    params: [
      { name: 'fast', type: 'number', label: 'Fast Period', default: 12, min: 1, max: 100 },
      { name: 'slow', type: 'number', label: 'Slow Period', default: 26, min: 1, max: 200 },
      { name: 'signal', type: 'number', label: 'Signal Period', default: 9, min: 1, max: 50 },
    ],
    outputs: [
      { name: 'MACD', description: 'MACD line' },
      { name: 'Signal', field: 'signal', description: 'Signal line' },
      { name: 'Histogram', field: 'histogram', description: 'MACD histogram' },
    ],
  },

  ADX: {
    type: 'ADX',
    name: 'Average Directional Index',
    description: 'Measures trend strength regardless of direction',
    category: 'trend',
    params: [
      { name: 'period', type: 'number', label: 'Period', default: 14, min: 1, max: 100 },
    ],
    outputs: [
      { name: 'ADX', description: 'ADX value (0-100)' },
      { name: '+DI', field: 'plus_di', description: 'Positive directional indicator' },
      { name: '-DI', field: 'minus_di', description: 'Negative directional indicator' },
    ],
  },

  ICHIMOKU: {
    type: 'ICHIMOKU',
    name: 'Ichimoku Cloud',
    description: 'Comprehensive indicator showing support/resistance and momentum',
    category: 'trend',
    params: [
      { name: 'conv', type: 'number', label: 'Conversion Period', default: 9, min: 1, max: 100 },
      { name: 'base', type: 'number', label: 'Base Period', default: 26, min: 1, max: 200 },
      { name: 'span', type: 'number', label: 'Span Period', default: 52, min: 1, max: 500 },
    ],
    outputs: [
      { name: 'Tenkan', field: 'tenkan', description: 'Conversion line' },
      { name: 'Kijun', field: 'kijun', description: 'Base line' },
      { name: 'Senkou A', field: 'senkou_a', description: 'Leading span A' },
      { name: 'Senkou B', field: 'senkou_b', description: 'Leading span B' },
    ],
  },

  SAR: {
    type: 'SAR',
    name: 'Parabolic SAR',
    description: 'Trailing stop and reversal indicator',
    category: 'trend',
    params: [
      { name: 'acceleration', type: 'number', label: 'Acceleration', default: 0.02, min: 0.001, max: 0.5 },
      { name: 'maximum', type: 'number', label: 'Maximum', default: 0.2, min: 0.01, max: 1.0 },
    ],
    outputs: [{ name: 'SAR', description: 'SAR value' }],
  },

  SUPERTREND: {
    type: 'SUPERTREND',
    name: 'Supertrend',
    description: 'Trend-following indicator based on ATR',
    category: 'trend',
    params: [
      { name: 'period', type: 'number', label: 'ATR Period', default: 10, min: 1, max: 100 },
      { name: 'multiplier', type: 'number', label: 'Multiplier', default: 3.0, min: 0.1, max: 10 },
    ],
    outputs: [
      { name: 'Upper', field: 'upper', description: 'Upper band' },
      { name: 'Lower', field: 'lower', description: 'Lower band' },
    ],
  },

  // ============================================================================
  // Momentum Indicators
  // ============================================================================
  RSI: {
    type: 'RSI',
    name: 'Relative Strength Index',
    description: 'Measures overbought/oversold conditions (0-100)',
    category: 'momentum',
    params: [
      { name: 'period', type: 'number', label: 'Period', default: 14, min: 2, max: 100 },
    ],
    outputs: [{ name: 'RSI', description: 'RSI value (0-100)' }],
  },

  STOCH: {
    type: 'STOCH',
    name: 'Stochastic Oscillator',
    description: 'Compares closing price to price range',
    category: 'momentum',
    params: [
      { name: 'k', type: 'number', label: '%K Period', default: 14, min: 1, max: 100 },
      { name: 'd', type: 'number', label: '%D Period', default: 3, min: 1, max: 50 },
      { name: 'smooth', type: 'number', label: 'Smoothing', default: 3, min: 1, max: 50 },
    ],
    outputs: [
      { name: '%K', field: 'k', description: 'Fast stochastic' },
      { name: '%D', field: 'd', description: 'Slow stochastic (signal)' },
    ],
  },

  STOCH_RSI: {
    type: 'STOCH_RSI',
    name: 'Stochastic RSI',
    description: 'RSI applied to stochastic formula',
    category: 'momentum',
    params: [
      { name: 'period', type: 'number', label: 'RSI Period', default: 14, min: 2, max: 100 },
      { name: 'k', type: 'number', label: '%K Period', default: 3, min: 1, max: 50 },
      { name: 'd', type: 'number', label: '%D Period', default: 3, min: 1, max: 50 },
    ],
    outputs: [
      { name: '%K', field: 'k', description: 'Stochastic RSI %K' },
      { name: '%D', field: 'd', description: 'Stochastic RSI %D' },
    ],
  },

  CCI: {
    type: 'CCI',
    name: 'Commodity Channel Index',
    description: 'Measures price deviation from statistical mean',
    category: 'momentum',
    params: [
      { name: 'period', type: 'number', label: 'Period', default: 20, min: 1, max: 200 },
    ],
    outputs: [{ name: 'CCI', description: 'CCI value' }],
  },

  WILLR: {
    type: 'WILLR',
    name: 'Williams %R',
    description: 'Overbought/oversold indicator (-100 to 0)',
    category: 'momentum',
    params: [
      { name: 'period', type: 'number', label: 'Period', default: 14, min: 1, max: 100 },
    ],
    outputs: [{ name: 'Williams %R', description: 'Value (-100 to 0)' }],
  },

  MOM: {
    type: 'MOM',
    name: 'Momentum',
    description: 'Rate of change in price',
    category: 'momentum',
    params: [
      { name: 'period', type: 'number', label: 'Period', default: 10, min: 1, max: 100 },
    ],
    outputs: [{ name: 'Momentum', description: 'Momentum value' }],
  },

  ROC: {
    type: 'ROC',
    name: 'Rate of Change',
    description: 'Percentage change over N periods',
    category: 'momentum',
    params: [
      { name: 'period', type: 'number', label: 'Period', default: 10, min: 1, max: 100 },
    ],
    outputs: [{ name: 'ROC', description: 'Rate of change (%)' }],
  },

  // ============================================================================
  // Volatility Indicators
  // ============================================================================
  ATR: {
    type: 'ATR',
    name: 'Average True Range',
    description: 'Measures market volatility',
    category: 'volatility',
    params: [
      { name: 'period', type: 'number', label: 'Period', default: 14, min: 1, max: 100 },
    ],
    outputs: [{ name: 'ATR', description: 'ATR value' }],
  },

  BB: {
    type: 'BB',
    name: 'Bollinger Bands',
    description: 'Volatility bands around a moving average',
    category: 'volatility',
    params: [
      { name: 'period', type: 'number', label: 'Period', default: 20, min: 1, max: 200 },
      { name: 'std_dev', type: 'number', label: 'Std Dev', default: 2.0, min: 0.1, max: 5.0 },
    ],
    outputs: [
      { name: 'Upper', field: 'upper', description: 'Upper band' },
      { name: 'Middle', field: 'middle', description: 'Middle band (SMA)' },
      { name: 'Lower', field: 'lower', description: 'Lower band' },
      { name: 'Width', field: 'width', description: 'Band width' },
    ],
  },

  KC: {
    type: 'KC',
    name: 'Keltner Channels',
    description: 'Volatility channels based on ATR',
    category: 'volatility',
    params: [
      { name: 'period', type: 'number', label: 'EMA Period', default: 20, min: 1, max: 200 },
      { name: 'multiplier', type: 'number', label: 'ATR Multiplier', default: 2.0, min: 0.1, max: 5.0 },
      { name: 'atr_period', type: 'number', label: 'ATR Period', default: 10, min: 1, max: 100 },
    ],
    outputs: [
      { name: 'Upper', field: 'upper', description: 'Upper channel' },
      { name: 'Middle', field: 'middle', description: 'Middle channel (EMA)' },
      { name: 'Lower', field: 'lower', description: 'Lower channel' },
    ],
  },

  // ============================================================================
  // Volume Indicators
  // ============================================================================
  OBV: {
    type: 'OBV',
    name: 'On Balance Volume',
    description: 'Cumulative volume based on price direction',
    category: 'volume',
    params: [],
    outputs: [{ name: 'OBV', description: 'OBV value' }],
  },

  MFI: {
    type: 'MFI',
    name: 'Money Flow Index',
    description: 'Volume-weighted RSI',
    category: 'volume',
    params: [
      { name: 'period', type: 'number', label: 'Period', default: 14, min: 1, max: 100 },
    ],
    outputs: [{ name: 'MFI', description: 'MFI value (0-100)' }],
  },

  VWAP: {
    type: 'VWAP',
    name: 'Volume Weighted Average Price',
    description: 'Average price weighted by volume',
    category: 'volume',
    params: [],
    outputs: [{ name: 'VWAP', description: 'VWAP value' }],
  },

  CMF: {
    type: 'CMF',
    name: 'Chaikin Money Flow',
    description: 'Measures buying/selling pressure',
    category: 'volume',
    params: [
      { name: 'period', type: 'number', label: 'Period', default: 20, min: 1, max: 100 },
    ],
    outputs: [{ name: 'CMF', description: 'CMF value (-1 to 1)' }],
  },

  AD: {
    type: 'AD',
    name: 'Accumulation/Distribution',
    description: 'Cumulative indicator measuring money flow',
    category: 'volume',
    params: [],
    outputs: [{ name: 'A/D', description: 'A/D line value' }],
  },

  // ============================================================================
  // Placeholder indicators
  // ============================================================================
  PIVOT: {
    type: 'PIVOT',
    name: 'Pivot Points',
    description: 'Support and resistance levels',
    category: 'trend',
    params: [],
    outputs: [
      { name: 'Pivot', description: 'Pivot point' },
      { name: 'R1', field: 'r1', description: 'Resistance 1' },
      { name: 'S1', field: 's1', description: 'Support 1' },
    ],
  },

  CUSTOM: {
    type: 'CUSTOM',
    name: 'Custom Indicator',
    description: 'User-defined custom indicator',
    category: 'custom',
    params: [
      { name: 'code', type: 'string', label: 'Python Code', default: '' },
    ],
    outputs: [{ name: 'Value', description: 'Custom output' }],
  },
};

// Get indicators by category
export function getIndicatorsByCategory(category: keyof typeof INDICATOR_CATEGORIES): IndicatorMeta[] {
  return Object.values(INDICATORS).filter((ind) => ind.category === category);
}

// Get all indicators as array
export function getAllIndicators(): IndicatorMeta[] {
  return Object.values(INDICATORS);
}

// Get indicator by type
export function getIndicatorMeta(type: IndicatorType): IndicatorMeta | undefined {
  return INDICATORS[type];
}

// Get default params for an indicator
export function getDefaultParams(type: IndicatorType): Record<string, unknown> {
  const meta = INDICATORS[type];
  if (!meta) return {};

  return meta.params.reduce(
    (acc, param) => {
      acc[param.name] = param.default;
      return acc;
    },
    {} as Record<string, unknown>
  );
}
