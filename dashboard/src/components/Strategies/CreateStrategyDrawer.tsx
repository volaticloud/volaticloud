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
import { Close } from '@mui/icons-material';
import { useState, useMemo } from 'react';
import { useCreateStrategyMutation } from './strategies.generated';
import { FreqtradeConfigForm } from '../Freqtrade/FreqtradeConfigForm';
import { useActiveOrganization } from '../../contexts/OrganizationContext';
import { PythonCodeEditor } from './PythonCodeEditor';
import { useDialogUnsavedChanges } from '../../hooks';
import { UnsavedChangesDrawer } from '../shared';

interface CreateStrategyDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateStrategyDrawer = ({ open, onClose, onSuccess }: CreateStrategyDrawerProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [config, setConfig] = useState<object | null>(null);

  const { activeOrganizationId } = useActiveOrganization();
  const [createStrategy, { loading, error }] = useCreateStrategyMutation();

  // Track if form has been modified
  const hasChanges = useMemo(() => {
    if (name !== '') return true;
    if (description !== '') return true;
    if (code !== '') return true;
    if (config !== null) return true;
    return false;
  }, [name, description, code, config]);

  const { handleClose, confirmDialogOpen, cancelClose, confirmClose } = useDialogUnsavedChanges({
    hasChanges,
    onClose,
  });

  const handleSubmit = async () => {
    if (!name || !code || !config || !activeOrganizationId) {
      return;
    }

    try {
      const result = await createStrategy({
        variables: {
          input: {
            name,
            description: description || undefined,
            code,
            config,
            ownerID: activeOrganizationId,
          },
        },
      });

      // Only close and reset if mutation was successful
      if (result.data?.createStrategy) {
        // Reset form
        setName('');
        setDescription('');
        setCode('');
        setConfig(null);

        onSuccess();
        onClose();
      }
      // If there are errors, they will be displayed via the error state
    } catch (err) {
      console.error('Failed to create strategy:', err);
      // Error will be displayed via the error state from the mutation hook
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
            width: { xs: '100%', sm: 700 },
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
            Create New Strategy
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Strategy Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              autoFocus
            />

            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
            />

            <PythonCodeEditor
              value={code}
              onChange={setCode}
            />

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Freqtrade Configuration (Required)
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Configure trading parameters. The form is auto-generated from the official Freqtrade schema.
              </Typography>
              <FreqtradeConfigForm
                value={config}
                onChange={setConfig}
                hideSubmitButton
              />
            </Box>

            {error && (
              <FormHelperText error>
                Error creating strategy: {error.message}
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
            disabled={loading || !name || !code || !config || !activeOrganizationId}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {loading ? 'Creating...' : 'Create Strategy'}
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
