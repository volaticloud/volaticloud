import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Refresh as RestartIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Public as PublicIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { useGetBotsQuery, useStartBotMutation, useStopBotMutation, useRestartBotMutation, useSetBotVisibilityMutation, GetBotsQuery } from './bots.generated';
import { useActiveGroup, useGroupNavigate } from '../../contexts/GroupContext';
import { CreateBotDialog } from './CreateBotDialog';
import { EditBotDialog } from './EditBotDialog';
import { DeleteBotDialog } from './DeleteBotDialog';
import { VisibilityToggleDialog } from '../shared/VisibilityToggleDialog';
import { PaginatedDataGrid } from '../shared/PaginatedDataGrid';
import { useCursorPagination } from '../../hooks/useCursorPagination';

type ViewMode = 'mine' | 'public';

// Extract Bot type from generated query
type Bot = NonNullable<NonNullable<NonNullable<GetBotsQuery['bots']['edges']>[number]>['node']>;

export const BotsList = () => {
  const navigate = useGroupNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('mine');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [visibilityDialogOpen, setVisibilityDialogOpen] = useState(false);
  const [selectedBot, setSelectedBot] = useState<{
    id: string;
    name: string;
    mode: string;
    public?: boolean;
    exchange: { id: string; name: string };
    strategy: { id: string; name: string };
    runner: { id: string; name: string };
  } | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'error' | 'success';
  }>({ open: false, message: '', severity: 'error' });

  const { activeGroupId } = useActiveGroup();

  // Pagination hook
  const pagination = useCursorPagination<Bot>({ initialPageSize: 10 });
  const { setLoading, updateFromResponse, reset } = pagination;

  const { data, loading, refetch } = useGetBotsQuery({
    variables: {
      first: pagination.pageSize,
      after: pagination.cursor,
      where: {
        ...(viewMode === 'mine'
          ? { ownerID: activeGroupId || undefined }
          : { public: true })
      }
    },
    pollInterval: 30000,
    skip: viewMode === 'mine' && !activeGroupId,
  });

  // Sync pagination state with query results
  useEffect(() => {
    setLoading(loading);
    if (data?.bots) {
      updateFromResponse(data.bots);
    }
  }, [data, loading, setLoading, updateFromResponse]);

  // Reset pagination when view mode changes
  useEffect(() => {
    reset();
  }, [viewMode, activeGroupId, reset]);

  // Mutations
  const [startBot] = useStartBotMutation({ onCompleted: () => refetch() });
  const [stopBot] = useStopBotMutation({ onCompleted: () => refetch() });
  const [restartBot] = useRestartBotMutation({ onCompleted: () => refetch() });
  const [setBotVisibility, { loading: visibilityLoading }] = useSetBotVisibilityMutation();

  const handleStartBot = async (id: string) => {
    try {
      const result = await startBot({ variables: { id } });
      if (result.errors || !result.data?.startBot) {
        setSnackbar({
          open: true,
          message: result.errors?.[0]?.message || 'Failed to start bot',
          severity: 'error',
        });
      } else {
        setSnackbar({ open: true, message: 'Bot started successfully', severity: 'success' });
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to start bot',
        severity: 'error',
      });
    }
  };

  const handleStopBot = async (id: string) => {
    try {
      const result = await stopBot({ variables: { id } });
      if (result.errors || !result.data?.stopBot) {
        setSnackbar({
          open: true,
          message: result.errors?.[0]?.message || 'Failed to stop bot',
          severity: 'error',
        });
      } else {
        setSnackbar({ open: true, message: 'Bot stopped successfully', severity: 'success' });
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to stop bot',
        severity: 'error',
      });
    }
  };

  const handleRestartBot = async (id: string) => {
    try {
      const result = await restartBot({ variables: { id } });
      if (result.errors || !result.data?.restartBot) {
        setSnackbar({
          open: true,
          message: result.errors?.[0]?.message || 'Failed to restart bot',
          severity: 'error',
        });
      } else {
        setSnackbar({ open: true, message: 'Bot restarted successfully', severity: 'success' });
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to restart bot',
        severity: 'error',
      });
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'success';
      case 'unhealthy': return 'warning';
      case 'stopped': return 'default';
      case 'creating': return 'info';
      case 'error': return 'error';
      case 'backtesting':
      case 'hyperopt': return 'info';
      default: return 'default';
    }
  };

  const canStart = (status: string) => status === 'stopped' || status === 'error';
  const canStopOrRestart = (status: string) => status === 'running' || status === 'unhealthy';

  // Define columns for the DataGrid
  const columns: GridColDef<Bot>[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams<Bot>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontWeight={500}>
            {params.row.name}
          </Typography>
          {params.row.public && (
            <Chip
              icon={<PublicIcon />}
              label="Public"
              size="small"
              color="info"
              variant="outlined"
            />
          )}
        </Box>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      renderCell: (params: GridRenderCellParams<Bot>) => (
        <Chip
          label={params.row.status}
          color={getStatusColor(params.row.status)}
          size="small"
        />
      ),
    },
    {
      field: 'mode',
      headerName: 'Mode',
      width: 100,
      renderCell: (params: GridRenderCellParams<Bot>) => (
        <Chip label={params.row.mode} variant="outlined" size="small" />
      ),
    },
    {
      field: 'exchange',
      headerName: 'Exchange',
      width: 120,
      valueGetter: (_, row) => row.exchange.name,
    },
    {
      field: 'strategy',
      headerName: 'Strategy',
      width: 120,
      valueGetter: (_, row) => row.strategy.name,
    },
    {
      field: 'runner',
      headerName: 'Runner',
      width: 140,
      renderCell: (params: GridRenderCellParams<Bot>) => (
        <Tooltip title={`Type: ${params.row.runner.type}`}>
          <Typography variant="body2">{params.row.runner.name}</Typography>
        </Tooltip>
      ),
    },
    {
      field: 'freqtradeVersion',
      headerName: 'Version',
      width: 80,
      renderCell: (params: GridRenderCellParams<Bot>) => (
        <Typography variant="caption" color="text.secondary">
          {params.row.freqtradeVersion}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 220,
      sortable: false,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams<Bot>) => (
        <Box onClick={(e) => e.stopPropagation()}>
          {viewMode === 'mine' && (
            <>
              <Tooltip title="Start">
                <IconButton
                  size="small"
                  color="success"
                  onClick={() => handleStartBot(params.row.id)}
                  disabled={!canStart(params.row.status)}
                >
                  <StartIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Stop">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleStopBot(params.row.id)}
                  disabled={!canStopOrRestart(params.row.status)}
                >
                  <StopIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Restart">
                <IconButton
                  size="small"
                  color="warning"
                  onClick={() => handleRestartBot(params.row.id)}
                  disabled={!canStopOrRestart(params.row.status)}
                >
                  <RestartIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={params.row.public ? 'Make Private' : 'Make Public'}>
                <IconButton
                  size="small"
                  color={params.row.public ? 'info' : 'default'}
                  onClick={() => {
                    setSelectedBot(params.row);
                    setVisibilityDialogOpen(true);
                  }}
                >
                  {params.row.public ? <PublicIcon fontSize="small" /> : <LockIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit">
                <IconButton
                  size="small"
                  onClick={() => {
                    setSelectedBot(params.row);
                    setEditDialogOpen(true);
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => {
                    setSelectedBot(params.row);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
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
            Bots
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {pagination.totalCount || 0} total bots
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="mine">
              <LockIcon sx={{ mr: 0.5 }} fontSize="small" />
              My Bots
            </ToggleButton>
            <ToggleButton value="public">
              <PublicIcon sx={{ mr: 0.5 }} fontSize="small" />
              Public
            </ToggleButton>
          </ToggleButtonGroup>
          {viewMode === 'mine' && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
              sx={{ flexShrink: 0 }}
            >
              Create Bot
            </Button>
          )}
        </Box>
      </Box>

      <PaginatedDataGrid<Bot>
        columns={columns}
        pagination={pagination}
        emptyMessage="No bots yet. Create your first bot to get started."
        onRowClick={(row) => navigate(`/bots/${row.id}`)}
        isPolling={!pagination.loading && data !== undefined}
      />

      <CreateBotDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={() => refetch()}
      />

      {selectedBot && (
        <>
          <EditBotDialog
            open={editDialogOpen}
            onClose={() => {
              setEditDialogOpen(false);
              setSelectedBot(null);
            }}
            onSuccess={() => {
              refetch();
              setSelectedBot(null);
            }}
            bot={selectedBot}
          />

          <DeleteBotDialog
            open={deleteDialogOpen}
            onClose={() => {
              setDeleteDialogOpen(false);
              setSelectedBot(null);
            }}
            onSuccess={() => {
              refetch();
              setSelectedBot(null);
            }}
            bot={selectedBot}
          />

          <VisibilityToggleDialog
            open={visibilityDialogOpen}
            onClose={() => {
              setVisibilityDialogOpen(false);
              setSelectedBot(null);
            }}
            onConfirm={async () => {
              const result = await setBotVisibility({
                variables: {
                  id: selectedBot.id,
                  public: !selectedBot.public,
                },
              });
              if (result.errors) {
                throw new Error(result.errors[0]?.message || 'Failed to update visibility');
              }
              refetch();
              setSnackbar({
                open: true,
                message: `Bot is now ${selectedBot.public ? 'private' : 'public'}`,
                severity: 'success',
              });
            }}
            resourceType="bot"
            resourceName={selectedBot.name}
            currentlyPublic={selectedBot.public || false}
            loading={visibilityLoading}
          />
        </>
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