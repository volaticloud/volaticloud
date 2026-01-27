import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
} from '@mui/material';
import {
  Lock as LockIcon,
} from '@mui/icons-material';
import { useConfigValue } from '../../contexts/ConfigContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const CredentialsPage = () => {
  useDocumentTitle('Password');
  const authority = useConfigValue('VOLATICLOUD__KEYCLOAK_AUTHORITY');
  const clientId = useConfigValue('VOLATICLOUD__KEYCLOAK_CLIENT_ID');

  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);


  const handleChangePassword = () => {
    try {
      // Save current path to sessionStorage (Keycloak overwrites state parameter)
      sessionStorage.setItem('kc_return_path', window.location.pathname);

      // Use base origin as redirect_uri (Keycloak AIA uses client Base URL anyway)
      const redirectUrl = window.location.origin;

      // Generate state and nonce for OIDC security
      const state = crypto.randomUUID();
      const nonce = crypto.randomUUID();

      // Build authorization URL
      const authUrl = new URL(`${authority}/protocol/openid-connect/auth`);
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUrl);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('response_mode', 'query');
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid');
      authUrl.searchParams.set('nonce', nonce);
      authUrl.searchParams.set('kc_action', 'UPDATE_PASSWORD');

      // Redirect to Keycloak
      window.location.href = authUrl.toString();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start password change');
    }
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Password
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage your account password.
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Change Password
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Update your password to keep your account secure.
          </Typography>
          <Button
            variant="contained"
            startIcon={<LockIcon />}
            onClick={handleChangePassword}
          >
            Change Password
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};
