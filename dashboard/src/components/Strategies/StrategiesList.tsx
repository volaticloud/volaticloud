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
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  Public as PublicIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { useGetStrategiesQuery, useSetStrategyVisibilityMutation, GetStrategiesQuery } from './strategies.generated';
import { CreateStrategyDialog } from './CreateStrategyDialog';
import { EditStrategyDialog } from './EditStrategyDialog';
import { DeleteStrategyDialog } from './DeleteStrategyDialog';
import { CreateBacktestDialog } from '../Backtests/CreateBacktestDialog';
import { VisibilityToggleDialog } from '../shared/VisibilityToggleDialog';
import { PaginatedDataGrid } from '../shared/PaginatedDataGrid';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { useActiveGroup, useGroupNavigate } from '../../contexts/GroupContext';

type ViewMode = 'mine' | 'public';

// Extract Strategy type from generated query
type Strategy = NonNullable<NonNullable<NonNullable<GetStrategiesQuery['strategies']['edges']>[number]>['node']>;

export const StrategiesList = () => {
  const navigate = useGroupNavigate();
  const { activeGroupId } = useActiveGroup();
  const [viewMode, setViewMode] = useState<ViewMode>('mine');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [backtestDialogOpen, setBacktestDialogOpen] = useState(false);
  const [visibilityDialogOpen, setVisibilityDialogOpen] = useState(false);
  const [selectedStrategyForBacktest, setSelectedStrategyForBacktest] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<{
    id: string;
    name: string;
    description?: string | null;
    code: string;
    versionNumber: number;
    public?: boolean;
  } | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'error' | 'success';
  }>({ open: false, message: '', severity: 'error' });

  // Pagination hook
  const pagination = useCursorPagination<Strategy>({ initialPageSize: 10 });
  const { setLoading, updateFromResponse, reset } = pagination;

  const [setStrategyVisibility, { loading: visibilityLoading }] = useSetStrategyVisibilityMutation();

  const { data, loading, refetch } = useGetStrategiesQuery({
    variables: {
      first: pagination.pageSize,
      after: pagination.cursor,
      where: {
        isLatest: true,
        ...(viewMode === 'mine'
          ? { ownerID: activeGroupId || undefined }
          : { public: true })
      }
    },
    skip: viewMode === 'mine' && !activeGroupId,
  });

  // Sync pagination state with query results
  useEffect(() => {
    setLoading(loading);
    if (data?.strategies) {
      updateFromResponse(data.strategies);
    }
  }, [data, loading, setLoading, updateFromResponse]);

  // Reset pagination when view mode changes
  useEffect(() => {
    reset();
  }, [viewMode, activeGroupId, reset]);

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // Define columns for the DataGrid
  const columns: GridColDef<Strategy>[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams<Strategy>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontWeight={500}>
            {params.row.name}
          </Typography>
          <Chip
            label={`v${params.row.versionNumber}`}
            size="small"
            color="primary"
            variant="outlined"
          />
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
      field: 'description',
      headerName: 'Description',
      flex: 1,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams<Strategy>) => (
        <Typography variant="body2" color="text.secondary">
          {params.row.description || '-'}
        </Typography>
      ),
    },
    {
      field: 'bots',
      headerName: 'Bots',
      width: 80,
      renderCell: (params: GridRenderCellParams<Strategy>) => params.row.bots?.totalCount || 0,
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 120,
      renderCell: (params: GridRenderCellParams<Strategy>) => (
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
      renderCell: (params: GridRenderCellParams<Strategy>) => (
        <Box onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Quick Backtest">
            <IconButton
              size="small"
              color="primary"
              onClick={() => {
                setSelectedStrategyForBacktest(params.row.id);
                setBacktestDialogOpen(true);
              }}
            >
              <PlayArrowIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {viewMode === 'mine' && (
            <>
              <Tooltip title={params.row.public ? 'Make Private' : 'Make Public'}>
                <IconButton
                  size="small"
                  color={params.row.public ? 'info' : 'default'}
                  onClick={() => {
                    setSelectedStrategy(params.row);
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
                    setSelectedStrategy(params.row);
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
                    setSelectedStrategy(params.row);
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
            Strategies
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {pagination.totalCount || 0} latest strategies
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
              My Strategies
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
              Create Strategy
            </Button>
          )}
        </Box>
      </Box>

      <PaginatedDataGrid<Strategy>
        columns={columns}
        pagination={pagination}
        emptyMessage="No strategies yet. Create your first strategy to get started."
        onRowClick={(row) => navigate(`/strategies/${row.id}`)}
      />

      <CreateStrategyDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={() => {
          refetch();
          setSnackbar({
            open: true,
            message: 'Strategy created successfully',
            severity: 'success',
          });
        }}
      />

      {selectedStrategy && (
        <>
          <EditStrategyDialog
            open={editDialogOpen}
            onClose={() => {
              setEditDialogOpen(false);
              setSelectedStrategy(null);
            }}
            onSuccess={() => {
              refetch();
              setSelectedStrategy(null);
              setSnackbar({
                open: true,
                message: 'Strategy updated successfully',
                severity: 'success',
              });
            }}
            strategy={selectedStrategy}
          />

          <DeleteStrategyDialog
            open={deleteDialogOpen}
            onClose={() => {
              setDeleteDialogOpen(false);
              setSelectedStrategy(null);
            }}
            onSuccess={() => {
              refetch();
              setSelectedStrategy(null);
              setSnackbar({
                open: true,
                message: 'Strategy deleted successfully',
                severity: 'success',
              });
            }}
            strategy={selectedStrategy}
          />
        </>
      )}

      <CreateBacktestDialog
        open={backtestDialogOpen}
        onClose={() => {
          setBacktestDialogOpen(false);
          setSelectedStrategyForBacktest(null);
        }}
        onSuccess={(newStrategyId) => {
          setBacktestDialogOpen(false);
          setSelectedStrategyForBacktest(null);
          setSnackbar({
            open: true,
            message: 'Backtest created successfully',
            severity: 'success',
          });
          if (newStrategyId) {
            navigate(`/strategies/${newStrategyId}`);
          }
        }}
        preSelectedStrategyId={selectedStrategyForBacktest || undefined}
      />

      {selectedStrategy && (
        <VisibilityToggleDialog
          open={visibilityDialogOpen}
          onClose={() => {
            setVisibilityDialogOpen(false);
            setSelectedStrategy(null);
          }}
          onConfirm={async () => {
            const result = await setStrategyVisibility({
              variables: {
                id: selectedStrategy.id,
                public: !selectedStrategy.public,
              },
            });
            if (result.errors) {
              throw new Error(result.errors[0]?.message || 'Failed to update visibility');
            }
            refetch();
            setSnackbar({
              open: true,
              message: `Strategy is now ${selectedStrategy.public ? 'private' : 'public'}`,
              severity: 'success',
            });
          }}
          resourceType="strategy"
          resourceName={selectedStrategy.name}
          currentlyPublic={selectedStrategy.public || false}
          loading={visibilityLoading}
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