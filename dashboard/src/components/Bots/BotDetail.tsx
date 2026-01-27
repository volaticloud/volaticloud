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
import { ArrowBack, Dashboard, DataUsage, SwapHoriz } from '@mui/icons-material';
import { useState, SyntheticEvent, useEffect } from 'react';
import { useGetBotQuery, useBotStatusChangedSubscription } from './bots.generated';
import BotMetrics from './BotMetrics';
import BotUsageCharts from './BotUsageCharts';
import BotActionsMenu from './BotActionsMenu';
import { useOrganizationNavigate } from '../../contexts/OrganizationContext';
import { useDocumentTitle } from '../../hooks';

type TabValue = 'overview' | 'usage' | 'trades';

const VALID_TABS: TabValue[] = ['overview', 'usage', 'trades'];

const BotDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useOrganizationNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

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
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={() => navigate('/bots')}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4">{bot.name}</Typography>
          <Chip label={bot.status} color={getStatusColor(bot.status)} />
          <Chip label={bot.mode} color={getModeColor(bot.mode)} />
        </Box>

        <BotActionsMenu
          botId={bot.id}
          botName={bot.name}
          botStatus={bot.status}
          showFreqUI
          refetch={refetch}
          onSuccess={(message) => setSnackbar({ open: true, message, severity: 'success' })}
          onError={(message) => setSnackbar({ open: true, message, severity: 'error' })}
          onDeleteSuccess={() => navigate('/bots')}
        />
      </Box>

      {/* Error Message */}
      {bot.errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {bot.errorMessage}
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab icon={<Dashboard />} iconPosition="start" label="Overview" value="overview" />
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
    </Box>
  );
};

export default BotDetail;