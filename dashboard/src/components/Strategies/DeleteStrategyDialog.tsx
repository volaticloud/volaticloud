import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
} from '@mui/material';
import { useState } from 'react';
import { useDeleteStrategyMutation } from '../../generated/graphql';

interface DeleteStrategyDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  strategy: {
    id: string;
    name: string;
  };
}

export const DeleteStrategyDialog = ({ open, onClose, onSuccess, strategy }: DeleteStrategyDialogProps) => {
  const [deleteStrategy, { loading }] = useDeleteStrategyMutation();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    try {
      setError(null);
      const result = await deleteStrategy({
        variables: {
          id: strategy.id,
        },
      });

      // Check for GraphQL errors (errorPolicy: 'all' means errors don't throw)
      if (result.errors || !result.data?.deleteStrategy) {
        const errorMsg = result.errors?.[0]?.message || 'Failed to delete strategy';
        setError(errorMsg);
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      // Catch network errors
      console.error('Failed to delete strategy:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete strategy');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Delete Strategy</DialogTitle>
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          Are you sure you want to delete the strategy "{strategy.name}"?
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This action cannot be undone. Any bots using this strategy will be affected.
        </Typography>

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
          variant="contained"
          color="error"
          disabled={loading}
        >
          {loading ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};