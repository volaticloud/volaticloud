import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  FormHelperText,
  Divider,
  CircularProgress,
} from '@mui/material';
import { Close, Add, Edit } from '@mui/icons-material';
import { useState, useEffect, useMemo } from 'react';
import { useDialogUnsavedChanges } from '../../hooks';
import { UnsavedChangesDrawer } from '../shared';

export interface StrategyNameDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Current name (for edit mode) */
  initialName?: string;
  /** Current description (for edit mode) */
  initialDescription?: string;
  /** Called when form is submitted with valid data */
  onSubmit: (name: string, description: string) => Promise<void>;
  /** Loading state from parent mutation */
  loading?: boolean;
  /** Error from parent mutation */
  error?: Error | null;
  /** Mode determines title, icon, and button text */
  mode: 'create' | 'rename';
}

export const StrategyNameDrawer = ({
  open,
  onClose,
  initialName = '',
  initialDescription = '',
  onSubmit,
  loading = false,
  error = null,
  mode,
}: StrategyNameDrawerProps) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  // Reset form when drawer opens with new values
  useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription(initialDescription);
    }
  }, [open, initialName, initialDescription]);

  // Track if form has been modified
  const hasChanges = useMemo(() => {
    return name !== initialName || description !== initialDescription;
  }, [name, description, initialName, initialDescription]);

  const { handleClose, confirmDialogOpen, cancelClose, confirmClose } = useDialogUnsavedChanges({
    hasChanges,
    onClose,
  });

  const canSubmit = name.trim() && (mode === 'create' || hasChanges) && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    await onSubmit(name.trim(), description.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && canSubmit) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Mode-specific configuration
  const config = {
    create: {
      title: 'Create New Strategy',
      icon: <Add color="primary" />,
      submitText: 'Create & Open Studio',
      loadingText: 'Creating...',
      errorPrefix: 'Error creating strategy',
      description: "Give your strategy a name and optional description. You'll configure the trading logic in the Strategy Studio.",
      nameHelperText: 'Choose a descriptive name for your strategy',
      descriptionHelperText: "Optional - helps you remember the strategy's purpose",
    },
    rename: {
      title: 'Rename Strategy',
      icon: <Edit color="primary" />,
      submitText: 'Save',
      loadingText: 'Saving...',
      errorPrefix: 'Error renaming strategy',
      description: null,
      nameHelperText: undefined,
      descriptionHelperText: undefined,
    },
  }[mode];

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 450 },
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {config.icon}
            <Typography variant="h6" component="h2">
              {config.title}
            </Typography>
          </Box>
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
            py: 3,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {config.description && (
              <Typography variant="body2" color="text.secondary">
                {config.description}
              </Typography>
            )}

            <TextField
              label="Strategy Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              required
              fullWidth
              autoFocus
              placeholder="e.g., RSI Momentum Strategy"
              helperText={config.nameHelperText}
            />

            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              placeholder="Briefly describe what this strategy does..."
              helperText={config.descriptionHelperText}
            />

            {error && (
              <FormHelperText error>
                {config.errorPrefix}: {error.message}
              </FormHelperText>
            )}
          </Box>
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
            onClick={handleSubmit}
            variant="contained"
            disabled={!canSubmit}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {loading ? config.loadingText : config.submitText}
          </Button>
        </Box>
      </Drawer>
      <UnsavedChangesDrawer
        open={confirmDialogOpen}
        onCancel={cancelClose}
        onDiscard={confirmClose}
      />
    </>
  );
};
