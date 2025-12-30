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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
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
import FreqUIDialog from './FreqUIDialog';

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [frequiDialogOpen, setFrequiDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const menuOpen = Boolean(anchorEl);

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
    setDeleteDialogOpen(false);
    handleMenuClose();
    try {
      const result = await deleteBot({ variables: { id: botId } });
      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'Failed to delete bot');
      }
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
    setFrequiDialogOpen(true);
  };

  const handleEditClick = () => {
    handleMenuClose();
    onEdit?.();
  };

  const startEnabled = canStart(botStatus) && !actionLoading;
  const stopEnabled = canStopOrRestart(botStatus) && !actionLoading;
  const restartEnabled = canStopOrRestart(botStatus) && !actionLoading;

  if (compact) {
    // Compact mode: Start/Stop as icon buttons, rest in menu
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
        <Tooltip title="Start">
          <span>
            <IconButton
              size="small"
              color="success"
              onClick={handleStart}
              disabled={!startEnabled}
            >
              <PlayArrow fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Stop">
          <span>
            <IconButton
              size="small"
              color="error"
              onClick={handleStop}
              disabled={!stopEnabled}
            >
              <Stop fontSize="small" />
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
            <MenuItem onClick={handleOpenFreqUI} disabled={actionLoading}>
              <ListItemIcon>
                <Dashboard fontSize="small" />
              </ListItemIcon>
              <ListItemText>Open FreqUI</ListItemText>
            </MenuItem>
          )}
          {showEdit && onEdit && (
            <MenuItem onClick={handleEditClick} disabled={actionLoading}>
              <ListItemIcon>
                <Edit fontSize="small" />
              </ListItemIcon>
              <ListItemText>Edit</ListItemText>
            </MenuItem>
          )}
          {showVisibility && (
            <MenuItem onClick={handleVisibilityToggle} disabled={actionLoading}>
              <ListItemIcon>
                {isPublic ? <Lock fontSize="small" /> : <Public fontSize="small" />}
              </ListItemIcon>
              <ListItemText>{isPublic ? 'Make Private' : 'Make Public'}</ListItemText>
            </MenuItem>
          )}
          <Divider />
          <MenuItem onClick={() => setDeleteDialogOpen(true)} disabled={actionLoading}>
            <ListItemIcon>
              <Delete fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
          </MenuItem>
        </Menu>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Delete Bot</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete "{botName}"? This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDelete} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* FreqUI Dialog */}
        {showFreqUI && (
          <FreqUIDialog
            open={frequiDialogOpen}
            onClose={() => setFrequiDialogOpen(false)}
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
      <Tooltip title="Start Bot">
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
            <PlayArrow />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Stop Bot">
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
            <Stop />
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
          <MenuItem onClick={handleOpenFreqUI} disabled={actionLoading}>
            <ListItemIcon>
              <Dashboard fontSize="small" />
            </ListItemIcon>
            <ListItemText>Open FreqUI</ListItemText>
          </MenuItem>
        )}
        {showEdit && onEdit && (
          <MenuItem onClick={handleEditClick} disabled={actionLoading}>
            <ListItemIcon>
              <Edit fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>
        )}
        {showVisibility && (
          <MenuItem onClick={handleVisibilityToggle} disabled={actionLoading}>
            <ListItemIcon>
              {isPublic ? <Lock fontSize="small" /> : <Public fontSize="small" />}
            </ListItemIcon>
            <ListItemText>{isPublic ? 'Make Private' : 'Make Public'}</ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={() => setDeleteDialogOpen(true)} disabled={actionLoading}>
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Bot</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{botName}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* FreqUI Dialog */}
      {showFreqUI && (
        <FreqUIDialog
          open={frequiDialogOpen}
          onClose={() => setFrequiDialogOpen(false)}
          botId={botId}
          botName={botName}
        />
      )}
    </Box>
  );
};

export default BotActionsMenu;