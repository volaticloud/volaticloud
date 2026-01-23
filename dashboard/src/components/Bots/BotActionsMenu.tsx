import { useState } from 'react';
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Refresh,
  Delete,
  Edit,
  MoreVert,
  Dashboard,
  Public,
  Lock,
} from '@mui/icons-material';
import {
  useStartBotMutation,
  useStopBotMutation,
  useRestartBotMutation,
  useDeleteBotMutation,
  useSetBotVisibilityMutation,
} from './bots.generated';
import { FreqUIDrawer } from './FreqUIDrawer';
import { ConfirmDrawer } from '../shared';
import { usePermissions } from '../../hooks/usePermissions';

export interface BotActionsMenuProps {
  botId: string;
  botName: string;
  botStatus: string;
  isPublic?: boolean;
  /** Compact mode for use in data grids (icon buttons only) */
  compact?: boolean;
  /** Whether to show visibility toggle */
  showVisibility?: boolean;
  /** Whether to show edit action */
  showEdit?: boolean;
  /** Whether to show FreqUI action */
  showFreqUI?: boolean;
  /** Callback when action succeeds */
  onSuccess?: (message: string) => void;
  /** Callback when action fails */
  onError?: (message: string) => void;
  /** Callback for edit action (opens external dialog) */
  onEdit?: () => void;
  /** Callback after delete success (e.g., navigate away) */
  onDeleteSuccess?: () => void;
  /** Refetch data after mutations */
  refetch?: () => void;
}

const canStart = (status: string) => status === 'stopped' || status === 'error';
const canStopOrRestart = (status: string) => status === 'running' || status === 'unhealthy';

export const BotActionsMenu = ({
  botId,
  botName,
  botStatus,
  isPublic = false,
  compact = false,
  showVisibility = false,
  showEdit = false,
  showFreqUI = false,
  onSuccess,
  onError,
  onEdit,
  onDeleteSuccess,
  refetch,
}: BotActionsMenuProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);
  const [frequiDrawerOpen, setFrequiDrawerOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const menuOpen = Boolean(anchorEl);

  // Check permissions via backend proxy (with self-healing)
  // Permissions are auto-fetched when can() is called
  const { can, loading: permissionsLoading } = usePermissions();

  // Permission checks - auto-fetched on first call
  const canRun = can(botId, 'run');
  const canStopBot = can(botId, 'stop');
  const canEdit = can(botId, 'edit');
  const canDelete = can(botId, 'delete');
  const canFreqtradeApi = can(botId, 'freqtrade-api');
  const canMakePublic = can(botId, 'make-public');

  // Mutations
  const [startBot] = useStartBotMutation();
  const [stopBot] = useStopBotMutation();
  const [restartBot] = useRestartBotMutation();
  const [deleteBot] = useDeleteBotMutation();
  const [setBotVisibility] = useSetBotVisibilityMutation();

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAction = async (
    action: () => Promise<any>,
    successMessage: string,
    errorPrefix: string
  ) => {
    setActionLoading(true);
    handleMenuClose();
    try {
      const result = await action();
      if (result.errors) {
        throw new Error(result.errors[0]?.message || `${errorPrefix} failed`);
      }
      refetch?.();
      onSuccess?.(successMessage);
    } catch (err: any) {
      onError?.(err.message || `${errorPrefix} failed`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = () => {
    handleAction(
      () => startBot({ variables: { id: botId } }),
      'Bot started successfully',
      'Failed to start bot'
    );
  };

  const handleStop = () => {
    handleAction(
      () => stopBot({ variables: { id: botId } }),
      'Bot stopped successfully',
      'Failed to stop bot'
    );
  };

  const handleRestart = () => {
    handleAction(
      () => restartBot({ variables: { id: botId } }),
      'Bot restarted successfully',
      'Failed to restart bot'
    );
  };

  const handleDelete = async () => {
    setActionLoading(true);
    setDeleteDrawerOpen(false);
    handleMenuClose();
    try {
      const result = await deleteBot({ variables: { id: botId } });
      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'Failed to delete bot');
      }
      refetch?.();
      onSuccess?.('Bot deleted successfully');
      onDeleteSuccess?.();
    } catch (err: any) {
      onError?.(err.message || 'Failed to delete bot');
      setActionLoading(false);
    }
  };

  const handleVisibilityToggle = () => {
    handleAction(
      () => setBotVisibility({ variables: { id: botId, public: !isPublic } }),
      `Bot is now ${isPublic ? 'private' : 'public'}`,
      'Failed to update visibility'
    );
  };

  const handleOpenFreqUI = () => {
    handleMenuClose();
    setFrequiDrawerOpen(true);
  };

  const handleEditClick = () => {
    handleMenuClose();
    onEdit?.();
  };

  // Combine status checks with permission checks
  const startEnabled = canStart(botStatus) && canRun && !actionLoading && !permissionsLoading;
  const stopEnabled = canStopOrRestart(botStatus) && canStopBot && !actionLoading && !permissionsLoading;
  const restartEnabled = canStopOrRestart(botStatus) && canRun && !actionLoading && !permissionsLoading;
  const editEnabled = canEdit && !actionLoading && !permissionsLoading;
  const deleteEnabled = canDelete && !actionLoading && !permissionsLoading;
  const freqUIEnabled = canFreqtradeApi && !actionLoading && !permissionsLoading;
  const visibilityEnabled = canMakePublic && !actionLoading && !permissionsLoading;

  // Tooltip messages for disabled buttons
  const getStartTooltip = () => {
    if (permissionsLoading) return 'Loading permissions...';
    if (!canRun) return 'No permission to start this bot';
    if (!canStart(botStatus)) return 'Bot must be stopped to start';
    return 'Start';
  };

  const getStopTooltip = () => {
    if (permissionsLoading) return 'Loading permissions...';
    if (!canStopBot) return 'No permission to stop this bot';
    if (!canStopOrRestart(botStatus)) return 'Bot must be running to stop';
    return 'Stop';
  };

  if (compact) {
    // Compact mode: Start/Stop as icon buttons, rest in menu
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
        <Tooltip title={getStartTooltip()}>
          <span>
            <IconButton
              size="small"
              color="success"
              onClick={handleStart}
              disabled={!startEnabled}
            >
              {permissionsLoading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <PlayArrow fontSize="small" />
              )}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={getStopTooltip()}>
          <span>
            <IconButton
              size="small"
              color="error"
              onClick={handleStop}
              disabled={!stopEnabled}
            >
              {permissionsLoading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <Stop fontSize="small" />
              )}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="More actions">
          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreVert fontSize="small" />
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={handleMenuClose}
          onClick={(e) => e.stopPropagation()}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem onClick={handleRestart} disabled={!restartEnabled}>
            <ListItemIcon>
              <Refresh fontSize="small" color={restartEnabled ? 'warning' : 'disabled'} />
            </ListItemIcon>
            <ListItemText>Restart</ListItemText>
          </MenuItem>
          {showFreqUI && (
            <MenuItem onClick={handleOpenFreqUI} disabled={!freqUIEnabled}>
              <ListItemIcon>
                <Dashboard fontSize="small" color={freqUIEnabled ? 'inherit' : 'disabled'} />
              </ListItemIcon>
              <ListItemText>Open FreqUI</ListItemText>
            </MenuItem>
          )}
          {showEdit && onEdit && (
            <MenuItem onClick={handleEditClick} disabled={!editEnabled}>
              <ListItemIcon>
                <Edit fontSize="small" color={editEnabled ? 'inherit' : 'disabled'} />
              </ListItemIcon>
              <ListItemText>Edit</ListItemText>
            </MenuItem>
          )}
          {showVisibility && (
            <MenuItem onClick={handleVisibilityToggle} disabled={!visibilityEnabled}>
              <ListItemIcon>
                {isPublic ? (
                  <Lock fontSize="small" color={visibilityEnabled ? 'inherit' : 'disabled'} />
                ) : (
                  <Public fontSize="small" color={visibilityEnabled ? 'inherit' : 'disabled'} />
                )}
              </ListItemIcon>
              <ListItemText>{isPublic ? 'Make Private' : 'Make Public'}</ListItemText>
            </MenuItem>
          )}
          <Divider />
          <MenuItem onClick={() => setDeleteDrawerOpen(true)} disabled={!deleteEnabled}>
            <ListItemIcon>
              <Delete fontSize="small" color={deleteEnabled ? 'error' : 'disabled'} />
            </ListItemIcon>
            <ListItemText sx={{ color: deleteEnabled ? 'error.main' : 'text.disabled' }}>
              Delete
            </ListItemText>
          </MenuItem>
        </Menu>

        {/* Delete Confirmation Drawer */}
        <ConfirmDrawer
          open={deleteDrawerOpen}
          onClose={() => setDeleteDrawerOpen(false)}
          onConfirm={handleDelete}
          title="Delete Bot"
          message={`Are you sure you want to delete "${botName}"? This action cannot be undone.`}
          confirmLabel="Delete"
          confirmColor="error"
        />

        {/* FreqUI Drawer */}
        {showFreqUI && (
          <FreqUIDrawer
            open={frequiDrawerOpen}
            onClose={() => setFrequiDrawerOpen(false)}
            botId={botId}
            botName={botName}
          />
        )}
      </Box>
    );
  }

  // Full mode: Start/Stop as primary icon buttons, rest in menu (for detail page)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title={getStartTooltip()}>
        <span>
          <IconButton
            onClick={handleStart}
            disabled={!startEnabled}
            sx={{
              bgcolor: startEnabled ? 'success.main' : 'action.disabledBackground',
              color: startEnabled ? 'white' : 'action.disabled',
              '&:hover': { bgcolor: 'success.dark' },
            }}
          >
            {permissionsLoading ? <CircularProgress size={24} color="inherit" /> : <PlayArrow />}
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={getStopTooltip()}>
        <span>
          <IconButton
            onClick={handleStop}
            disabled={!stopEnabled}
            sx={{
              bgcolor: stopEnabled ? 'warning.main' : 'action.disabledBackground',
              color: stopEnabled ? 'white' : 'action.disabled',
              '&:hover': { bgcolor: 'warning.dark' },
            }}
          >
            {permissionsLoading ? <CircularProgress size={24} color="inherit" /> : <Stop />}
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="More actions">
        <IconButton onClick={handleMenuOpen}>
          <MoreVert />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleRestart} disabled={!restartEnabled}>
          <ListItemIcon>
            <Refresh fontSize="small" color={restartEnabled ? 'warning' : 'disabled'} />
          </ListItemIcon>
          <ListItemText>Restart</ListItemText>
        </MenuItem>
        {showFreqUI && (
          <MenuItem onClick={handleOpenFreqUI} disabled={!freqUIEnabled}>
            <ListItemIcon>
              <Dashboard fontSize="small" color={freqUIEnabled ? 'inherit' : 'disabled'} />
            </ListItemIcon>
            <ListItemText>Open FreqUI</ListItemText>
          </MenuItem>
        )}
        {showEdit && onEdit && (
          <MenuItem onClick={handleEditClick} disabled={!editEnabled}>
            <ListItemIcon>
              <Edit fontSize="small" color={editEnabled ? 'inherit' : 'disabled'} />
            </ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>
        )}
        {showVisibility && (
          <MenuItem onClick={handleVisibilityToggle} disabled={!visibilityEnabled}>
            <ListItemIcon>
              {isPublic ? (
                <Lock fontSize="small" color={visibilityEnabled ? 'inherit' : 'disabled'} />
              ) : (
                <Public fontSize="small" color={visibilityEnabled ? 'inherit' : 'disabled'} />
              )}
            </ListItemIcon>
            <ListItemText>{isPublic ? 'Make Private' : 'Make Public'}</ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={() => setDeleteDrawerOpen(true)} disabled={!deleteEnabled}>
          <ListItemIcon>
            <Delete fontSize="small" color={deleteEnabled ? 'error' : 'disabled'} />
          </ListItemIcon>
          <ListItemText sx={{ color: deleteEnabled ? 'error.main' : 'text.disabled' }}>
            Delete
          </ListItemText>
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Drawer */}
      <ConfirmDrawer
        open={deleteDrawerOpen}
        onClose={() => setDeleteDrawerOpen(false)}
        onConfirm={handleDelete}
        title="Delete Bot"
        message={`Are you sure you want to delete "${botName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="error"
      />

      {/* FreqUI Drawer */}
      {showFreqUI && (
        <FreqUIDrawer
          open={frequiDrawerOpen}
          onClose={() => setFrequiDrawerOpen(false)}
          botId={botId}
          botName={botName}
        />
      )}
    </Box>
  );
};

export default BotActionsMenu;