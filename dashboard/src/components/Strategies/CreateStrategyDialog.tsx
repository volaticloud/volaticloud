import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormHelperText,
  Box,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useCreateStrategyMutation } from './strategies.generated';
import { FreqtradeConfigForm } from '../Freqtrade/FreqtradeConfigForm';
import { useActiveOrganization } from '../../contexts/OrganizationContext';
import { PythonCodeEditor } from './PythonCodeEditor';

interface CreateStrategyDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateStrategyDialog = ({ open, onClose, onSuccess }: CreateStrategyDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [config, setConfig] = useState<object | null>(null);

  const { activeOrganizationId } = useActiveOrganization();
  const [createStrategy, { loading, error }] = useCreateStrategyMutation();

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
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Create New Strategy</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !name || !code || !config || !activeOrganizationId}
        >
          {loading ? 'Creating...' : 'Create Strategy'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};