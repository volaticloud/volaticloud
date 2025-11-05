import {
  Box,
  Card,
  CardContent,
  Typography,
  Skeleton,
  Alert,
  AlertTitle,
  Grid,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Timeline,
  ShowChart,
  BarChart,
  Speed,
} from '@mui/icons-material';

interface BotMetricsProps {
  metrics: {
    profitClosedCoin?: number | null;
    profitClosedPercent?: number | null;
    profitAllCoin?: number | null;
    profitAllPercent?: number | null;
    tradeCount?: number | null;
    closedTradeCount?: number | null;
    openTradeCount?: number | null;
    winningTrades?: number | null;
    losingTrades?: number | null;
    winrate?: number | null;
    expectancy?: number | null;
    profitFactor?: number | null;
    maxDrawdown?: number | null;
    maxDrawdownAbs?: number | null;
    bestPair?: string | null;
    bestRate?: number | null;
    fetchedAt?: string | null;
  } | null;
  botStatus: string;
}

const BotMetrics = ({ metrics, botStatus }: BotMetricsProps) => {
  const formatNumber = (value: number | null | undefined, decimals = 2) => {
    if (value === null || value === undefined) return 'N/A';
    return value.toFixed(decimals);
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    return `${value.toFixed(2)}%`;
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  // Show alert if bot is not running
  if (botStatus !== 'running' && botStatus !== 'unhealthy') {
    return (
      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>Metrics Not Available</AlertTitle>
        Bot must be running to collect metrics. Start the bot to begin tracking performance.
      </Alert>
    );
  }

  // Show skeleton while metrics are being fetched
  if (!metrics) {
    return (
      <Box mb={3}>
        <Typography variant="h6" gutterBottom>
          Performance Metrics
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          <AlertTitle>Fetching Metrics</AlertTitle>
          Waiting for the monitor to collect metrics from the bot. This may take up to 30 seconds...
        </Alert>
        <Grid container spacing={3}>
          {[...Array(6)].map((_, index) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="rectangular" height={40} sx={{ my: 1 }} />
                  <Skeleton variant="text" width="40%" />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  // Show metrics cards
  return (
    <Box mb={3}>
      <Typography variant="h6" gutterBottom>
        Performance Metrics
      </Typography>
      <Grid container spacing={3}>
        {/* Total Profit */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <ShowChart color="primary" />
                <Typography color="textSecondary" variant="body2">
                  Total Profit
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                {metrics.profitAllCoin !== null && metrics.profitAllCoin >= 0 ? (
                  <TrendingUp color="success" />
                ) : (
                  <TrendingDown color="error" />
                )}
                <Typography variant="h4">
                  {formatNumber(metrics.profitAllCoin, 4)}
                </Typography>
              </Box>
              <Typography variant="body2" color="textSecondary">
                {formatPercent(metrics.profitAllPercent)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Closed Profit */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Timeline color="primary" />
                <Typography color="textSecondary" variant="body2">
                  Closed Profit
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                {metrics.profitClosedCoin !== null && metrics.profitClosedCoin >= 0 ? (
                  <TrendingUp color="success" />
                ) : (
                  <TrendingDown color="error" />
                )}
                <Typography variant="h4">
                  {formatNumber(metrics.profitClosedCoin, 4)}
                </Typography>
              </Box>
              <Typography variant="body2" color="textSecondary">
                {formatPercent(metrics.profitClosedPercent)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Total Trades */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <BarChart color="primary" />
                <Typography color="textSecondary" variant="body2">
                  Total Trades
                </Typography>
              </Box>
              <Typography variant="h4">{metrics.tradeCount || 0}</Typography>
              <Typography variant="body2" color="textSecondary">
                {metrics.closedTradeCount || 0} closed, {metrics.openTradeCount || 0} open
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Win Rate */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Speed color="primary" />
                <Typography color="textSecondary" variant="body2">
                  Win Rate
                </Typography>
              </Box>
              <Typography variant="h4">{formatPercent(metrics.winrate)}</Typography>
              <Typography variant="body2" color="textSecondary">
                {metrics.winningTrades || 0}W / {metrics.losingTrades || 0}L
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Best Pair */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <TrendingUp color="primary" />
                <Typography color="textSecondary" variant="body2">
                  Best Pair
                </Typography>
              </Box>
              <Typography variant="h5">{metrics.bestPair || 'N/A'}</Typography>
              <Typography variant="body2" color="textSecondary">
                {formatPercent(metrics.bestRate)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Max Drawdown */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <TrendingDown color="primary" />
                <Typography color="textSecondary" variant="body2">
                  Max Drawdown
                </Typography>
              </Box>
              <Typography variant="h5" color="error">
                {formatPercent(metrics.maxDrawdown)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {formatNumber(metrics.maxDrawdownAbs, 4)} abs
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Profit Factor */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography color="textSecondary" variant="body2" gutterBottom>
                Profit Factor
              </Typography>
              <Typography variant="h5">{formatNumber(metrics.profitFactor)}</Typography>
              <Typography variant="body2" color="textSecondary">
                Expectancy: {formatNumber(metrics.expectancy, 4)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Metrics Last Updated */}
      <Box mt={2} textAlign="right">
        <Typography variant="caption" color="textSecondary">
          Last updated: {formatDate(metrics.fetchedAt)}
        </Typography>
      </Box>
    </Box>
  );
};

export default BotMetrics;