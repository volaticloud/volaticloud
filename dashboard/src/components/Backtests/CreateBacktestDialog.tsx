import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Box,
} from '@mui/material';
import { useState } from 'react';
import { useCreateBacktestMutation, useGetBacktestOptionsQuery } from '../../generated/graphql';
import { JSONEditor } from '../JSONEditor';

interface CreateBacktestDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateBacktestDialog = ({ open, onClose, onSuccess }: CreateBacktestDialogProps) => {
  const [strategyID, setStrategyID] = useState('');
  const [runnerID, setRunnerID] = useState('');
  const [config, setConfig] = useState<object | null>({
    pairs: ['BTC/USDT', 'ETH/USDT'],
    timeframe: '5m',
    stake_amount: 100,
    stake_currency: 'USDT',
    max_open_trades: 3,
    freqtrade_version: 'stable',
    exchange: {
      name: 'binance',
      pair_whitelist: ['BTC/USDT', 'ETH/USDT'],
    },
    pairlists: [{ method: 'StaticPairList' }],
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
    unfilledtimeout: {
      entry: 10,
      exit: 30,
    },
  });

  const { data: optionsData } = useGetBacktestOptionsQuery();
  const [createBacktest, { loading, error }] = useCreateBacktestMutation();

  const handleSubmit = async () => {
    if (!strategyID || !runnerID || !config) {
      return;
    }

    try {
      const result = await createBacktest({
        variables: {
          input: {
            strategyID,
            runnerID,
            status: 'pending' as any,
            config,
          },
        },
      });

      // Only close and reset if mutation was successful
      if (result.data?.createBacktest) {
        // Reset form
        setStrategyID('');
        setRunnerID('');
        setConfig({
          pairs: ['BTC/USDT', 'ETH/USDT'],
          timeframe: '5m',
          stake_amount: 100,
          stake_currency: 'USDT',
          max_open_trades: 3,
          freqtrade_version: 'stable',
          exchange: {
            name: 'binance',
            pair_whitelist: ['BTC/USDT', 'ETH/USDT'],
          },
          pairlists: [{ method: 'StaticPairList' }],
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
          unfilledtimeout: {
            entry: 10,
            exit: 30,
          },
        });

        onSuccess();
        onClose();
      }
      // If there are errors, they will be displayed via the error state
    } catch (err) {
      console.error('Failed to create backtest:', err);
      // Error will be displayed via the error state from the mutation hook
    }
  };

  const strategies = optionsData?.strategies?.edges?.map(edge => edge?.node).filter(Boolean) || [];
  const runners = optionsData?.botRunners?.edges?.map(edge => edge?.node).filter(Boolean) || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Create New Backtest</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
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

          <JSONEditor
            value={config}
            onChange={setConfig}
            label="Backtest Configuration (JSON)"
            helperText="Required: Configure pairs, timeframe, stake amount, dates, etc."
            height="300px"
            placeholder={JSON.stringify({
              pairs: ['BTC/USDT', 'ETH/USDT'],
              timeframe: '5m',
              stake_amount: 100,
              stake_currency: 'USDT',
              max_open_trades: 3,
              freqtrade_version: 'stable',
              data_source: 'download',
            }, null, 2)}
          />

          {error && (
            <FormHelperText error>
              Error creating backtest: {error.message}
            </FormHelperText>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !strategyID || !runnerID || !config}
        >
          {loading ? 'Creating...' : 'Create Backtest'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};