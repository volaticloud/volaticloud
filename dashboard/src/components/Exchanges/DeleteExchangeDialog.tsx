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
import { useDeleteExchangeMutation } from '../../generated/graphql';

interface DeleteExchangeDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  exchange: {
    id: string;
    name: string;
  } | null;
}

export const DeleteExchangeDialog = ({ open, onClose, onSuccess, exchange }: DeleteExchangeDialogProps) => {
  const [deleteExchange, { loading }] = useDeleteExchangeMutation();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!exchange) return;

    try {
      setError(null);
      const result = await deleteExchange({
        variables: { id: exchange.id },
      });

      // Check for GraphQL errors (errorPolicy: 'all' means errors don't throw)
      if (result.errors || !result.data?.deleteExchange) {
        const errorMsg = result.errors?.[0]?.message || 'Failed to delete exchange';
        setError(errorMsg);
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      // Catch network errors
      console.error('Failed to delete exchange:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete exchange');
    }
  };

  if (!exchange) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete Exchange</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to delete the exchange <strong>{exchange.name}</strong>?
          This action cannot be undone.
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