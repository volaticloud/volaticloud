import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  FormHelperText,
} from '@mui/material';
import { useDeleteExchangeMutation, ExchangeExchangeType } from '../../generated/graphql';

interface DeleteExchangeDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  exchange: {
    id: string;
    name: ExchangeExchangeType;
  } | null;
}

export const DeleteExchangeDialog = ({ open, onClose, onSuccess, exchange }: DeleteExchangeDialogProps) => {
  const [deleteExchange, { loading, error }] = useDeleteExchangeMutation();

  const handleDelete = async () => {
    if (!exchange) return;

    try {
      await deleteExchange({
        variables: { id: exchange.id },
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to delete exchange:', err);
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
          <FormHelperText error sx={{ mt: 2 }}>
            Error deleting exchange: {error.message}
          </FormHelperText>
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