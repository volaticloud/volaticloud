import { useEffect, useState } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  useGetAlertEventsQuery,
  GetAlertEventsQuery,
} from './alerts.generated';
import { AlertEventOrderField, OrderDirection } from '../../generated/types';
import { PaginatedDataGrid } from '../shared/PaginatedDataGrid';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { useActiveOrganization } from '../../contexts/OrganizationContext';
import { AlertEventAlertEventStatus, AlertEventAlertSeverity } from '../../generated/types';
import { AlertDetailDrawer } from './AlertDetailDrawer';

// Extract AlertEvent type from generated query
type AlertEvent = NonNullable<
  NonNullable<NonNullable<GetAlertEventsQuery['alertEvents']['edges']>[number]>['node']
>;

const statusColors: Record<AlertEventAlertEventStatus, 'success' | 'error' | 'warning' | 'default'> = {
  sent: 'success',
  failed: 'error',
  pending: 'warning',
  suppressed: 'default',
};

const severityColors: Record<AlertEventAlertSeverity, 'error' | 'warning' | 'info'> = {
  critical: 'error',
  warning: 'warning',
  info: 'info',
};

export const AlertHistoryTab = () => {
  const { activeOrganizationId } = useActiveOrganization();
  const [selectedAlert, setSelectedAlert] = useState<AlertEvent | null>(null);

  const pagination = useCursorPagination<AlertEvent>({ initialPageSize: 10 });
  const { setLoading, updateFromResponse, reset } = pagination;

  const { data, loading } = useGetAlertEventsQuery({
    variables: {
      first: pagination.pageSize,
      after: pagination.cursor,
      where: {
        ownerID: activeOrganizationId || undefined,
      },
      orderBy: {
        direction: OrderDirection.Desc,
        field: AlertEventOrderField.CreatedAt,
      },
    },
    skip: !activeOrganizationId,
  });

  useEffect(() => {
    setLoading(loading);
    if (data?.alertEvents) {
      updateFromResponse(data.alertEvents);
    }
  }, [data, loading, setLoading, updateFromResponse]);

  useEffect(() => {
    reset();
  }, [activeOrganizationId, reset]);

  const columns: GridColDef<AlertEvent>[] = [
    {
      field: 'createdAt',
      headerName: 'Time',
      width: 160,
      renderCell: (params: GridRenderCellParams<AlertEvent>) => (
        <Typography variant="caption" color="text.secondary">
          {new Date(params.row.createdAt).toLocaleString()}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 100,
      renderCell: (params: GridRenderCellParams<AlertEvent>) => (
        <Chip
          label={params.row.status}
          size="small"
          color={statusColors[params.row.status]}
          variant="outlined"
        />
      ),
    },
    {
      field: 'severity',
      headerName: 'Severity',
      width: 100,
      renderCell: (params: GridRenderCellParams<AlertEvent>) => (
        <Chip
          label={params.row.severity}
          size="small"
          color={severityColors[params.row.severity]}
          variant="outlined"
        />
      ),
    },
    {
      field: 'subject',
      headerName: 'Subject',
      flex: 1,
      minWidth: 250,
      renderCell: (params: GridRenderCellParams<AlertEvent>) => (
        <Typography variant="body2" noWrap>
          {params.row.subject}
        </Typography>
      ),
    },
    {
      field: 'rule',
      headerName: 'Rule',
      width: 150,
      renderCell: (params: GridRenderCellParams<AlertEvent>) => (
        <Typography variant="body2" color="text.secondary">
          {params.row.rule.name}
        </Typography>
      ),
    },
    {
      field: 'recipients',
      headerName: 'Recipients',
      width: 150,
      renderCell: (params: GridRenderCellParams<AlertEvent>) => (
        <Typography variant="caption" color="text.secondary" noWrap>
          {params.row.recipients.join(', ')}
        </Typography>
      ),
    },
    {
      field: 'channelType',
      headerName: 'Channel',
      width: 100,
      renderCell: (params: GridRenderCellParams<AlertEvent>) => (
        <Typography variant="body2" color="text.secondary">
          {params.row.channelType}
        </Typography>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {pagination.totalCount || 0} alert events
        </Typography>
      </Box>

      <PaginatedDataGrid<AlertEvent>
        columns={columns}
        pagination={pagination}
        emptyMessage="No alerts have been sent yet."
        onRowClick={(row) => setSelectedAlert(row)}
      />

      <AlertDetailDrawer
        open={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        alert={selectedAlert}
      />
    </Box>
  );
};