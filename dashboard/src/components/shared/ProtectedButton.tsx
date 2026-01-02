import { Button, ButtonProps, IconButton, IconButtonProps, Tooltip, CircularProgress } from '@mui/material';
import { useCanPerform } from '../../hooks/useCanPerform';
import { PermissionScope } from '../../services/permissions';

interface ProtectedButtonBaseProps {
  /**
   * Resource ID to check permission for.
   */
  resourceId: string;

  /**
   * Permission scope required.
   */
  scope: PermissionScope;

  /**
   * Message to show when permission is denied.
   */
  deniedTooltip?: string;

  /**
   * Hide button entirely when permission denied (vs showing disabled).
   */
  hideWhenDenied?: boolean;

  /**
   * Skip permission check and always enable.
   */
  skipPermissionCheck?: boolean;
}

type ProtectedButtonProps = ProtectedButtonBaseProps & ButtonProps;
type ProtectedIconButtonProps = ProtectedButtonBaseProps & IconButtonProps;

/**
 * Button that checks permission before enabling.
 *
 * @example
 * <ProtectedButton
 *   resourceId={bot.id}
 *   scope="edit"
 *   onClick={handleEdit}
 *   deniedTooltip="You don't have permission to edit this bot"
 * >
 *   Edit Bot
 * </ProtectedButton>
 */
export function ProtectedButton({
  resourceId,
  scope,
  deniedTooltip = "You don't have permission for this action",
  hideWhenDenied = false,
  skipPermissionCheck = false,
  children,
  ...buttonProps
}: ProtectedButtonProps) {
  const { can, loading } = useCanPerform({
    resourceId,
    scope,
    skip: skipPermissionCheck,
  });

  if (skipPermissionCheck) {
    return <Button {...buttonProps}>{children}</Button>;
  }

  if (hideWhenDenied && can === false) {
    return null;
  }

  const button = (
    <Button {...buttonProps} disabled={loading || !can || buttonProps.disabled}>
      {loading ? <CircularProgress size={20} /> : children}
    </Button>
  );

  if (!can && !loading) {
    return (
      <Tooltip title={deniedTooltip}>
        <span>{button}</span>
      </Tooltip>
    );
  }

  return button;
}

/**
 * IconButton that checks permission before enabling.
 *
 * @example
 * <ProtectedIconButton
 *   resourceId={bot.id}
 *   scope="delete"
 *   color="error"
 *   onClick={handleDelete}
 *   hideWhenDenied
 * >
 *   <DeleteIcon />
 * </ProtectedIconButton>
 */
export function ProtectedIconButton({
  resourceId,
  scope,
  deniedTooltip = "You don't have permission for this action",
  hideWhenDenied = false,
  skipPermissionCheck = false,
  children,
  ...buttonProps
}: ProtectedIconButtonProps) {
  const { can, loading } = useCanPerform({
    resourceId,
    scope,
    skip: skipPermissionCheck,
  });

  if (skipPermissionCheck) {
    return <IconButton {...buttonProps}>{children}</IconButton>;
  }

  if (hideWhenDenied && can === false) {
    return null;
  }

  const iconButton = (
    <IconButton {...buttonProps} disabled={loading || !can || buttonProps.disabled}>
      {loading ? <CircularProgress size={20} /> : children}
    </IconButton>
  );

  if (!can && !loading) {
    return (
      <Tooltip title={deniedTooltip}>
        <span>{iconButton}</span>
      </Tooltip>
    );
  }

  return iconButton;
}