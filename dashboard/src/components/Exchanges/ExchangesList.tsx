import {
  Box,
  Typography,
  Button,
  Tooltip,
} from '@mui/material';
import { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { useGetExchangesQuery, GetExchangesQuery } from './exchanges.generated';
import { CreateExchangeDrawer } from './CreateExchangeDrawer';
import { EditExchangeDrawer } from './EditExchangeDrawer';
import { DeleteExchangeDrawer } from './DeleteExchangeDrawer';
import { PaginatedDataGrid } from '../shared/PaginatedDataGrid';
import { useCursorPagination, useOrganizationPermission } from '../../hooks';
import { useActiveOrganization } from '../../contexts/OrganizationContext';
import { ProtectedIconButton } from '../shared/ProtectedButton';

// Extract Exchange type from generated query
type Exchange = NonNullable<NonNullable<NonNullable<GetExchangesQuery['exchanges']['edges']>[number]>['node']>;

export const ExchangesList = () => {
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<{
    id: string;
    name: string;
    config?: Record<string, unknown>;
  } | null>(null);

  const { activeOrganizationId } = useActiveOrganization();
  const { allowed: canCreateExchange } = useOrganizationPermission('create-exchange');

  // Pagination hook
  const pagination = useCursorPagination<Exchange>({ initialPageSize: 10 });
  const { setLoading, updateFromResponse, reset } = pagination;

  const { data, loading, refetch } = useGetExchangesQuery({
    variables: {
      first: pagination.pageSize,
      after: pagination.cursor,
      where: {
        ownerID: activeOrganizationId || undefined
      }
    },
    skip: !activeOrganizationId,
  });

  // Sync pagination state with query results
  useEffect(() => {
    setLoading(loading);
    if (data?.exchanges) {
      updateFromResponse(data.exchanges);
    }
  }, [data, loading, setLoading, updateFromResponse]);

  // Reset pagination when activeOrganizationId changes
  useEffect(() => {
    reset();
  }, [activeOrganizationId, reset]);

  const handleSuccess = () => {
    refetch();
  };

  // Define columns for the DataGrid
  const columns: GridColDef<Exchange>[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams<Exchange>) => (
        <Typography variant="body2" fontWeight={600}>
          {params.row.name}
        </Typography>
      ),
    },
    {
      field: 'bots',
      headerName: 'Bots',
      width: 100,
      renderCell: (params: GridRenderCellParams<Exchange>) => (
        <Typography variant="body2" color="text.secondary">
          {params.row.bots.totalCount}
        </Typography>
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 160,
      renderCell: (params: GridRenderCellParams<Exchange>) => (
        <Typography variant="caption" color="text.secondary">
          {new Date(params.row.createdAt).toLocaleString()}
        </Typography>
      ),
    },
    {
      field: 'updatedAt',
      headerName: 'Updated',
      width: 160,
      renderCell: (params: GridRenderCellParams<Exchange>) => (
        <Typography variant="caption" color="text.secondary">
          {new Date(params.row.updatedAt).toLocaleString()}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams<Exchange>) => (
        <Box onClick={(e) => e.stopPropagation()}>
          <ProtectedIconButton
            resourceId={params.row.id}
            scope="edit"
            size="small"
            onClick={() => {
              setSelectedExchange(params.row);
              setEditDrawerOpen(true);
            }}
            color="primary"
            deniedTooltip="No permission to edit"
          >
            <EditIcon fontSize="small" />
          </ProtectedIconButton>
          <ProtectedIconButton
            resourceId={params.row.id}
            scope="delete"
            size="small"
            onClick={() => {
              setSelectedExchange(params.row);
              setDeleteDrawerOpen(true);
            }}
            color="error"
            deniedTooltip="No permission to delete"
          >
            <DeleteIcon fontSize="small" />
          </ProtectedIconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ width: '100%', maxWidth: '100%' }}>
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
            Exchanges
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {pagination.totalCount || 0} exchange connections
          </Typography>
        </Box>
        <Tooltip title={!canCreateExchange ? 'You do not have permission to create exchanges' : ''}>
          <span>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDrawerOpen(true)}
              disabled={!canCreateExchange}
              sx={{ flexShrink: 0 }}
              data-testid="add-exchange-button"
            >
              Add Exchange
            </Button>
          </span>
        </Tooltip>
      </Box>

      <PaginatedDataGrid<Exchange>
        columns={columns}
        pagination={pagination}
        emptyMessage="No exchanges configured. Add an exchange to connect to trading platforms."
        testIdPrefix="exchange"
      />

      <CreateExchangeDrawer
        open={createDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
        onSuccess={handleSuccess}
      />

      <EditExchangeDrawer
        open={editDrawerOpen}
        onClose={() => {
          setEditDrawerOpen(false);
          setSelectedExchange(null);
        }}
        onSuccess={handleSuccess}
        exchange={selectedExchange}
      />

      <DeleteExchangeDrawer
        open={deleteDrawerOpen}
        onClose={() => {
          setDeleteDrawerOpen(false);
          setSelectedExchange(null);
        }}
        onSuccess={handleSuccess}
        exchange={selectedExchange}
      />
    </Box>
  );
};