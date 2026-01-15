import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';

interface ChangeRoleDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (newRole: string) => Promise<void>;
  username: string;
  currentRole: string;
  availableRoles: string[];
  loading?: boolean;
}

/**
 * Reusable dialog for changing a user's role.
 * Shows the current role and allows selecting a new one from available roles.
 */
export const ChangeRoleDialog = ({
  open,
  onClose,
  onConfirm,
  username,
  currentRole,
  availableRoles,
  loading = false,
}: ChangeRoleDialogProps) => {
  const [selectedRole, setSelectedRole] = useState(currentRole);
  const [error, setError] = useState<string | null>(null);

  // Reset selected role when dialog opens with new user
  useEffect(() => {
    if (open) {
      setSelectedRole(currentRole);
      setError(null);
    }
  }, [open, currentRole]);

  const handleConfirm = async () => {
    if (selectedRole === currentRole) {
      onClose();
      return;
    }

    try {
      setError(null);
      await onConfirm(selectedRole);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change role');
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Change Role</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Change role for <strong>{username}</strong>
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              label="Role"
              disabled={loading}
            >
              {availableRoles.map((role) => (
                <MenuItem key={role} value={role}>
                  {role}
                  {role === currentRole && ' (current)'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedRole !== currentRole && (
            <Alert severity="info" sx={{ mt: 2 }}>
              This will change {username}'s role from <strong>{currentRole}</strong> to{' '}
              <strong>{selectedRole}</strong>.
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={loading || selectedRole === currentRole}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {loading ? 'Changing...' : 'Change Role'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
