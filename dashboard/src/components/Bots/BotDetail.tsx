import { useParams, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Chip,
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
  Grid,
  Snackbar,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ArrowBack,
  Dashboard as DashboardIcon,
  DataUsage,
  SwapHoriz,
  PlayArrow,
  Stop,
  Refresh,
  Delete,
} from '@mui/icons-material';
import { useState, SyntheticEvent, useEffect } from 'react';
import {
  useGetBotQuery,
  useBotStatusChangedSubscription,
  useStartBotMutation,
  useStopBotMutation,
  useRestartBotMutation,
  useDeleteBotMutation,
} from './bots.generated';
import BotMetrics from './BotMetrics';
import BotUsageCharts from './BotUsageCharts';
import { FreqUIDrawer } from './FreqUIDrawer';
import { ToolbarActions, ToolbarAction } from '../shared/ToolbarActions';
import { ConfirmDrawer } from '../shared';
import { useOrganizationNavigate } from '../../contexts/OrganizationContext';
import { useDocumentTitle, usePermissions } from '../../hooks';

type TabValue = 'overview' | 'usage' | 'trades';

const VALID_TABS: TabValue[] = ['overview', 'usage', 'trades'];

const canStart = (status: string) => status === 'stopped' || status === 'error';
const canStopOrRestart = (status: string) => status === 'running' || status === 'unhealthy';

const BotDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useOrganizationNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });
  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);
  const [frequiDrawerOpen, setFrequiDrawerOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Get tab from URL, default to 'overview'
  const tabParam = searchParams.get('tab') as TabValue | null;
  const activeTab: TabValue = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'overview';

  const handleTabChange = (_event: SyntheticEvent, newValue: TabValue) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      if (newValue === 'overview') {
        newParams.delete('tab'); // Clean URL for default tab
      } else {
        newParams.set('tab', newValue);
      }
      return newParams;
    });
  };

  const { data, loading, error, refetch } = useGetBotQuery({
    variables: { id: id! },
    skip: !id,
  });

  // Subscribe to real-time bot status updates via WebSocket
  const { data: subscriptionData } = useBotStatusChangedSubscription({
    variables: { botId: id! },
    skip: !id,
  });

  const bot = data?.bots?.edges?.[0]?.node;

  // Set dynamic page title based on bot name
  useDocumentTitle(bot?.name ? `${bot.name} - Bot` : 'Bot Details');

  // Update local data when subscription receives new status
  useEffect(() => {
    if (subscriptionData?.botStatusChanged) {
      // Refetch to get full bot data when status changes
      refetch();
    }
  }, [subscriptionData, refetch]);

  // Mutations
  const [startBot] = useStartBotMutation();
  const [stopBot] = useStopBotMutation();
  const [restartBot] = useRestartBotMutation();
  const [deleteBot] = useDeleteBotMutation();

  // Permissions
  const { can, loading: permissionsLoading } = usePermissions();
  const canRun = can(id || '', 'run');
  const canStopBot = can(id || '', 'stop');
  const canDelete = can(id || '', 'delete');
  const canFreqtradeApi = can(id || '', 'freqtrade-api');

  // Action handlers
  const handleAction = async (
    action: () => Promise<unknown>,
    successMessage: string,
    errorPrefix: string
  ) => {
    setActionLoading(true);
    try {
      const result = await action() as { errors?: { message: string }[] };
      if (result.errors) {
        throw new Error(result.errors[0]?.message || `${errorPrefix} failed`);
      }
      refetch();
      setSnackbar({ open: true, message: successMessage, severity: 'success' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `${errorPrefix} failed`;
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = () => {
    handleAction(
      () => startBot({ variables: { id: id! } }),
      'Bot started successfully',
      'Failed to start bot'
    );
  };

  const handleStop = () => {
    handleAction(
      () => stopBot({ variables: { id: id! } }),
      'Bot stopped successfully',
      'Failed to stop bot'
    );
  };

  const handleRestart = () => {
    handleAction(
      () => restartBot({ variables: { id: id! } }),
      'Bot restarted successfully',
      'Failed to restart bot'
    );
  };

  const handleDelete = async () => {
    setActionLoading(true);
    setDeleteDrawerOpen(false);
    try {
      const result = await deleteBot({ variables: { id: id! } });
      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'Failed to delete bot');
      }
      setSnackbar({ open: true, message: 'Bot deleted successfully', severity: 'success' });
      navigate('/bots');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete bot';
      setSnackbar({ open: true, message, severity: 'error' });
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Error loading bot: {error.message}</Alert>;
  }

  if (!bot) {
    return <Alert severity="warning">Bot not found</Alert>;
  }

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

  return (
    <Box>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          px: 2,
          py: 2,
          mb: 3,
          mx: -3,
          mt: -3,
          pt: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <IconButton onClick={() => navigate('/bots')} size="small">
          <ArrowBack />
        </IconButton>

        {/* Title and Chips */}
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="h5" fontWeight={600}>
              {bot.name}
            </Typography>
            <Chip label={bot.status} color={getStatusColor(bot.status)} size="small" />
            <Chip label={bot.mode} color={getModeColor(bot.mode)} size="small" />
          </Box>
        </Box>

        {/* Toolbar Actions */}
        <ToolbarActions
          actions={[
            {
              id: 'start',
              label: 'Start',
              icon: <PlayArrow />,
              onClick: handleStart,
              primary: true,
              variant: 'contained',
              color: 'success',
              disabled: !canStart(bot.status) || !canRun || actionLoading || permissionsLoading,
              tooltip: 'Start Bot',
              iconOnlyOnSmallScreen: true,
            },
            {
              id: 'stop',
              label: 'Stop',
              icon: <Stop />,
              onClick: handleStop,
              primary: true,
              color: 'warning',
              disabled: !canStopOrRestart(bot.status) || !canStopBot || actionLoading || permissionsLoading,
              tooltip: 'Stop Bot',
              iconOnlyOnSmallScreen: true,
            },
            {
              id: 'restart',
              label: 'Restart',
              icon: <Refresh />,
              onClick: handleRestart,
              disabled: !canStopOrRestart(bot.status) || !canRun || actionLoading || permissionsLoading,
            },
            {
              id: 'frequi',
              label: 'Open FreqUI',
              icon: <DashboardIcon />,
              onClick: () => setFrequiDrawerOpen(true),
              disabled: !canFreqtradeApi || actionLoading || permissionsLoading,
            },
            {
              id: 'delete',
              label: 'Delete',
              icon: <Delete />,
              onClick: () => setDeleteDrawerOpen(true),
              color: 'error',
              disabled: !canDelete || actionLoading || permissionsLoading,
              dividerBefore: true,
            },
          ] satisfies ToolbarAction[]}
        />
      </Paper>

      {/* Error Message */}
      {bot.errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {bot.errorMessage}
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab icon={<DashboardIcon />} iconPosition="start" label="Overview" value="overview" />
          <Tab icon={<DataUsage />} iconPosition="start" label="Usage" value="usage" />
          <Tab
            icon={<SwapHoriz />}
            iconPosition="start"
            label={`Trades${bot.trades?.edges?.length ? ` (${bot.trades.edges.length})` : ''}`}
            value="trades"
          />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
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
                      Freqtrade Version
                    </Typography>
                    <Typography variant="body1">{bot.freqtradeVersion}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="body2" color="textSecondary">
                      Exchange
                    </Typography>
                    <Typography variant="body1">{bot.exchange?.name}</Typography>
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
        </>
      )}

      {activeTab === 'usage' && <BotUsageCharts botId={bot.id} />}

      {activeTab === 'trades' && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Recent Trades
          </Typography>
          <Divider sx={{ mb: 2 }} />
          {bot.trades?.edges && bot.trades.edges.length > 0 ? (
            <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
              <Table sx={{ minWidth: 650 }}>
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
                              trade.profitAbs && trade.profitAbs > 0
                                ? 'success.main'
                                : 'error.main',
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
          ) : (
            <Typography color="text.secondary" textAlign="center" py={4}>
              No trades yet. Start the bot to begin trading.
            </Typography>
          )}
        </Paper>
      )}

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Delete Confirmation Drawer */}
      <ConfirmDrawer
        open={deleteDrawerOpen}
        onClose={() => setDeleteDrawerOpen(false)}
        onConfirm={handleDelete}
        title="Delete Bot"
        message={`Are you sure you want to delete "${bot.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="error"
      />

      {/* FreqUI Drawer */}
      <FreqUIDrawer
        open={frequiDrawerOpen}
        onClose={() => setFrequiDrawerOpen(false)}
        botId={bot.id}
        botName={bot.name}
      />
    </Box>
  );
};

export default BotDetail;