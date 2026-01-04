import { useEffect } from 'react';
import { Box, Typography, Button, Alert, CircularProgress } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { SessionItem } from './SessionItem';
import type { KeycloakSession } from '../../services/keycloak';

interface SessionsListProps {
  sessions: KeycloakSession[];
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<boolean>;
}

export const SessionsList = ({
  sessions,
  loading,
  error,
  onRefresh,
  onDeleteSession,
}: SessionsListProps) => {
  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6" fontWeight={600}>
            Active Sessions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage devices and sessions where you're logged in
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={onRefresh}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && sessions.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sessions.length === 0 ? (
            <Typography color="text.secondary">No active sessions</Typography>
          ) : (
            sessions.map((session) => (
              <SessionItem key={session.id} session={session} onDelete={onDeleteSession} />
            ))
          )}
        </Box>
      )}
    </Box>
  );
};
