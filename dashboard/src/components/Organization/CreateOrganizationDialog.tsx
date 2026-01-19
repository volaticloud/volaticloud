import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Typography,
  Box,
  Collapse,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useAuth } from '../../contexts/AuthContext';
import { useCreateOrganizationMutation } from './organization.generated';

interface CreateOrganizationDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Generate a URL-friendly alias from a title.
 * - Converts to lowercase
 * - Replaces spaces and special characters with hyphens
 * - Removes consecutive hyphens
 * - Trims hyphens from start and end
 * - Truncates to 50 characters
 */
function generateAliasFromTitle(title: string): string {
  let alias = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-') // Remove consecutive hyphens
    .replace(/^-|-$/g, ''); // Trim hyphens from start and end

  // Truncate to max length
  if (alias.length > 50) {
    alias = alias.substring(0, 50).replace(/-$/, ''); // Remove trailing hyphen after truncation
  }

  return alias;
}

/**
 * Validate organization alias format.
 * - Must be 3-50 characters long
 * - Lowercase alphanumeric with hyphens
 * - Cannot start or end with hyphen
 * - Cannot have consecutive hyphens
 * - Cannot contain path traversal sequences
 */
function validateAlias(alias: string): string | null {
  if (alias.length < 3) {
    return 'Alias must be at least 3 characters';
  }
  if (alias.length > 50) {
    return 'Alias must be 50 characters or less';
  }
  // Security: prevent directory traversal attacks
  if (alias === '.' || alias === '..' || alias.includes('/') || alias.includes('\\')) {
    return 'Alias contains invalid path characters';
  }
  if (alias.startsWith('.')) {
    return 'Alias cannot start with a dot';
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(alias)) {
    return 'Alias must be lowercase alphanumeric with hyphens, cannot start or end with hyphen';
  }
  if (/--/.test(alias)) {
    return 'Alias cannot contain consecutive hyphens';
  }
  return null;
}

export function CreateOrganizationDialog({
  open,
  onClose,
  onSuccess,
}: CreateOrganizationDialogProps) {
  const auth = useAuth();
  const [title, setTitle] = useState('');
  const [alias, setAlias] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate alias from title when alias is not manually set
  const effectiveAlias = useMemo(() => {
    if (alias.trim()) {
      return alias.trim();
    }
    return generateAliasFromTitle(title);
  }, [title, alias]);

  // Validate alias
  const aliasError = useMemo(() => {
    if (!effectiveAlias) return null;
    return validateAlias(effectiveAlias);
  }, [effectiveAlias]);

  const [createOrganization, { loading }] = useCreateOrganizationMutation({
    onCompleted: async () => {
      // Refresh token BEFORE closing dialog to ensure JWT has new organization claims
      try {
        await auth.signinSilent();
      } catch (refreshError) {
        console.error('Failed to refresh token after organization creation:', refreshError);
        // Organization was created successfully, but token refresh failed
        // User will need to manually refresh (sign out and back in) to see the new org
        setError('Organization created, but session refresh failed. Please sign out and sign back in to see your new organization.');
        return;
      }
      // Token refreshed successfully, now close dialog and notify success
      handleClose();
      onSuccess?.();
    },
    onError: (err) => {
      setError(err.message || 'Failed to create organization');
    },
  });

  const handleClose = () => {
    setTitle('');
    setAlias('');
    setShowAdvanced(false);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    // Validate alias
    if (aliasError) {
      setError(aliasError);
      return;
    }

    await createOrganization({
      variables: {
        input: {
          title: trimmedTitle,
          alias: alias.trim() || undefined, // Only send if manually set
        },
      },
    });
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create New Organization</DialogTitle>
        <DialogContent>
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

          {/* Show auto-generated alias preview */}
          {effectiveAlias && !showAdvanced && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Alias: <strong>{effectiveAlias}</strong>
            </Typography>
          )}

          {/* Advanced settings toggle */}
          <Button
            size="small"
            onClick={() => setShowAdvanced(!showAdvanced)}
            endIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ mt: 1, textTransform: 'none' }}
          >
            {showAdvanced ? 'Hide advanced' : 'Customize alias'}
          </Button>

          <Collapse in={showAdvanced}>
            <Box sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label="Organization Alias"
                value={alias}
                onChange={(e) => setAlias(e.target.value.toLowerCase())}
                placeholder={generateAliasFromTitle(title) || 'my-organization'}
                disabled={loading}
                margin="dense"
                error={!!aliasError}
                helperText={
                  aliasError ||
                  'URL-friendly identifier (3-50 chars, lowercase, hyphens allowed). Cannot be changed after creation.'
                }
              />
              {!alias && title && (
                <Typography variant="caption" color="text.secondary">
                  Will be auto-generated as: <strong>{effectiveAlias}</strong>
                </Typography>
              )}
            </Box>
          </Collapse>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !title.trim() || !!aliasError}
            startIcon={loading ? <CircularProgress size={16} /> : <AddIcon />}
          >
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
