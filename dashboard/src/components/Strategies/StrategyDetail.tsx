import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
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
  Card,
  CardContent,
  Collapse,
} from '@mui/material';
import {
  PlayArrow,
  Edit,
  Delete,
  ArrowBack,
  Code as CodeIcon,
  Assessment,
  History as HistoryIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useGetStrategyDetailQuery, useGetStrategyVersionsQuery } from './strategy-detail.generated';
import { CreateBacktestDialog } from '../Backtests/CreateBacktestDialog';
import { EditStrategyDialog } from './EditStrategyDialog';
import { DeleteStrategyDialog } from './DeleteStrategyDialog';

const StrategyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [backtestDialogOpen, setBacktestDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);

  const { data, loading, error, refetch } = useGetStrategyDetailQuery({
    variables: { id: id! },
    skip: !id,
  });

  const strategy = data?.strategies?.edges?.[0]?.node;

  const { data: versionsData, loading: versionsLoading } = useGetStrategyVersionsQuery({
    variables: { name: strategy?.name || '' },
    skip: !strategy?.name || !versionHistoryOpen,
  });

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
        <Alert severity="error">Error loading strategy: {error.message}</Alert>
      </Box>
    );
  }

  if (!strategy) {
    return (
      <Box p={3}>
        <Alert severity="warning">Strategy not found</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={() => navigate('/strategies')}>
          <ArrowBack />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
            <Typography variant="h4" fontWeight={600}>
              {strategy.name}
            </Typography>
            <Chip
              label={`v${strategy.versionNumber}`}
              size="medium"
              color="primary"
              variant="outlined"
            />
            {strategy.isLatest && (
              <Chip label="Latest" size="small" color="success" />
            )}
          </Box>
          {strategy.description && (
            <Typography variant="body2" color="text.secondary">
              {strategy.description}
            </Typography>
          )}
        </Box>
        {!strategy.backtest && (
          <Button
            variant="contained"
            startIcon={<PlayArrow />}
            onClick={() => setBacktestDialogOpen(true)}
          >
            Run Backtest
          </Button>
        )}
        <IconButton onClick={() => setEditDialogOpen(true)}>
          <Edit />
        </IconButton>
        <IconButton color="error" onClick={() => setDeleteDialogOpen(true)}>
          <Delete />
        </IconButton>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Top Section: Strategy Info and Code */}
        <Box sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3
        }}>
          {/* Strategy Info */}
          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 33%' } }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Strategy Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Version
                    </Typography>
                    <Typography variant="body2">{strategy.version || 'N/A'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Bots Using
                    </Typography>
                    <Typography variant="body2">{strategy.bots?.totalCount || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Backtest
                    </Typography>
                    <Typography variant="body2">{strategy.backtest ? 'Yes' : 'No'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Created
                    </Typography>
                    <Typography variant="body2">
                      {new Date(strategy.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Last Updated
                    </Typography>
                    <Typography variant="body2">
                      {new Date(strategy.updatedAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Strategy Code */}
          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 67%' } }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CodeIcon />
                  <Typography variant="h6">Strategy Code</Typography>
                </Box>
                <Box
                  component="pre"
                  sx={{
                    p: 2,
                    bgcolor: 'background.default',
                    borderRadius: 1,
                    overflow: 'auto',
                    maxHeight: 400,
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                  }}
                >
                  {strategy.code}
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* Backtest Results */}
        {strategy.backtest && (
          <Box>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Assessment />
                    <Typography variant="h6">Backtest Results</Typography>
                  </Box>
                  <Chip
                    label={strategy.backtest.status}
                    color={
                      strategy.backtest.status === 'completed' ? 'success' :
                      strategy.backtest.status === 'running' ? 'primary' :
                      strategy.backtest.status === 'failed' ? 'error' : 'default'
                    }
                    size="small"
                  />
                </Box>
                <Divider sx={{ mb: 2 }} />

                {strategy.backtest.summary ? (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 2 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Total Trades
                      </Typography>
                      <Typography variant="h6">{strategy.backtest.summary.totalTrades}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Win Rate
                      </Typography>
                      <Typography variant="h6" color={strategy.backtest.summary.winRate && strategy.backtest.summary.winRate > 0.5 ? 'success.main' : 'error.main'}>
                        {strategy.backtest.summary.winRate ? `${(strategy.backtest.summary.winRate * 100).toFixed(2)}%` : 'N/A'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Total Profit
                      </Typography>
                      <Typography variant="h6" color={strategy.backtest.summary.profitTotal && strategy.backtest.summary.profitTotal > 0 ? 'success.main' : 'error.main'}>
                        {strategy.backtest.summary.profitTotal ? `${strategy.backtest.summary.profitTotal.toFixed(2)}%` : 'N/A'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Max Drawdown
                      </Typography>
                      <Typography variant="h6" color="error.main">
                        {strategy.backtest.summary.maxDrawdown ? `${(strategy.backtest.summary.maxDrawdown * 100).toFixed(2)}%` : 'N/A'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Profit Factor
                      </Typography>
                      <Typography variant="body1">
                        {strategy.backtest.summary.profitFactor?.toFixed(2) || 'N/A'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Expectancy
                      </Typography>
                      <Typography variant="body1">
                        {strategy.backtest.summary.expectancy?.toFixed(2) || 'N/A'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Wins / Losses
                      </Typography>
                      <Typography variant="body1">
                        {strategy.backtest.summary.wins} / {strategy.backtest.summary.losses}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Created
                      </Typography>
                      <Typography variant="body1">
                        {new Date(strategy.backtest.createdAt).toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                ) : strategy.backtest.status === 'running' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <CircularProgress size={20} />
                    <Typography>Backtest is currently running...</Typography>
                  </Box>
                ) : strategy.backtest.status === 'failed' ? (
                  <Alert severity="error">
                    Backtest failed. Please try running it again.
                  </Alert>
                ) : (
                  <Alert severity="info">
                    Backtest is pending. Results will appear once processing is complete.
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Version History */}
        <Box>
          <Card>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: versionHistoryOpen ? 2 : 0,
                  cursor: 'pointer',
                }}
                onClick={() => setVersionHistoryOpen(!versionHistoryOpen)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HistoryIcon />
                  <Typography variant="h6">Version History</Typography>
                </Box>
                <IconButton size="small">
                  {versionHistoryOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
              <Collapse in={versionHistoryOpen}>
                {versionsLoading ? (
                  <Box display="flex" justifyContent="center" p={2}>
                    <CircularProgress size={24} />
                  </Box>
                ) : versionsData?.strategyVersions && versionsData.strategyVersions.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Version</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Bots</TableCell>
                          <TableCell>Backtest</TableCell>
                          <TableCell>Created</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {versionsData.strategyVersions
                          .slice()
                          .sort((a, b) => b.versionNumber - a.versionNumber)
                          .map((version) => (
                            <TableRow
                              key={version.id}
                              hover
                              selected={version.id === strategy.id}
                              sx={{
                                backgroundColor:
                                  version.id === strategy.id
                                    ? 'action.selected'
                                    : undefined,
                              }}
                            >
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Chip
                                    label={`v${version.versionNumber}`}
                                    size="small"
                                    color="primary"
                                    variant={version.id === strategy.id ? 'filled' : 'outlined'}
                                  />
                                  {version.isLatest && (
                                    <Chip label="Latest" size="small" color="success" />
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" color="text.secondary">
                                  {version.version || 'N/A'}
                                </Typography>
                              </TableCell>
                              <TableCell>{version.bots?.totalCount || 0}</TableCell>
                              <TableCell>
                                <Chip
                                  label={version.backtest ? 'Yes' : 'No'}
                                  size="small"
                                  color={version.backtest ? 'success' : 'default'}
                                  variant="outlined"
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(version.createdAt).toLocaleDateString()}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                {version.id !== strategy.id && (
                                  <Tooltip title="View Version">
                                    <IconButton
                                      size="small"
                                      onClick={() => navigate(`/strategies/${version.id}`)}
                                    >
                                      <Assessment fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Alert severity="info">No other versions available.</Alert>
                )}
              </Collapse>
            </CardContent>
          </Card>
        </Box>

      </Box>

      {/* Dialogs */}
      <CreateBacktestDialog
        open={backtestDialogOpen}
        onClose={() => setBacktestDialogOpen(false)}
        onSuccess={() => {
          setBacktestDialogOpen(false);
          refetch();
        }}
        preSelectedStrategyId={strategy.id}
      />

      <EditStrategyDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onSuccess={(newStrategyId) => {
          setEditDialogOpen(false);
          // Navigate to the new strategy version page
          navigate(`/strategies/${newStrategyId}`);
        }}
        strategy={strategy}
      />

      <DeleteStrategyDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onSuccess={() => {
          setDeleteDialogOpen(false);
          navigate('/strategies');
        }}
        strategy={strategy}
      />
    </Box>
  );
};

export default StrategyDetail;