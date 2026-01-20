import { useActiveOrganization } from '../contexts/OrganizationContext';
import { usePermissionContext } from '../contexts/PermissionContext';
import { OrganizationScope } from '../services/permissions';

interface UseOrganizationPermissionResult {
  /**
   * Whether the user has the permission for the active organization.
   * Returns false if no organization is active or permission is denied.
   */
  allowed: boolean;

  /**
   * Whether permissions are being loaded.
   */
  loading: boolean;

  /**
   * Error message if permission check failed (e.g., network error).
   * Null if no error occurred.
   */
  error: string | null;

  /**
   * The active organization ID, if any.
   */
  organizationId: string | null;
}

/**
 * Hook to check organization-level permissions.
 * Automatically uses the active organization from context.
 *
 * @example
 * const { allowed: canCreateBot, loading, error } = useOrganizationPermission('create-bot');
 *
 * if (loading) return <Skeleton />;
 * if (error) return <Alert severity="error">{error}</Alert>;
 *
 * return (
 *   <Button disabled={!canCreateBot}>
 *     Create Bot
 *   </Button>
 * );
 */
export function useOrganizationPermission(scope: OrganizationScope): UseOrganizationPermissionResult {
  const { activeOrganizationId } = useActiveOrganization();
  const { can, loading, errors } = usePermissionContext();

  if (!activeOrganizationId) {
    return {
      allowed: false,
      loading: false,
      error: null,
      organizationId: null,
    };
  }

  const allowed = can(activeOrganizationId, scope);
  const errorKey = `${activeOrganizationId}:${scope}`;
  const error = errors.get(errorKey) || null;

  return {
    allowed,
    loading,
    error,
    organizationId: activeOrganizationId,
  };
}