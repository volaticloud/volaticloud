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
import { useDeleteRunnerMutation } from '../../generated/graphql';

interface DeleteRunnerDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  runner: {
    id: string;
    name: string;
  } | null;
}

export const DeleteRunnerDialog = ({ open, onClose, onSuccess, runner }: DeleteRunnerDialogProps) => {
  const [deleteRunner, { loading }] = useDeleteRunnerMutation();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!runner) return;

    try {
      setError(null);
      const result = await deleteRunner({
        variables: {
          id: runner.id,
        },
      });

      // Check for GraphQL errors (errorPolicy: 'all' means errors don't throw)
      if (result.errors || !result.data?.deleteBotRunner) {
        const errorMsg = result.errors?.[0]?.message || 'Failed to delete runner';
        setError(errorMsg);
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      // Catch network errors
      console.error('Failed to delete runner:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete runner');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm">
      <DialogTitle>Delete Runner</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete the runner <strong>{runner?.name}</strong>?
          This action cannot be undone.
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