/**
 * Candlestick Chart Component
 *
 * Displays OHLCV candlestick data with trade markers using lightweight-charts.
 * Fetches data directly from exchanges using the exchange data service.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  CandlestickSeries,
  HistogramSeries,
  HistogramData,
  SeriesMarker,
  createSeriesMarkers,
} from 'lightweight-charts';
import type { ISeriesMarkersPluginApi } from 'lightweight-charts';
import {
  Box,
  Typography,
  useTheme,
  Skeleton,
  Alert,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Chip,
  SelectChangeEvent,
} from '@mui/material';
import { getChartTheme, profitColors } from './theme';
import { useOHLCVData, type ExchangeId, type Timeframe } from '../../../services/exchangeData';
import type { Trade } from '../../../types/freqtrade';

export interface CandlestickChartProps {
  /** Exchange identifier */
  exchange: ExchangeId | string;
  /** Trading pair (e.g., "BTC/USDT") */
  symbol: string;
  /** Candle timeframe */
  timeframe: Timeframe;
  /** Start time (ISO string or timestamp) */
  startTime: string | number;
  /** End time (ISO string or timestamp) */
  endTime: string | number;
  /** Trades for markers */
  trades?: Trade[];
  /** Chart height in pixels */
  height?: number;
  /** Show volume bars */
  showVolume?: boolean;
  /** Available symbols for selector (if multiple pairs) */
  availableSymbols?: string[];
  /** Callback when symbol changes */
  onSymbolChange?: (symbol: string) => void;
}

/**
 * Candlestick Chart - shows OHLCV price data with trade markers
 */
export function CandlestickChart({
  exchange,
  symbol,
  timeframe,
  startTime,
  endTime,
  trades = [],
  height = 400,
  showVolume = true,
  availableSymbols,
  onSymbolChange,
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const theme = useTheme();

  const [selectedSymbol, setSelectedSymbol] = useState(symbol);

  // Fetch OHLCV data
  const { candles, loading, error, fromCache, refetch } = useOHLCVData({
    exchange: exchange as ExchangeId,
    symbol: selectedSymbol,
    timeframe,
    startTime,
    endTime,
    enabled: true,
  });

  // Handle symbol change
  const handleSymbolChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      const newSymbol = event.target.value;
      setSelectedSymbol(newSymbol);
      onSymbolChange?.(newSymbol);
    },
    [onSymbolChange]
  );

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
      height: showVolume ? height - 80 : height,
      rightPriceScale: {
        borderColor: chartTheme.gridColor,
      },
      timeScale: {
        borderColor: chartTheme.gridColor,
        timeVisible: true,
        secondsVisible: false,
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

    // Add candlestick series (v5 API)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: profitColors.positive,
      downColor: profitColors.negative,
      borderUpColor: profitColors.positive,
      borderDownColor: profitColors.negative,
      wickUpColor: profitColors.positive,
      wickDownColor: profitColors.negative,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Add volume series if enabled
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: theme.palette.mode === 'dark' ? '#26a69a80' : '#26a69a60',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
      });

      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.85,
          bottom: 0,
        },
      });

      volumeSeriesRef.current = volumeSeries;
    }

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
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      markersPluginRef.current = null;
    };
  }, [height, theme.palette.mode, loading, showVolume]);

  // Update candlestick data when candles change
  useEffect(() => {
    if (!candleSeriesRef.current || !candles.length) return;

    // Convert to lightweight-charts format
    const candleData: CandlestickData<Time>[] = candles.map((candle) => ({
      time: (candle.timestamp / 1000) as Time, // Convert ms to seconds
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    candleSeriesRef.current.setData(candleData);

    // Update volume data
    if (volumeSeriesRef.current) {
      const volumeData: HistogramData<Time>[] = candles.map((candle) => ({
        time: (candle.timestamp / 1000) as Time,
        value: candle.volume,
        color:
          candle.close >= candle.open
            ? theme.palette.mode === 'dark'
              ? '#26a69a80'
              : '#26a69a60'
            : theme.palette.mode === 'dark'
              ? '#ef535080'
              : '#ef535060',
      }));

      volumeSeriesRef.current.setData(volumeData);
    }

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [candles, theme.palette.mode]);

  // Add trade markers when trades change
  useEffect(() => {
    if (!candleSeriesRef.current || !trades.length || !candles.length) return;

    const markers: SeriesMarker<Time>[] = [];

    // Filter trades for the current symbol
    const symbolTrades = trades.filter((trade) => {
      // Normalize pair names for comparison
      const tradePair = trade.pair?.replace('/', '').toUpperCase();
      const chartPair = selectedSymbol.replace('/', '').toUpperCase();
      return tradePair === chartPair;
    });

    for (const trade of symbolTrades) {
      // Entry marker
      if (trade.open_date) {
        const entryTime = Math.floor(new Date(trade.open_date).getTime() / 1000) as Time;
        markers.push({
          time: entryTime,
          position: 'belowBar',
          color: profitColors.positive,
          shape: 'arrowUp',
          text: 'Entry',
          size: 1,
        });
      }

      // Exit marker
      if (trade.close_date) {
        const exitTime = Math.floor(new Date(trade.close_date).getTime() / 1000) as Time;
        const isProfit = trade.profit_abs > 0;

        markers.push({
          time: exitTime,
          position: 'aboveBar',
          color: isProfit ? profitColors.positive : profitColors.negative,
          shape: 'arrowDown',
          text: isProfit ? `+${trade.profit_abs.toFixed(2)}` : trade.profit_abs.toFixed(2),
          size: 1,
        });
      }
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
      markersPluginRef.current = createSeriesMarkers(candleSeriesRef.current, markers);
    }
  }, [trades, candles, selectedSymbol]);

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load price data: {error.message}
        </Alert>
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
          <Typography color="text.secondary">Unable to fetch OHLCV data from {exchange}</Typography>
        </Box>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Skeleton variant="text" width={200} height={32} />
          <Skeleton variant="rounded" width={80} height={24} />
        </Box>
        <Skeleton variant="rectangular" height={height} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with symbol selector */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6">Price Chart</Typography>

        {availableSymbols && availableSymbols.length > 1 ? (
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="symbol-select-label">Pair</InputLabel>
            <Select
              labelId="symbol-select-label"
              value={selectedSymbol}
              label="Pair"
              onChange={handleSymbolChange}
            >
              {availableSymbols.map((sym) => (
                <MenuItem key={sym} value={sym}>
                  {sym}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <Chip label={selectedSymbol} size="small" />
        )}

        <Chip label={timeframe} size="small" variant="outlined" />

        {fromCache && (
          <Chip
            label="Cached"
            size="small"
            color="info"
            variant="outlined"
            onClick={() => refetch()}
            sx={{ cursor: 'pointer' }}
          />
        )}

        <Typography variant="body2" color="text.secondary">
          {candles.length} candles
        </Typography>
      </Box>

      {/* Chart container */}
      {candles.length === 0 ? (
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
          <Typography color="text.secondary">No price data available</Typography>
        </Box>
      ) : (
        <Box
          ref={chartContainerRef}
          sx={{
            width: '100%',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        />
      )}
    </Box>
  );
}

export default CandlestickChart;