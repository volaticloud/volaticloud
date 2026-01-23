import { useEffect, useState, useRef } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Close, OpenInNew, Refresh } from '@mui/icons-material';
import { useConfigValue } from '../../contexts/ConfigContext';
import {
  useGetFreqtradeTokenMutation,
  GetFreqtradeTokenMutation,
} from './bots.generated';

interface FreqUIDrawerProps {
  open: boolean;
  onClose: () => void;
  botId: string;
  botName: string;
}

// FreqUI localStorage keys
const FREQUI_AUTH_KEY = 'ftAuthLoginInfo';
const FREQUI_SELECTED_BOT_KEY = 'ftSelectedBot';

/**
 * Updates localStorage with FreqUI bot authentication info.
 * FreqUI expects the format: { [botKey]: { botName, apiUrl, username, accessToken, refreshToken, autoRefresh } }
 *
 * IMPORTANT: We clear ALL existing entries and only keep the current bot.
 * This ensures no stale entries with outdated API URLs (e.g., /bot/{id} instead of /gateway/v1/bot/{id})
 * cause FreqUI to make requests to wrong endpoints.
 */
function updateFreqUIAuth(
  botId: string,
  botName: string,
  token: NonNullable<GetFreqtradeTokenMutation['getFreqtradeToken']>
) {
  // Clear all existing auth info to prevent stale API URLs
  // FreqUI will re-authenticate when switching bots anyway
  const authInfo: Record<string, unknown> = {
    [botId]: {
      botName: botName,
      apiUrl: token.apiUrl,
      username: token.username,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      autoRefresh: true,
    },
  };

  // Save fresh auth info to localStorage
  localStorage.setItem(FREQUI_AUTH_KEY, JSON.stringify(authInfo));

  // Set the selected bot so FreqUI auto-selects it
  localStorage.setItem(FREQUI_SELECTED_BOT_KEY, botId);
}

/**
 * FreqUIDrawer displays FreqUI in an iframe within a fullscreen drawer.
 * Before showing the iframe, it authenticates with the bot via backend
 * and pre-populates FreqUI's localStorage with the JWT tokens.
 */
export const FreqUIDrawer = ({ open, onClose, botId, botName }: FreqUIDrawerProps) => {
  const frequiUrl = useConfigValue('VOLATICLOUD__FREQUI_URL');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [getToken, { loading }] = useGetFreqtradeTokenMutation({
    onCompleted: (data) => {
      // Update localStorage with token
      updateFreqUIAuth(botId, botName, data.getFreqtradeToken);
      setIsReady(true);
      setAuthError(null);
    },
    onError: (error) => {
      console.error('Failed to get Freqtrade token:', error);
      setAuthError(error.message);
      setIsReady(false);
    },
  });

  // Fetch token when drawer opens
  useEffect(() => {
    if (open && botId) {
      setIsReady(false);
      setAuthError(null);
      getToken({ variables: { botId } });
    }
  }, [open, botId, getToken]);

  // Reset state when drawer closes
  useEffect(() => {
    if (!open) {
      setIsReady(false);
      setAuthError(null);
    }
  }, [open]);

  const handleOpenInNewTab = () => {
    window.open(frequiUrl, '_blank', 'noopener,noreferrer');
  };

  const handleRetry = () => {
    setAuthError(null);
    getToken({ variables: { botId } });
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: '95vw',
          maxWidth: '95vw',
          height: '100%',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="h6">FreqUI - {botName}</Typography>
          <Typography variant="body2" color="textSecondary">
            (Bot ID: {botId.substring(0, 8)}...)
          </Typography>
        </Box>
        <Box>
          <IconButton
            onClick={handleOpenInNewTab}
            title="Open in new tab"
            size="small"
            sx={{ mr: 1 }}
          >
            <OpenInNew />
          </IconButton>
          <IconButton onClick={onClose} title="Close" size="small">
            <Close />
          </IconButton>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {loading && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            height="100%"
            gap={2}
          >
            <CircularProgress />
            <Typography>Authenticating with bot...</Typography>
          </Box>
        )}

        {authError && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            height="100%"
            gap={2}
            p={4}
          >
            <Alert
              severity="error"
              action={
                <IconButton
                  color="inherit"
                  size="small"
                  onClick={handleRetry}
                  title="Retry"
                >
                  <Refresh />
                </IconButton>
              }
            >
              Failed to authenticate with bot: {authError}
            </Alert>
            <Typography variant="body2" color="textSecondary">
              Make sure the bot is running and healthy before opening FreqUI.
            </Typography>
          </Box>
        )}

        {isReady && !authError && (
          <Box
            component="iframe"
            ref={iframeRef}
            src={`${frequiUrl}trade`}
            sx={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
            title={`FreqUI - ${botName}`}
            allow="clipboard-write"
          />
        )}
      </Box>
    </Drawer>
  );
};

