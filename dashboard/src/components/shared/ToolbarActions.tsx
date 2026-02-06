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
  useMediaQuery,
  useTheme,
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
  /** Show only icon on small screens (requires icon and tooltip) */
  iconOnlyOnSmallScreen?: boolean;
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
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
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
        const showIconOnly = action.iconOnlyOnSmallScreen && isSmallScreen && action.icon;
        const tooltipTitle = action.tooltip || (showIconOnly ? action.label : '');

        const button = showIconOnly ? (
          <IconButton
            aria-label={action.label}
            color={action.color || 'primary'}
            size={size}
            onClick={action.onClick}
            disabled={action.disabled || action.loading}
            data-testid={`toolbar-action-${action.id}`}
          >
            {action.loading ? <CircularProgress size={20} /> : action.icon}
          </IconButton>
        ) : (
          <Button
            aria-label={action.label}
            variant={action.variant || 'outlined'}
            color={action.color || 'primary'}
            size={size}
            startIcon={action.loading ? <CircularProgress size={16} /> : action.icon}
            onClick={action.onClick}
            disabled={action.disabled || action.loading}
            data-testid={`toolbar-action-${action.id}`}
          >
            {action.loading && action.loadingLabel ? action.loadingLabel : action.label}
          </Button>
        );

        return tooltipTitle ? (
          <Tooltip key={action.id} title={tooltipTitle}>
            <span>{button}</span>
          </Tooltip>
        ) : (
          <Fragment key={action.id}>{button}</Fragment>
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
              data-testid="toolbar-more-actions"
            >
              <MoreVert />
            </IconButton>
          </Tooltip>
          <Menu
            id="toolbar-overflow-menu"
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={handleMenuClose}
            disableRestoreFocus
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
              <MenuItemContent
                key={action.id}
                action={action}
                index={index}
                onClose={handleMenuClose}
              />
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
 * This component reuses ToolbarActions internally, treating all items as secondary
 * (overflow menu) actions. Use this when you only need a menu without primary buttons.
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

  // Filter out hidden items
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
          data-testid="toolbar-more-actions"
        >
          {icon || <MoreVert />}
        </IconButton>
      </Tooltip>
      <Menu
        id="overflow-menu"
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        disableRestoreFocus
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
          <MenuItemContent
            key={item.id}
            action={item}
            index={index}
            onClose={handleMenuClose}
          />
        ))}
      </Menu>
    </>
  );
};

/**
 * Internal component for rendering menu items consistently across
 * ToolbarActions and OverflowMenu to reduce code duplication.
 */
const MenuItemContent = ({
  action,
  index,
  onClose,
}: {
  action: ToolbarAction;
  index: number;
  onClose: () => void;
}) => {
  const handleClick = () => {
    onClose();
    action.onClick();
  };

  return (
    <Fragment>
      {action.dividerBefore && index > 0 && <Divider />}
      <MenuItem
        onClick={handleClick}
        disabled={action.disabled || action.loading}
        data-testid={`toolbar-menu-item-${action.id}`}
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
  );
};