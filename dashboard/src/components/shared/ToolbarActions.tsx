import { useState, ReactNode, Fragment } from 'react';
import {
  Button,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Divider,
  Box,
  CircularProgress,
} from '@mui/material';
import { MoreVert } from '@mui/icons-material';

export interface ToolbarAction {
  /** Unique identifier for the action */
  id: string;
  /** Display label */
  label: string;
  /** Icon to display */
  icon?: ReactNode;
  /** Click handler */
  onClick: () => void;
  /** Whether this is a primary action (shown as button) or secondary (shown in menu) */
  primary?: boolean;
  /** Whether the action is disabled */
  disabled?: boolean;
  /** Tooltip text (for primary actions) */
  tooltip?: string;
  /** Button variant for primary actions */
  variant?: 'text' | 'outlined' | 'contained';
  /** Button color */
  color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  /** Whether to show loading state */
  loading?: boolean;
  /** Loading label override */
  loadingLabel?: string;
  /** Whether this action should be hidden */
  hidden?: boolean;
  /** Add divider before this item in the menu */
  dividerBefore?: boolean;
}

export interface ToolbarActionsProps {
  /** List of actions to render */
  actions: ToolbarAction[];
  /** Size of buttons */
  size?: 'small' | 'medium' | 'large';
  /** Gap between buttons */
  gap?: number;
  /** Tooltip for the overflow menu button */
  overflowTooltip?: string;
}

/**
 * ToolbarActions - A smart toolbar that shows primary actions as buttons
 * and secondary actions in a 3-dot overflow menu.
 *
 * @example
 * ```tsx
 * <ToolbarActions
 *   actions={[
 *     { id: 'save', label: 'Save', icon: <Save />, onClick: handleSave, primary: true, variant: 'contained' },
 *     { id: 'cancel', label: 'Cancel', onClick: handleCancel },
 *     { id: 'delete', label: 'Delete', icon: <Delete />, onClick: handleDelete, color: 'error' },
 *   ]}
 * />
 * ```
 */
export const ToolbarActions = ({
  actions,
  size = 'medium',
  gap = 1,
  overflowTooltip = 'More actions',
}: ToolbarActionsProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMenuItemClick = (action: ToolbarAction) => {
    handleMenuClose();
    action.onClick();
  };

  // Filter out hidden actions
  const visibleActions = actions.filter((action) => !action.hidden);

  // Split into primary (buttons) and secondary (menu items)
  const primaryActions = visibleActions.filter((action) => action.primary);
  const secondaryActions = visibleActions.filter((action) => !action.primary);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap }}>
      {/* Primary actions as buttons */}
      {primaryActions.map((action) => {
        const button = (
          <Button
            key={action.id}
            variant={action.variant || 'outlined'}
            color={action.color || 'primary'}
            size={size}
            startIcon={action.loading ? <CircularProgress size={16} /> : action.icon}
            onClick={action.onClick}
            disabled={action.disabled || action.loading}
          >
            {action.loading && action.loadingLabel ? action.loadingLabel : action.label}
          </Button>
        );

        return action.tooltip ? (
          <Tooltip key={action.id} title={action.tooltip}>
            <span>{button}</span>
          </Tooltip>
        ) : (
          button
        );
      })}

      {/* Overflow menu for secondary actions */}
      {secondaryActions.length > 0 && (
        <>
          <Tooltip title={overflowTooltip}>
            <IconButton
              size={size}
              onClick={handleMenuOpen}
              aria-label="more actions"
              aria-controls={menuOpen ? 'toolbar-overflow-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={menuOpen ? 'true' : undefined}
            >
              <MoreVert />
            </IconButton>
          </Tooltip>
          <Menu
            id="toolbar-overflow-menu"
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            {secondaryActions.map((action, index) => (
              <Fragment key={action.id}>
                {action.dividerBefore && index > 0 && <Divider />}
                <MenuItem
                  onClick={() => handleMenuItemClick(action)}
                  disabled={action.disabled || action.loading}
                >
                  {action.icon && (
                    <ListItemIcon sx={{ color: action.color ? `${action.color}.main` : undefined }}>
                      {action.loading ? <CircularProgress size={20} /> : action.icon}
                    </ListItemIcon>
                  )}
                  <ListItemText
                    primary={action.loading && action.loadingLabel ? action.loadingLabel : action.label}
                    sx={{ color: action.color ? `${action.color}.main` : undefined }}
                  />
                </MenuItem>
              </Fragment>
            ))}
          </Menu>
        </>
      )}
    </Box>
  );
};

export interface OverflowMenuProps {
  /** List of menu items */
  items: ToolbarAction[];
  /** Size of the icon button */
  size?: 'small' | 'medium' | 'large';
  /** Tooltip text */
  tooltip?: string;
  /** Custom icon (defaults to MoreVert) */
  icon?: ReactNode;
}

/**
 * OverflowMenu - A standalone 3-dot menu component for secondary actions.
 *
 * @example
 * ```tsx
 * <OverflowMenu
 *   items={[
 *     { id: 'edit', label: 'Edit', icon: <Edit />, onClick: handleEdit },
 *     { id: 'delete', label: 'Delete', icon: <Delete />, onClick: handleDelete, color: 'error' },
 *   ]}
 * />
 * ```
 */
export const OverflowMenu = ({
  items,
  size = 'medium',
  tooltip = 'More actions',
  icon,
}: OverflowMenuProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMenuItemClick = (item: ToolbarAction) => {
    handleMenuClose();
    item.onClick();
  };

  const visibleItems = items.filter((item) => !item.hidden);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <>
      <Tooltip title={tooltip}>
        <IconButton
          size={size}
          onClick={handleMenuOpen}
          aria-label="more actions"
          aria-controls={menuOpen ? 'overflow-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={menuOpen ? 'true' : undefined}
        >
          {icon || <MoreVert />}
        </IconButton>
      </Tooltip>
      <Menu
        id="overflow-menu"
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {visibleItems.map((item, index) => (
          <Fragment key={item.id}>
            {item.dividerBefore && index > 0 && <Divider />}
            <MenuItem
              onClick={() => handleMenuItemClick(item)}
              disabled={item.disabled || item.loading}
            >
              {item.icon && (
                <ListItemIcon sx={{ color: item.color ? `${item.color}.main` : undefined }}>
                  {item.loading ? <CircularProgress size={20} /> : item.icon}
                </ListItemIcon>
              )}
              <ListItemText
                primary={item.loading && item.loadingLabel ? item.loadingLabel : item.label}
                sx={{ color: item.color ? `${item.color}.main` : undefined }}
              />
            </MenuItem>
          </Fragment>
        ))}
      </Menu>
    </>
  );
};