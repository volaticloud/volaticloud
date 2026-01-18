import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useAuth } from '../../contexts/AuthContext';
import { useCreateOrganizationMutation } from './organization.generated';

interface CreateOrganizationDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateOrganizationDialog({
  open,
  onClose,
  onSuccess,
}: CreateOrganizationDialogProps) {
  const auth = useAuth();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [createOrganization, { loading }] = useCreateOrganizationMutation({
    onCompleted: async () => {
      // Refresh token BEFORE closing dialog to ensure JWT has new organization claims
      try {
        await auth.signinSilent();
      } catch (refreshError) {
        console.error('Failed to refresh token after organization creation:', refreshError);
        // Organization was created successfully, but token refresh failed
        // User will need to manually refresh (sign out and back in) to see the new org
        setError('Organization created, but session refresh failed. Please sign out and sign back in to see your new organization.');
        return;
      }
      // Token refreshed successfully, now close dialog and notify success
      handleClose();
      onSuccess?.();
    },
    onError: (err) => {
      setError(err.message || 'Failed to create organization');
    },
  });

  const handleClose = () => {
    setTitle('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Organization title is required');
      return;
    }
    if (trimmedTitle.length > 100) {
      setError('Organization title must be 100 characters or less');
      return;
    }

    await createOrganization({
      variables: { title: trimmedTitle },
    });
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create New Organization</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            autoFocus
            fullWidth
            label="Organization Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My Trading Organization"
            disabled={loading}
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !title.trim()}
            startIcon={loading ? <CircularProgress size={16} /> : <AddIcon />}
          >
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
