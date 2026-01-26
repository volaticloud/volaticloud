import { useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
} from '@mui/material';
import {
  GridColDef,
  GridRenderCellParams,
} from '@mui/x-data-grid';
import {
  TrendingUp as ProfitIcon,
  TrendingDown as LossIcon,
  AccessTime as OpenIcon,
  CheckCircle as ClosedIcon,
} from '@mui/icons-material';
import { useGetTradesQuery, useTradeChangedSubscription, GetTradesQuery } from './trades.generated';
import { useActiveOrganization } from '../../contexts/OrganizationContext';
import { TradeOrderField, OrderDirection } from '../../generated/types';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { PaginatedDataGrid } from '../shared/PaginatedDataGrid';

// Extract Trade type from generated query
type Trade = NonNullable<NonNullable<NonNullable<GetTradesQuery['trades']['edges']>[number]>['node']>;

export const TradesList = () => {
  const { activeOrganizationId } = useActiveOrganization();

  const pagination = useCursorPagination<Trade>({
    initialPageSize: 25,
    pageSizeOptions: [10, 25, 50, 100],
  });
  const { setLoading, updateFromResponse, reset } = pagination;

  // Build where clause
  const whereClause = activeOrganizationId ? { hasBotWith: [{ ownerID: activeOrganizationId }] } : {};

  const { data, loading, refetch } = useGetTradesQuery({
    variables: {
      first: pagination.pageSize,
      after: pagination.cursor,
      where: whereClause,
      orderBy: {
        field: TradeOrderField.OpenDate,
        direction: OrderDirection.Desc,
      },
    },
    skip: !activeOrganizationId,
  });

  // Subscribe to trade changes for real-time updates (organization-level)
  const { data: subscriptionData } = useTradeChangedSubscription({
    variables: { ownerId: activeOrganizationId! },
    skip: !activeOrganizationId,
  });

  useEffect(() => {
    setLoading(loading);
    if (data?.trades) {
      updateFromResponse(data.trades);
    }
  }, [data, loading, setLoading, updateFromResponse]);

  // Refetch when subscription receives data
  useEffect(() => {
    if (subscriptionData?.tradeChanged) {
      refetch();
    }
  }, [subscriptionData, refetch]);

  useEffect(() => {
    reset();
  }, [activeOrganizationId, reset]);

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
      sortable: false,
      valueGetter: (_, row) => row.bot.name,
    },
    {
      field: 'strategyName',
      headerName: 'Strategy',
      width: 150,
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
      sortable: false,
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
      sortable: false,
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
      sortable: false,
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
      sortable: false,
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
          {pagination.totalCount} total trades
        </Typography>
      </Box>

      <PaginatedDataGrid<Trade>
        columns={columns}
        pagination={pagination}
        emptyMessage="No trades found."
        isPolling={!loading && pagination.items.length > 0}
      />
    </Box>
  );
};