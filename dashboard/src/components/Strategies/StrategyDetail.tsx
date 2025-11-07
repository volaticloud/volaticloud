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

  const backtests = strategy.backtests?.edges?.map(edge => edge?.node).filter(Boolean) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'running':
        return 'primary';
      case 'failed':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

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
        <Button
          variant="contained"
          startIcon={<PlayArrow />}
          onClick={() => setBacktestDialogOpen(true)}
        >
          Quick Backtest
        </Button>
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
                      Total Backtests
                    </Typography>
                    <Typography variant="body2">{strategy.backtests?.totalCount || 0}</Typography>
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
                          <TableCell>Backtests</TableCell>
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
                              <TableCell>{version.backtests?.totalCount || 0}</TableCell>
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

        {/* Backtests List */}
        <Box>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Assessment />
                <Typography variant="h6">Backtests ({backtests.length})</Typography>
              </Box>
              {backtests.length === 0 ? (
                <Alert severity="info">
                  No backtests yet. Click "Quick Backtest" to create your first backtest for this strategy.
                </Alert>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Status</TableCell>
                        <TableCell>Runner</TableCell>
                        <TableCell>Total Trades</TableCell>
                        <TableCell>Win Rate</TableCell>
                        <TableCell>Profit</TableCell>
                        <TableCell>Max Drawdown</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {backtests.map((backtest) => (
                        <TableRow key={backtest.id} hover>
                          <TableCell>
                            <Chip
                              label={backtest.status}
                              color={getStatusColor(backtest.status) as any}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {backtest.runner?.name || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {backtest.summary?.totalTrades || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {backtest.summary?.winRate
                              ? `${(backtest.summary.winRate * 100).toFixed(2)}%`
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {backtest.summary?.profitTotal
                              ? `${backtest.summary.profitTotal.toFixed(2)}%`
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {backtest.summary?.maxDrawdown
                              ? `${(backtest.summary.maxDrawdown * 100).toFixed(2)}%`
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(backtest.createdAt).toLocaleDateString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/backtests/${backtest.id}`)}
                              >
                                <Assessment fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
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
        onSuccess={() => {
          setEditDialogOpen(false);
          refetch();
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