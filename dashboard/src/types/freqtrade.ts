/**
 * TypeScript interfaces for Freqtrade backtest result structure
 *
 * These interfaces provide type safety when working with backtest results from GraphQL.
 * The actual data comes as JSON (Map scalar) from the `result` field in Backtest type.
 *
 * Usage:
 *   const result = backtest.result as FreqtradeBacktestResult;
 *   const strategyName = Object.keys(result.strategy)[0];
 *   const strategyData = result.strategy[strategyName];
 *   const trades = strategyData.trades || [];
 */

/**
 * Root structure of Freqtrade backtest result
 */
export interface FreqtradeBacktestResult {
  /** Strategy results keyed by strategy name (dynamic key) */
  strategy: Record<string, StrategyResult>;
  /** Strategy comparison summary */
  strategy_comparison?: StrategyComparison[];
}

/**
 * Complete strategy result with metrics and trades
 */
export interface StrategyResult {
  // Core metrics
  strategy_name: string;
  total_trades: number;
  wins: number;
  losses: number;
  draws: number;

  // Profit metrics
  profit_total: number;
  profit_total_abs: number;
  profit_total_long: number;
  profit_total_long_abs: number;
  profit_total_short: number;
  profit_total_short_abs: number;
  profit_mean: number;
  profit_median: number;
  profit_factor: number;

  // Performance metrics
  winrate: number;
  expectancy: number;
  expectancy_ratio: number;
  sharpe: number;
  sortino: number;
  calmar: number;

  // Drawdown metrics
  max_drawdown: number;
  max_drawdown_abs: number;
  max_drawdown_account: number;
  max_drawdown_high: number;
  max_drawdown_low: number;
  max_relative_drawdown: number;
  drawdown_start: string;
  drawdown_start_ts: number;
  drawdown_end: string;
  drawdown_end_ts: number;

  // Trade statistics
  avg_stake_amount: number;
  max_open_trades: number;
  max_open_trades_setting: number;
  max_consecutive_wins: number;
  max_consecutive_losses: number;

  // Time statistics
  holding_avg: string;
  winner_holding_avg: string;
  loser_holding_avg: string;

  // Backtest period
  backtest_start: string;
  backtest_start_ts: number;
  backtest_end: string;
  backtest_end_ts: number;
  backtest_days: number;
  backtest_run_start_ts: number;
  backtest_run_end_ts: number;

  // Market comparison
  market_change: number;

  // Strategy configuration
  stake_currency: string;
  stake_amount: number;
  timeframe: string;
  timeframe_detail: string;
  timerange: string;
  trading_mode: string;
  dry_run_wallet: number;
  pairlist: string[];

  // Strategy settings
  minimal_roi: Record<string, number>;
  stoploss: number;
  trailing_stop: boolean;
  trailing_stop_positive: number | null;
  trailing_stop_positive_offset: number;
  trailing_only_offset_is_reached: boolean;
  use_custom_stoploss: boolean;
  use_exit_signal: boolean;
  exit_profit_only: boolean;
  exit_profit_offset: number;
  enable_protections: boolean;

  // Breakdown data
  results_per_pair: PairResult[];
  results_per_enter_tag: TagResult[];
  exit_reason_summary: ExitReasonResult[];
  mix_tag_stats: TagResult[];
  left_open_trades: TagResult[];

  // Periodic breakdown
  periodic_breakdown: {
    day: DailyStats[];
    week: DailyStats[];
    month: DailyStats[];
    year: DailyStats[];
  };

  // Best/worst pairs
  best_pair: PairResult;
  worst_pair: PairResult;

  // Daily profit tracking
  daily_profit_list: Array<[string, number]>;

  // Day tracking
  winning_days: number;
  draw_days: number;
  losing_days: number;

  // Trade tracking
  trades_per_day: number;
  trade_count_long: number;
  trade_count_short: number;
  total_volume: number;

  // Order tracking
  canceled_trade_entries: number;
  canceled_entry_orders: number;
  replaced_entry_orders: number;
  timedout_entry_orders: number;
  timedout_exit_orders: number;
  rejected_signals: number;

  // Cumulative profit tracking
  csum_min: number;
  csum_max: number;

  // Trades list
  trades: Trade[];

  // Advanced features
  locks: any[];
  freqai_identifier: string | null;
  freqaimodel: string | null;

  // Best/worst days
  backtest_best_day: number;
  backtest_best_day_abs: number;
  backtest_worst_day: number;
  backtest_worst_day_abs: number;

  // Additional metrics
  final_balance: number;
  starting_balance: number;
  stake_currency_decimals: number;
}

/**
 * Individual trade result
 */
export interface Trade {
  pair: string;
  profit_ratio: number;
  profit_abs: number;
  profit_total: number;
  open_date: string;
  close_date?: string;
  open_rate: number;
  close_rate?: number;
  amount: number;
  trade_duration?: number;
  open_timestamp: number;
  close_timestamp?: number;
  sell_reason?: string;
  exit_reason?: string;
  stake_amount: number;
  fee_open: number;
  fee_close?: number;
  is_open: boolean;
  is_short?: boolean;
  enter_tag?: string;
  leverage?: number;
  interest_rate?: number;
  funding_fees?: number;
  trading_mode?: string;
  orders?: any[];
}

/**
 * Pair-level statistics
 */
export interface PairResult {
  key: string;
  trades: number;
  profit_mean: number;
  profit_mean_pct: number;
  profit_total: number;
  profit_total_abs: number;
  profit_total_pct: number;
  duration_avg: string;
  wins: number;
  draws: number;
  losses: number;
  winrate: number;
  expectancy: number;
  expectancy_ratio: number;
  profit_factor: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  max_drawdown_abs: number;
  max_drawdown_account: number;
  sqn: number;
}

/**
 * Tag-level statistics (enter/exit tags)
 */
export interface TagResult {
  key: string;
  trades: number;
  profit_mean: number;
  profit_mean_pct: number;
  profit_total: number;
  profit_total_abs: number;
  profit_total_pct: number;
  duration_avg: string;
  wins: number;
  draws: number;
  losses: number;
  winrate: number;
  expectancy: number;
  expectancy_ratio: number;
  profit_factor: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  max_drawdown_abs: number;
  max_drawdown_account: number;
  sqn: number;
}

/**
 * Exit reason statistics
 */
export interface ExitReasonResult extends TagResult {}

/**
 * Daily/periodic statistics
 */
export interface DailyStats {
  date: string;
  profit_abs: number;
  profit: number;
  trades: number;
  wins: number;
  draws: number;
  losses: number;
}

/**
 * Strategy comparison entry
 */
export interface StrategyComparison {
  key: string;
  trades: number;
  profit_mean: number;
  profit_mean_pct: number;
  profit_total: number;
  profit_total_abs: number;
  profit_total_pct: number;
  duration_avg: string;
  wins: number;
  draws: number;
  losses: number;
  winrate: number;
  expectancy: number;
  expectancy_ratio: number;
  profit_factor: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  max_drawdown_abs: string;  // Note: Can be string in comparison
  max_drawdown_account: number;
  sqn: number;
}

/**
 * Type guard to check if a result is a valid Freqtrade result
 */
export function isFreqtradeResult(result: any): result is FreqtradeBacktestResult {
  return result && typeof result === 'object' && 'strategy' in result;
}

/**
 * Helper to safely extract strategy data from result
 */
export function extractStrategyData(result: any): StrategyResult | null {
  if (!isFreqtradeResult(result)) {
    return null;
  }

  const strategyNames = Object.keys(result.strategy);
  if (strategyNames.length === 0) {
    return null;
  }

  return result.strategy[strategyNames[0]] || null;
}

/**
 * Helper to safely extract trades from result
 */
export function extractTrades(result: any): Trade[] {
  const strategyData = extractStrategyData(result);
  return strategyData?.trades || [];
}
