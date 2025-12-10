/**
 * Backtest Charts Component
 *
 * Integrates all chart components into a tabbed interface for backtest visualization.
 */
import { useState, useMemo } from 'react';
import { Box, Tabs, Tab, Paper, Grid, Alert } from '@mui/material';
import {
  ShowChart as EquityIcon,
  BarChart as BarChartIcon,
  ViewList as TradesIcon,
  CandlestickChart as CandlestickIcon,
} from '@mui/icons-material';
import {
  EquityCurveChart,
  DrawdownChart,
  MonthlyBreakdownChart,
  CandlestickChart,
  transformToEquityCurve,
  transformToDrawdown,
  transformMonthlyBreakdown,
} from '../shared/charts';
import TradesTable from '../shared/TradesTable';
import type { StrategyResult, Trade } from '../../types/freqtrade';
import { isExchangeSupported, type Timeframe } from '../../services/exchangeData';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`backtest-tabpanel-${index}`}
      aria-labelledby={`backtest-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `backtest-tab-${index}`,
    'aria-controls': `backtest-tabpanel-${index}`,
  };
}

export interface BacktestChartsProps {
  /** Strategy result data from freqtrade */
  strategyData: StrategyResult;
  /** Trades list */
  trades: Trade[];
  /** Exchange identifier for OHLCV fetching */
  exchange?: string;
  /** Backtest timeframe */
  timeframe?: string;
  /** Backtest start date */
  backtestStart?: string;
  /** Backtest end date */
  backtestEnd?: string;
  /** Loading state */
  loading?: boolean;
}

/**
 * Backtest Charts - tabbed interface for all backtest visualizations
 */
export function BacktestCharts({
  strategyData,
  trades,
  exchange,
  timeframe,
  backtestStart,
  backtestEnd,
  loading = false,
}: BacktestChartsProps) {
  const [tabValue, setTabValue] = useState(0);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Transform data for charts
  const equityCurveData = useMemo(() => {
    return transformToEquityCurve(trades, strategyData.starting_balance || 1000);
  }, [trades, strategyData.starting_balance]);

  const drawdownData = useMemo(() => {
    return transformToDrawdown(equityCurveData);
  }, [equityCurveData]);

  const monthlyData = useMemo(() => {
    return transformMonthlyBreakdown(strategyData.periodic_breakdown?.month || []);
  }, [strategyData.periodic_breakdown?.month]);

  // Extract unique symbols from trades
  const availableSymbols = useMemo(() => {
    const symbols = new Set<string>();
    trades.forEach((trade) => {
      if (trade.pair) {
        symbols.add(trade.pair);
      }
    });
    return Array.from(symbols).sort();
  }, [trades]);

  // Set initial selected symbol
  useMemo(() => {
    if (availableSymbols.length > 0 && !selectedSymbol) {
      setSelectedSymbol(availableSymbols[0]);
    }
  }, [availableSymbols, selectedSymbol]);

  // Check if exchange is supported for candlestick chart
  const exchangeSupported = exchange ? isExchangeSupported(exchange) : false;
  const canShowPriceAction = exchangeSupported && timeframe && backtestStart && backtestEnd;

  const currency = strategyData.stake_currency || 'USDT';
  const startingBalance = strategyData.starting_balance || 1000;
  const maxDrawdown = strategyData.max_drawdown ? strategyData.max_drawdown * 100 : undefined;

  return (
    <Paper elevation={0} sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="Backtest analysis tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            icon={<EquityIcon />}
            iconPosition="start"
            label="Overview"
            {...a11yProps(0)}
          />
          <Tab
            icon={<BarChartIcon />}
            iconPosition="start"
            label="Performance"
            {...a11yProps(1)}
          />
          <Tab
            icon={<TradesIcon />}
            iconPosition="start"
            label={`Trades (${trades.length})`}
            {...a11yProps(2)}
          />
          {canShowPriceAction && (
            <Tab
              icon={<CandlestickIcon />}
              iconPosition="start"
              label="Price Action"
              {...a11yProps(3)}
            />
          )}
        </Tabs>
      </Box>

      {/* Overview Tab - Equity + Drawdown */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <EquityCurveChart
              data={equityCurveData}
              startingBalance={startingBalance}
              trades={trades}
              currency={currency}
              height={350}
              loading={loading}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <DrawdownChart
              data={drawdownData}
              maxDrawdown={maxDrawdown}
              height={200}
              loading={loading}
            />
          </Grid>
        </Grid>
      </TabPanel>

      {/* Performance Tab - Monthly Breakdown */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <MonthlyBreakdownChart
              data={monthlyData}
              currency={currency}
              height={300}
              loading={loading}
            />
          </Grid>
        </Grid>
      </TabPanel>

      {/* Trades Tab */}
      <TabPanel value={tabValue} index={2}>
        <TradesTable trades={trades} />
      </TabPanel>

      {/* Price Action Tab - Candlestick with trade markers */}
      {canShowPriceAction && (
        <TabPanel value={tabValue} index={3}>
          {selectedSymbol ? (
            <CandlestickChart
              exchange={exchange!}
              symbol={selectedSymbol}
              timeframe={timeframe as Timeframe}
              startTime={backtestStart!}
              endTime={backtestEnd!}
              trades={trades}
              height={500}
              showVolume={true}
              availableSymbols={availableSymbols}
              onSymbolChange={setSelectedSymbol}
            />
          ) : (
            <Alert severity="info">No trading pairs found in backtest results.</Alert>
          )}
        </TabPanel>
      )}
    </Paper>
  );
}

export default BacktestCharts;