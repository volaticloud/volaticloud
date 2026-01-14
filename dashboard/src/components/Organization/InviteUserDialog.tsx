import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useInviteOrganizationUserMutation } from './organization.generated';
import { ORG_ID_PARAM } from '../../constants/url';
import { isValidEmail } from '../../utils/validation';

interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
  onSuccess?: () => void;
}

/**
 * Dialog for inviting a user to an organization.
 * Creates an invitation via GraphQL mutation which sends an email
 * with an invite link. Upon acceptance, the user is automatically assigned
 * the 'viewer' role.
 */
export const InviteUserDialog = ({
  open,
  onClose,
  organizationId,
  organizationName,
  onSuccess,
}: InviteUserDialogProps) => {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [inviteUser, { loading, error, reset }] = useInviteOrganizationUserMutation();

  // Reset form state when dialog opens/closes to prevent stale data
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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Invite User to {organizationName}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
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
      </DialogContent>
      <DialogActions>
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
      </DialogActions>
    </Dialog>
  );
};
