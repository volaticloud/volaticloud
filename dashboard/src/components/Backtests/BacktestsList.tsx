import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
} from '@mui/material';
import { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  PlayArrow as RunIcon,
  Stop as StopIcon,
  Assessment as ResultsIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { useGetBacktestsQuery, useRunBacktestMutation, useStopBacktestMutation, GetBacktestsQuery } from './backtests.generated';
import { CreateBacktestDialog } from './CreateBacktestDialog';
import { DeleteBacktestDialog } from './DeleteBacktestDialog';
import { PaginatedDataGrid } from '../shared/PaginatedDataGrid';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { useActiveGroup, useGroupNavigate } from '../../contexts/GroupContext';

// Extract Backtest type from generated query
type Backtest = NonNullable<NonNullable<NonNullable<GetBacktestsQuery['backtests']['edges']>[number]>['node']>;

export const BacktestsList = () => {
  const navigate = useGroupNavigate();
  const { activeGroupId } = useActiveGroup();
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

  // Pagination hook
  const pagination = useCursorPagination<Backtest>({ initialPageSize: 10 });
  const { setLoading, updateFromResponse, reset } = pagination;

  const { data, loading, refetch } = useGetBacktestsQuery({
    variables: {
      first: pagination.pageSize,
      after: pagination.cursor,
      where: activeGroupId ? {
        hasStrategyWith: [{ ownerID: activeGroupId }]
      } : undefined
    },
    skip: !activeGroupId,
  });

  // Sync pagination state with query results
  useEffect(() => {
    setLoading(loading);
    if (data?.backtests) {
      updateFromResponse(data.backtests);
    }
  }, [data, loading, setLoading, updateFromResponse]);

  // Reset pagination when activeGroupId changes
  useEffect(() => {
    reset();
  }, [activeGroupId, reset]);

  // Mutations
  const [runBacktest] = useRunBacktestMutation({ onCompleted: () => refetch() });
  const [stopBacktest] = useStopBacktestMutation({ onCompleted: () => refetch() });

  const handleRunBacktest = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const result = await runBacktest({ variables: { id } });
      if (result.errors || !result.data?.runBacktest) {
        setSnackbar({
          open: true,
          message: result.errors?.[0]?.message || 'Failed to run backtest',
          severity: 'error',
        });
      } else {
        setSnackbar({ open: true, message: 'Backtest started successfully', severity: 'success' });
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to run backtest',
        severity: 'error',
      });
    }
  };

  const handleStopBacktest = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const result = await stopBacktest({ variables: { id } });
      if (result.errors || !result.data?.stopBacktest) {
        setSnackbar({
          open: true,
          message: result.errors?.[0]?.message || 'Failed to stop backtest',
          severity: 'error',
        });
      } else {
        setSnackbar({ open: true, message: 'Backtest stopped successfully', severity: 'success' });
      }
    } catch (err) {
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
      case 'running': return 'info';
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'pending': return 'default';
      default: return 'warning';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getConfigSummary = (config: Record<string, unknown> | null | undefined) => {
    if (!config) return 'No config';
    const pairs = (config.pairs as unknown[])?.length || 0;
    const timeframe = config.timeframe || 'N/A';
    return `${pairs} pairs, ${timeframe}`;
  };

  // Define columns for the DataGrid
  const columns: GridColDef<Backtest>[] = [
    {
      field: 'strategy',
      headerName: 'Strategy',
      flex: 1,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams<Backtest>) => (
        <Typography variant="body2" fontWeight={500}>
          {params.row.strategy.name}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      renderCell: (params: GridRenderCellParams<Backtest>) => (
        <Chip
          label={params.row.status}
          color={getStatusColor(params.row.status)}
          size="small"
        />
      ),
    },
    {
      field: 'config',
      headerName: 'Configuration',
      width: 150,
      renderCell: (params: GridRenderCellParams<Backtest>) => (
        <Typography variant="body2">
          {getConfigSummary(params.row.strategy.config)}
        </Typography>
      ),
    },
    {
      field: 'runner',
      headerName: 'Runner',
      width: 140,
      renderCell: (params: GridRenderCellParams<Backtest>) => (
        <Tooltip title={`Type: ${params.row.runner.type}`}>
          <Typography variant="body2">{params.row.runner.name}</Typography>
        </Tooltip>
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 160,
      renderCell: (params: GridRenderCellParams<Backtest>) => (
        <Typography variant="caption" color="text.secondary">
          {formatDate(params.row.createdAt)}
        </Typography>
      ),
    },
    {
      field: 'completedAt',
      headerName: 'Completed',
      width: 160,
      renderCell: (params: GridRenderCellParams<Backtest>) => (
        <Typography variant="caption" color="text.secondary">
          {params.row.completedAt ? formatDate(params.row.completedAt) : '-'}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 160,
      sortable: false,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams<Backtest>) => (
        <Box onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Run">
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => handleRunBacktest(e, params.row.id)}
              disabled={params.row.status === 'running'}
            >
              <RunIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Stop">
            <IconButton
              size="small"
              color="error"
              onClick={(e) => handleStopBacktest(e, params.row.id)}
              disabled={params.row.status !== 'running'}
            >
              <StopIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="View Results">
            <IconButton
              size="small"
              color="info"
              disabled={!params.row.result || params.row.status !== 'completed'}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/backtests/${params.row.id}`);
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
                setSelectedBacktest(params.row);
                setDeleteDialogOpen(true);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

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
            {pagination.totalCount || 0} total backtests
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

      <PaginatedDataGrid<Backtest>
        columns={columns}
        pagination={pagination}
        emptyMessage="No backtests yet. Create your first backtest to get started."
        onRowClick={(row) => navigate(`/backtests/${row.id}`)}
      />

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