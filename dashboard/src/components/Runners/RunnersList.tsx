import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Snackbar,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  CloudDownload as CloudDownloadIcon,
  Public as PublicIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { useGetRunnersQuery, useGetRunnerWithSecretsLazyQuery, useRefreshRunnerDataMutation, useSetRunnerVisibilityMutation, GetRunnersQuery } from './runners.generated';
import { CreateRunnerDialog } from './CreateRunnerDialog';
import { EditRunnerDialog } from './EditRunnerDialog';
import { DeleteRunnerDialog } from './DeleteRunnerDialog';
import { VisibilityToggleDialog } from '../shared/VisibilityToggleDialog';
import { PaginatedDataGrid } from '../shared/PaginatedDataGrid';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { useActiveGroup } from '../../contexts/GroupContext';

type ViewMode = 'mine' | 'public';

// Extract Runner type from generated query
type Runner = NonNullable<NonNullable<NonNullable<GetRunnersQuery['botRunners']['edges']>[number]>['node']>;

export const RunnersList = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('mine');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [visibilityDialogOpen, setVisibilityDialogOpen] = useState(false);
  const [selectedRunner, setSelectedRunner] = useState<Runner | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'error' | 'success';
  }>({ open: false, message: '', severity: 'error' });

  const { activeGroupId } = useActiveGroup();

  // Pagination hook
  const pagination = useCursorPagination<Runner>({ initialPageSize: 10 });
  const { setLoading, updateFromResponse, reset } = pagination;

  const { data, loading, refetch } = useGetRunnersQuery({
    variables: {
      first: pagination.pageSize,
      after: pagination.cursor,
      where: {
        ...(viewMode === 'mine'
          ? { ownerID: activeGroupId || undefined }
          : { public: true })
      }
    },
    pollInterval: 10000,
    fetchPolicy: 'network-only',
    skip: viewMode === 'mine' && !activeGroupId,
  });

  // Sync pagination state with query results
  useEffect(() => {
    setLoading(loading);
    if (data?.botRunners) {
      updateFromResponse(data.botRunners);
    }
  }, [data, loading, setLoading, updateFromResponse]);

  // Reset pagination when view mode changes
  useEffect(() => {
    reset();
  }, [viewMode, activeGroupId, reset]);

  const [refreshRunnerData] = useRefreshRunnerDataMutation();
  const [setRunnerVisibility, { loading: visibilityLoading }] = useSetRunnerVisibilityMutation();
  const [getRunnerWithSecrets] = useGetRunnerWithSecretsLazyQuery();

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleRefreshData = async (id: string, name: string) => {
    try {
      await refreshRunnerData({ variables: { id } });
      refetch();
    } catch (err) {
      console.error(`Failed to refresh data for runner ${name}:`, err);
    }
  };

  const renderDataStatus = (runner: Runner) => {
    const status = runner.dataDownloadStatus;
    const progress = runner.dataDownloadProgress as { percent_complete?: number; current_pair?: string; pairs_completed?: number; pairs_total?: number } | null;
    const isReady = runner.dataIsReady;
    const lastUpdated = runner.dataLastUpdated;
    const errorMsg = runner.dataErrorMessage;

    if (status === 'downloading') {
      const percentComplete = progress?.percent_complete || 0;
      return (
        <Box sx={{ width: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <CloudDownloadIcon fontSize="small" color="primary" />
            <Typography variant="caption">
              Downloading... {Math.round(percentComplete)}%
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={percentComplete} />
          {progress?.current_pair && (
            <Typography variant="caption" color="text.secondary">
              {progress.current_pair} ({progress.pairs_completed}/{progress.pairs_total})
            </Typography>
          )}
        </Box>
      );
    }

    if (status === 'failed') {
      return (
        <Tooltip title={errorMsg || 'Download failed'}>
          <Chip icon={<ErrorIcon />} label="Failed" color="error" size="small" />
        </Tooltip>
      );
    }

    if (isReady && status === 'completed') {
      return (
        <Tooltip title={lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleDateString()}` : ''}>
          <Chip icon={<CheckCircleIcon />} label="Ready" color="success" size="small" />
        </Tooltip>
      );
    }

    return <Chip label="No Data" color="default" size="small" variant="outlined" />;
  };

  // Define columns for the DataGrid
  const columns: GridColDef<Runner>[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams<Runner>) => (
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
      field: 'type',
      headerName: 'Type',
      width: 100,
      renderCell: (params: GridRenderCellParams<Runner>) => (
        <Chip label={params.row.type} variant="outlined" size="small" />
      ),
    },
    {
      field: 'dataStatus',
      headerName: 'Data Status',
      width: 200,
      renderCell: (params: GridRenderCellParams<Runner>) => renderDataStatus(params.row),
    },
    {
      field: 'bots',
      headerName: 'Bots',
      width: 80,
      renderCell: (params: GridRenderCellParams<Runner>) => params.row.bots?.totalCount || 0,
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 120,
      renderCell: (params: GridRenderCellParams<Runner>) => (
        <Typography variant="caption" color="text.secondary">
          {new Date(params.row.createdAt).toLocaleDateString()}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 180,
      sortable: false,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams<Runner>) => (
        <Box onClick={(e) => e.stopPropagation()}>
          {viewMode === 'mine' && (
            <>
              <Tooltip title="Refresh Data">
                <IconButton
                  size="small"
                  color="primary"
                  disabled={params.row.dataDownloadStatus === 'downloading'}
                  onClick={() => handleRefreshData(params.row.id, params.row.name)}
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={params.row.public ? 'Make Private' : 'Make Public'}>
                <IconButton
                  size="small"
                  color={params.row.public ? 'info' : 'default'}
                  onClick={() => {
                    setSelectedRunner(params.row);
                    setVisibilityDialogOpen(true);
                  }}
                >
                  {params.row.public ? <PublicIcon fontSize="small" /> : <LockIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit Runner">
                <IconButton
                  size="small"
                  onClick={async () => {
                    const result = await getRunnerWithSecrets({ variables: { id: params.row.id } });
                    const runnerData = result.data?.botRunners?.edges?.[0]?.node;
                    if (runnerData) {
                      setSelectedRunner(runnerData as Runner);
                      setEditDialogOpen(true);
                    }
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete Runner">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => {
                    setSelectedRunner(params.row);
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
            Runners
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {pagination.totalCount || 0} total runners
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
              My Runners
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
              Create Runner
            </Button>
          )}
        </Box>
      </Box>

      <PaginatedDataGrid<Runner>
        columns={columns}
        pagination={pagination}
        emptyMessage="No runners yet. Create your first runner to get started."
        isPolling={!pagination.loading && data !== undefined}
      />

      <CreateRunnerDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={() => refetch()}
      />

      {selectedRunner && (
        <>
          <EditRunnerDialog
            open={editDialogOpen}
            onClose={() => {
              setEditDialogOpen(false);
              setSelectedRunner(null);
            }}
            onSuccess={() => {
              refetch();
              setSelectedRunner(null);
            }}
            runner={selectedRunner}
          />

          <DeleteRunnerDialog
            open={deleteDialogOpen}
            onClose={() => {
              setDeleteDialogOpen(false);
              setSelectedRunner(null);
            }}
            onSuccess={() => {
              refetch();
              setSelectedRunner(null);
            }}
            runner={selectedRunner}
          />

          <VisibilityToggleDialog
            open={visibilityDialogOpen}
            onClose={() => {
              setVisibilityDialogOpen(false);
              setSelectedRunner(null);
            }}
            onConfirm={async () => {
              const result = await setRunnerVisibility({
                variables: {
                  id: selectedRunner.id,
                  public: !selectedRunner.public,
                },
              });
              if (result.errors) {
                throw new Error(result.errors[0]?.message || 'Failed to update visibility');
              }
              refetch();
              setSnackbar({
                open: true,
                message: `Runner is now ${selectedRunner.public ? 'private' : 'public'}`,
                severity: 'success',
              });
            }}
            resourceType="runner"
            resourceName={selectedRunner.name}
            currentlyPublic={selectedRunner.public || false}
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