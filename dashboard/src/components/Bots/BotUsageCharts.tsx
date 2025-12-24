/**
 * Bot Usage Charts Component
 *
 * Displays resource usage charts (CPU, Memory, Network, Disk) for a bot.
 * Uses Recharts for visualization with time-series data from botUsageHistory query.
 */
import { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Skeleton,
  useTheme,
  alpha,
  Grid,
} from '@mui/material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useGetBotUsageHistoryQuery } from './bots.generated';

// Time range options
type TimeRange = '1d' | '7d' | '30d';

interface BotUsageChartsProps {
  botId: string;
}

// Chart colors
const chartColors = {
  cpu: '#2196f3',      // Blue
  memory: '#9c27b0',   // Purple
  networkRx: '#4caf50', // Green
  networkTx: '#ff9800', // Orange
  diskRead: '#00bcd4',  // Cyan
  diskWrite: '#f44336', // Red
};

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// Format percent
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Format date for X axis
function formatXAxis(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Format time for tooltip
function formatTooltipTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

// Custom tooltip
interface CustomTooltipProps {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string; name: string }[];
  label?: string;
  valueFormatter: (value: number) => string;
}

function CustomTooltip({ active, payload, label, valueFormatter }: CustomTooltipProps) {
  if (!active || !payload || !payload.length || !label) {
    return null;
  }

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
      <Typography variant="caption" color="text.secondary">
        {formatTooltipTime(label)}
      </Typography>
      {payload.map((entry, index) => (
        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: entry.color,
            }}
          />
          <Typography variant="body2">
            {entry.name}: <strong>{valueFormatter(entry.value)}</strong>
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// Single chart component
interface UsageChartProps {
  title: string;
  data: any[];
  dataKeys: { key: string; name: string; color: string }[];
  valueFormatter: (value: number) => string;
  yAxisFormatter?: (value: number) => string;
  loading?: boolean;
  height?: number;
}

function UsageChart({
  title,
  data,
  dataKeys,
  valueFormatter,
  yAxisFormatter,
  loading = false,
  height = 200,
}: UsageChartProps) {
  const theme = useTheme();

  if (loading) {
    return (
      <Paper sx={{ p: 2 }}>
        <Skeleton variant="text" width={150} height={28} />
        <Skeleton variant="rectangular" height={height} />
      </Paper>
    );
  }

  if (!data.length) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          {title}
        </Typography>
        <Box
          sx={{
            height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(theme.palette.action.hover, 0.3),
            borderRadius: 1,
          }}
        >
          <Typography color="text.secondary">No usage data available</Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        {title}
      </Typography>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            {dataKeys.map(({ key, color }) => (
              <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme.palette.divider}
            vertical={false}
          />
          <XAxis
            dataKey="bucketStart"
            tickFormatter={formatXAxis}
            tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
            tickLine={{ stroke: theme.palette.divider }}
            axisLine={{ stroke: theme.palette.divider }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={yAxisFormatter || valueFormatter}
            tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
            tickLine={{ stroke: theme.palette.divider }}
            axisLine={{ stroke: theme.palette.divider }}
            width={70}
          />
          <Tooltip
            content={<CustomTooltip valueFormatter={valueFormatter} />}
            cursor={{ stroke: theme.palette.divider }}
          />
          {dataKeys.length > 1 && (
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12 }}
            />
          )}
          {dataKeys.map(({ key, name, color }) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              name={name}
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${key})`}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </Paper>
  );
}

// Main component
export default function BotUsageCharts({ botId }: BotUsageChartsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  // Calculate time range
  const { start, end } = useMemo(() => {
    const now = new Date();
    const endDate = now.toISOString();
    let startDate: string;

    switch (timeRange) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    return { start: startDate, end: endDate };
  }, [timeRange]);

  // Fetch usage data
  const { data, loading, error } = useGetBotUsageHistoryQuery({
    variables: {
      botID: botId,
      start,
      end,
    },
    pollInterval: 60000, // Refresh every minute
  });

  // Transform data for charts
  const chartData = useMemo(() => {
    if (!data?.botUsageHistory) return [];

    return data.botUsageHistory.map((agg) => ({
      bucketStart: agg.bucketStart,
      bucketEnd: agg.bucketEnd,
      cpuAvgPercent: agg.cpuAvgPercent,
      cpuMaxPercent: agg.cpuMaxPercent,
      memoryAvgBytes: agg.memoryAvgBytes,
      memoryMaxBytes: agg.memoryMaxBytes,
      networkRxBytes: agg.networkRxBytes,
      networkTxBytes: agg.networkTxBytes,
      blockReadBytes: agg.blockReadBytes,
      blockWriteBytes: agg.blockWriteBytes,
      sampleCount: agg.sampleCount,
    }));
  }, [data]);

  // Calculate summary stats
  const stats = useMemo(() => {
    if (!chartData.length) {
      return {
        avgCpu: 0,
        maxCpu: 0,
        avgMemory: 0,
        maxMemory: 0,
        totalNetworkRx: 0,
        totalNetworkTx: 0,
        totalDiskRead: 0,
        totalDiskWrite: 0,
      };
    }

    const avgCpu =
      chartData.reduce((sum, d) => sum + d.cpuAvgPercent, 0) / chartData.length;
    const maxCpu = Math.max(...chartData.map((d) => d.cpuMaxPercent));
    const avgMemory =
      chartData.reduce((sum, d) => sum + d.memoryAvgBytes, 0) / chartData.length;
    const maxMemory = Math.max(...chartData.map((d) => d.memoryMaxBytes));
    const totalNetworkRx = chartData.reduce((sum, d) => sum + d.networkRxBytes, 0);
    const totalNetworkTx = chartData.reduce((sum, d) => sum + d.networkTxBytes, 0);
    const totalDiskRead = chartData.reduce((sum, d) => sum + d.blockReadBytes, 0);
    const totalDiskWrite = chartData.reduce((sum, d) => sum + d.blockWriteBytes, 0);

    return {
      avgCpu,
      maxCpu,
      avgMemory,
      maxMemory,
      totalNetworkRx,
      totalNetworkTx,
      totalDiskRead,
      totalDiskWrite,
    };
  }, [chartData]);

  const handleTimeRangeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newTimeRange: TimeRange | null
  ) => {
    if (newTimeRange !== null) {
      setTimeRange(newTimeRange);
    }
  };

  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h6">Resource Usage</Typography>
        <ToggleButtonGroup
          value={timeRange}
          exclusive
          onChange={handleTimeRangeChange}
          size="small"
        >
          <ToggleButton value="1d">24h</ToggleButton>
          <ToggleButton value="7d">7d</ToggleButton>
          <ToggleButton value="30d">30d</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Summary Stats */}
      {chartData.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Box
              sx={{
                p: 2,
                bgcolor: alpha(chartColors.cpu, 0.1),
                borderRadius: 1,
                borderLeft: 3,
                borderColor: chartColors.cpu,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Avg CPU
              </Typography>
              <Typography variant="h6">{formatPercent(stats.avgCpu)}</Typography>
              <Typography variant="caption" color="text.secondary">
                Max: {formatPercent(stats.maxCpu)}
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Box
              sx={{
                p: 2,
                bgcolor: alpha(chartColors.memory, 0.1),
                borderRadius: 1,
                borderLeft: 3,
                borderColor: chartColors.memory,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Avg Memory
              </Typography>
              <Typography variant="h6">{formatBytes(stats.avgMemory)}</Typography>
              <Typography variant="caption" color="text.secondary">
                Max: {formatBytes(stats.maxMemory)}
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Box
              sx={{
                p: 2,
                bgcolor: alpha(chartColors.networkRx, 0.1),
                borderRadius: 1,
                borderLeft: 3,
                borderColor: chartColors.networkRx,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Network I/O
              </Typography>
              <Typography variant="h6">{formatBytes(stats.totalNetworkRx + stats.totalNetworkTx)}</Typography>
              <Typography variant="caption" color="text.secondary">
                RX: {formatBytes(stats.totalNetworkRx)} / TX: {formatBytes(stats.totalNetworkTx)}
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Box
              sx={{
                p: 2,
                bgcolor: alpha(chartColors.diskRead, 0.1),
                borderRadius: 1,
                borderLeft: 3,
                borderColor: chartColors.diskRead,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Disk I/O
              </Typography>
              <Typography variant="h6">{formatBytes(stats.totalDiskRead + stats.totalDiskWrite)}</Typography>
              <Typography variant="caption" color="text.secondary">
                R: {formatBytes(stats.totalDiskRead)} / W: {formatBytes(stats.totalDiskWrite)}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      )}

      {/* Error state */}
      {error && (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography color="error">Failed to load usage data: {error.message}</Typography>
        </Box>
      )}

      {/* Charts */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <UsageChart
            title="CPU Usage"
            data={chartData}
            dataKeys={[
              { key: 'cpuAvgPercent', name: 'Average', color: chartColors.cpu },
            ]}
            valueFormatter={formatPercent}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <UsageChart
            title="Memory Usage"
            data={chartData}
            dataKeys={[
              { key: 'memoryAvgBytes', name: 'Average', color: chartColors.memory },
            ]}
            valueFormatter={formatBytes}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <UsageChart
            title="Network I/O"
            data={chartData}
            dataKeys={[
              { key: 'networkRxBytes', name: 'Received', color: chartColors.networkRx },
              { key: 'networkTxBytes', name: 'Transmitted', color: chartColors.networkTx },
            ]}
            valueFormatter={formatBytes}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <UsageChart
            title="Disk I/O"
            data={chartData}
            dataKeys={[
              { key: 'blockReadBytes', name: 'Read', color: chartColors.diskRead },
              { key: 'blockWriteBytes', name: 'Write', color: chartColors.diskWrite },
            ]}
            valueFormatter={formatBytes}
            loading={loading}
          />
        </Grid>
      </Grid>
    </Paper>
  );
}