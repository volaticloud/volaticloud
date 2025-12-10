/**
 * Chart data types for backtest visualization
 * Used with lightweight-charts library
 */

/**
 * Single point on the equity curve
 */
export interface EquityPoint {
  time: string; // YYYY-MM-DD format for lightweight-charts
  value: number; // Cumulative equity value
}

/**
 * Single point on the drawdown chart
 */
export interface DrawdownPoint {
  time: string; // YYYY-MM-DD format
  value: number; // Drawdown percentage (negative value)
}

/**
 * OHLCV candle data
 */
export interface OHLCVCandle {
  time: string; // YYYY-MM-DD or timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Trade marker for overlaying on charts
 */
export interface TradeMarker {
  time: string;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown' | 'circle';
  text?: string;
  size?: number;
}

/**
 * Monthly/periodic breakdown data
 */
export interface PeriodBreakdown {
  period: string; // Month name or date
  profit: number;
  profitPercent: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
}

/**
 * Chart theme configuration
 */
export interface ChartTheme {
  backgroundColor: string;
  textColor: string;
  gridColor: string;
  upColor: string;
  downColor: string;
  borderUpColor: string;
  borderDownColor: string;
  wickUpColor: string;
  wickDownColor: string;
  volumeUpColor: string;
  volumeDownColor: string;
  crosshairColor: string;
  lineColor: string;
  areaTopColor: string;
  areaBottomColor: string;
}