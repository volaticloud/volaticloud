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
} from '@mui/material';
import { useState } from 'react';
import { useCreateBotMutation } from '../../generated/graphql';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { JSONEditor } from '../JSONEditor';

// Query to get available exchanges, strategies, and runners
const GET_BOT_OPTIONS = gql`
  query GetBotOptions {
    exchanges {
      id
      name
    }
    strategies(first: 50) {
      edges {
        node {
          id
          name
        }
      }
    }
    botRunners(first: 50) {
      edges {
        node {
          id
          name
          type
        }
      }
    }
  }
`;

interface CreateBotDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateBotDialog = ({ open, onClose, onSuccess }: CreateBotDialogProps) => {
  const [name, setName] = useState('');
  const [exchangeID, setExchangeID] = useState('');
  const [strategyID, setStrategyID] = useState('');
  const [runnerID, setRunnerID] = useState('');
  const [mode, setMode] = useState<'live' | 'dry_run'>('dry_run');
  const [config, setConfig] = useState<object | null>({
    stake_currency: 'USDT',
    stake_amount: 10,
    dry_run_wallet: 1000,
    timeframe: '5m',
    max_open_trades: 3,
    unfilledtimeout: {
      entry: 10,
      exit: 30,
    },
    exit_pricing: {
      price_side: 'other',
      use_order_book: true,
      order_book_top: 1,
      price_last_balance: 0.0,
    },
    entry_pricing: {
      price_side: 'other',
      use_order_book: true,
      order_book_top: 1,
      price_last_balance: 0.0,
      check_depth_of_market: {
        enabled: false,
        bids_to_ask_delta: 1,
      },
    },
    order_types: {
      entry: 'limit',
      exit: 'limit',
      stoploss: 'market',
      stoploss_on_exchange: false,
      stoploss_on_exchange_interval: 60,
    },
    order_time_in_force: {
      entry: 'GTC',
      exit: 'GTC',
    },
    pairlists: [
      {
        method: 'StaticPairList',
      },
    ],
    exchange: {
      pair_whitelist: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'],
    },
  });

  const { data: optionsData } = useQuery(GET_BOT_OPTIONS);
  const [createBot, { loading, error }] = useCreateBotMutation();

  const handleSubmit = async () => {
    if (!name || !exchangeID || !strategyID || !runnerID) {
      return;
    }

    try {
      const result = await createBot({
        variables: {
          input: {
            name,
            exchangeID,
            strategyID,
            runnerID,
            mode,
            freqtradeVersion: '2024.1',
            config: config || undefined,
          },
        },
      });

      // Only close and reset if mutation was successful
      if (result.data?.createBot) {
        // Reset form
        setName('');
        setExchangeID('');
        setStrategyID('');
        setRunnerID('');
        setMode('dry_run');
        setConfig(null);

        onSuccess();
        onClose();
      }
      // If there are errors, they will be displayed via the error state
    } catch (err) {
      console.error('Failed to create bot:', err);
      // Error will be displayed via the error state from the mutation hook
    }
  };

  const exchanges = optionsData?.exchanges || [];
  const strategies = optionsData?.strategies?.edges?.map(edge => edge?.node).filter(Boolean) || [];
  const runners = optionsData?.botRunners?.edges?.map(edge => edge?.node).filter(Boolean) || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Bot</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Bot Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            autoFocus
          />

          <FormControl fullWidth required>
            <InputLabel>Mode</InputLabel>
            <Select
              value={mode}
              onChange={(e) => setMode(e.target.value as 'live' | 'dry_run')}
              label="Mode"
            >
              <MenuItem value="dry_run">Dry Run (Paper Trading)</MenuItem>
              <MenuItem value="live">Live Trading</MenuItem>
            </Select>
            <FormHelperText>Dry run mode trades with fake money</FormHelperText>
          </FormControl>

          <FormControl fullWidth required>
            <InputLabel>Exchange</InputLabel>
            <Select
              value={exchangeID}
              onChange={(e) => setExchangeID(e.target.value)}
              label="Exchange"
            >
              {exchanges.map((exchange) => (
                <MenuItem key={exchange.id} value={exchange.id}>
                  {exchange.name}
                </MenuItem>
              ))}
            </Select>
            {exchanges.length === 0 && (
              <FormHelperText error>
                No exchanges configured. Please add an exchange first.
              </FormHelperText>
            )}
          </FormControl>

          <FormControl fullWidth required>
            <InputLabel>Strategy</InputLabel>
            <Select
              value={strategyID}
              onChange={(e) => setStrategyID(e.target.value)}
              label="Strategy"
            >
              {strategies.map((strategy) => (
                <MenuItem key={strategy.id} value={strategy.id}>
                  {strategy.name}
                </MenuItem>
              ))}
            </Select>
            {strategies.length === 0 && (
              <FormHelperText error>
                No strategies available. Please add a strategy first.
              </FormHelperText>
            )}
          </FormControl>

          <FormControl fullWidth required>
            <InputLabel>Runner</InputLabel>
            <Select
              value={runnerID}
              onChange={(e) => setRunnerID(e.target.value)}
              label="Runner"
            >
              {runners.map((runner) => (
                <MenuItem key={runner.id} value={runner.id}>
                  {runner.name} ({runner.type})
                </MenuItem>
              ))}
            </Select>
            {runners.length === 0 && (
              <FormHelperText error>
                No runners configured. Please add a runner first.
              </FormHelperText>
            )}
          </FormControl>

          <Box>
            <JSONEditor
              value={config}
              onChange={setConfig}
              label="Freqtrade Bot Configuration"
              helperText="Complete freqtrade bot config. Required fields: stake_currency, stake_amount, exit_pricing, entry_pricing. This will be written to config.bot.json and merged with exchange and strategy configs."
              height="400px"
            />
          </Box>

          {error && (
            <FormHelperText error>
              Error creating bot: {error.message}
            </FormHelperText>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !name || !exchangeID || !strategyID || !runnerID}
        >
          {loading ? 'Creating...' : 'Create Bot'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};