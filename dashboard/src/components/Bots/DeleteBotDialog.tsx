import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
  Alert,
} from '@mui/material';
import { useState } from 'react';
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
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!bot) return;

    try {
      setError(null);
      const result = await deleteBot({
        variables: {
          id: bot.id,
        },
      });

      // Check for GraphQL errors (errorPolicy: 'all' means errors don't throw)
      if (result.errors || !result.data?.deleteBot) {
        const errorMsg = result.errors?.[0]?.message || 'Failed to delete bot';
        setError(errorMsg);
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      // Catch network errors
      console.error('Failed to delete bot:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete bot');
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
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
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