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
  Divider,
  FormControlLabel,
  Checkbox,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { useState, useEffect } from 'react';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import {
  useUpdateExchangeMutation,
  type BinanceConfigInput,
  type KrakenConfigInput,
  type BybitConfigInput,
  type BitfinexConfigInput,
  type PassphraseExchangeConfigInput,
  ExchangeExchangeType,
} from '../../generated/graphql';

interface EditExchangeDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  exchange: {
    id: string;
    name: ExchangeExchangeType;
    testMode: boolean;
  } | null;
}

// Helper to determine if exchange needs passphrase
const needsPassphrase = (type: ExchangeExchangeType): boolean => {
  return type === ExchangeExchangeType.Coinbase ||
         type === ExchangeExchangeType.Kucoin ||
         type === ExchangeExchangeType.Okx;
};

export const EditExchangeDialog = ({ open, onClose, onSuccess, exchange }: EditExchangeDialogProps) => {
  const [testMode, setTestMode] = useState(false);

  // Config state
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');

  // Visibility toggles
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);

  const [updateExchange, { loading, error }] = useUpdateExchangeMutation();

  // Reset form when exchange changes
  useEffect(() => {
    if (exchange) {
      setTestMode(exchange.testMode);
      setApiKey('');
      setApiSecret('');
      setPassphrase('');
      setShowApiSecret(false);
      setShowPassphrase(false);
    }
  }, [exchange]);

  const handleSubmit = async () => {
    if (!exchange) return;

    // Only include config if credentials are provided
    let config: any = undefined;

    if (apiKey && apiSecret) {
      if (needsPassphrase(exchange.name)) {
        if (!passphrase) {
          return; // Passphrase required but not provided
        }

        const passphraseConfig: PassphraseExchangeConfigInput = {
          apiKey,
          apiSecret,
          passphrase,
        };

        if (exchange.name === ExchangeExchangeType.Coinbase) {
          config = { coinbase: passphraseConfig };
        } else if (exchange.name === ExchangeExchangeType.Kucoin) {
          config = { kucoin: passphraseConfig };
        } else if (exchange.name === ExchangeExchangeType.Okx) {
          config = { okx: passphraseConfig };
        }
      } else {
        const standardConfig = { apiKey, apiSecret };

        if (exchange.name === ExchangeExchangeType.Binance) {
          config = { binance: standardConfig as BinanceConfigInput };
        } else if (exchange.name === ExchangeExchangeType.Binanceus) {
          config = { binanceus: standardConfig as BinanceConfigInput };
        } else if (exchange.name === ExchangeExchangeType.Kraken) {
          config = { kraken: standardConfig as KrakenConfigInput };
        } else if (exchange.name === ExchangeExchangeType.Bybit) {
          config = { bybit: standardConfig as BybitConfigInput };
        } else if (exchange.name === ExchangeExchangeType.Bitfinex) {
          config = { bitfinex: standardConfig as BitfinexConfigInput };
        }
      }
    }

    try {
      await updateExchange({
        variables: {
          id: exchange.id,
          input: {
            testMode,
            ...(config && { config }),
          },
        },
      });

      // Reset form
      setApiKey('');
      setApiSecret('');
      setPassphrase('');
      setShowApiSecret(false);
      setShowPassphrase(false);

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to update exchange:', err);
    }
  };

  if (!exchange) return null;

  const isPassphraseRequired = needsPassphrase(exchange.name);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Exchange: {exchange.name}</DialogTitle>
      <DialogContent dividers sx={{ maxHeight: '70vh' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={testMode}
                onChange={(e) => setTestMode(e.target.checked)}
              />
            }
            label="Test Mode (Sandbox/Testnet)"
          />

          <Divider sx={{ my: 1 }} />

          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Update API Credentials (Optional)
          </Typography>

          <FormHelperText>
            Leave fields empty to keep existing credentials. Fill in all fields to update credentials.
          </FormHelperText>

          <TextField
            label="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            fullWidth
            autoComplete="off"
            helperText="Your exchange API key"
          />

          <TextField
            label="API Secret"
            type={showApiSecret ? 'text' : 'password'}
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            fullWidth
            autoComplete="off"
            helperText="Your exchange API secret"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowApiSecret(!showApiSecret)}
                    edge="end"
                  >
                    {showApiSecret ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {isPassphraseRequired && (
            <TextField
              label="Passphrase"
              type={showPassphrase ? 'text' : 'password'}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              fullWidth
              autoComplete="off"
              helperText="Your exchange API passphrase"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      edge="end"
                    >
                      {showPassphrase ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          )}

          {error && (
            <FormHelperText error>
              Error updating exchange: {error.message}
            </FormHelperText>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
        >
          {loading ? 'Updating...' : 'Update Exchange'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};