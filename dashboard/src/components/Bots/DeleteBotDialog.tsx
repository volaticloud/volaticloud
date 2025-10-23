import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
} from '@mui/material';
import { useDeleteBotMutation } from '../../generated/graphql';

interface DeleteBotDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  bot: {
    id: string;
    name: string;
  } | null;
}

export const DeleteBotDialog = ({ open, onClose, onSuccess, bot }: DeleteBotDialogProps) => {
  const [deleteBot, { loading }] = useDeleteBotMutation();

  const handleDelete = async () => {
    if (!bot) return;

    try {
      await deleteBot({
        variables: {
          id: bot.id,
        },
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to delete bot:', err);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm">
      <DialogTitle>Delete Bot</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete the bot <strong>{bot?.name}</strong>?
          This action cannot be undone and will also delete all associated trades and data.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleDelete}
          color="error"
          variant="contained"
          disabled={loading}
        >
          {loading ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};