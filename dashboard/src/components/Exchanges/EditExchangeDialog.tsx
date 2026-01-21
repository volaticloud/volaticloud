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
import { useState, useEffect, useMemo } from 'react';
import { useUpdateExchangeMutation } from './exchanges.generated';
import { JSONEditor } from '../JSONEditor';
import { useDialogUnsavedChanges } from '../../hooks';
import { UnsavedChangesDialog } from '../shared';

interface EditExchangeDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  exchange: {
    id: string;
    name: string;
    config?: any;
  } | null;
}

export const EditExchangeDialog = ({ open, onClose, onSuccess, exchange }: EditExchangeDialogProps) => {
  const [name, setName] = useState('');
  const [config, setConfig] = useState<object | null>(null);

  const [updateExchange, { loading, error }] = useUpdateExchangeMutation();

  // Track if form has been modified from original exchange values
  const hasChanges = useMemo(() => {
    if (!exchange) return false;
    if (name !== exchange.name) return true;
    if (JSON.stringify(config) !== JSON.stringify(exchange.config || null)) return true;
    return false;
  }, [name, config, exchange]);

  const { handleClose, confirmDialogOpen, cancelClose, confirmClose } = useDialogUnsavedChanges({
    hasChanges,
    onClose,
  });

  // Reset form when exchange changes
  useEffect(() => {
    if (exchange) {
      setName(exchange.name);
      // Populate config if it exists
      setConfig(exchange.config || null);
    }
  }, [exchange]);

  const handleSubmit = async () => {
    if (!exchange) return;

    try {
      const input: Record<string, unknown> = {};

      // Only update fields that are provided
      if (name !== exchange.name) {
        input.name = name;
      }

      if (config) {
        input.config = config;
      }

      // If nothing changed, close without making request
      if (Object.keys(input).length === 0) {
        onClose();
        return;
      }

      const result = await updateExchange({
        variables: {
          id: exchange.id,
          input,
        },
      });

      // Only close if mutation was successful
      if (result.data?.updateExchange) {
        // Reset form
        setName('');
        setConfig(null);

        onSuccess();
        onClose();
      }
      // If there are errors, they will be displayed via the error state
    } catch (err) {
      console.error('Failed to update exchange:', err);
      // Error will be displayed via the error state from the mutation hook
    }
  };

  if (!exchange) return null;

  return (
    <>
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Exchange</DialogTitle>
      <DialogContent dividers sx={{ maxHeight: '70vh' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          <TextField
            label="Exchange Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoComplete="off"
            placeholder="e.g., Binance Production, Coinbase Testnet"
            helperText="A descriptive name to identify this exchange configuration"
          />

          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Freqtrade Exchange Configuration (Optional)
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Leave empty to keep existing configuration. Provide new JSON to update.
            </Typography>
            <JSONEditor
              value={config}
              onChange={setConfig}
              height="400px"
              placeholder={`{\n  "exchange": {\n    "name": "binance",\n    "key": "your-api-key",\n    "secret": "your-api-secret",\n    "pair_whitelist": ["BTC/USDT", "ETH/USDT"]\n  }\n}`}
              helperText="Complete freqtrade exchange config including credentials"
            />
          </Box>

          {error && (
            <FormHelperText error>
              Error updating exchange: {error.message}
            </FormHelperText>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
        >
          {loading ? 'Updating...' : 'Update Exchange'}
        </Button>
      </DialogActions>
    </Dialog>
    <UnsavedChangesDialog
      open={confirmDialogOpen}
      onCancel={cancelClose}
      onDiscard={confirmClose}
    />
    </>
  );
};