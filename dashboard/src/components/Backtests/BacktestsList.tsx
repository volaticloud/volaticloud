import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as RunIcon,
  Stop as StopIcon,
  Assessment as ResultsIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetBacktestsQuery, useRunBacktestMutation, useStopBacktestMutation } from './backtests.generated';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ErrorAlert } from '../shared/ErrorAlert';
import { CreateBacktestDialog } from './CreateBacktestDialog';
import { DeleteBacktestDialog } from './DeleteBacktestDialog';

export const BacktestsList = () => {
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBacktest, setSelectedBacktest] = useState<{
    id: string;
    strategy: { id: string; name: string };
    runner: { id: string; name: string };
  } | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'error' | 'success';
  }>({ open: false, message: '', severity: 'error' });

  // Use generated Apollo hooks
  const { data, loading, error, refetch } = useGetBacktestsQuery({
    variables: { first: 50 }
  });

  // Mutations with refetch on completion
  const [runBacktest] = useRunBacktestMutation({
    onCompleted: () => refetch()
  });

  const [stopBacktest] = useStopBacktestMutation({
    onCompleted: () => refetch()
  });

  const handleRunBacktest = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent row click
    try {
      const result = await runBacktest({ variables: { id } });

      // Check for GraphQL errors (errorPolicy: 'all' means errors don't throw)
      if (result.errors || !result.data?.runBacktest) {
        const errorMsg = result.errors?.[0]?.message || 'Failed to run backtest';
        setSnackbar({
          open: true,
          message: errorMsg,
          severity: 'error',
        });
      } else {
        setSnackbar({
          open: true,
          message: 'Backtest started successfully',
          severity: 'success',
        });
      }
    } catch (err) {
      // Catch network errors
      console.error('Failed to run backtest:', err);
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to run backtest',
        severity: 'error',
      });
    }
  };

  const handleStopBacktest = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent row click
    try {
      const result = await stopBacktest({ variables: { id } });

      // Check for GraphQL errors (errorPolicy: 'all' means errors don't throw)
      if (result.errors || !result.data?.stopBacktest) {
        const errorMsg = result.errors?.[0]?.message || 'Failed to stop backtest';
        setSnackbar({
          open: true,
          message: errorMsg,
          severity: 'error',
        });
      } else {
        setSnackbar({
          open: true,
          message: 'Backtest stopped successfully',
          severity: 'success',
        });
      }
    } catch (err) {
      // Catch network errors
      console.error('Failed to stop backtest:', err);
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to stop backtest',
        severity: 'error',
      });
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
        return 'info';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'pending':
        return 'default';
      default:
        return 'warning';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getConfigSummary = (config: any) => {
    if (!config) return 'No config';
    const pairs = config.pairs?.length || 0;
    const timeframe = config.timeframe || 'N/A';
    return `${pairs} pairs, ${timeframe}`;
  };

  if (loading) return <LoadingSpinner message="Loading backtests..." />;
  if (error) return <ErrorAlert error={error} />;

  const backtests = (data?.backtests?.edges
    ?.map(edge => edge?.node)
    .filter((node): node is NonNullable<typeof node> => node !== null && node !== undefined) || []);

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: 2,
        mb: 3
      }}>
        <Box>
          <Typography variant="h4" gutterBottom fontWeight={600}>
            Backtests
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {data?.backtests?.totalCount || 0} total backtests
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{ flexShrink: 0 }}
        >
          Create Backtest
        </Button>
      </Box>

      {backtests.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              No backtests yet. Create your first backtest to get started.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Paper sx={{ width: '100%', mb: 2 }}>
          <TableContainer>
            <Table sx={{ minWidth: 750 }}>
            <TableHead>
              <TableRow>
                <TableCell>Strategy</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Configuration</TableCell>
                <TableCell>Runner</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Completed</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {backtests.map((backtest) => (
                <TableRow
                  key={backtest.id}
                  hover
                  onClick={() => navigate(`/backtests/${backtest.id}`)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {backtest.strategy.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={backtest.status}
                      color={getStatusColor(backtest.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {getConfigSummary(backtest.config)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {backtest.runner.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {backtest.runner.type}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(backtest.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {backtest.completedAt ? formatDate(backtest.completedAt) : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Run">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={(e) => handleRunBacktest(e, backtest.id)}
                        disabled={backtest.status === 'running'}
                      >
                        <RunIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Stop">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => handleStopBacktest(e, backtest.id)}
                        disabled={backtest.status !== 'running'}
                      >
                        <StopIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View Results">
                      <IconButton
                        size="small"
                        color="info"
                        disabled={!backtest.result || backtest.status !== 'completed'}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/backtests/${backtest.id}`);
                        }}
                      >
                        <ResultsIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBacktest(backtest);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        </Paper>
      )}

      <CreateBacktestDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={() => refetch()}
      />

      {selectedBacktest && (
        <DeleteBacktestDialog
          open={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false);
            setSelectedBacktest(null);
          }}
          onSuccess={() => {
            refetch();
            setSelectedBacktest(null);
          }}
          backtest={selectedBacktest}
        />
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};