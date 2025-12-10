/**
 * Data transformation utilities for converting Freqtrade backtest data to chart formats
 */
import type { Trade, DailyStats } from '../../../../types/freqtrade';
import type { EquityPoint, DrawdownPoint, PeriodBreakdown, TradeMarker } from '../types';
import { profitColors } from '../theme';

/**
 * Parse date string handling various formats
 * Handles both ISO format (T separator) and space-separated format from Freqtrade
 */
function parseDate(dateStr: string): Date {
  // Replace space with T for ISO format compatibility
  // "2025-11-20 02:09:00+00:00" -> "2025-11-20T02:09:00+00:00"
  const normalized = dateStr.replace(' ', 'T');
  return new Date(normalized);
}

/**
 * Format date for lightweight-charts (YYYY-MM-DD)
 * Handles Date objects and ensures consistent output format
 */
function formatDateForChart(date: Date): string {
  // Check if date is valid
  if (isNaN(date.getTime())) {
    console.warn('Invalid date:', date);
    return '';
  }
  // Use UTC to avoid timezone issues
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert trades to equity curve data points
 * Calculates cumulative profit over time
 */
export function transformToEquityCurve(
  trades: Trade[],
  startingBalance: number
): EquityPoint[] {
  if (!trades || trades.length === 0) {
    return [];
  }

  // Sort trades by close date
  const sortedTrades = [...trades]
    .filter((t) => t.close_date)
    .sort((a, b) => parseDate(a.close_date!).getTime() - parseDate(b.close_date!).getTime());

  let cumulativeProfit = 0;
  const points: EquityPoint[] = [];

  // Add starting point
  if (sortedTrades.length > 0) {
    const firstTradeDate = parseDate(sortedTrades[0].close_date!);
    firstTradeDate.setDate(firstTradeDate.getDate() - 1);
    points.push({
      time: formatDateForChart(firstTradeDate),
      value: startingBalance,
    });
  }

  // Build equity curve from trades
  for (const trade of sortedTrades) {
    cumulativeProfit += trade.profit_abs;
    points.push({
      time: formatDateForChart(parseDate(trade.close_date!)),
      value: startingBalance + cumulativeProfit,
    });
  }

  // Deduplicate points with same date (keep last value for each day)
  return deduplicateByDate(points);
}

/**
 * Convert daily profit list to equity curve
 * Alternative method using daily_profit_list from freqtrade
 */
export function transformDailyProfitToEquityCurve(
  dailyProfitList: Array<[string, number]>,
  startingBalance: number
): EquityPoint[] {
  if (!dailyProfitList || dailyProfitList.length === 0) {
    return [];
  }

  let cumulativeProfit = 0;
  const points: EquityPoint[] = [];

  for (const [dateStr, profit] of dailyProfitList) {
    cumulativeProfit += profit;
    points.push({
      time: formatDateForChart(new Date(dateStr)),
      value: startingBalance + cumulativeProfit,
    });
  }

  return points;
}

/**
 * Calculate drawdown from equity curve
 * Returns percentage drawdown from peak at each point
 */
export function transformToDrawdown(equityCurve: EquityPoint[]): DrawdownPoint[] {
  if (!equityCurve || equityCurve.length === 0) {
    return [];
  }

  let peak = equityCurve[0].value;
  const drawdownPoints: DrawdownPoint[] = [];

  for (const point of equityCurve) {
    if (point.value > peak) {
      peak = point.value;
    }

    const drawdownPercent = peak > 0 ? ((point.value - peak) / peak) * 100 : 0;

    drawdownPoints.push({
      time: point.time,
      value: drawdownPercent, // Negative percentage
    });
  }

  return drawdownPoints;
}

/**
 * Transform monthly breakdown data for bar chart
 */
export function transformMonthlyBreakdown(
  monthlyStats: DailyStats[]
): PeriodBreakdown[] {
  if (!monthlyStats || monthlyStats.length === 0) {
    return [];
  }

  return monthlyStats.map((stat) => ({
    period: formatMonthLabel(stat.date),
    profit: stat.profit_abs,
    profitPercent: stat.profit * 100,
    trades: stat.trades,
    wins: stat.wins,
    losses: stat.losses,
    winRate: stat.trades > 0 ? (stat.wins / stat.trades) * 100 : 0,
  }));
}

/**
 * Create trade markers for candlestick chart overlay
 */
export function createTradeMarkers(trades: Trade[]): TradeMarker[] {
  if (!trades || trades.length === 0) {
    return [];
  }

  const markers: TradeMarker[] = [];

  for (const trade of trades) {
    // Entry marker
    markers.push({
      time: formatDateForChart(parseDate(trade.open_date)),
      position: trade.is_short ? 'aboveBar' : 'belowBar',
      color: trade.is_short ? profitColors.negative : profitColors.positive,
      shape: trade.is_short ? 'arrowDown' : 'arrowUp',
      text: `${trade.pair} Entry`,
    });

    // Exit marker (if trade is closed)
    if (trade.close_date) {
      const isProfit = trade.profit_abs > 0;
      markers.push({
        time: formatDateForChart(parseDate(trade.close_date)),
        position: trade.is_short ? 'belowBar' : 'aboveBar',
        color: isProfit ? profitColors.positive : profitColors.negative,
        shape: 'circle',
        text: `${(trade.profit_ratio * 100).toFixed(2)}%`,
      });
    }
  }

  return markers;
}

/**
 * Format month label from date string
 */
function formatMonthLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Deduplicate points with same date, keeping the last value
 */
function deduplicateByDate(points: EquityPoint[]): EquityPoint[] {
  const dateMap = new Map<string, EquityPoint>();

  for (const point of points) {
    dateMap.set(point.time, point);
  }

  return Array.from(dateMap.values()).sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );
}

/**
 * Calculate summary statistics from equity curve
 */
export function calculateEquityStats(equityCurve: EquityPoint[]): {
  totalReturn: number;
  totalReturnPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
} {
  if (!equityCurve || equityCurve.length < 2) {
    return {
      totalReturn: 0,
      totalReturnPercent: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
    };
  }

  const startValue = equityCurve[0].value;
  const endValue = equityCurve[equityCurve.length - 1].value;
  const totalReturn = endValue - startValue;
  const totalReturnPercent = startValue > 0 ? (totalReturn / startValue) * 100 : 0;

  // Calculate max drawdown
  let peak = startValue;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  for (const point of equityCurve) {
    if (point.value > peak) {
      peak = point.value;
    }
    const drawdown = peak - point.value;
    const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;

    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPercent = drawdownPercent;
    }
  }

  return {
    totalReturn,
    totalReturnPercent,
    maxDrawdown,
    maxDrawdownPercent,
  };
}