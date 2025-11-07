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
import { useState } from 'react';
import { useCreateStrategyMutation } from './strategies.generated';
import { JSONEditor } from '../JSONEditor';

interface CreateStrategyDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateStrategyDialog = ({ open, onClose, onSuccess }: CreateStrategyDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [version, setVersion] = useState('');
  const [config, setConfig] = useState<object | null>(null);

  const [createStrategy, { loading, error }] = useCreateStrategyMutation();

  const handleSubmit = async () => {
    if (!name || !code) {
      return;
    }

    try {
      const result = await createStrategy({
        variables: {
          input: {
            name,
            description: description || undefined,
            code,
            version: version || undefined,
            config: config || undefined,
          },
        },
      });

      // Only close and reset if mutation was successful
      if (result.data?.createStrategy) {
        // Reset form
        setName('');
        setDescription('');
        setCode('');
        setVersion('');
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
          disabled={loading || !name || !code}
        >
          {loading ? 'Creating...' : 'Create Strategy'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};