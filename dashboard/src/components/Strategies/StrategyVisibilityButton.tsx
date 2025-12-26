import { useState } from 'react';
import { IconButton, Tooltip, Snackbar, Alert } from '@mui/material';
import { Public as PublicIcon, Lock as LockIcon } from '@mui/icons-material';
import { useSetStrategyVisibilityMutation } from './strategies.generated';
import { VisibilityToggleDialog } from '../shared/VisibilityToggleDialog';

interface StrategyVisibilityButtonProps {
  strategyId: string;
  strategyName: string;
  isPublic: boolean;
  onSuccess?: () => void;
}

export const StrategyVisibilityButton = ({
  strategyId,
  strategyName,
  isPublic,
  onSuccess,
}: StrategyVisibilityButtonProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const [setStrategyVisibility, { loading }] = useSetStrategyVisibilityMutation();

  const handleConfirm = async () => {
    try {
      const result = await setStrategyVisibility({
        variables: {
          id: strategyId,
          public: !isPublic,
        },
      });
      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'Failed to update visibility');
      }
      setSnackbar({
        open: true,
        message: `Strategy is now ${isPublic ? 'private' : 'public'}`,
        severity: 'success',
      });
      onSuccess?.();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Failed to update visibility',
        severity: 'error',
      });
      throw error;
    }
  };

  return (
    <>
      <Tooltip title={isPublic ? 'Make Private' : 'Make Public'}>
        <IconButton
          size="small"
          color={isPublic ? 'info' : 'default'}
          onClick={() => setDialogOpen(true)}
        >
          {isPublic ? <PublicIcon /> : <LockIcon />}
        </IconButton>
      </Tooltip>

      <VisibilityToggleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleConfirm}
        resourceType="strategy"
        resourceName={strategyName}
        currentlyPublic={isPublic}
        loading={loading}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};