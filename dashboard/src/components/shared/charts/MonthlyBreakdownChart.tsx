/**
 * Monthly Breakdown Chart Component
 *
 * Displays profit/loss by month using recharts BarChart.
 * Shows trade count and win rate per period.
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { Box, Typography, useTheme, Skeleton } from '@mui/material';
import type { PeriodBreakdown } from './types';
import { profitColors } from './theme';
import { formatCurrency, formatPercent } from './utils/formatters';

export interface MonthlyBreakdownChartProps {
  /** Monthly breakdown data */
  data: PeriodBreakdown[];
  /** Chart height in pixels */
  height?: number;
  /** Currency symbol for formatting */
  currency?: string;
  /** Loading state */
  loading?: boolean;
}

interface TooltipPayload {
  payload: PeriodBreakdown;
}

/**
 * Custom tooltip for the bar chart
 */
function CustomTooltip({
  active,
  payload,
  currency = 'USD',
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  currency?: string;
}) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0].payload;
  const isPositive = data.profit >= 0;

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        p: 1.5,
        boxShadow: 2,
      }}
    >
      <Typography variant="subtitle2" fontWeight={600}>
        {data.period}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: isPositive ? 'success.main' : 'error.main' }}
      >
        Profit: {formatCurrency(data.profit, currency)} ({formatPercent(data.profitPercent)})
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Trades: {data.trades} (W: {data.wins} / L: {data.losses})
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Win Rate: {data.winRate.toFixed(1)}%
      </Typography>
    </Box>
  );
}

/**
 * Monthly Breakdown Chart - shows profit by month
 */
export function MonthlyBreakdownChart({
  data,
  height = 250,
  currency = 'USD',
  loading = false,
}: MonthlyBreakdownChartProps) {
  const theme = useTheme();

  // Calculate totals for header
  const totalProfit = data.reduce((sum, d) => sum + d.profit, 0);
  const profitableMonths = data.filter((d) => d.profit > 0).length;
  const isPositive = totalProfit >= 0;

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={200} height={32} />
        <Skeleton variant="rectangular" height={height} />
      </Box>
    );
  }

  if (!data.length) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.paper',
          borderRadius: 1,
        }}
      >
        <Typography color="text.secondary">No monthly data available</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mb: 1 }}>
        <Typography variant="h6">Monthly Performance</Typography>
        <Typography
          variant="body1"
          sx={{ color: isPositive ? 'success.main' : 'error.main', fontWeight: 500 }}
        >
          {formatCurrency(totalProfit, currency)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          ({profitableMonths}/{data.length} profitable months)
        </Typography>
      </Box>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme.palette.divider}
            vertical={false}
          />
          <XAxis
            dataKey="period"
            tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
            tickLine={{ stroke: theme.palette.divider }}
            axisLine={{ stroke: theme.palette.divider }}
          />
          <YAxis
            tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
            tickLine={{ stroke: theme.palette.divider }}
            axisLine={{ stroke: theme.palette.divider }}
            tickFormatter={(value) => formatCurrency(value, currency)}
          />
          <Tooltip
            content={<CustomTooltip currency={currency} />}
            cursor={{ fill: theme.palette.action.hover }}
          />
          <ReferenceLine y={0} stroke={theme.palette.divider} />
          <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.profit >= 0 ? profitColors.positive : profitColors.negative}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

export default MonthlyBreakdownChart;