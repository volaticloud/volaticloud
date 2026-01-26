import { useState, useEffect, useCallback } from 'react';
import { Alert, Button, Snackbar, Box, Typography, Chip } from '@mui/material';
import { WifiOff as WifiOffIcon, Wifi as WifiIcon } from '@mui/icons-material';
import {
  ConnectionStatus,
  addConnectionStatusListener,
  reconnectWebSocket,
} from '../../graphql/client';

interface WebSocketStatusProps {
  /** Show status indicator chip (for headers/footers) */
  showIndicator?: boolean;
  /** Show error banner when disconnected */
  showErrorBanner?: boolean;
}

/**
 * WebSocketStatus displays connection status for GraphQL subscriptions.
 *
 * Features:
 * - Status indicator chip showing connected/disconnected state
 * - Error banner with reconnect button when connection fails
 */
export function WebSocketStatus({
  showIndicator = false,
  showErrorBanner = true
}: WebSocketStatusProps) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<Error | null>(null);
  const [showSnackbar, setShowSnackbar] = useState(false);

  useEffect(() => {
    const unsubscribe = addConnectionStatusListener((newStatus, err) => {
      setStatus(newStatus);
      if (newStatus === 'error') {
        setError(err || new Error('Connection failed'));
        setShowSnackbar(true);
      } else if (newStatus === 'connected') {
        setError(null);
        setShowSnackbar(false);
      } else if (newStatus === 'disconnected') {
        setShowSnackbar(true);
      }
    });

    return unsubscribe;
  }, []);

  const handleReconnect = useCallback(() => {
    setShowSnackbar(false);
    reconnectWebSocket();
  }, []);

  const handleClose = useCallback(() => {
    setShowSnackbar(false);
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'success';
      case 'connecting':
        return 'warning';
      case 'disconnected':
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'connected':
        return 'Live';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Connection Error';
      default:
        return 'Unknown';
    }
  };

  return (
    <>
      {/* Status indicator chip */}
      {showIndicator && (
        <Chip
          icon={status === 'connected' ? <WifiIcon /> : <WifiOffIcon />}
          label={getStatusLabel()}
          color={getStatusColor()}
          size="small"
          variant="outlined"
          sx={{ ml: 1 }}
        />
      )}

      {/* Error/disconnection banner */}
      {showErrorBanner && (
        <Snackbar
          open={showSnackbar && (status === 'error' || status === 'disconnected')}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert
            severity="warning"
            sx={{ width: '100%' }}
            action={
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Button color="inherit" size="small" onClick={handleReconnect}>
                  Reconnect
                </Button>
                <Button color="inherit" size="small" onClick={handleClose}>
                  Dismiss
                </Button>
              </Box>
            }
          >
            <Typography variant="body2">
              Real-time updates unavailable.
              {error && ` ${error.message}`}
            </Typography>
          </Alert>
        </Snackbar>
      )}
    </>
  );
}

