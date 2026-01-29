import { useState, useMemo, useCallback } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Collapse,
  Divider,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useAuth } from '../../contexts/AuthContext';
import { useCreateOrganizationMutation } from './organization.generated';
import { useDialogUnsavedChanges } from '../../hooks/useDialogUnsavedChanges';
import { UnsavedChangesDrawer } from '../shared/UnsavedChangesDrawer';

interface CreateOrganizationDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Generate a URL-friendly ID from a title.
 * - Converts to lowercase
 * - Replaces spaces and special characters with hyphens
 * - Removes consecutive hyphens
 * - Trims hyphens from start and end
 * - Truncates to 50 characters
 */
function generateIdFromTitle(title: string): string {
  let id = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-') // Remove consecutive hyphens
    .replace(/^-|-$/g, ''); // Trim hyphens from start and end

  // Truncate to max length
  if (id.length > 50) {
    id = id.substring(0, 50).replace(/-$/, ''); // Remove trailing hyphen after truncation
  }

  return id;
}

/**
 * Validate organization ID format.
 * - Must be 3-50 characters long
 * - Lowercase alphanumeric with hyphens
 * - Cannot start or end with hyphen
 * - Cannot have consecutive hyphens
 * - Cannot contain path traversal sequences
 */
function validateId(id: string): string | null {
  if (id.length < 3) {
    return 'ID must be at least 3 characters';
  }
  if (id.length > 50) {
    return 'ID must be 50 characters or less';
  }
  // Security: prevent directory traversal attacks
  if (id === '.' || id === '..' || id.includes('/') || id.includes('\\')) {
    return 'ID contains invalid path characters';
  }
  if (id.startsWith('.')) {
    return 'ID cannot start with a dot';
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(id)) {
    return 'ID must be lowercase alphanumeric with hyphens, cannot start or end with hyphen';
  }
  if (/--/.test(id)) {
    return 'ID cannot contain consecutive hyphens';
  }
  return null;
}

export function CreateOrganizationDrawer({
  open,
  onClose,
}: CreateOrganizationDrawerProps) {
  const auth = useAuth();
  const [title, setTitle] = useState('');
  const [customId, setCustomId] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate ID from title when not manually set
  const effectiveId = useMemo(() => {
    if (customId.trim()) {
      return customId.trim();
    }
    return generateIdFromTitle(title);
  }, [title, customId]);

  // Validate ID
  const idError = useMemo(() => {
    if (!effectiveId) return null;
    return validateId(effectiveId);
  }, [effectiveId]);

  // Track if form has been modified
  const hasChanges = useMemo(() => {
    if (title !== '') return true;
    if (customId !== '') return true;
    return false;
  }, [title, customId]);

  // Clear form and close drawer
  const clearAndClose = useCallback(() => {
    setTitle('');
    setCustomId('');
    setShowAdvanced(false);
    setError(null);
    onClose();
  }, [onClose]);

  const { handleClose, confirmDialogOpen, cancelClose, confirmClose } = useDialogUnsavedChanges({
    hasChanges,
    onClose: clearAndClose,
  });

  const [createOrganization, { loading }] = useCreateOrganizationMutation({
    onCompleted: async () => {
      // Organization created in Keycloak, but the current session's refresh token
      // is bound to the OLD claims (without the new org membership).
      // signinSilent() reuses the existing session and won't pick up new org claims.
      // We must force a full re-authentication to create a NEW Keycloak session
      // that includes the updated organization membership in the JWT.
      // Since the user already has an active Keycloak SSO session, this redirect
      // is instant (no password prompt) — Keycloak auto-issues a new token.
      try {
        await auth.signinRedirect();
      } catch (err) {
        console.error('Failed to redirect for re-authentication:', err);
        setError(
          'Organization created successfully, but automatic login failed. Please refresh the page.'
        );
      }
    },
    onError: (err) => {
      setError(err.message || 'Failed to create organization');
    },
  });

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Organization title is required');
      return;
    }
    if (trimmedTitle.length > 100) {
      setError('Organization title must be 100 characters or less');
      return;
    }

    // Validate ID
    if (idError) {
      setError(idError);
      return;
    }

    await createOrganization({
      variables: {
        input: {
          title: trimmedTitle,
          // GraphQL API uses 'alias' field name (Keycloak terminology)
          alias: customId.trim() || undefined,
        },
      },
    });
  };

  return (
    <>
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
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
              Create New Organization
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
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              autoFocus
              fullWidth
              label="Organization Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Trading Organization"
              disabled={loading}
              margin="dense"
            />

            {/* Show auto-generated ID preview */}
            {effectiveId && !showAdvanced && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                ID: <strong>{effectiveId}</strong>
              </Typography>
            )}

            {/* Advanced settings toggle */}
            <Button
              size="small"
              onClick={() => setShowAdvanced(!showAdvanced)}
              endIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{ mt: 1, textTransform: 'none' }}
            >
              {showAdvanced ? 'Hide advanced' : 'Customize ID'}
            </Button>

            <Collapse in={showAdvanced}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  fullWidth
                  label="Organization ID"
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value.toLowerCase())}
                  placeholder={generateIdFromTitle(title) || 'my-organization'}
                  disabled={loading}
                  margin="dense"
                  error={!!idError}
                  helperText={
                    idError ||
                    'URL-friendly identifier (3-50 chars, lowercase, hyphens allowed). Cannot be changed after creation.'
                  }
                />
                {!customId && title && (
                  <Typography variant="caption" color="text.secondary">
                    Will be auto-generated as: <strong>{effectiveId}</strong>
                  </Typography>
                )}
              </Box>
            </Collapse>
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
              type="submit"
              variant="contained"
              disabled={loading || !title.trim() || !!idError}
              startIcon={loading ? <CircularProgress size={16} /> : <AddIcon />}
            >
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </Box>
        </form>
      </Drawer>
      <UnsavedChangesDrawer
        open={confirmDialogOpen}
        onCancel={cancelClose}
        onDiscard={confirmClose}
      />
    </>
  );
}
