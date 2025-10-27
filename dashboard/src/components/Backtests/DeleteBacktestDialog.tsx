import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  DialogContentText,
  Alert,
} from '@mui/material';
import { useState } from 'react';
import { useDeleteBacktestMutation } from '../../generated/graphql';

interface DeleteBacktestDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  backtest: {
    id: string;
    strategy: { name: string };
  };
}

export const DeleteBacktestDialog = ({
  open,
  onClose,
  onSuccess,
  backtest,
}: DeleteBacktestDialogProps) => {
  const [deleteBacktest, { loading }] = useDeleteBacktestMutation();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    try {
      setError(null);
      const result = await deleteBacktest({
        variables: { id: backtest.id },
      });

      // Check for GraphQL errors (errorPolicy: 'all' means errors don't throw)
      if (result.errors || !result.data?.deleteBacktest) {
        const errorMsg = result.errors?.[0]?.message || 'Failed to delete backtest';
        setError(errorMsg);
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      // Catch network errors
      console.error('Failed to delete backtest:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete backtest');
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Delete Backtest</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete the backtest for strategy "{backtest.strategy.name}"?
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
        <Button onClick={handleDelete} color="error" disabled={loading} variant="contained">
          {loading ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};