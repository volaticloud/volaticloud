import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';

interface BacktestMetricsProps {
  status: string;
  summary?: {
    totalTrades: number;
    wins: number;
    losses: number;
    winRate?: number | null;
    profitTotal?: number | null;
    maxDrawdown?: number | null;
    profitFactor?: number | null;
    expectancy?: number | null;
  } | null;
  createdAt: string;
}

export const BacktestMetrics = ({ status, summary, createdAt }: BacktestMetricsProps) => {
  if (summary) {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 2 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Total Trades
          </Typography>
          <Typography variant="h6">{summary.totalTrades}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Win Rate
          </Typography>
          <Typography variant="h6" color={summary.winRate && summary.winRate > 0.5 ? 'success.main' : 'error.main'}>
            {summary.winRate ? `${(summary.winRate * 100).toFixed(2)}%` : 'N/A'}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Total Profit
          </Typography>
          <Typography variant="h6" color={summary.profitTotal && summary.profitTotal > 0 ? 'success.main' : 'error.main'}>
            {summary.profitTotal ? `${summary.profitTotal.toFixed(2)}%` : 'N/A'}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Max Drawdown
          </Typography>
          <Typography variant="h6" color="error.main">
            {summary.maxDrawdown ? `${(summary.maxDrawdown * 100).toFixed(2)}%` : 'N/A'}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Profit Factor
          </Typography>
          <Typography variant="body1">
            {summary.profitFactor?.toFixed(2) || 'N/A'}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Expectancy
          </Typography>
          <Typography variant="body1">
            {summary.expectancy?.toFixed(2) || 'N/A'}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Wins / Losses
          </Typography>
          <Typography variant="body1">
            {summary.wins} / {summary.losses}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Created
          </Typography>
          <Typography variant="body1">
            {new Date(createdAt).toLocaleString()}
          </Typography>
        </Box>
      </Box>
    );
  }

  if (status === 'running') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <CircularProgress size={20} />
        <Typography>Backtest is currently running...</Typography>
      </Box>
    );
  }

  if (status === 'failed') {
    return (
      <Alert severity="error">
        Backtest failed. Please try running it again.
      </Alert>
    );
  }

  return (
    <Alert severity="info">
      Backtest is pending. Results will appear once processing is complete.
    </Alert>
  );
};