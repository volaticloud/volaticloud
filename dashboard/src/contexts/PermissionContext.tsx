/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { useAuth } from 'react-oidc-context';
import { useApolloClient, ApolloError } from '@apollo/client';
import {
  CheckPermissionsDocument,
  CheckPermissionsQuery,
  CheckPermissionsQueryVariables,
} from '../services/permissions/permissions.generated';
import { PermissionScope } from '../services/permissions';

interface CachedPermission {
  granted: boolean;
  timestamp: number;
}

interface PermissionContextValue {
  /**
   * Check if user has permission for a resource/scope.
   * Auto-requests permission from backend if not cached.
   * Returns false while loading, true/false once loaded.
   */
  can: (resourceId: string, scope: PermissionScope) => boolean;

  /**
   * Whether permissions are currently being fetched.
   */
  loading: boolean;

  /**
   * Errors encountered during permission checks (e.g., network errors).
   * Map of "resourceId:scope" -> error message.
   */
  errors: Map<string, string>;

  /**
   * Force refresh all cached permissions.
   */
  refresh: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextValue | undefined>(undefined);

interface PermissionProviderProps {
  children: ReactNode;
}

// Batching configuration
const BATCH_DELAY_MS = 50; // Wait 50ms to collect all permission requests
const MAX_BATCH_SIZE = 50; // Maximum batch size before immediate execution
const PERMISSION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function PermissionProvider({ children }: PermissionProviderProps) {
  const auth = useAuth();
  const apolloClient = useApolloClient();

  // Store permissions with timestamps: Map<"resourceId:scope", CachedPermission>
  const [permissions, setPermissions] = useState<Map<string, CachedPermission>>(new Map());
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());

  // Track which permissions have been requested (to avoid duplicate requests)
  const requestedPermissions = useRef<Set<string>>(new Set());

  // Batch pending permission requests
  const pendingRequests = useRef<Set<string>>(new Set());
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create permission key
  const makeKey = (resourceId: string, scope: string) => `${resourceId}:${scope}`;

  // Execute batched permission check
  const executeBatch = useCallback(async () => {
    const pending = Array.from(pendingRequests.current);
    pendingRequests.current = new Set();

    if (pending.length === 0) return;

    // Convert to input format
    const permissionInputs = pending.map((key) => {
      const [resourceId, ...scopeParts] = key.split(':');
      const scope = scopeParts.join(':'); // Handle scopes with colons
      return { resourceId, scope };
    });

    setLoading(true);
    try {
      const result = await apolloClient.query<
        CheckPermissionsQuery,
        CheckPermissionsQueryVariables
      >({
        query: CheckPermissionsDocument,
        variables: { permissions: permissionInputs },
        fetchPolicy: 'network-only',
      });

      const now = Date.now();

      // Update permissions cache with timestamps
      setPermissions((prev) => {
        const updated = new Map(prev);
        for (const perm of result.data.checkPermissions) {
          const key = makeKey(perm.resourceId, perm.scope);
          updated.set(key, { granted: perm.granted, timestamp: now });
        }
        return updated;
      });

      // Clear errors on success
      setErrors(new Map());
    } catch (error) {
      console.error('Failed to check permissions:', error);

      // Detect network errors vs permission errors
      const isNetworkError =
        error instanceof ApolloError &&
        (error.networkError !== null || error.message.includes('network'));

      if (isNetworkError) {
        // Network error: store error message, re-add to pending for retry
        setErrors(new Map(pending.map((key) => [key, 'Network error - retrying...'])));

        // Re-add to pending for automatic retry
        for (const key of pending) {
          pendingRequests.current.add(key);
        }

        // Schedule retry after 2 seconds
        setTimeout(() => {
          executeBatch();
        }, 2000);
      } else {
        // Permission error: cache as denied
        const now = Date.now();
        setPermissions((prev) => {
          const updated = new Map(prev);
          for (const key of pending) {
            if (!updated.has(key)) {
              updated.set(key, { granted: false, timestamp: now });
            }
          }
          return updated;
        });
      }
    } finally {
      setLoading(false);
    }
  }, [apolloClient]);

  // Schedule a permission request (batched)
  const scheduleRequest = useCallback(
    (resourceId: string, scope: string) => {
      const key = makeKey(resourceId, scope);

      // Skip if already requested
      if (requestedPermissions.current.has(key)) return;
      requestedPermissions.current.add(key);

      // Add to pending batch
      pendingRequests.current.add(key);

      // Execute immediately if batch is full (Phase 2: Fix race condition)
      if (pendingRequests.current.size >= MAX_BATCH_SIZE) {
        if (batchTimeoutRef.current) {
          clearTimeout(batchTimeoutRef.current);
          batchTimeoutRef.current = null;
        }
        executeBatch();
        return;
      }

      // Otherwise schedule batch execution with delay
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      batchTimeoutRef.current = setTimeout(() => {
        executeBatch();
      }, BATCH_DELAY_MS);
    },
    [executeBatch]
  );

  // Check permission - auto-requests if not cached or expired (Phase 5: TTL check)
  const can = useCallback(
    (resourceId: string, scope: PermissionScope): boolean => {
      if (!resourceId) return false;

      const key = makeKey(resourceId, scope);
      const cached = permissions.get(key);

      // Check if cached and still valid (not expired)
      if (cached !== undefined) {
        const age = Date.now() - cached.timestamp;
        if (age < PERMISSION_CACHE_TTL_MS) {
          return cached.granted;
        }
        // Expired - re-fetch
      }

      // Not cached or expired - schedule a request and return false for now
      scheduleRequest(resourceId, scope);
      return false;
    },
    [permissions, scheduleRequest]
  );

  // Refresh all previously requested permissions
  const refresh = useCallback(async () => {
    const allKeys = Array.from(requestedPermissions.current);
    if (allKeys.length === 0) return;

    const permissionInputs = allKeys.map((key) => {
      const [resourceId, ...scopeParts] = key.split(':');
      const scope = scopeParts.join(':');
      return { resourceId, scope };
    });

    setLoading(true);
    try {
      const result = await apolloClient.query<
        CheckPermissionsQuery,
        CheckPermissionsQueryVariables
      >({
        query: CheckPermissionsDocument,
        variables: { permissions: permissionInputs },
        fetchPolicy: 'network-only',
      });

      // Replace permissions cache with fresh timestamps
      const now = Date.now();
      const newPermissions = new Map<string, CachedPermission>();
      for (const perm of result.data.checkPermissions) {
        const key = makeKey(perm.resourceId, perm.scope);
        newPermissions.set(key, { granted: perm.granted, timestamp: now });
      }
      setPermissions(newPermissions);
    } catch (error) {
      console.error('Failed to refresh permissions:', error);
    } finally {
      setLoading(false);
    }
  }, [apolloClient]);

  // Clear permissions when user logs out (Phase 3: Fix memory leak)
  useEffect(() => {
    if (!auth.isAuthenticated) {
      setPermissions(new Map());
      requestedPermissions.current.clear(); // Use .clear() instead of new Set()
      pendingRequests.current.clear();
      setErrors(new Map());
    }
  }, [auth.isAuthenticated]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      can,
      loading,
      errors,
      refresh,
    }),
    [can, loading, errors, refresh]
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

/**
 * Hook to access permission context.
 *
 * @example
 * const { can, loading } = usePermissionContext();
 *
 * // Just call can() - permissions are auto-fetched!
 * const canEdit = can(bot.id, 'edit');
 * const canDelete = can(bot.id, 'delete');
 *
 * return (
 *   <>
 *     {canEdit && <Button>Edit</Button>}
 *     {canDelete && <Button>Delete</Button>}
 *   </>
 * );
 */
export function usePermissionContext(): PermissionContextValue {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissionContext must be used within PermissionProvider');
  }
  return context;
}