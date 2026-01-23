import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Alert,
  Divider,
  CircularProgress,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { useState } from 'react';

export type ResourceType = 'strategy' | 'bot' | 'runner';

interface VisibilityToggleDrawerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  resourceType: ResourceType;
  resourceName: string;
  currentlyPublic: boolean;
  loading?: boolean;
}

const resourceTypeLabels: Record<ResourceType, string> = {
  strategy: 'Strategy',
  bot: 'Bot',
  runner: 'Runner',
};

export const VisibilityToggleDrawer = ({
  open,
  onClose,
  onConfirm,
  resourceType,
  resourceName,
  currentlyPublic,
  loading = false,
}: VisibilityToggleDrawerProps) => {
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    try {
      setError(null);
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('Failed to update visibility:', err);
      setError(err instanceof Error ? err.message : 'Failed to update visibility');
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const resourceLabel = resourceTypeLabels[resourceType];
  const newVisibility = currentlyPublic ? 'private' : 'public';
  const title = currentlyPublic
    ? `Make ${resourceLabel} Private`
    : `Make ${resourceLabel} Public`;

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
          {title}
        </Typography>
        <IconButton onClick={handleClose} size="small" aria-label="close">
          <Close />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ px: 3, py: 2 }}>
        <Typography variant="body1" gutterBottom>
          Are you sure you want to make "{resourceName}" {newVisibility}?
        </Typography>
        {currentlyPublic ? (
          <Typography variant="body2" color="text.secondary">
            Making this {resourceLabel.toLowerCase()} private will restrict access to only you.
            Other users will no longer be able to see or use it.
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Making this {resourceLabel.toLowerCase()} public will allow any authenticated user to
            view and use it. They will not be able to modify or delete it.
          </Typography>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
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
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={currentlyPublic ? 'warning' : 'primary'}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {loading
            ? 'Updating...'
            : currentlyPublic
            ? 'Make Private'
            : 'Make Public'}
        </Button>
      </Box>
    </Drawer>
  );
};
