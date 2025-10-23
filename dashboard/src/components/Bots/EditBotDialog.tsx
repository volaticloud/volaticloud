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
import { useState, useEffect } from 'react';
import { useUpdateBotMutation } from '../../generated/graphql';
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

interface EditBotDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  bot: {
    id: string;
    name: string;
    mode: string;
    config?: any;
    exchange: { id: string; name: string };
    strategy: { id: string; name: string };
    runner: { id: string; name: string };
  };
}

export const EditBotDialog = ({ open, onClose, onSuccess, bot }: EditBotDialogProps) => {
  const [name, setName] = useState(bot.name);
  const [exchangeID, setExchangeID] = useState(bot.exchange.id);
  const [strategyID, setStrategyID] = useState(bot.strategy.id);
  const [runnerID, setRunnerID] = useState(bot.runner.id);
  const [mode, setMode] = useState<'live' | 'dry_run'>(bot.mode as 'live' | 'dry_run');
  const [config, setConfig] = useState<object | null>(null);

  const { data: optionsData } = useQuery(GET_BOT_OPTIONS);
  const [updateBot, { loading, error }] = useUpdateBotMutation();

  // Reset form when bot changes
  useEffect(() => {
    setName(bot.name);
    setExchangeID(bot.exchange.id);
    setStrategyID(bot.strategy.id);
    setRunnerID(bot.runner.id);
    setMode(bot.mode as 'live' | 'dry_run');
    setConfig(bot.config || null);
  }, [bot]);

  const handleSubmit = async () => {
    if (!name || !exchangeID || !strategyID || !runnerID) {
      return;
    }

    try {
      await updateBot({
        variables: {
          id: bot.id,
          input: {
            name,
            exchangeID,
            strategyID,
            runnerID,
            mode,
            config: config || undefined,
          },
        },
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to update bot:', err);
    }
  };

  const exchanges = optionsData?.exchanges || [];
  const strategies = optionsData?.strategies?.edges?.map(edge => edge?.node).filter(Boolean) || [];
  const runners = optionsData?.botRunners?.edges?.map(edge => edge?.node).filter(Boolean) || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Bot</DialogTitle>
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
              {exchanges.map((exchange: any) => (
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
              {strategies.map((strategy: any) => (
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
              {runners.map((runner: any) => (
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
            label="Bot Configuration (JSON)"
            helperText="Optional: Configure bot-specific Freqtrade settings like dry_run_wallet, timeframe, etc."
            height="200px"
            placeholder='{\n  "dry_run_wallet": 1000,\n  "stake_amount": "unlimited",\n  "unfilledtimeout": {\n    "entry": 10,\n    "exit": 30\n  }\n}'
          />

          {error && (
            <FormHelperText error>
              Error updating bot: {error.message}
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
          {loading ? 'Updating...' : 'Update Bot'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};