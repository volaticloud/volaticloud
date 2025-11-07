import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormHelperText,
  Box,
} from '@mui/material';
import { useState, useEffect } from 'react';
import { useUpdateStrategyMutation } from './strategies.generated';
import { JSONEditor } from '../JSONEditor';

interface EditStrategyDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  strategy: {
    id: string;
    name: string;
    description?: string | null;
    code: string;
    version: string;
    config?: object;
  };
}

export const EditStrategyDialog = ({ open, onClose, onSuccess, strategy }: EditStrategyDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [version, setVersion] = useState('');
  const [config, setConfig] = useState<object | null>(null);

  const [updateStrategy, { loading, error }] = useUpdateStrategyMutation();

  // Update form when strategy changes
  useEffect(() => {
    if (strategy) {
      setName(strategy.name);
      setDescription(strategy.description || '');
      setCode(strategy.code);
      setVersion(strategy.version);
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
            version: version || undefined,
            config: config || undefined,
          },
        },
      });

      // Only close if mutation was successful
      if (result.data?.updateStrategy) {
        onSuccess();
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

          <TextField
            label="Version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            fullWidth
            placeholder="e.g., 1.0.0"
          />

          <JSONEditor
            value={config}
            onChange={setConfig}
            label="Strategy Configuration (JSON)"
            helperText="Optional: Configure strategy-specific settings like max_open_trades, stake_amount, etc."
            height="200px"
            placeholder='{\n  "max_open_trades": 3,\n  "stake_amount": 100,\n  "stake_currency": "USDT"\n}'
          />

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