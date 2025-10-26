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
import { useCreateExchangeMutation } from '../../generated/graphql';
import { JSONEditor } from '../JSONEditor';

interface CreateExchangeDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateExchangeDialog = ({ open, onClose, onSuccess }: CreateExchangeDialogProps) => {
  const [name, setName] = useState('');
  const [config, setConfig] = useState<object | null>({
    exchange: {
      name: 'binance',
      key: 'your-api-key',
      secret: 'your-api-secret',
      ccxt_config: {},
      ccxt_async_config: {},
      pair_whitelist: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'],
    },
  });

  const [createExchange, { loading, error }] = useCreateExchangeMutation();

  const handleSubmit = async () => {
    if (!name || !config) {
      return;
    }

    try {
      const result = await createExchange({
        variables: {
          input: {
            name,
            config,
          },
        },
      });

      // Only close and reset if mutation was successful
      if (result.data?.createExchange) {
        // Reset form
        setName('');
        setConfig({
          exchange: {
            name: 'binance',
            key: 'your-api-key',
            secret: 'your-api-secret',
            ccxt_config: {},
            ccxt_async_config: {},
            pair_whitelist: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'],
          },
        });

        onSuccess();
        onClose();
      }
      // If there are errors, they will be displayed via the error state
    } catch (err) {
      console.error('Failed to create exchange:', err);
      // Error will be displayed via the error state from the mutation hook
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Add Exchange</DialogTitle>
      <DialogContent dividers sx={{ maxHeight: '70vh' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          <TextField
            label="Exchange Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            autoComplete="off"
            placeholder="e.g., Binance Production, Coinbase Testnet"
            helperText="A descriptive name to identify this exchange configuration"
          />

          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Freqtrade Exchange Configuration
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Complete freqtrade exchange config including credentials and pair whitelist.
              This config will be written to <code>config.exchange.json</code> and passed to freqtrade via <code>--config</code> parameter.
            </Typography>
            <JSONEditor
              value={config}
              onChange={setConfig}
              height="400px"
              helperText="Required fields: exchange.name, exchange.key, exchange.secret, exchange.pair_whitelist"
            />
          </Box>

          {error && (
            <FormHelperText error>
              Error creating exchange: {error.message}
            </FormHelperText>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !name || !config}
        >
          {loading ? 'Adding...' : 'Add Exchange'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};