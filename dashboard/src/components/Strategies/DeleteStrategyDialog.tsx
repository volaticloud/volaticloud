import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  FormHelperText,
} from '@mui/material';
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
  const [deleteStrategy, { loading, error }] = useDeleteStrategyMutation();

  const handleDelete = async () => {
    try {
      await deleteStrategy({
        variables: {
          id: strategy.id,
        },
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to delete strategy:', err);
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
          <FormHelperText error sx={{ mt: 2 }}>
            Error deleting strategy: {error.message}
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