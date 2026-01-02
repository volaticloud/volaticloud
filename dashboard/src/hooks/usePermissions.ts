import { usePermissionContext } from '../contexts/PermissionContext';
import { PermissionScope } from '../services/permissions';

interface UsePermissionsResult {
  /**
   * Check if user has permission for a resource/scope.
   * Auto-requests from backend if not cached.
   */
  can: (resourceId: string, scope: PermissionScope) => boolean;

  /**
   * Whether permissions are being loaded.
   */
  loading: boolean;

  /**
   * Refresh all previously checked permissions.
   */
  refresh: () => Promise<void>;
}

/**
 * Hook for checking permissions.
 * Permissions are auto-fetched when can() is called.
 * Backend triggers self-healing if scopes need syncing.
 *
 * @example
 * const { can, loading } = usePermissions();
 *
 * // Just call can() - no setup needed!
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
export function usePermissions(): UsePermissionsResult {
  const { can, loading, refresh } = usePermissionContext();
  return { can, loading, refresh };
}