import { useState, useCallback, useMemo, useEffect } from 'react';

/**
 * PageInfo structure from Relay-style GraphQL connections
 */
export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

/**
 * Connection response structure from Relay-style GraphQL
 */
export interface ConnectionResponse<TNode> {
  edges: Array<{ node: TNode | null } | null> | null;
  pageInfo: PageInfo;
  totalCount: number;
}

/**
 * Pagination state for cursor-based navigation
 */
export interface CursorPaginationState {
  pageSize: number;
  currentPage: number;
  cursors: (string | null)[]; // Stack of cursors for each page [null, cursor1, cursor2, ...]
}

/**
 * Options for useCursorPagination hook
 */
export interface UseCursorPaginationOptions {
  /** Initial page size (default: 10) */
  initialPageSize?: number;
  /** Available page size options (default: [10, 25, 50]) */
  pageSizeOptions?: number[];
}

/**
 * Result returned by useCursorPagination hook
 */
export interface UseCursorPaginationResult<TNode> {
  /** Current page size */
  pageSize: number;
  /** Available page size options */
  pageSizeOptions: number[];
  /** Current page index (0-based) */
  currentPage: number;
  /** Whether there's a next page */
  hasNextPage: boolean;
  /** Whether there's a previous page */
  hasPreviousPage: boolean;
  /** Total number of items */
  totalCount: number;
  /** Extracted nodes from current page */
  items: TNode[];
  /** Cursor to use for GraphQL query (pass to 'after' variable) */
  cursor: string | null;
  /** Go to next page */
  goToNextPage: () => void;
  /** Go to previous page */
  goToPreviousPage: () => void;
  /** Change page size (resets to first page) */
  setPageSize: (size: number) => void;
  /** Reset pagination to first page */
  reset: () => void;
  /** Update pagination state with new data from GraphQL response */
  updateFromResponse: (response: ConnectionResponse<TNode> | undefined | null) => void;
  /** Loading state indicator */
  loading: boolean;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
}

/**
 * Custom hook for cursor-based pagination with MUI DataGrid
 *
 * This hook manages pagination state for Relay-style GraphQL connections,
 * providing Previous/Next navigation without page jumping.
 *
 * @example
 * ```tsx
 * const pagination = useCursorPagination<Strategy>({ initialPageSize: 25 });
 *
 * const { data, loading } = useGetStrategiesQuery({
 *   variables: {
 *     first: pagination.pageSize,
 *     after: pagination.cursor,
 *   },
 * });
 *
 * useEffect(() => {
 *   pagination.setLoading(loading);
 *   pagination.updateFromResponse(data?.strategies);
 * }, [data, loading]);
 *
 * return (
 *   <DataGrid
 *     rows={pagination.items}
 *     paginationMode="server"
 *     rowCount={pagination.totalCount}
 *     paginationModel={{ page: pagination.currentPage, pageSize: pagination.pageSize }}
 *     onPaginationModelChange={(model) => {
 *       if (model.pageSize !== pagination.pageSize) {
 *         pagination.setPageSize(model.pageSize);
 *       } else if (model.page > pagination.currentPage) {
 *         pagination.goToNextPage();
 *       } else if (model.page < pagination.currentPage) {
 *         pagination.goToPreviousPage();
 *       }
 *     }}
 *   />
 * );
 * ```
 */
export function useCursorPagination<TNode>(
  options: UseCursorPaginationOptions = {}
): UseCursorPaginationResult<TNode> {
  const {
    initialPageSize = 10,
    pageSizeOptions = [10, 25, 50],
  } = options;

  const [state, setState] = useState<CursorPaginationState>({
    pageSize: initialPageSize,
    currentPage: 0,
    cursors: [null], // First page has no cursor
  });

  const [pageInfo, setPageInfo] = useState<PageInfo>({
    hasNextPage: false,
    hasPreviousPage: false,
    startCursor: null,
    endCursor: null,
  });

  const [totalCount, setTotalCount] = useState(0);
  const [items, setItems] = useState<TNode[]>([]);
  const [loading, setLoading] = useState(false);

  // Current cursor for GraphQL query
  const cursor = useMemo(() => {
    return state.cursors[state.currentPage] ?? null;
  }, [state.cursors, state.currentPage]);

  // Go to next page
  const goToNextPage = useCallback(() => {
    if (!pageInfo.hasNextPage || !pageInfo.endCursor) return;

    setState((prev) => {
      const nextPage = prev.currentPage + 1;
      const newCursors = [...prev.cursors];

      // Store the cursor for the next page if not already stored
      if (newCursors.length <= nextPage) {
        newCursors.push(pageInfo.endCursor);
      }

      return {
        ...prev,
        currentPage: nextPage,
        cursors: newCursors,
      };
    });
  }, [pageInfo.hasNextPage, pageInfo.endCursor]);

  // Go to previous page
  const goToPreviousPage = useCallback(() => {
    setState((prev) => {
      if (prev.currentPage === 0) return prev;

      return {
        ...prev,
        currentPage: prev.currentPage - 1,
      };
    });
  }, []);

  // Change page size (resets to first page)
  const setPageSize = useCallback((size: number) => {
    setState({
      pageSize: size,
      currentPage: 0,
      cursors: [null],
    });
  }, []);

  // Reset to first page
  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentPage: 0,
      cursors: [null],
    }));
  }, []);

  // Update state from GraphQL response
  const updateFromResponse = useCallback(
    (response: ConnectionResponse<TNode> | undefined | null) => {
      if (!response) return;

      // Extract nodes from edges
      const nodes = (response.edges ?? [])
        .map((edge) => edge?.node)
        .filter((node): node is TNode => node !== null && node !== undefined);

      setItems(nodes);
      setPageInfo(response.pageInfo);
      setTotalCount(response.totalCount);
    },
    []
  );

  return {
    pageSize: state.pageSize,
    pageSizeOptions,
    currentPage: state.currentPage,
    hasNextPage: pageInfo.hasNextPage,
    hasPreviousPage: state.currentPage > 0,
    totalCount,
    items,
    cursor,
    goToNextPage,
    goToPreviousPage,
    setPageSize,
    reset,
    updateFromResponse,
    loading,
    setLoading,
  };
}

/**
 * Helper to handle pagination model changes from MUI DataGrid
 */
export function handlePaginationModelChange<TNode>(
  pagination: UseCursorPaginationResult<TNode>,
  newModel: { page: number; pageSize: number }
) {
  if (newModel.pageSize !== pagination.pageSize) {
    pagination.setPageSize(newModel.pageSize);
  } else if (newModel.page > pagination.currentPage) {
    pagination.goToNextPage();
  } else if (newModel.page < pagination.currentPage) {
    pagination.goToPreviousPage();
  }
}

/**
 * Hook to sync pagination state with GraphQL query results
 */
export function usePaginationSync<TNode>(
  pagination: UseCursorPaginationResult<TNode>,
  data: ConnectionResponse<TNode> | undefined | null,
  loading: boolean
) {
  useEffect(() => {
    pagination.setLoading(loading);
  }, [loading, pagination]);

  useEffect(() => {
    pagination.updateFromResponse(data);
  }, [data, pagination]);
}