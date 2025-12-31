import { usePermissionContext } from '../contexts/PermissionContext';
import { PermissionScope } from '../services/permissions';

interface UseCanPerformOptions {
  /**
   * Resource ID to check permission for.
   */
  resourceId: string;

  /**
   * Permission scope required.
   */
  scope: PermissionScope;

  /**
   * Skip permission check (always returns true).
   */
  skip?: boolean;
}

interface UseCanPerformResult {
  /**
   * Whether the user can perform the action.
   * false while loading, then the actual permission value.
   */
  can: boolean;

  /**
   * Whether the permissions are being loaded.
   */
  loading: boolean;
}

/**
 * Simple hook to check a single permission.
 * Permissions are auto-fetched when can() is called internally.
 * Backend triggers self-healing if scopes need syncing.
 *
 * @example
 * const { can, loading } = useCanPerform({
 *   resourceId: strategy.id,
 *   scope: 'edit',
 * });
 *
 * if (loading) return <Skeleton />;
 *
 * if (can) {
 *   return <EditButton />;
 * }
 */
export function useCanPerform(options: UseCanPerformOptions): UseCanPerformResult {
  const { resourceId, scope, skip = false } = options;
  const { can, loading } = usePermissionContext();

  if (skip) {
    return { can: true, loading: false };
  }

  // Just call can() - permissions are auto-fetched if not cached!
  return {
    can: can(resourceId, scope),
    loading,
  };
}