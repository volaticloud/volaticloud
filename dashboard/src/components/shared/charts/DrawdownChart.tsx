/**
 * Drawdown Chart Component
 *
 * Displays peak-to-trough drawdown over time using lightweight-charts.
 * Highlights maximum drawdown period.
 */
import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, AreaData, Time, AreaSeries } from 'lightweight-charts';
import { Box, Typography, useTheme, Skeleton } from '@mui/material';
import type { DrawdownPoint } from './types';
import { getChartTheme, drawdownColors } from './theme';
import { formatPercent } from './utils/formatters';

export interface DrawdownChartProps {
  /** Drawdown data points (values should be negative percentages) */
  data: DrawdownPoint[];
  /** Maximum drawdown percentage from backtest summary */
  maxDrawdown?: number;
  /** Chart height in pixels */
  height?: number;
  /** Loading state */
  loading?: boolean;
}

/**
 * Drawdown Chart - shows peak-to-trough declines
 */
export function DrawdownChart({
  data,
  maxDrawdown,
  height = 200,
  loading = false,
}: DrawdownChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const theme = useTheme();

  // Calculate max drawdown from data if not provided
  const calculatedMaxDrawdown = maxDrawdown ?? Math.min(...data.map((d) => d.value), 0);

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
        scaleMargins: {
          top: 0.1,
          bottom: 0,
        },
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

    // Add area series for drawdown (v5 API) - inverted values go below zero
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: drawdownColors.line,
      topColor: drawdownColors.areaTop,
      bottomColor: drawdownColors.areaBottom,
      lineWidth: 2,
      invertFilledArea: true, // Fill below the line
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => formatPercent(price),
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
    };
  }, [height, theme.palette.mode, loading]);

  // Update data when it changes
  useEffect(() => {
    if (!seriesRef.current || !data.length) return;

    // Convert to lightweight-charts format
    const chartData: AreaData<Time>[] = data.map((point) => ({
      time: point.time as Time,
      value: point.value,
    }));

    seriesRef.current.setData(chartData);

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data]);

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
        <Typography color="text.secondary">No drawdown data available</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with max drawdown */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mb: 1 }}>
        <Typography variant="h6">Drawdown</Typography>
        <Typography
          variant="body1"
          sx={{ color: 'error.main', fontWeight: 500 }}
        >
          Max: {formatPercent(calculatedMaxDrawdown)}
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

export default DrawdownChart;