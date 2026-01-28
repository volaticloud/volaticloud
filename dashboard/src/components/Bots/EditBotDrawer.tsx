import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Divider,
  CircularProgress,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { useState, useEffect, useMemo } from 'react';
import { useUpdateBotMutation, useGetExchangesForEditQuery } from './bots.generated';
import { FreqtradeConfigForm, BOT_SECTIONS } from '../Freqtrade';
import { useDialogUnsavedChanges } from '../../hooks';
import { UnsavedChangesDrawer, StrategySelector, RunnerSelector } from '../shared';

interface EditBotDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  bot: {
    id: string;
    name: string;
    mode: string;
    config?: object;
    exchange: { id: string; name: string };
    strategy: { id: string; name: string };
    runner: { id: string; name: string };
  };
}

export const EditBotDrawer = ({ open, onClose, onSuccess, bot }: EditBotDrawerProps) => {
  const [name, setName] = useState(bot.name);
  const [exchangeID, setExchangeID] = useState(bot.exchange.id);
  const [strategyID, setStrategyID] = useState(bot.strategy.id);
  const [runnerID, setRunnerID] = useState(bot.runner.id);
  const [mode, setMode] = useState<'live' | 'dry_run'>(bot.mode as 'live' | 'dry_run');
  const [config, setConfig] = useState<object | null>(null);

  const { data: optionsData } = useGetExchangesForEditQuery();
  const [updateBot, { loading, error }] = useUpdateBotMutation();

  // Track if form has been modified from original bot values
  const hasChanges = useMemo(() => {
    if (name !== bot.name) return true;
    if (exchangeID !== bot.exchange.id) return true;
    if (strategyID !== bot.strategy.id) return true;
    if (runnerID !== bot.runner.id) return true;
    if (mode !== bot.mode) return true;
    if (JSON.stringify(config) !== JSON.stringify(bot.config || null)) return true;
    return false;
  }, [name, exchangeID, strategyID, runnerID, mode, config, bot]);

  const { handleClose, confirmDialogOpen, cancelClose, confirmClose } = useDialogUnsavedChanges({
    hasChanges,
    onClose,
  });

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
      const result = await updateBot({
        variables: {
          id: bot.id,
          input: {
            name,
            exchangeID,
            strategyID,
            runnerID,
            mode: mode as any,
            config: config || undefined,
          },
        },
      });

      // Only close if mutation was successful
      if (result.data?.updateBot) {
        onSuccess();
        onClose();
      }
      // If there are errors, they will be displayed via the error state
    } catch (err) {
      console.error('Failed to update bot:', err);
      // Error will be displayed via the error state from the mutation hook
    }
  };

  const exchanges = optionsData?.exchanges?.edges?.map(edge => edge?.node).filter(Boolean) || [];

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 500 },
            maxWidth: '100%',
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6" component="h2">
            Edit Bot
          </Typography>
          <IconButton onClick={handleClose} size="small" aria-label="close">
            <Close />
          </IconButton>
        </Box>

        {/* Content */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            px: 3,
            py: 2,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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

            <StrategySelector
              value={strategyID}
              onChange={setStrategyID}
              required
            />

            <RunnerSelector
              value={runnerID}
              onChange={setRunnerID}
              required
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Freqtrade Bot Configuration
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Configure bot settings. This will be written to config.bot.json and merged with exchange and strategy configs.
              </Typography>
              <FreqtradeConfigForm
                value={config}
                onChange={setConfig}
                defaultSections={BOT_SECTIONS}
              />
            </Box>

            {error && (
              <FormHelperText error>
                Error updating bot: {error.message}
              </FormHelperText>
            )}
          </Box>
        </Box>

        {/* Footer */}
        <Divider />
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
            px: 3,
            py: 2,
          }}
        >
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading || !name || !exchangeID || !strategyID || !runnerID}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {loading ? 'Updating...' : 'Update Bot'}
          </Button>
        </Box>
      </Drawer>
      <UnsavedChangesDrawer
        open={confirmDialogOpen}
        onCancel={cancelClose}
        onDiscard={confirmClose}
      />
    </>
  );
};
