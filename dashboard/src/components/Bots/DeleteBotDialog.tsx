import { Typography } from '@mui/material';
import { useDeleteBotMutation } from './bots.generated';
import { ConfirmDialog } from '../shared/FormDialog';
import { useMutationHandler } from '../../hooks';

interface DeleteBotDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  bot: {
    id: string;
    name: string;
  } | null;
}

export const DeleteBotDialog = ({ open, onClose, onSuccess, bot }: DeleteBotDialogProps) => {
  const [deleteBot] = useDeleteBotMutation();

  const mutation = useMutationHandler(deleteBot, {
    getResult: (data) => data.deleteBot,
    errorMessage: 'Failed to delete bot',
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  const handleDelete = () => {
    if (!bot) return;
    mutation.execute({ id: bot.id });
  };

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title="Delete Bot"
      message={
        <Typography>
          Are you sure you want to delete the bot <strong>{bot?.name}</strong>?
          This action cannot be undone and will also delete all associated trades and data.
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