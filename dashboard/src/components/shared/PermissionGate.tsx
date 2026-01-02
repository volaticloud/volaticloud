import { ReactNode } from 'react';
import { Box, Skeleton } from '@mui/material';
import { useCanPerform } from '../../hooks/useCanPerform';
import { PermissionScope } from '../../services/permissions';

interface PermissionGateProps {
  /**
   * Resource ID to check permission for.
   */
  resourceId: string;

  /**
   * Permission scope required.
   */
  scope: PermissionScope;

  /**
   * Content to render if permission is granted.
   */
  children: ReactNode;

  /**
   * Content to render if permission is denied.
   * Defaults to null (render nothing).
   */
  fallback?: ReactNode;

  /**
   * Content to render while loading.
   * Defaults to a small skeleton.
   */
  loading?: ReactNode;

  /**
   * Skip permission check and always render children.
   * Useful for conditional permission checking.
   */
  skip?: boolean;
}

/**
 * Component that conditionally renders children based on permissions.
 *
 * @example
 * <PermissionGate resourceId={bot.id} scope="edit">
 *   <IconButton onClick={handleEdit}>
 *     <EditIcon />
 *   </IconButton>
 * </PermissionGate>
 *
 * @example
 * // With custom fallback
 * <PermissionGate
 *   resourceId={strategy.id}
 *   scope="delete"
 *   fallback={
 *     <Tooltip title="No permission">
 *       <span><DeleteIcon color="disabled" /></span>
 *     </Tooltip>
 *   }
 * >
 *   <DeleteButton />
 * </PermissionGate>
 */
export function PermissionGate({
  resourceId,
  scope,
  children,
  fallback = null,
  loading: loadingContent,
  skip = false,
}: PermissionGateProps): ReactNode {
  const { can, loading } = useCanPerform({
    resourceId,
    scope,
    skip,
  });

  if (skip) {
    return <>{children}</>;
  }

  if (loading) {
    return loadingContent !== undefined ? (
      <>{loadingContent}</>
    ) : (
      <Box component="span" sx={{ display: 'inline-block' }}>
        <Skeleton variant="rectangular" width={32} height={32} sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  return can ? <>{children}</> : <>{fallback}</>;
}