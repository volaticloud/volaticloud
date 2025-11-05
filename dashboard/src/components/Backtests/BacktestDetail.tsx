import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Divider,
  Paper,
} from '@mui/material';
import Grid2 from '@mui/material/Grid2';
import { ArrowBack, Timeline, TrendingUp, TrendingDown } from '@mui/icons-material';
import { useGetBacktestQuery } from '../../generated/graphql';
import TradesTable from './TradesTable';
import { extractStrategyData, extractTrades } from '../../types/freqtrade';

const BacktestDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, error } = useGetBacktestQuery({
    variables: { id: id! },
    skip: !id,
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading backtest: {error.message}
      </Alert>
    );
  }

  const backtest = data?.backtests?.edges?.[0]?.node;

  if (!backtest) {
    return (
      <Alert severity="error">
        Backtest not found
      </Alert>
    );
  }

  // Extract typed strategy data using helper functions
  const strategyData = extractStrategyData(backtest.result);

  // Extract metrics with type safety
  const totalTrades = strategyData?.total_trades || 0;
  const profitTotal = strategyData?.profit_total_abs || 0;
  const profitPercent = strategyData?.profit_total || 0;
  const winRate = strategyData?.wins ? (strategyData.wins / totalTrades * 100).toFixed(2) : '0.00';
  const avgProfit = strategyData?.profit_mean ? (strategyData.profit_mean * 100).toFixed(2) : '0.00';
  const maxDrawdown = strategyData?.max_drawdown ? (strategyData.max_drawdown * 100).toFixed(2) : '0.00';
  const profitFactor = strategyData?.profit_factor || 0;
  const expectancy = strategyData?.expectancy || 0;

  // Status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'running':
        return 'info';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  // Extract trades list using helper function
  const trades = extractTrades(backtest.result);

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={3}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/backtests')}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Typography variant="h4" component="h1">
          Backtest Results
        </Typography>
      </Box>

      {/* Backtest Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid2 container spacing={2}>
            <Grid2 xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Strategy
              </Typography>
              <Typography variant="body1">
                {backtest.strategy?.name || 'N/A'}
              </Typography>
            </Grid2>
            <Grid2 xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Runner
              </Typography>
              <Typography variant="body1">
                {backtest.runner?.name || 'N/A'}
              </Typography>
            </Grid2>
            <Grid2 xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Status
              </Typography>
              <Chip
                label={backtest.status}
                color={getStatusColor(backtest.status)}
                size="small"
              />
            </Grid2>
            <Grid2 xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Completed At
              </Typography>
              <Typography variant="body1">
                {backtest.completedAt
                  ? new Date(backtest.completedAt).toLocaleString()
                  : 'N/A'}
              </Typography>
            </Grid2>
          </Grid2>

          {backtest.errorMessage && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {backtest.errorMessage}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Summary Metrics */}
      {backtest.status === 'completed' && strategyData !== null && (
        <>
          <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
            Performance Summary
          </Typography>

          <Grid2 container spacing={2} sx={{ mb: 4 }}>
            {/* Total Profit */}
            <Grid2 xs={12} sm={6} md={3}>
              <Paper elevation={2} sx={{ p: 2 }}>
                <Box display="flex" alignItems="center" mb={1}>
                  {profitTotal >= 0 ? (
                    <TrendingUp color="success" sx={{ mr: 1 }} />
                  ) : (
                    <TrendingDown color="error" sx={{ mr: 1 }} />
                  )}
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Profit
                  </Typography>
                </Box>
                <Typography variant="h5" color={profitTotal >= 0 ? 'success.main' : 'error.main'}>
                  ${profitTotal.toFixed(2)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {profitPercent.toFixed(2)}%
                </Typography>
              </Paper>
            </Grid2>

            {/* Total Trades */}
            <Grid2 xs={12} sm={6} md={3}>
              <Paper elevation={2} sx={{ p: 2 }}>
                <Box display="flex" alignItems="center" mb={1}>
                  <Timeline sx={{ mr: 1 }} />
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Trades
                  </Typography>
                </Box>
                <Typography variant="h5">{totalTrades}</Typography>
                <Typography variant="body2" color="text.secondary">
                  W: {strategyData.wins || 0} / L: {strategyData.losses || 0}
                </Typography>
              </Paper>
            </Grid2>

            {/* Win Rate */}
            <Grid2 xs={12} sm={6} md={3}>
              <Paper elevation={2} sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Win Rate
                </Typography>
                <Typography variant="h5">{winRate}%</Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg Profit: {avgProfit}%
                </Typography>
              </Paper>
            </Grid2>

            {/* Max Drawdown */}
            <Grid2 xs={12} sm={6} md={3}>
              <Paper elevation={2} sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Max Drawdown
                </Typography>
                <Typography variant="h5" color="error.main">
                  {maxDrawdown}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  PF: {profitFactor.toFixed(2)} | Exp: {expectancy.toFixed(2)}
                </Typography>
              </Paper>
            </Grid2>
          </Grid2>

          <Divider sx={{ my: 3 }} />

          {/* Trades Table */}
          <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
            Trades ({trades.length})
          </Typography>
          <TradesTable trades={trades} />
        </>
      )}

      {/* No Results */}
      {backtest.status === 'completed' && strategyData === null && (
        <Alert severity="info">
          No backtest results available. The backtest may have failed to generate results.
        </Alert>
      )}

      {/* Running State */}
      {backtest.status === 'running' && (
        <Alert severity="info" icon={<CircularProgress size={20} />}>
          Backtest is currently running. Refresh to see results when complete.
        </Alert>
      )}
    </Box>
  );
};

export default BacktestDetail;