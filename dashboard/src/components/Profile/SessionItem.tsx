import { useState } from 'react';
import { Card, CardContent, Typography, Button, Box, Chip, Divider } from '@mui/material';
import {
  Computer as ComputerIcon,
  Smartphone as SmartphoneIcon,
  LocationOn as LocationIcon,
  Schedule as ScheduleIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { ConfirmDrawer } from '../shared/FormDrawer';
import type { KeycloakSession } from '../../services/keycloak';

interface SessionItemProps {
  session: KeycloakSession;
  onDelete: (sessionId: string) => Promise<boolean>;
}

export const SessionItem = ({ session, onDelete }: SessionItemProps) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const success = await onDelete(session.id);
    setDeleting(false);
    if (success) {
      setConfirmOpen(false);
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const isMobile = session.browser?.toLowerCase().includes('mobile');

  return (
    <>
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
              <Box>
                {isMobile ? (
                  <SmartphoneIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                ) : (
                  <ComputerIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                )}
              </Box>

              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {session.browser || 'Unknown Browser'}
                  </Typography>
                  {session.current && (
                    <Chip label="Current Session" color="primary" size="small" />
                  )}
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {session.ipAddress && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LocationIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {session.ipAddress}
                      </Typography>
                    </Box>
                  )}

                  {session.started && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ScheduleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        Started: {formatDate(session.started)}
                      </Typography>
                    </Box>
                  )}

                  {session.lastAccess && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ScheduleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        Last access: {formatDate(session.lastAccess)}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {session.clients && session.clients.length > 0 && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="caption" color="text.secondary">
                      Applications:{' '}
                      {session.clients.map((c) => c.clientName || c.clientId).join(', ')}
                    </Typography>
                  </>
                )}
              </Box>
            </Box>

            {!session.current && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<LogoutIcon />}
                onClick={() => setConfirmOpen(true)}
              >
                Revoke
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      <ConfirmDrawer
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Revoke Session"
        message={
          <>
            Are you sure you want to revoke this session? This will log you out from this device.
            {session.browser && (
              <Box sx={{ mt: 1 }}>
                <strong>{session.browser}</strong> - {session.ipAddress}
              </Box>
            )}
          </>
        }
        confirmLabel="Revoke Session"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
};
