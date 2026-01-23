import { Typography } from '@mui/material';
import { useDeleteRunnerMutation } from '../../generated/graphql';
import { ConfirmDrawer } from '../shared';
import { useMutationHandler } from '../../hooks';

interface DeleteRunnerDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  runner: {
    id: string;
    name: string;
  } | null;
}

export const DeleteRunnerDrawer = ({ open, onClose, onSuccess, runner }: DeleteRunnerDrawerProps) => {
  const [deleteRunner] = useDeleteRunnerMutation();

  const mutation = useMutationHandler(deleteRunner, {
    getResult: (data) => data.deleteBotRunner,
    errorMessage: 'Failed to delete runner',
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  const handleDelete = () => {
    if (!runner) return;
    mutation.execute({ id: runner.id });
  };

  return (
    <ConfirmDrawer
      open={open}
      onClose={onClose}
      title="Delete Runner"
      message={
        <Typography>
          Are you sure you want to delete the runner <strong>{runner?.name}</strong>?
          This action cannot be undone.
        </Typography>
      }
      confirmLabel="Delete"
      confirmLoadingLabel="Deleting..."
      loading={mutation.state.loading}
      error={mutation.state.error}
      onConfirm={handleDelete}
    />
  );
};