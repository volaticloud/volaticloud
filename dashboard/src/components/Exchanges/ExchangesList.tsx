import {
  Box,
  Typography,
  Button,
  IconButton,
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
import { CreateExchangeDialog } from './CreateExchangeDialog';
import { EditExchangeDialog } from './EditExchangeDialog';
import { DeleteExchangeDialog } from './DeleteExchangeDialog';
import { PaginatedDataGrid } from '../shared/PaginatedDataGrid';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { useActiveGroup } from '../../contexts/GroupContext';

// Extract Exchange type from generated query
type Exchange = NonNullable<NonNullable<NonNullable<GetExchangesQuery['exchanges']['edges']>[number]>['node']>;

export const ExchangesList = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<{
    id: string;
    name: string;
    config?: Record<string, unknown>;
  } | null>(null);

  const { activeGroupId } = useActiveGroup();

  // Pagination hook
  const pagination = useCursorPagination<Exchange>({ initialPageSize: 10 });
  const { setLoading, updateFromResponse, reset } = pagination;

  const { data, loading, refetch } = useGetExchangesQuery({
    variables: {
      first: pagination.pageSize,
      after: pagination.cursor,
      where: {
        ownerID: activeGroupId || undefined
      }
    },
    skip: !activeGroupId,
  });

  // Sync pagination state with query results
  useEffect(() => {
    setLoading(loading);
    if (data?.exchanges) {
      updateFromResponse(data.exchanges);
    }
  }, [data, loading, setLoading, updateFromResponse]);

  // Reset pagination when activeGroupId changes
  useEffect(() => {
    reset();
  }, [activeGroupId, reset]);

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
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={() => {
                setSelectedExchange(params.row);
                setEditDialogOpen(true);
              }}
              color="primary"
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => {
                setSelectedExchange(params.row);
                setDeleteDialogOpen(true);
              }}
              color="error"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
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
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{ flexShrink: 0 }}
        >
          Add Exchange
        </Button>
      </Box>

      <PaginatedDataGrid<Exchange>
        columns={columns}
        pagination={pagination}
        emptyMessage="No exchanges configured. Add an exchange to connect to trading platforms."
      />

      <CreateExchangeDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handleSuccess}
      />

      <EditExchangeDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedExchange(null);
        }}
        onSuccess={handleSuccess}
        exchange={selectedExchange}
      />

      <DeleteExchangeDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setSelectedExchange(null);
        }}
        onSuccess={handleSuccess}
        exchange={selectedExchange}
      />
    </Box>
  );
};