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
import { useCreateBotMutation } from './bots.generated';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { JSONEditor } from '../JSONEditor';
import { useActiveOrganization } from '../../contexts/OrganizationContext';
import { RunnerSelector } from '../shared/RunnerSelector';

// Query to get available exchanges and strategies filtered by owner
// (Runners are fetched by RunnerSelector component)
const GET_BOT_OPTIONS = gql`
  query GetBotOptions($ownerID: String) {
    exchanges(first: 50, where: { ownerID: $ownerID }) {
      edges {
        node {
          id
          name
        }
      }
    }
    strategies(first: 50, where: { ownerID: $ownerID }) {
      edges {
        node {
          id
          name
          versionNumber
          isLatest
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
  const { activeOrganizationId } = useActiveOrganization();
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

  const { data: optionsData } = useQuery(GET_BOT_OPTIONS, {
    variables: {
      ownerID: activeOrganizationId || undefined,
    },
    skip: !activeOrganizationId, // Skip query if no active group
  });
  const [createBot, { loading, error }] = useCreateBotMutation();

  const handleSubmit = async () => {
    if (!name || !exchangeID || !strategyID || !runnerID || !activeOrganizationId) {
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
            mode: mode as any,
            freqtradeVersion: '2025.10',
            config: config || undefined,
            ownerID: activeOrganizationId,
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

  const exchanges = optionsData?.exchanges?.edges?.map(edge => edge?.node).filter(Boolean) || [];
  const strategies = optionsData?.strategies?.edges?.map(edge => edge?.node).filter(Boolean) || [];

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
                  {strategy.name} (v{strategy.versionNumber})
                  {strategy.isLatest && ' - Latest'}
                </MenuItem>
              ))}
            </Select>
            {strategies.length === 0 && (
              <FormHelperText error>
                No strategies available. Please add a strategy first.
              </FormHelperText>
            )}
          </FormControl>

          <RunnerSelector
            value={runnerID}
            onChange={setRunnerID}
            required
          />

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