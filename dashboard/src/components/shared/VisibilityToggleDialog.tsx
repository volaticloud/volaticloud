import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
} from '@mui/material';
import { useState } from 'react';

export type ResourceType = 'strategy' | 'bot' | 'runner';

interface VisibilityToggleDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  resourceType: ResourceType;
  resourceName: string;
  currentlyPublic: boolean;
  loading?: boolean;
}

const resourceTypeLabels: Record<ResourceType, string> = {
  strategy: 'Strategy',
  bot: 'Bot',
  runner: 'Runner',
};

export const VisibilityToggleDialog = ({
  open,
  onClose,
  onConfirm,
  resourceType,
  resourceName,
  currentlyPublic,
  loading = false,
}: VisibilityToggleDialogProps) => {
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    try {
      setError(null);
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('Failed to update visibility:', err);
      setError(err instanceof Error ? err.message : 'Failed to update visibility');
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const resourceLabel = resourceTypeLabels[resourceType];
  const newVisibility = currentlyPublic ? 'private' : 'public';
  const title = currentlyPublic
    ? `Make ${resourceLabel} Private`
    : `Make ${resourceLabel} Public`;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          Are you sure you want to make "{resourceName}" {newVisibility}?
        </Typography>
        {currentlyPublic ? (
          <Typography variant="body2" color="text.secondary">
            Making this {resourceLabel.toLowerCase()} private will restrict access to only you.
            Other users will no longer be able to see or use it.
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Making this {resourceLabel.toLowerCase()} public will allow any authenticated user to
            view and use it. They will not be able to modify or delete it.
          </Typography>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={currentlyPublic ? 'warning' : 'primary'}
          disabled={loading}
        >
          {loading
            ? 'Updating...'
            : currentlyPublic
            ? 'Make Private'
            : 'Make Public'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};