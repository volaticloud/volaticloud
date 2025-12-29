import { Typography } from '@mui/material';
import { useDeleteBacktestMutation } from './backtests.generated';
import { ConfirmDialog } from '../shared/FormDialog';
import { useMutationHandler } from '../../hooks';

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
  const [deleteBacktest] = useDeleteBacktestMutation();

  const mutation = useMutationHandler(deleteBacktest, {
    getResult: (data) => data.deleteBacktest,
    errorMessage: 'Failed to delete backtest',
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  const handleDelete = () => {
    mutation.execute({ id: backtest.id });
  };

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title="Delete Backtest"
      message={
        <Typography>
          Are you sure you want to delete the backtest for strategy "{backtest.strategy.name}"?
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