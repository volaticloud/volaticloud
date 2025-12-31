/* eslint-disable react-refresh/only-export-components */
import React, {
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
import { useApolloClient } from '@apollo/client';
import {
  CheckPermissionsDocument,
  CheckPermissionsQuery,
  CheckPermissionsQueryVariables,
} from '../services/permissions/permissions.generated';
import { PermissionScope } from '../services/permissions';

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

export function PermissionProvider({ children }: PermissionProviderProps) {
  const auth = useAuth();
  const apolloClient = useApolloClient();

  // Store permissions: Map<"resourceId:scope", boolean>
  const [permissions, setPermissions] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(false);

  // Track which permissions have been requested (to avoid duplicate requests)
  const requestedPermissions = useRef<Set<string>>(new Set());

  // Batch pending permission requests
  const pendingRequests = useRef<Set<string>>(new Set());
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

      // Update permissions cache
      setPermissions((prev) => {
        const updated = new Map(prev);
        for (const perm of result.data.checkPermissions) {
          const key = makeKey(perm.resourceId, perm.scope);
          updated.set(key, perm.granted);
        }
        return updated;
      });
    } catch (error) {
      console.error('Failed to check permissions:', error);
      // Mark as checked (false) to avoid infinite retries
      setPermissions((prev) => {
        const updated = new Map(prev);
        for (const key of pending) {
          if (!updated.has(key)) {
            updated.set(key, false);
          }
        }
        return updated;
      });
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

      // Schedule batch execution
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      batchTimeoutRef.current = setTimeout(() => {
        executeBatch();
      }, BATCH_DELAY_MS);
    },
    [executeBatch]
  );

  // Check permission - auto-requests if not cached
  const can = useCallback(
    (resourceId: string, scope: PermissionScope): boolean => {
      if (!resourceId) return false;

      const key = makeKey(resourceId, scope);
      const cached = permissions.get(key);

      // If cached, return the value
      if (cached !== undefined) {
        return cached;
      }

      // Not cached - schedule a request and return false for now
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

      // Replace permissions cache
      const newPermissions = new Map<string, boolean>();
      for (const perm of result.data.checkPermissions) {
        const key = makeKey(perm.resourceId, perm.scope);
        newPermissions.set(key, perm.granted);
      }
      setPermissions(newPermissions);
    } catch (error) {
      console.error('Failed to refresh permissions:', error);
    } finally {
      setLoading(false);
    }
  }, [apolloClient]);

  // Clear permissions when user logs out
  useEffect(() => {
    if (!auth.isAuthenticated) {
      setPermissions(new Map());
      requestedPermissions.current = new Set();
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
      refresh,
    }),
    [can, loading, refresh]
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