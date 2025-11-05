import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  IconButton,
  Tooltip,
  Grid,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Refresh,
  Delete,
  ArrowBack,
} from '@mui/icons-material';
import { useState } from 'react';
import {
  useGetBotQuery,
  useStopBotMutation,
  useStartBotMutation,
  useRestartBotMutation,
  useDeleteBotMutation,
} from '../../generated/graphql';
import BotMetrics from './BotMetrics';

const BotDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState(false);

  const { data, loading, error, refetch } = useGetBotQuery({
    variables: { id: id! },
    skip: !id,
    pollInterval: 10000, // Refresh every 10 seconds
  });

  const [stopBot] = useStopBotMutation();
  const [startBot] = useStartBotMutation();
  const [restartBot] = useRestartBotMutation();
  const [deleteBot] = useDeleteBotMutation();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">Error loading bot: {error.message}</Alert>
      </Box>
    );
  }

  const bot = data?.bots?.edges?.[0]?.node;

  if (!bot) {
    return (
      <Box p={3}>
        <Alert severity="warning">Bot not found</Alert>
      </Box>
    );
  }

  const handleAction = async (action: () => Promise<any>, successMessage: string) => {
    setActionLoading(true);
    try {
      await action();
      await refetch();
      alert(successMessage);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this bot? This action cannot be undone.')) {
      return;
    }
    setActionLoading(true);
    try {
      await deleteBot({ variables: { id: id! } });
      navigate('/bots');
    } catch (err: any) {
      alert(`Error deleting bot: ${err.message}`);
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'success';
      case 'stopped':
        return 'default';
      case 'error':
        return 'error';
      case 'creating':
        return 'info';
      default:
        return 'default';
    }
  };

  const getModeColor = (mode: string) => {
    return mode === 'live' ? 'error' : 'warning';
  };

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

  const canStart = bot.status === 'stopped';
  const canStop = bot.status === 'running' || bot.status === 'unhealthy';
  const canRestart = bot.status === 'running' || bot.status === 'unhealthy';

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={() => navigate('/bots')}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4">{bot.name}</Typography>
          <Chip label={bot.status} color={getStatusColor(bot.status)} />
          <Chip label={bot.mode} color={getModeColor(bot.mode)} />
        </Box>

        <Box display="flex" gap={1}>
          <Tooltip title="Start Bot">
            <span>
              <Button
                variant="contained"
                color="success"
                startIcon={<PlayArrow />}
                disabled={!canStart || actionLoading}
                onClick={() =>
                  handleAction(
                    () => startBot({ variables: { id: id! } }),
                    'Bot started successfully'
                  )
                }
              >
                Start
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="Stop Bot">
            <span>
              <Button
                variant="contained"
                color="warning"
                startIcon={<Stop />}
                disabled={!canStop || actionLoading}
                onClick={() =>
                  handleAction(
                    () => stopBot({ variables: { id: id! } }),
                    'Bot stopped successfully'
                  )
                }
              >
                Stop
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="Restart Bot">
            <span>
              <Button
                variant="contained"
                startIcon={<Refresh />}
                disabled={!canRestart || actionLoading}
                onClick={() =>
                  handleAction(
                    () => restartBot({ variables: { id: id! } }),
                    'Bot restarted successfully'
                  )
                }
              >
                Restart
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="Delete Bot">
            <span>
              <Button
                variant="contained"
                color="error"
                startIcon={<Delete />}
                disabled={actionLoading}
                onClick={handleDelete}
              >
                Delete
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* Error Message */}
      {bot.errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {bot.errorMessage}
        </Alert>
      )}

      {/* Metrics */}
      <BotMetrics metrics={bot.metrics} botStatus={bot.status} />

      {/* Bot Information */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Bot Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="textSecondary">
                  Container ID
                </Typography>
                <Typography variant="body1" sx={{ wordBreak: 'break-all' }}>
                  {bot.containerID || 'N/A'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="textSecondary">
                  Freqtrade Version
                </Typography>
                <Typography variant="body1">{bot.freqtradeVersion}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="textSecondary">
                  Exchange
                </Typography>
                <Typography variant="body1">
                  {bot.exchange?.name}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="textSecondary">
                  Strategy
                </Typography>
                <Typography variant="body1">{bot.strategy?.name}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="textSecondary">
                  Runner
                </Typography>
                <Typography variant="body1">
                  {bot.runner?.name} ({bot.runner?.type})
                </Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="textSecondary">
                  Last Seen
                </Typography>
                <Typography variant="body1">{formatDate(bot.lastSeenAt)}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="textSecondary">
                  Created
                </Typography>
                <Typography variant="body1">{formatDate(bot.createdAt)}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="textSecondary">
                  Updated
                </Typography>
                <Typography variant="body1">{formatDate(bot.updatedAt)}</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Strategy Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Name
            </Typography>
            <Typography variant="body1" gutterBottom>
              {bot.strategy?.name}
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom sx={{ mt: 2 }}>
              Description
            </Typography>
            <Typography variant="body1">
              {bot.strategy?.description || 'No description available'}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Trades */}
      {bot.trades?.edges && bot.trades.edges.length > 0 && (
        <Paper sx={{ mt: 3, p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Recent Trades
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Pair</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Open Date</TableCell>
                  <TableCell align="right">Close Date</TableCell>
                  <TableCell align="right">Profit</TableCell>
                  <TableCell align="right">Profit %</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bot.trades.edges.map((edge) => {
                  const trade = edge.node;
                  return (
                    <TableRow key={trade.id}>
                      <TableCell>{trade.pair}</TableCell>
                      <TableCell>
                        <Chip
                          label={trade.isOpen ? 'Open' : 'Closed'}
                          size="small"
                          color={trade.isOpen ? 'primary' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">{formatDate(trade.openDate)}</TableCell>
                      <TableCell align="right">{formatDate(trade.closeDate)}</TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          color:
                            trade.profitAbs && trade.profitAbs > 0 ? 'success.main' : 'error.main',
                        }}
                      >
                        {formatNumber(trade.profitAbs, 4)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          color:
                            trade.profitRatio && trade.profitRatio > 0
                              ? 'success.main'
                              : 'error.main',
                        }}
                      >
                        {formatPercent(trade.profitRatio ? trade.profitRatio * 100 : null)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default BotDetail;