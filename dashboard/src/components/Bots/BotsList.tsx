import {
  Box,
  Typography,
  Button,
  Chip,
  Tooltip,
  Snackbar,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Public as PublicIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { useGetBotsQuery, GetBotsQuery } from './bots.generated';
import { useActiveGroup, useGroupNavigate } from '../../contexts/GroupContext';
import { CreateBotDialog } from './CreateBotDialog';
import { EditBotDialog } from './EditBotDialog';
import BotActionsMenu from './BotActionsMenu';
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
  const [selectedBot, setSelectedBot] = useState<{
    id: string;
    name: string;
    mode: string;
    status: string;
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
      width: 130,
      sortable: false,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams<Bot>) => (
        viewMode === 'mine' ? (
          <BotActionsMenu
            botId={params.row.id}
            botName={params.row.name}
            botStatus={params.row.status}
            isPublic={params.row.public}
            compact
            showEdit
            showVisibility
            refetch={refetch}
            onSuccess={(message) => setSnackbar({ open: true, message, severity: 'success' })}
            onError={(message) => setSnackbar({ open: true, message, severity: 'error' })}
            onEdit={() => {
              setSelectedBot(params.row);
              setEditDialogOpen(true);
            }}
          />
        ) : null
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