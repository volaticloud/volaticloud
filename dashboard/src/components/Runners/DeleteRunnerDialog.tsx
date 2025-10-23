import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
} from '@mui/material';
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

  const handleDelete = async () => {
    if (!runner) return;

    try {
      await deleteRunner({
        variables: {
          id: runner.id,
        },
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to delete runner:', err);
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