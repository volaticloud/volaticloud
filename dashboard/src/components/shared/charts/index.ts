/**
 * Chart components and utilities for backtest visualization
 *
 * Uses lightweight-charts (TradingView) for financial charting
 */

// Types
export type {
  EquityPoint,
  DrawdownPoint,
  OHLCVCandle,
  TradeMarker,
  PeriodBreakdown,
  ChartTheme,
} from './types';

// Theme
export { darkTheme, lightTheme, getChartTheme, drawdownColors, profitColors } from './theme';

// Data transformers
export {
  transformToEquityCurve,
  transformDailyProfitToEquityCurve,
  transformToDrawdown,
  transformMonthlyBreakdown,
  createTradeMarkers,
  calculateEquityStats,
} from './utils/dataTransformers';

// Formatters
export {
  formatCurrency,
  formatPercent,
  formatCompactNumber,
  formatDate,
  formatAxisDate,
  formatTime,
  formatPrice,
  formatVolume,
  formatDuration,
  createPriceFormatter,
  createPercentFormatter,
} from './utils/formatters';

// Chart components
export { EquityCurveChart } from './EquityCurveChart';
export { DrawdownChart } from './DrawdownChart';
export { MonthlyBreakdownChart } from './MonthlyBreakdownChart';
export { CandlestickChart } from './CandlestickChart';