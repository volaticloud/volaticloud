import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  DialogContentText,
} from '@mui/material';
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

  const handleDelete = async () => {
    try {
      await deleteBacktest({
        variables: { id: backtest.id },
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to delete backtest:', err);
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleDelete} color="error" disabled={loading}>
          {loading ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};