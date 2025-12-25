import {
  Box,
  Typography,
  Chip,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridSortModel,
  GridFilterModel,
  GridPaginationModel,
} from '@mui/x-data-grid';
import {
  TrendingUp as ProfitIcon,
  TrendingDown as LossIcon,
  AccessTime as OpenIcon,
  CheckCircle as ClosedIcon,
} from '@mui/icons-material';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useGetTradesQuery, GetTradesQuery } from './trades.generated';
import { useActiveGroup } from '../../contexts/GroupContext';
import { TradeOrderField, OrderDirection } from '../../generated/types';

// Extract Trade type from generated query
type Trade = NonNullable<NonNullable<NonNullable<GetTradesQuery['trades']['edges']>[number]>['node']>;

// Map DataGrid field names to GraphQL order fields
const fieldToOrderField: Record<string, TradeOrderField> = {
  openDate: TradeOrderField.OpenDate,
  closeDate: TradeOrderField.CloseDate,
  profitRatio: TradeOrderField.ProfitRatio,
  profitAbs: TradeOrderField.ProfitAbs,
};

export const TradesList = () => {
  const { activeGroupId } = useActiveGroup();

  // Pagination state
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });

  // Sorting state - default to newest first
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'openDate', sort: 'desc' },
  ]);

  // Filtering state
  const [filterModel, setFilterModel] = useState<GridFilterModel>({
    items: [],
  });

  // Cursor for pagination
  const [cursor, setCursor] = useState<string | null>(null);

  // Build orderBy from sort model
  const orderBy = useMemo(() => {
    if (sortModel.length === 0) {
      // Default: newest first
      return {
        field: TradeOrderField.OpenDate,
        direction: OrderDirection.Desc,
      };
    }
    const sort = sortModel[0];
    const field = fieldToOrderField[sort.field];
    if (!field) return undefined;
    return {
      field,
      direction: sort.sort === 'asc' ? OrderDirection.Asc : OrderDirection.Desc,
    };
  }, [sortModel]);

  // Build where clause from filter model
  const whereClause = useMemo(() => {
    const conditions: Record<string, unknown> = {};

    // Always filter by owner's bots
    if (activeGroupId) {
      conditions.hasBotWith = [{ ownerID: activeGroupId }];
    }

    // Process DataGrid filters
    for (const item of filterModel.items) {
      if (!item.value && item.value !== false) continue;

      switch (item.field) {
        case 'isOpen':
          if (item.value === 'true' || item.value === true) {
            conditions.isOpen = true;
          } else if (item.value === 'false' || item.value === false) {
            conditions.isOpen = false;
          }
          break;
        case 'pair':
          if (item.operator === 'contains') {
            conditions.pairContains = item.value;
          } else if (item.operator === 'equals') {
            conditions.pair = item.value;
          }
          break;
        case 'bot':
          if (item.operator === 'contains') {
            conditions.hasBotWith = [{ nameContains: item.value }];
          }
          break;
        case 'strategyName':
          if (item.operator === 'contains') {
            conditions.strategyNameContains = item.value;
          }
          break;
        case 'sellReason':
          if (item.operator === 'contains') {
            conditions.sellReasonContains = item.value;
          }
          break;
      }
    }

    return conditions;
  }, [filterModel, activeGroupId]);

  const { data, loading } = useGetTradesQuery({
    variables: {
      first: paginationModel.pageSize,
      after: cursor,
      where: whereClause,
      orderBy,
    },
    pollInterval: 30000,
    skip: !activeGroupId,
  });

  // Reset cursor when filters or sorting changes
  useEffect(() => {
    setCursor(null);
    setPaginationModel(prev => ({ ...prev, page: 0 }));
  }, [filterModel, sortModel, activeGroupId]);

  // Extract rows from data
  const rows = useMemo(() => {
    return data?.trades.edges?.map(edge => edge?.node).filter(Boolean) as Trade[] || [];
  }, [data]);

  const totalCount = data?.trades.totalCount || 0;

  // Handle pagination
  const handlePaginationModelChange = useCallback((model: GridPaginationModel) => {
    if (model.page > paginationModel.page && data?.trades.pageInfo.hasNextPage) {
      // Going forward
      setCursor(data.trades.pageInfo.endCursor || null);
    } else if (model.page < paginationModel.page) {
      // Going back - reset to beginning for simplicity
      // (Full back pagination would require storing cursor history)
      setCursor(null);
    }
    setPaginationModel(model);
  }, [paginationModel.page, data?.trades.pageInfo]);

  // Format duration between two dates
  const formatDuration = (openDate: string, closeDate: string | null | undefined): string => {
    if (!closeDate) return '-';
    const start = new Date(openDate);
    const end = new Date(closeDate);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays}d ${diffHours % 24}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    } else {
      return `${diffMins}m`;
    }
  };

  // Format date for display
  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString();
  };

  // Define columns for the DataGrid
  const columns: GridColDef<Trade>[] = [
    {
      field: 'pair',
      headerName: 'Pair',
      width: 130,
      filterable: true,
      renderCell: (params: GridRenderCellParams<Trade>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {params.row.profitRatio >= 0 ? (
            <ProfitIcon fontSize="small" color="success" />
          ) : (
            <LossIcon fontSize="small" color="error" />
          )}
          <Typography variant="body2" fontWeight={500}>
            {params.row.pair}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'isOpen',
      headerName: 'Status',
      width: 100,
      type: 'singleSelect',
      valueOptions: [
        { value: 'true', label: 'Open' },
        { value: 'false', label: 'Closed' },
      ],
      renderCell: (params: GridRenderCellParams<Trade>) => (
        <Chip
          icon={params.row.isOpen ? <OpenIcon /> : <ClosedIcon />}
          label={params.row.isOpen ? 'Open' : 'Closed'}
          color={params.row.isOpen ? 'info' : 'default'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'bot',
      headerName: 'Bot',
      width: 150,
      filterable: true,
      sortable: false,
      valueGetter: (_, row) => row.bot.name,
    },
    {
      field: 'strategyName',
      headerName: 'Strategy',
      width: 150,
      filterable: true,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Trade>) => (
        <Typography variant="body2" color="text.secondary">
          {params.row.strategyName || '-'}
        </Typography>
      ),
    },
    {
      field: 'profitRatio',
      headerName: 'Profit %',
      width: 100,
      align: 'right',
      headerAlign: 'right',
      sortable: true,
      renderCell: (params: GridRenderCellParams<Trade>) => {
        const profit = params.row.profitRatio * 100;
        const isPositive = profit >= 0;
        return (
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{ color: isPositive ? 'success.main' : 'error.main' }}
          >
            {isPositive ? '+' : ''}{profit.toFixed(2)}%
          </Typography>
        );
      },
    },
    {
      field: 'profitAbs',
      headerName: 'Profit',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      sortable: true,
      renderCell: (params: GridRenderCellParams<Trade>) => {
        const profit = params.row.profitAbs;
        const isPositive = profit >= 0;
        return (
          <Typography
            variant="body2"
            fontWeight={500}
            sx={{ color: isPositive ? 'success.main' : 'error.main' }}
          >
            {isPositive ? '+' : ''}{profit.toFixed(4)}
          </Typography>
        );
      },
    },
    {
      field: 'openRate',
      headerName: 'Entry',
      width: 110,
      align: 'right',
      headerAlign: 'right',
      sortable: false,
      renderCell: (params: GridRenderCellParams<Trade>) => (
        <Typography variant="body2">
          {params.row.openRate.toFixed(params.row.openRate < 1 ? 6 : 2)}
        </Typography>
      ),
    },
    {
      field: 'closeRate',
      headerName: 'Exit',
      width: 110,
      align: 'right',
      headerAlign: 'right',
      sortable: false,
      renderCell: (params: GridRenderCellParams<Trade>) => (
        <Typography variant="body2" color={params.row.closeRate ? 'text.primary' : 'text.disabled'}>
          {params.row.closeRate
            ? params.row.closeRate.toFixed(params.row.closeRate < 1 ? 6 : 2)
            : '-'}
        </Typography>
      ),
    },
    {
      field: 'stakeAmount',
      headerName: 'Stake',
      width: 100,
      align: 'right',
      headerAlign: 'right',
      sortable: false,
      renderCell: (params: GridRenderCellParams<Trade>) => (
        <Typography variant="body2">
          {params.row.stakeAmount.toFixed(2)}
        </Typography>
      ),
    },
    {
      field: 'duration',
      headerName: 'Duration',
      width: 100,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Trade>) => (
        <Typography variant="body2" color="text.secondary">
          {formatDuration(params.row.openDate, params.row.closeDate)}
        </Typography>
      ),
    },
    {
      field: 'openDate',
      headerName: 'Opened',
      width: 170,
      sortable: true,
      renderCell: (params: GridRenderCellParams<Trade>) => (
        <Typography variant="body2" color="text.secondary">
          {formatDate(params.row.openDate)}
        </Typography>
      ),
    },
    {
      field: 'closeDate',
      headerName: 'Closed',
      width: 170,
      sortable: true,
      renderCell: (params: GridRenderCellParams<Trade>) => (
        <Typography variant="body2" color="text.secondary">
          {params.row.closeDate ? formatDate(params.row.closeDate) : '-'}
        </Typography>
      ),
    },
    {
      field: 'sellReason',
      headerName: 'Exit Reason',
      width: 120,
      filterable: true,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Trade>) => (
        params.row.sellReason ? (
          <Chip label={params.row.sellReason} size="small" variant="outlined" />
        ) : (
          <Typography variant="body2" color="text.disabled">-</Typography>
        )
      ),
    },
  ];

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom fontWeight={600}>
          Trades
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {totalCount} total trades
        </Typography>
      </Box>

      <Box sx={{ width: '100%', height: 'calc(100vh - 200px)', minHeight: 400 }}>
        <DataGrid<Trade>
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          // Server-side pagination
          paginationMode="server"
          rowCount={totalCount}
          paginationModel={paginationModel}
          onPaginationModelChange={handlePaginationModelChange}
          pageSizeOptions={[10, 25, 50, 100]}
          // Server-side sorting
          sortingMode="server"
          sortModel={sortModel}
          onSortModelChange={setSortModel}
          // Server-side filtering
          filterMode="server"
          filterModel={filterModel}
          onFilterModelChange={setFilterModel}
          // Loading state
          loading={loading}
          // Styling
          disableRowSelectionOnClick
          rowHeight={52}
          columnHeaderHeight={56}
          sx={{
            border: 'none',
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: 'background.paper',
              borderBottom: 1,
              borderColor: 'divider',
            },
            '& .MuiDataGrid-cell': {
              borderBottom: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
            },
            '& .MuiDataGrid-footerContainer': {
              borderTop: 1,
              borderColor: 'divider',
            },
            backgroundColor: 'background.paper',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        />
      </Box>
    </Box>
  );
};