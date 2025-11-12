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
import { useState, useEffect } from 'react';
import { useUpdateStrategyMutation } from './strategies.generated';
import { FreqtradeConfigForm } from '../Freqtrade/FreqtradeConfigForm';

interface EditStrategyDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (newStrategyId: string) => void;
  strategy: {
    id: string;
    name: string;
    description?: string | null;
    code: string;
    config?: object;
  };
}

export const EditStrategyDialog = ({ open, onClose, onSuccess, strategy }: EditStrategyDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [config, setConfig] = useState<object | null>(null);

  const [updateStrategy, { loading, error }] = useUpdateStrategyMutation();

  // Update form when strategy changes
  useEffect(() => {
    if (strategy) {
      setName(strategy.name);
      setDescription(strategy.description || '');
      setCode(strategy.code);
      setConfig(strategy.config || null);
    }
  }, [strategy]);

  const handleSubmit = async () => {
    if (!name || !code) {
      return;
    }

    try {
      const result = await updateStrategy({
        variables: {
          id: strategy.id,
          input: {
            name,
            description: description || undefined,
            code,
            config: config || undefined,
          },
        },
      });

      // Only close if mutation was successful
      if (result.data?.updateStrategy) {
        // Pass the new strategy ID (updateStrategy creates a new version)
        onSuccess(result.data.updateStrategy.id);
        onClose();
      }
      // If there are errors, they will be displayed via the error state
    } catch (err) {
      console.error('Failed to update strategy:', err);
      // Error will be displayed via the error state from the mutation hook
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Strategy</DialogTitle>
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

          <TextField
            label="Python Strategy Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            fullWidth
            multiline
            rows={10}
            placeholder="# Enter your Freqtrade strategy code here..."
            sx={{ fontFamily: 'monospace' }}
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
              Error updating strategy: {error.message}
            </FormHelperText>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !name || !code}
        >
          {loading ? 'Updating...' : 'Update Strategy'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};