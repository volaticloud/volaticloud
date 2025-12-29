import { Typography } from '@mui/material';
import { useDeleteExchangeMutation } from './exchanges.generated';
import { ConfirmDialog } from '../shared/FormDialog';
import { useMutationHandler } from '../../hooks';

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
  const [deleteExchange] = useDeleteExchangeMutation();

  const mutation = useMutationHandler(deleteExchange, {
    getResult: (data) => data.deleteExchange,
    errorMessage: 'Failed to delete exchange',
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  const handleDelete = () => {
    if (!exchange) return;
    mutation.execute({ id: exchange.id });
  };

  if (!exchange) return null;

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title="Delete Exchange"
      message={
        <Typography>
          Are you sure you want to delete the exchange <strong>{exchange.name}</strong>?
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