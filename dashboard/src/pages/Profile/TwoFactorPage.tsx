import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  IconButton,
  Divider,
} from '@mui/material';
import {
  QrCode2 as QrCodeIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useKeycloakAccount } from '../../hooks/useKeycloakAccount';
import { ConfirmDrawer } from '../../components/shared/FormDrawer';
import { useConfigValue } from '../../contexts/ConfigContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const TwoFactorPage = () => {
  useDocumentTitle('Two-Factor Authentication');
  const account = useKeycloakAccount();
  const authority = useConfigValue('VOLATICLOUD__KEYCLOAK_AUTHORITY');
  const clientId = useConfigValue('VOLATICLOUD__KEYCLOAK_CLIENT_ID');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<string | null>(null);

  // Extract OTP credentials from the credential types
  const otpCredentialType = account.credentials.find((c) => c.type === 'otp');
  const otpDevices = otpCredentialType?.userCredentialMetadatas.map((m) => m.credential) || [];
  const hasTwoFactor = otpDevices.length > 0;

  // Refresh credentials when component mounts
  useEffect(() => {
    account.refreshCredentials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount


  const handleStartSetup = () => {
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
      authUrl.searchParams.set('kc_action', 'CONFIGURE_TOTP');

      // Redirect to Keycloak
      window.location.href = authUrl.toString();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start 2FA setup');
    }
  };

  const handleDeleteDevice = async () => {
    if (!deviceToDelete) return;

    setLoading(true);
    setError(null);
    try {
      await account.deleteCredential(deviceToDelete);
      setSuccess('2FA device removed successfully');
      setDeleteDialogOpen(false);
      setDeviceToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove 2FA device');
    } finally {
      setLoading(false);
    }
  };

  const openDeleteDialog = (deviceId: string) => {
    setDeviceToDelete(deviceId);
    setDeleteDialogOpen(true);
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Two-Factor Authentication (2FA)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Add an extra layer of security to your account using an authenticator app.
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

      {account.loadingCredentials ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Status Card */}
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                {hasTwoFactor ? (
                  <CheckIcon color="success" />
                ) : (
                  <WarningIcon color="warning" />
                )}
                <Typography variant="subtitle1" fontWeight={600}>
                  Status: {hasTwoFactor ? 'Enabled' : 'Disabled'}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {hasTwoFactor
                  ? 'Your account is protected with two-factor authentication.'
                  : 'Enable 2FA to add an extra layer of security to your account.'}
              </Typography>
            </CardContent>
          </Card>

          {/* Setup Card */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Set Up New Device
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Use an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator.
              </Typography>
              <Button
                variant="contained"
                startIcon={<QrCodeIcon />}
                onClick={handleStartSetup}
                disabled={loading}
              >
                Add Authenticator App
              </Button>
            </CardContent>
          </Card>

          {/* Configured Devices */}
          {otpDevices.length > 0 && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  Configured Devices ({otpDevices.length})
                </Typography>
                <Divider sx={{ my: 1 }} />
                {otpDevices.map((device, index) => (
                  <Box
                    key={device.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 1.5,
                      borderBottom: index < otpDevices.length - 1 ? '1px solid' : 'none',
                      borderColor: 'divider',
                    }}
                  >
                    <Box>
                      <Typography variant="body1">
                        {device.userLabel || 'Authenticator App'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {device.createdDate
                          ? `Added: ${new Date(device.createdDate).toLocaleDateString()}`
                          : 'Date unknown'}
                      </Typography>
                    </Box>
                    <IconButton
                      onClick={() => openDeleteDialog(device.id)}
                      color="error"
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}
        </Box>
      )}

      {/* Delete Confirmation Drawer */}
      <ConfirmDrawer
        open={deleteDialogOpen}
        title="Remove 2FA Device?"
        message="Are you sure you want to remove this device? You will no longer be able to use it for two-factor authentication."
        onConfirm={handleDeleteDevice}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeviceToDelete(null);
        }}
        confirmLabel="Remove"
        confirmColor="error"
      />
    </Box>
  );
};
