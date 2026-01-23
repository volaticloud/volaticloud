import { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { useInviteOrganizationUserMutation } from './organization.generated';
import { ORG_ID_PARAM } from '../../constants/url';
import { isValidEmail } from '../../utils/validation';

interface InviteUserDrawerProps {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
  onSuccess?: () => void;
}

/**
 * Drawer for inviting a user to an organization.
 * Creates an invitation via GraphQL mutation which sends an email
 * with an invite link. Upon acceptance, the user is automatically assigned
 * the 'viewer' role.
 */
export const InviteUserDrawer = ({
  open,
  onClose,
  organizationId,
  organizationName,
  onSuccess,
}: InviteUserDrawerProps) => {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [inviteUser, { loading, error, reset }] = useInviteOrganizationUserMutation();

  // Reset form state when drawer opens/closes to prevent stale data
  useEffect(() => {
    if (!open) {
      setEmail('');
      setFirstName('');
      setLastName('');
      setSuccessMessage(null);
      reset();
    }
  }, [open, reset]);

  const handleClose = () => {
    // Reset form
    setEmail('');
    setFirstName('');
    setLastName('');
    setSuccessMessage(null);
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!email) {
      return;
    }

    try {
      // Build redirect URL with organization ID as query param (URL-encoded for safety)
      // The OIDC config dynamically detects this and uses it as redirect_uri
      const redirectUrl = `${window.location.origin}/?${ORG_ID_PARAM}=${encodeURIComponent(organizationId)}`;

      const result = await inviteUser({
        variables: {
          organizationId,
          input: {
            email,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            redirectUrl,
          },
        },
      });

      if (result.data?.inviteOrganizationUser) {
        setSuccessMessage(`Invitation sent to ${email}. The invitation link expires in 24 hours.`);
        // Reset form for another invitation
        setEmail('');
        setFirstName('');
        setLastName('');

        // Notify parent of success
        onSuccess?.();
      }
    } catch (err) {
      console.error('Failed to invite user:', err);
      // Error will be displayed via the error state from the mutation hook
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 450 },
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
          Invite User to {organizationName}
        </Typography>
        <IconButton onClick={handleClose} size="small" aria-label="close">
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {successMessage && (
            <Alert severity="success" onClose={() => setSuccessMessage(null)}>
              {successMessage}
            </Alert>
          )}

          {error && <Alert severity="error">{error.message}</Alert>}

          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            autoComplete="off"
            placeholder="user@example.com"
            helperText="The user will receive an invitation email with a link to join"
            error={email.length > 0 && !isValidEmail(email)}
            disabled={loading}
          />

          <TextField
            label="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            fullWidth
            autoComplete="off"
            placeholder="John"
            helperText="Optional - used in the invitation email"
            disabled={loading}
          />

          <TextField
            label="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            fullWidth
            autoComplete="off"
            placeholder="Doe"
            helperText="Optional - used in the invitation email"
            disabled={loading}
          />

          <Alert severity="info" sx={{ mt: 1 }}>
            Invited users are automatically assigned the <strong>viewer</strong> role. You can
            change their role after they accept the invitation.
          </Alert>
        </Box>
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
          Close
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !email || !isValidEmail(email)}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {loading ? 'Sending...' : 'Send Invitation'}
        </Button>
      </Box>
    </Drawer>
  );
};
