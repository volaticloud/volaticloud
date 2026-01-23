import { Typography, Box } from '@mui/material';
import { useDeleteStrategyMutation } from './strategies.generated';
import { ConfirmDrawer } from '../shared';
import { useMutationHandler } from '../../hooks';

interface DeleteStrategyDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  strategy: {
    id: string;
    name: string;
  };
}

export const DeleteStrategyDrawer = ({ open, onClose, onSuccess, strategy }: DeleteStrategyDrawerProps) => {
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
    <ConfirmDrawer
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