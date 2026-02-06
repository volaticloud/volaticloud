import {
  Box,
  Typography,
  Button,
  Chip,
  Snackbar,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
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
import { useGetStrategiesQuery, GetStrategiesQuery } from './strategies.generated';
import { DeleteStrategyDrawer } from './DeleteStrategyDrawer';
import { CreateStrategyNameDrawer } from './CreateStrategyNameDrawer';
import { CreateBacktestDrawer } from '../Backtests/CreateBacktestDrawer';
import { StrategyVisibilityButton } from './StrategyVisibilityButton';
import { PaginatedDataGrid } from '../shared/PaginatedDataGrid';
import { useCursorPagination, useOrganizationPermission } from '../../hooks';
import { useActiveOrganization, useOrganizationNavigate } from '../../contexts/OrganizationContext';
import { ProtectedIconButton } from '../shared/ProtectedButton';

type ViewMode = 'mine' | 'public';

// Extract Strategy type from generated query
type Strategy = NonNullable<NonNullable<NonNullable<GetStrategiesQuery['strategies']['edges']>[number]>['node']>;

export const StrategiesList = () => {
  const navigate = useOrganizationNavigate();
  const { activeOrganizationId } = useActiveOrganization();
  const { allowed: canCreateStrategy } = useOrganizationPermission('create-strategy');

  const [viewMode, setViewMode] = useState<ViewMode>('mine');
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);
  const [backtestDrawerOpen, setBacktestDrawerOpen] = useState(false);
  const [selectedStrategyForBacktest, setSelectedStrategyForBacktest] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'error' | 'success';
  }>({ open: false, message: '', severity: 'error' });

  // Pagination hook
  const pagination = useCursorPagination<Strategy>({ initialPageSize: 10 });
  const { setLoading, updateFromResponse, reset } = pagination;

  const { data, loading, refetch } = useGetStrategiesQuery({
    variables: {
      first: pagination.pageSize,
      after: pagination.cursor,
      where: {
        isLatest: true,
        ...(viewMode === 'mine'
          ? { ownerID: activeOrganizationId || undefined }
          : { public: true })
      }
    },
    skip: viewMode === 'mine' && !activeOrganizationId,
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
  }, [viewMode, activeOrganizationId, reset]);

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
          <ProtectedIconButton
            resourceId={params.row.id}
            scope="run-backtest"
            size="small"
            color="primary"
            onClick={() => {
              setSelectedStrategyForBacktest(params.row.id);
              setBacktestDrawerOpen(true);
            }}
            deniedTooltip="No permission to run backtest"
          >
            <PlayArrowIcon fontSize="small" />
          </ProtectedIconButton>
          {viewMode === 'mine' && (
            <>
              <StrategyVisibilityButton
                strategyId={params.row.id}
                strategyName={params.row.name}
                isPublic={params.row.public}
                onSuccess={() => refetch()}
              />
              <ProtectedIconButton
                resourceId={params.row.id}
                scope="edit"
                size="small"
                onClick={() => navigate(`/strategies/${params.row.id}/edit`)}
                deniedTooltip="No permission to edit"
              >
                <EditIcon fontSize="small" />
              </ProtectedIconButton>
              <ProtectedIconButton
                resourceId={params.row.id}
                scope="delete"
                size="small"
                color="error"
                onClick={() => {
                  setSelectedStrategy(params.row);
                  setDeleteDrawerOpen(true);
                }}
                deniedTooltip="No permission to delete"
              >
                <DeleteIcon fontSize="small" />
              </ProtectedIconButton>
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
            <Tooltip title={!canCreateStrategy ? 'You do not have permission to create strategies' : ''}>
              <span>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setCreateDrawerOpen(true)}
                  disabled={!canCreateStrategy}
                  sx={{ flexShrink: 0 }}
                  data-testid="create-strategy-button"
                >
                  Create Strategy
                </Button>
              </span>
            </Tooltip>
          )}
        </Box>
      </Box>

      <PaginatedDataGrid<Strategy>
        columns={columns}
        pagination={pagination}
        emptyMessage="No strategies yet. Create your first strategy to get started."
        onRowClick={(row) => navigate(`/strategies/${row.id}`)}
        testIdPrefix="strategy"
      />

      {selectedStrategy && (
        <DeleteStrategyDrawer
          open={deleteDrawerOpen}
          onClose={() => {
            setDeleteDrawerOpen(false);
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
      )}

      <CreateBacktestDrawer
        open={backtestDrawerOpen}
        onClose={() => {
          setBacktestDrawerOpen(false);
          setSelectedStrategyForBacktest(null);
        }}
        onSuccess={(newStrategyId) => {
          setBacktestDrawerOpen(false);
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

      <CreateStrategyNameDrawer
        open={createDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
        onSuccess={(strategyId) => {
          setCreateDrawerOpen(false);
          navigate(`/strategies/${strategyId}/edit`);
        }}
      />

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