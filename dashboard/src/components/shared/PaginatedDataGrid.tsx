import { DataGrid, GridColDef, GridRowsProp, GridValidRowModel } from '@mui/x-data-grid';
import { Box, Card, CardContent, Typography } from '@mui/material';
import { UseCursorPaginationResult, handlePaginationModelChange } from '../../hooks/useCursorPagination';

/**
 * Props for PaginatedDataGrid component
 */
export interface PaginatedDataGridProps<TRow extends GridValidRowModel> {
  /** Column definitions for the DataGrid */
  columns: GridColDef<TRow>[];
  /** Pagination state from useCursorPagination hook */
  pagination: UseCursorPaginationResult<TRow>;
  /** Optional: Message to show when no data */
  emptyMessage?: string;
  /** Optional: Callback when row is clicked */
  onRowClick?: (row: TRow) => void;
  /** Optional: Get row ID (default: uses 'id' field) */
  getRowId?: (row: TRow) => string;
  /** Optional: Additional DataGrid props */
  autoHeight?: boolean;
  /** Optional: Disable row selection */
  disableRowSelectionOnClick?: boolean;
  /** Optional: Row height */
  rowHeight?: number;
  /** Optional: Column header height */
  columnHeaderHeight?: number;
  /** Optional: Hide footer */
  hideFooter?: boolean;
  /** Optional: Polling indicator - shows subtle loading without blocking UI */
  isPolling?: boolean;
}

/**
 * Reusable DataGrid component with cursor-based pagination support.
 *
 * This component integrates MUI DataGrid with the useCursorPagination hook
 * to provide server-side cursor-based pagination with Previous/Next navigation.
 *
 * @example
 * ```tsx
 * const pagination = useCursorPagination<Strategy>({ initialPageSize: 25 });
 *
 * const { data, loading } = useGetStrategiesQuery({
 *   variables: { first: pagination.pageSize, after: pagination.cursor },
 * });
 *
 * usePaginationSync(pagination, data?.strategies, loading);
 *
 * const columns: GridColDef<Strategy>[] = [
 *   { field: 'name', headerName: 'Name', flex: 1 },
 *   { field: 'status', headerName: 'Status', width: 120 },
 * ];
 *
 * return (
 *   <PaginatedDataGrid
 *     columns={columns}
 *     pagination={pagination}
 *     onRowClick={(row) => navigate(`/strategies/${row.id}`)}
 *   />
 * );
 * ```
 */
export function PaginatedDataGrid<TRow extends GridValidRowModel>({
  columns,
  pagination,
  emptyMessage = 'No data available.',
  onRowClick,
  getRowId = (row) => (row as unknown as { id: string }).id,
  autoHeight = true,
  disableRowSelectionOnClick = true,
  rowHeight = 52,
  columnHeaderHeight = 56,
  hideFooter = false,
  isPolling = false,
}: PaginatedDataGridProps<TRow>) {
  const rows: GridRowsProp<TRow> = pagination.items;

  // Show empty state only when not loading and no items
  if (!pagination.loading && rows.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            {emptyMessage}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <DataGrid<TRow>
        rows={rows}
        columns={columns}
        getRowId={getRowId}
        // Server-side pagination
        paginationMode="server"
        rowCount={pagination.totalCount}
        paginationModel={{
          page: pagination.currentPage,
          pageSize: pagination.pageSize,
        }}
        onPaginationModelChange={(model) => {
          handlePaginationModelChange(pagination, model);
        }}
        pageSizeOptions={pagination.pageSizeOptions}
        // Indicate that we can only navigate to adjacent pages
        paginationMeta={{
          hasNextPage: pagination.hasNextPage,
        }}
        // Loading state
        loading={pagination.loading && !isPolling}
        // Row click handler
        onRowClick={onRowClick ? (params) => onRowClick(params.row) : undefined}
        // Styling
        autoHeight={autoHeight}
        disableRowSelectionOnClick={disableRowSelectionOnClick}
        rowHeight={rowHeight}
        columnHeaderHeight={columnHeaderHeight}
        hideFooter={hideFooter}
        // Disable column menu and filters for cleaner UI
        disableColumnMenu
        // Custom styles
        sx={{
          // Remove border around grid
          border: 'none',
          // Style rows
          '& .MuiDataGrid-row': {
            cursor: onRowClick ? 'pointer' : 'default',
          },
          // Style header
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
          },
          // Style cells - ensure vertical centering
          '& .MuiDataGrid-cell': {
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
          },
          // Style footer
          '& .MuiDataGrid-footerContainer': {
            borderTop: 1,
            borderColor: 'divider',
          },
          // Ensure proper background
          backgroundColor: 'background.paper',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      />
    </Box>
  );
}

export default PaginatedDataGrid;