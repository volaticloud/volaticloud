import { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { Close } from '@mui/icons-material';

interface ChangeRoleDrawerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (newRole: string) => Promise<void>;
  username: string;
  currentRole: string;
  availableRoles: string[];
  loading?: boolean;
}

/**
 * Reusable drawer for changing a user's role.
 * Shows the current role and allows selecting a new one from available roles.
 */
export const ChangeRoleDrawer = ({
  open,
  onClose,
  onConfirm,
  username,
  currentRole,
  availableRoles,
  loading = false,
}: ChangeRoleDrawerProps) => {
  const [selectedRole, setSelectedRole] = useState(currentRole);
  const [error, setError] = useState<string | null>(null);

  // Reset selected role when drawer opens with new user
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
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 400 },
          maxWidth: '100%',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" component="h2">
          Change Role
        </Typography>
        <IconButton onClick={handleClose} disabled={loading} size="small" aria-label="close">
          <Close />
        </IconButton>
      </Box>

      {/* Content */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          px: 3,
          py: 2,
        }}
      >
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

      {/* Footer */}
      <Divider />
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1,
          px: 3,
          py: 2,
        }}
      >
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
      </Box>
    </Drawer>
  );
};
