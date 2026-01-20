import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import {
  Memory as CpuIcon,
  Storage as MemoryIcon,
  CloudDownload as NetworkIcon,
  SdStorage as StorageIcon,
  AttachMoney as CostIcon,
} from '@mui/icons-material';
import { useGetUsageDashboardQuery } from './usage.generated';
import { useActiveOrganization } from '../../contexts/OrganizationContext';

// Helper to format bytes to human-readable
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// Helper to format cost
const formatCost = (cost: number, currency: string): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(cost);
};

type TimeRange = '24h' | '7d' | '30d';

const getTimeRange = (range: TimeRange): { start: Date; end: Date } => {
  const end = new Date();
  const start = new Date();

  switch (range) {
    case '24h':
      start.setHours(start.getHours() - 24);
      break;
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
  }

  return { start, end };
};

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  tooltip?: string;
}

const MetricCard = ({ title, value, subtitle, icon, color, tooltip }: MetricCardProps) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {title}
          </Typography>
          <Tooltip title={tooltip || ''} arrow placement="top">
            <Typography variant="h5" fontWeight={600} sx={{ color }}>
              {value}
            </Typography>
          </Tooltip>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            p: 1,
            borderRadius: 2,
            bgcolor: `${color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

export const UsageDashboard = () => {
  const { activeOrganizationId } = useActiveOrganization();
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');

  const { start, end } = useMemo(() => getTimeRange(timeRange), [timeRange]);

  const { data, loading, error } = useGetUsageDashboardQuery({
    variables: {
      ownerID: activeOrganizationId || '',
      start: start.toISOString(),
      end: end.toISOString(),
    },
    skip: !activeOrganizationId, // Skip query if no group is selected
    pollInterval: 60000, // Poll every minute for live updates
  });

  const handleTimeRangeChange = (_: React.MouseEvent<HTMLElement>, newRange: TimeRange | null) => {
    if (newRange) {
      setTimeRange(newRange);
    }
  };

  const usage = data?.organizationUsage;
  const cost = data?.estimatedCost;

  // Calculate derived metrics
  const cpuCoreHours = usage ? usage.cpuCoreSeconds / 3600 : 0;
  const memoryGBHours = usage ? usage.memoryGBSeconds / 3600 : 0;
  const totalNetworkBytes = usage ? (usage.networkRxBytes ?? 0) + (usage.networkTxBytes ?? 0) : 0;
  const totalStorageBytes = usage ? (usage.blockReadBytes ?? 0) + (usage.blockWriteBytes ?? 0) : 0;

  return (
    <Box sx={{ width: '100%', maxWidth: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom fontWeight={600}>
            Resource Usage
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor your organization's resource consumption and estimated costs
          </Typography>
        </Box>
        <ToggleButtonGroup
          value={timeRange}
          exclusive
          onChange={handleTimeRangeChange}
          size="small"
        >
          <ToggleButton value="24h">24 Hours</ToggleButton>
          <ToggleButton value="7d">7 Days</ToggleButton>
          <ToggleButton value="30d">30 Days</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load usage data: {error.message}
        </Alert>
      )}

      {!loading && !error && (
        <>
          {/* Cost Summary Card */}
          <Card sx={{ mb: 3, bgcolor: 'primary.dark' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CostIcon sx={{ fontSize: 48, color: 'primary.contrastText' }} />
                <Box>
                  <Typography variant="body2" sx={{ color: 'primary.contrastText', opacity: 0.8 }}>
                    Estimated Total Cost ({timeRange === '24h' ? 'Last 24 Hours' : timeRange === '7d' ? 'Last 7 Days' : 'Last 30 Days'})
                  </Typography>
                  <Typography variant="h3" fontWeight={700} sx={{ color: 'primary.contrastText' }}>
                    {cost ? formatCost(cost.totalCost, cost.currency) : '$0.0000'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Resource Usage Metrics */}
          <Typography variant="h6" gutterBottom fontWeight={600} sx={{ mt: 4, mb: 2 }}>
            Resource Consumption
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MetricCard
                title="CPU Usage"
                value={`${cpuCoreHours.toFixed(2)} core-hours`}
                subtitle={usage?.cpuAvgPercent ? `Avg: ${usage.cpuAvgPercent.toFixed(1)}%` : undefined}
                icon={<CpuIcon sx={{ color: 'info.main', fontSize: 28 }} />}
                color="#2196f3"
                tooltip={`Total CPU consumption in core-hours. Max: ${usage?.cpuMaxPercent?.toFixed(1) || 0}%`}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MetricCard
                title="Memory Usage"
                value={`${memoryGBHours.toFixed(2)} GB-hours`}
                subtitle={usage?.memoryAvgBytes ? `Avg: ${formatBytes(usage.memoryAvgBytes)}` : undefined}
                icon={<MemoryIcon sx={{ color: 'success.main', fontSize: 28 }} />}
                color="#4caf50"
                tooltip={`Total memory consumption in GB-hours. Max: ${formatBytes(usage?.memoryMaxBytes || 0)}`}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MetricCard
                title="Network I/O"
                value={formatBytes(totalNetworkBytes)}
                subtitle={usage ? `RX: ${formatBytes(usage.networkRxBytes ?? 0)} / TX: ${formatBytes(usage.networkTxBytes ?? 0)}` : undefined}
                icon={<NetworkIcon sx={{ color: 'warning.main', fontSize: 28 }} />}
                color="#ff9800"
                tooltip="Total network bytes transferred (received + transmitted)"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MetricCard
                title="Storage I/O"
                value={formatBytes(totalStorageBytes)}
                subtitle={usage ? `Read: ${formatBytes(usage.blockReadBytes ?? 0)} / Write: ${formatBytes(usage.blockWriteBytes ?? 0)}` : undefined}
                icon={<StorageIcon sx={{ color: 'secondary.main', fontSize: 28 }} />}
                color="#9c27b0"
                tooltip="Total disk bytes read and written"
              />
            </Grid>
          </Grid>

          {/* Cost Breakdown */}
          <Typography variant="h6" gutterBottom fontWeight={600} sx={{ mt: 4, mb: 2 }}>
            Cost Breakdown
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    CPU Cost
                  </Typography>
                  <Typography variant="h5" fontWeight={600} color="info.main">
                    {cost ? formatCost(cost.cpuCost, cost.currency) : '$0.0000'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Memory Cost
                  </Typography>
                  <Typography variant="h5" fontWeight={600} color="success.main">
                    {cost ? formatCost(cost.memoryCost, cost.currency) : '$0.0000'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Network Cost
                  </Typography>
                  <Typography variant="h5" fontWeight={600} color="warning.main">
                    {cost ? formatCost(cost.networkCost, cost.currency) : '$0.0000'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Storage Cost
                  </Typography>
                  <Typography variant="h5" fontWeight={600} color="secondary.main">
                    {cost ? formatCost(cost.storageCost, cost.currency) : '$0.0000'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Sample Info */}
          {usage && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Data based on {usage.sampleCount || 0} samples collected between{' '}
                  {new Date(usage.bucketStart).toLocaleString()} and{' '}
                  {new Date(usage.bucketEnd).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* No Data Message */}
          {!usage && !loading && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="body1" color="text.secondary" align="center">
                  No usage data available for the selected time range.
                  <br />
                  Usage tracking starts when you run bots or backtests on runners with billing enabled.
                </Typography>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
};