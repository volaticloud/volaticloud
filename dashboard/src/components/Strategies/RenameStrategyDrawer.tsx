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
import { Close, Edit } from '@mui/icons-material';
import { useState, useEffect, useMemo } from 'react';
import { useUpdateStrategyMutation } from './strategies.generated';
import { useDialogUnsavedChanges } from '../../hooks';
import { UnsavedChangesDrawer } from '../shared';

interface RenameStrategyDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (newName: string, newDescription: string) => void;
  strategyId: string;
  currentName: string;
  currentDescription: string;
}

export const RenameStrategyDrawer = ({
  open,
  onClose,
  onSuccess,
  strategyId,
  currentName,
  currentDescription,
}: RenameStrategyDrawerProps) => {
  const [name, setName] = useState(currentName);
  const [description, setDescription] = useState(currentDescription);

  const [updateStrategy, { loading, error }] = useUpdateStrategyMutation();

  // Reset form when drawer opens with new values
  useEffect(() => {
    if (open) {
      setName(currentName);
      setDescription(currentDescription);
    }
  }, [open, currentName, currentDescription]);

  // Track if form has been modified
  const hasChanges = useMemo(() => {
    return name !== currentName || description !== currentDescription;
  }, [name, description, currentName, currentDescription]);

  const { handleClose, confirmDialogOpen, cancelClose, confirmClose } = useDialogUnsavedChanges({
    hasChanges,
    onClose,
  });

  const handleSubmit = async () => {
    if (!name.trim()) {
      return;
    }

    try {
      const result = await updateStrategy({
        variables: {
          id: strategyId,
          input: {
            name: name.trim(),
            description: description.trim() || undefined,
          },
        },
      });

      if (result.data?.updateStrategy) {
        onSuccess(name.trim(), description.trim());
        onClose();
      }
    } catch (err) {
      console.error('Failed to rename strategy:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && name.trim() && hasChanges && !loading) {
      e.preventDefault();
      handleSubmit();
    }
  };

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
            <Edit color="primary" />
            <Typography variant="h6" component="h2">
              Rename Strategy
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
            <TextField
              label="Strategy Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              required
              fullWidth
              autoFocus
              placeholder="e.g., RSI Momentum Strategy"
            />

            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              placeholder="Briefly describe what this strategy does..."
            />

            {error && (
              <FormHelperText error>
                Error renaming strategy: {error.message}
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
            disabled={loading || !name.trim() || !hasChanges}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {loading ? 'Saving...' : 'Save'}
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
