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
import { useState, useMemo } from 'react';
import { useCreateBotMutation, useGetExchangesForCreateQuery } from './bots.generated';
import { FreqtradeConfigForm, createDefaultFreqtradeConfig, BOT_SECTIONS } from '../Freqtrade';
import { useActiveOrganization } from '../../contexts/OrganizationContext';
import { RunnerSelector, StrategySelector } from '../shared';
import { useDialogUnsavedChanges } from '../../hooks';
import { UnsavedChangesDrawer } from '../shared';

interface CreateBotDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Create default config once for comparison
const DEFAULT_BOT_CONFIG = createDefaultFreqtradeConfig();

export const CreateBotDrawer = ({ open, onClose, onSuccess }: CreateBotDrawerProps) => {
  const { activeOrganizationId } = useActiveOrganization();
  const [name, setName] = useState('');
  const [exchangeID, setExchangeID] = useState('');
  const [strategyID, setStrategyID] = useState('');
  const [runnerID, setRunnerID] = useState('');
  const [mode, setMode] = useState<'live' | 'dry_run'>('dry_run');
  const [config, setConfig] = useState<object | null>(null);

  const { data: optionsData } = useGetExchangesForCreateQuery({
    variables: {
      ownerID: activeOrganizationId || undefined,
    },
    skip: !activeOrganizationId, // Skip query if no active group
  });
  const [createBot, { loading, error }] = useCreateBotMutation();

  // Track if form has been modified
  const hasChanges = useMemo(() => {
    if (name !== '') return true;
    if (exchangeID !== '') return true;
    if (strategyID !== '') return true;
    if (runnerID !== '') return true;
    if (mode !== 'dry_run') return true;
    // Config starts as null, any change means it's been modified
    if (config !== null && JSON.stringify(config) !== JSON.stringify(DEFAULT_BOT_CONFIG)) return true;
    return false;
  }, [name, exchangeID, strategyID, runnerID, mode, config]);

  const { handleClose, confirmDialogOpen, cancelClose, confirmClose } = useDialogUnsavedChanges({
    hasChanges,
    onClose,
  });

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
            Create New Bot
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
              inputProps={{ 'data-testid': 'bot-name-input' }}
            />

            <FormControl fullWidth required>
              <InputLabel>Mode</InputLabel>
              <Select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'live' | 'dry_run')}
                label="Mode"
                data-testid="bot-mode-select"
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
                data-testid="bot-exchange-select"
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
              data-testid="bot-strategy-select"
            />

            <RunnerSelector
              value={runnerID}
              onChange={setRunnerID}
              required
              data-testid="bot-runner-select"
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
                Error creating bot: {error.message}
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
            data-testid="submit-create-bot"
          >
            {loading ? 'Creating...' : 'Create Bot'}
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
