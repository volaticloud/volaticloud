import { Typography, Box } from '@mui/material';
import { useDeleteStrategyMutation } from './strategies.generated';
import { ConfirmDialog } from '../shared/FormDialog';
import { useMutationHandler } from '../../hooks';

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
  const [deleteStrategy] = useDeleteStrategyMutation();

  const mutation = useMutationHandler(deleteStrategy, {
    getResult: (data) => data.deleteStrategy,
    errorMessage: 'Failed to delete strategy',
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  const handleDelete = () => {
    mutation.execute({ id: strategy.id });
  };

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title="Delete Strategy"
      message={
        <Box>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to delete the strategy "{strategy.name}"?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This action cannot be undone. Any bots using this strategy will be affected.
          </Typography>
        </Box>
      }
      confirmLabel="Delete"
      confirmLoadingLabel="Deleting..."
      loading={mutation.state.loading}
      error={mutation.state.error}
      onConfirm={handleDelete}
    />
  );
};