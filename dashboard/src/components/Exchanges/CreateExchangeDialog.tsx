import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Box,
  Typography,
  Divider,
  FormControlLabel,
  Checkbox,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { useState } from 'react';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import {
  useCreateExchangeMutation,
  type BinanceConfigInput,
  type KrakenConfigInput,
  type BybitConfigInput,
  type BitfinexConfigInput,
  type PassphraseExchangeConfigInput,
  ExchangeExchangeType,
} from '../../generated/graphql';

interface CreateExchangeDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Define exchange type with proper typing
type ExchangeType = ExchangeExchangeType;

// Helper to determine if exchange needs passphrase
const needsPassphrase = (type: ExchangeType): boolean => {
  return type === ExchangeExchangeType.Coinbase ||
         type === ExchangeExchangeType.Kucoin ||
         type === ExchangeExchangeType.Okx;
};

export const CreateExchangeDialog = ({ open, onClose, onSuccess }: CreateExchangeDialogProps) => {
  const [exchangeType, setExchangeType] = useState<ExchangeType>(ExchangeExchangeType.Binance);
  const [testMode, setTestMode] = useState(true);

  // Config state
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');

  // Visibility toggles
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);

  const [createExchange, { loading, error }] = useCreateExchangeMutation();

  const handleSubmit = async () => {
    if (!apiKey || !apiSecret) {
      return;
    }

    if (needsPassphrase(exchangeType) && !passphrase) {
      return;
    }

    // Build config based on exchange type
    let config: any = {};

    if (needsPassphrase(exchangeType)) {
      const passphraseConfig: PassphraseExchangeConfigInput = {
        apiKey,
        apiSecret,
        passphrase,
      };

      if (exchangeType === ExchangeExchangeType.Coinbase) {
        config = { coinbase: passphraseConfig };
      } else if (exchangeType === ExchangeExchangeType.Kucoin) {
        config = { kucoin: passphraseConfig };
      } else if (exchangeType === ExchangeExchangeType.Okx) {
        config = { okx: passphraseConfig };
      }
    } else {
      const standardConfig = { apiKey, apiSecret };

      if (exchangeType === ExchangeExchangeType.Binance) {
        config = { binance: standardConfig as BinanceConfigInput };
      } else if (exchangeType === ExchangeExchangeType.Binanceus) {
        config = { binanceus: standardConfig as BinanceConfigInput };
      } else if (exchangeType === ExchangeExchangeType.Kraken) {
        config = { kraken: standardConfig as KrakenConfigInput };
      } else if (exchangeType === ExchangeExchangeType.Bybit) {
        config = { bybit: standardConfig as BybitConfigInput };
      } else if (exchangeType === ExchangeExchangeType.Bitfinex) {
        config = { bitfinex: standardConfig as BitfinexConfigInput };
      }
    }

    try {
      await createExchange({
        variables: {
          input: {
            name: exchangeType,
            testMode,
            config,
          },
        },
      });

      // Reset form
      setExchangeType(ExchangeExchangeType.Binance);
      setTestMode(true);
      setApiKey('');
      setApiSecret('');
      setPassphrase('');
      setShowApiSecret(false);
      setShowPassphrase(false);

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to create exchange:', err);
    }
  };

  const isPassphraseRequired = needsPassphrase(exchangeType);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Exchange</DialogTitle>
      <DialogContent dividers sx={{ maxHeight: '70vh' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <FormControl fullWidth required>
            <InputLabel>Exchange</InputLabel>
            <Select
              value={exchangeType}
              onChange={(e) => setExchangeType(e.target.value as ExchangeType)}
              label="Exchange"
            >
              <MenuItem value={ExchangeExchangeType.Binance}>Binance</MenuItem>
              <MenuItem value={ExchangeExchangeType.Binanceus}>Binance US</MenuItem>
              <MenuItem value={ExchangeExchangeType.Coinbase}>Coinbase</MenuItem>
              <MenuItem value={ExchangeExchangeType.Kraken}>Kraken</MenuItem>
              <MenuItem value={ExchangeExchangeType.Kucoin}>KuCoin</MenuItem>
              <MenuItem value={ExchangeExchangeType.Bybit}>Bybit</MenuItem>
              <MenuItem value={ExchangeExchangeType.Okx}>OKX</MenuItem>
              <MenuItem value={ExchangeExchangeType.Bitfinex}>Bitfinex</MenuItem>
            </Select>
            <FormHelperText>Select the trading platform</FormHelperText>
          </FormControl>

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
            API Credentials
          </Typography>

          <TextField
            label="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
            fullWidth
            autoComplete="off"
            helperText="Your exchange API key"
          />

          <TextField
            label="API Secret"
            type={showApiSecret ? 'text' : 'password'}
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            required
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
              required
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
          disabled={
            loading ||
            !apiKey ||
            !apiSecret ||
            (isPassphraseRequired && !passphrase)
          }
        >
          {loading ? 'Adding...' : 'Add Exchange'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};