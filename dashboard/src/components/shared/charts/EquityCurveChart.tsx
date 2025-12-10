/**
 * Equity Curve Chart Component
 *
 * Displays cumulative portfolio value over time using lightweight-charts.
 * Supports trade markers to show entry/exit points.
 */
import { useEffect, useRef, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  AreaSeries,
  SeriesMarker,
  AreaData,
  createSeriesMarkers,
} from 'lightweight-charts';
import type { ISeriesMarkersPluginApi } from 'lightweight-charts';
import { Box, Typography, useTheme, Skeleton } from '@mui/material';
import type { EquityPoint } from './types';
import { getChartTheme, profitColors } from './theme';
import { formatCurrency, formatPercent } from './utils/formatters';
import type { Trade } from '../../../types/freqtrade';

export interface EquityCurveChartProps {
  /** Equity curve data points */
  data: EquityPoint[];
  /** Starting balance for return calculation */
  startingBalance: number;
  /** Optional trades for markers */
  trades?: Trade[];
  /** Chart height in pixels */
  height?: number;
  /** Currency symbol for formatting */
  currency?: string;
  /** Show trade markers on chart */
  showTradeMarkers?: boolean;
  /** Loading state */
  loading?: boolean;
}

/**
 * Equity Curve Chart - shows portfolio value over time
 */
export function EquityCurveChart({
  data,
  startingBalance,
  trades,
  height = 300,
  currency = 'USD',
  showTradeMarkers = true,
  loading = false,
}: EquityCurveChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const theme = useTheme();

  // Calculate returns for header
  const totalReturn = data.length > 1 ? data[data.length - 1].value - startingBalance : 0;
  const totalReturnPercent = startingBalance > 0 ? (totalReturn / startingBalance) * 100 : 0;
  const isPositive = totalReturn >= 0;

  // Create chart on mount
  useEffect(() => {
    if (!chartContainerRef.current || loading) return;

    const chartTheme = getChartTheme(theme.palette.mode);

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: chartTheme.textColor,
      },
      grid: {
        vertLines: { color: chartTheme.gridColor },
        horzLines: { color: chartTheme.gridColor },
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
      rightPriceScale: {
        borderColor: chartTheme.gridColor,
      },
      timeScale: {
        borderColor: chartTheme.gridColor,
        timeVisible: true,
      },
      crosshair: {
        vertLine: {
          color: chartTheme.crosshairColor,
          width: 1,
          style: 2,
        },
        horzLine: {
          color: chartTheme.crosshairColor,
          width: 1,
          style: 2,
        },
      },
    });

    // Add area series for equity curve (v5 API)
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: isPositive ? profitColors.positive : profitColors.negative,
      topColor: isPositive
        ? 'rgba(38, 166, 154, 0.4)'
        : 'rgba(239, 83, 80, 0.4)',
      bottomColor: isPositive
        ? 'rgba(38, 166, 154, 0.0)'
        : 'rgba(239, 83, 80, 0.0)',
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => formatCurrency(price, currency),
      },
    });

    chartRef.current = chart;
    seriesRef.current = areaSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersPluginRef.current = null;
    };
  }, [height, theme.palette.mode, loading, isPositive, currency]);

  // Update data when it changes
  useEffect(() => {
    if (!seriesRef.current || !data.length) return;

    // Convert to lightweight-charts format
    const chartData: AreaData<Time>[] = data.map((point) => ({
      time: point.time as Time,
      value: point.value,
    }));

    seriesRef.current.setData(chartData);

    // Add trade markers if enabled
    if (showTradeMarkers && trades && trades.length > 0) {
      const markers: SeriesMarker<Time>[] = [];

      for (const trade of trades) {
        if (!trade.close_date) continue;

        const isProfit = trade.profit_abs > 0;
        // Handle both ISO format (T separator) and space-separated format
        const closeDate = trade.close_date.split(/[T ]/)[0] as Time;

        markers.push({
          time: closeDate,
          position: isProfit ? 'aboveBar' : 'belowBar',
          color: isProfit ? profitColors.positive : profitColors.negative,
          shape: 'circle',
          size: 0.5,
        });
      }

      // Sort markers by time
      markers.sort((a, b) => {
        if (a.time < b.time) return -1;
        if (a.time > b.time) return 1;
        return 0;
      });

      // v5 API: Use createSeriesMarkers plugin
      if (markersPluginRef.current) {
        markersPluginRef.current.setMarkers(markers);
      } else {
        markersPluginRef.current = createSeriesMarkers(seriesRef.current, markers);
      }
    }

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data, trades, showTradeMarkers]);

  // Update theme colors when theme changes
  const updateSeriesColors = useCallback(() => {
    if (!seriesRef.current) return;

    seriesRef.current.applyOptions({
      lineColor: isPositive ? profitColors.positive : profitColors.negative,
      topColor: isPositive
        ? 'rgba(38, 166, 154, 0.4)'
        : 'rgba(239, 83, 80, 0.4)',
      bottomColor: isPositive
        ? 'rgba(38, 166, 154, 0.0)'
        : 'rgba(239, 83, 80, 0.0)',
    });
  }, [isPositive]);

  useEffect(() => {
    updateSeriesColors();
  }, [updateSeriesColors]);

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
        <Typography color="text.secondary">No equity data available</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with returns */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mb: 1 }}>
        <Typography variant="h6">Equity Curve</Typography>
        <Typography
          variant="body1"
          sx={{ color: isPositive ? 'success.main' : 'error.main', fontWeight: 500 }}
        >
          {formatCurrency(totalReturn, currency)} ({formatPercent(totalReturnPercent)})
        </Typography>
      </Box>

      {/* Chart container */}
      <Box
        ref={chartContainerRef}
        sx={{
          width: '100%',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      />
    </Box>
  );
}

export default EquityCurveChart;