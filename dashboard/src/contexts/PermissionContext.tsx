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
const MAX_CACHE_SIZE = 1000; // Maximum number of cached permissions (LRU eviction)
const MAX_RETRIES = 3; // Maximum retry attempts for network errors
const INITIAL_RETRY_DELAY_MS = 2000; // Initial retry delay (2 seconds)

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

  // Track retry attempts per batch
  const retryCount = useRef<Map<string, number>>(new Map());

  // Create permission key
  const makeKey = (resourceId: string, scope: string) => `${resourceId}:${scope}`;

  // LRU eviction: remove oldest entries when cache exceeds MAX_CACHE_SIZE
  const evictOldestIfNeeded = useCallback((cacheMap: Map<string, CachedPermission>) => {
    if (cacheMap.size <= MAX_CACHE_SIZE) return cacheMap;

    // Sort by timestamp and keep only the newest MAX_CACHE_SIZE entries
    const sorted = Array.from(cacheMap.entries()).sort(
      ([, a], [, b]) => b.timestamp - a.timestamp
    );
    return new Map(sorted.slice(0, MAX_CACHE_SIZE));
  }, []);

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

      // Update permissions cache with timestamps and apply LRU eviction
      setPermissions((prev) => {
        const updated = new Map(prev);
        for (const perm of result.data.checkPermissions) {
          const key = makeKey(perm.resourceId, perm.scope);
          updated.set(key, { granted: perm.granted, timestamp: now });
        }
        // Apply LRU eviction if cache exceeds MAX_CACHE_SIZE
        return evictOldestIfNeeded(updated);
      });

      // Clear errors and retry counts on success
      setErrors(new Map());
      for (const key of pending) {
        retryCount.current.delete(key);
      }
    } catch (error) {
      console.error('Failed to check permissions:', error);

      // Detect network errors vs permission errors
      const isNetworkError =
        error instanceof ApolloError &&
        (error.networkError !== null || error.message.includes('network'));

      if (isNetworkError) {
        // Check retry count and implement exponential backoff
        const batchKey = pending.join(',');
        const currentRetries = retryCount.current.get(batchKey) || 0;

        if (currentRetries < MAX_RETRIES) {
          // Update retry count
          retryCount.current.set(batchKey, currentRetries + 1);

          // Calculate exponential backoff delay: 2s, 4s, 8s
          const retryDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, currentRetries);

          setErrors(
            new Map(
              pending.map((key) => [
                key,
                `Network error - retry ${currentRetries + 1}/${MAX_RETRIES} in ${retryDelay / 1000}s...`,
              ])
            )
          );

          // Re-add to pending for automatic retry
          for (const key of pending) {
            pendingRequests.current.add(key);
          }

          // Schedule retry with exponential backoff
          setTimeout(() => {
            executeBatch();
          }, retryDelay);
        } else {
          // Max retries exceeded, give up and cache as denied
          retryCount.current.delete(batchKey);
          setErrors(
            new Map(
              pending.map((key) => [key, `Network error - max retries (${MAX_RETRIES}) exceeded`])
            )
          );

          const now = Date.now();
          setPermissions((prev) => {
            const updated = new Map(prev);
            for (const key of pending) {
              if (!updated.has(key)) {
                updated.set(key, { granted: false, timestamp: now });
              }
            }
            return evictOldestIfNeeded(updated);
          });
        }
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
          return evictOldestIfNeeded(updated);
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

  // Track if auth was ever authenticated (to detect logout vs initial load)
  const wasAuthenticated = useRef(false);

  // Clear permissions when user logs out (Phase 3: Fix memory leak)
  // Only clear when transitioning from authenticated to unauthenticated (logout),
  // not on initial page load when auth is still loading
  useEffect(() => {
    if (auth.isAuthenticated) {
      wasAuthenticated.current = true;
    } else if (wasAuthenticated.current) {
      // User was authenticated but now isn't - this is a logout
      // Cancel pending batch to prevent race conditions
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = null;
      }

      // Replace Sets (thread-safe, prevents race conditions during iteration)
      requestedPermissions.current = new Set();
      pendingRequests.current = new Set();

      // Clear maps and retry counters
      setPermissions(new Map());
      setErrors(new Map());
      retryCount.current.clear();

      wasAuthenticated.current = false;
    }
  }, [auth.isAuthenticated]);

  // Cleanup timeout and retry counters on unmount
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = null;
      }
      // Clear pending requests from requested set so they can be re-scheduled on remount
      // This is needed for React Strict Mode which unmounts and remounts components
      for (const key of pendingRequests.current) {
        requestedPermissions.current.delete(key);
      }
      pendingRequests.current = new Set();
      retryCount.current.clear();
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