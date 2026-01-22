import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormHelperText,
  Box,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
  Divider,
  Chip,
  Autocomplete,
  TextField,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRunBacktestMutation, useSearchStrategiesLazyQuery, useGetStrategyByIdLazyQuery } from './backtests.generated';
import { useActiveOrganization } from '../../contexts/OrganizationContext';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SettingsIcon from '@mui/icons-material/Settings';
import { RunnerSelector } from '../shared/RunnerSelector';
import { debounce } from '@mui/material/utils';

interface CreateBacktestDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (newStrategyId?: string) => void;
  onBacktestCreated?: (backtestId: string) => void;
  preSelectedStrategyId?: string;
}

type DatePreset = '1week' | '1month' | '3months' | '6months' | '1year' | 'custom';

interface StrategyOption {
  id: string;
  name: string;
  versionNumber: number;
  isLatest: boolean;
}

const SUPPORTED_EXCHANGES = [
  { id: 'binance', name: 'Binance' },
  { id: 'binanceus', name: 'Binance US' },
  { id: 'kraken', name: 'Kraken' },
  { id: 'kucoin', name: 'KuCoin' },
  { id: 'bybit', name: 'Bybit' },
  { id: 'bitget', name: 'Bitget' },
  { id: 'gateio', name: 'Gate.io' },
  { id: 'okx', name: 'OKX' },
];

// Validates trading pair format: BASE/QUOTE (e.g., BTC/USDT)
// Returns null if valid, error message if invalid
const validateTradingPair = (pair: string): string | null => {
  const trimmed = pair.trim();
  if (!trimmed) return 'Empty trading pair';

  const parts = trimmed.split('/');
  if (parts.length !== 2) {
    return `Invalid format "${trimmed}": expected BASE/QUOTE (e.g., BTC/USDT)`;
  }

  const [base, quote] = parts;
  if (!base || !base.trim()) return `Invalid pair "${trimmed}": empty base currency`;
  if (!quote || !quote.trim()) return `Invalid pair "${trimmed}": empty quote currency`;

  // Check for alphanumeric only
  const alphanumeric = /^[A-Za-z0-9]+$/;
  if (!alphanumeric.test(base.trim())) {
    return `Invalid pair "${trimmed}": base currency contains invalid characters`;
  }
  if (!alphanumeric.test(quote.trim())) {
    return `Invalid pair "${trimmed}": quote currency contains invalid characters`;
  }

  return null;
};

// Validates all trading pairs from comma-separated input
// Returns null if all valid, first error message if any invalid
const validateTradingPairs = (pairsInput: string): string | null => {
  const pairs = pairsInput
    .split(/[,\n]+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (pairs.length === 0) {
    return 'At least one trading pair is required';
  }

  for (const pair of pairs) {
    const error = validateTradingPair(pair);
    if (error) return error;
  }

  return null;
};

// Build config JSON from simple mode inputs
// Backtest config only contains: exchange selection, pairs, and pairlists method
// Strategy config (in Strategy entity) should contain: stake_currency, stake_amount, entry_pricing, exit_pricing, timeframe, etc.
const buildConfigFromSimpleMode = (exchangeName: string, pairs: string): Record<string, unknown> => {
  const pairWhitelist = pairs
    .split(/[,\n]+/)
    .map(p => p.trim().toUpperCase())
    .filter(p => p.length > 0);

  return {
    exchange: {
      name: exchangeName,
      pair_whitelist: pairWhitelist,
    },
    pairlists: [
      { method: 'StaticPairList' },
    ],
  };
};

// Try to extract simple mode values from config JSON
const extractSimpleModeFromConfig = (config: Record<string, unknown>): { exchangeName: string; pairs: string } | null => {
  try {
    const exchange = config.exchange as Record<string, unknown> | undefined;
    if (!exchange) return null;

    const name = exchange.name as string | undefined;
    const pairWhitelist = exchange.pair_whitelist as string[] | undefined;

    if (!name || !pairWhitelist || !Array.isArray(pairWhitelist)) return null;

    // Check if exchange is supported
    if (!SUPPORTED_EXCHANGES.some(e => e.id === name)) return null;

    return {
      exchangeName: name,
      pairs: pairWhitelist.join(', '),
    };
  } catch {
    return null;
  }
};

export const CreateBacktestDialog = ({ open, onClose, onSuccess, onBacktestCreated, preSelectedStrategyId }: CreateBacktestDialogProps) => {
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyOption | null>(null);
  const [strategyInputValue, setStrategyInputValue] = useState('');
  const [strategyOptions, setStrategyOptions] = useState<StrategyOption[]>([]);
  const [runnerID, setRunnerID] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('1month');
  const [startDate, setStartDate] = useState<Dayjs | null>(dayjs().subtract(1, 'month'));
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs());

  // Config mode state
  const [advancedMode, setAdvancedMode] = useState(false);
  const [exchangeName, setExchangeName] = useState('binance');
  const [pairs, setPairs] = useState('BTC/USDT, ETH/USDT');
  const [pairsError, setPairsError] = useState<string | null>(null);
  const [configJson, setConfigJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Get active group for filtering strategies and runners
  const { activeOrganizationId } = useActiveOrganization();

  const [searchStrategies, { loading: searchLoading }] = useSearchStrategiesLazyQuery();
  const [getStrategyById] = useGetStrategyByIdLazyQuery();
  const [runBacktest, { loading, error }] = useRunBacktestMutation();

  // Sync config JSON when simple mode values change
  useEffect(() => {
    if (!advancedMode) {
      const config = buildConfigFromSimpleMode(exchangeName, pairs);
      setConfigJson(JSON.stringify(config, null, 2));
    }
  }, [advancedMode, exchangeName, pairs]);

  // Handle mode switch
  const handleModeSwitch = (checked: boolean) => {
    if (checked) {
      // Switching to advanced mode - sync current simple mode to JSON
      const config = buildConfigFromSimpleMode(exchangeName, pairs);
      setConfigJson(JSON.stringify(config, null, 2));
      setJsonError(null);
    } else {
      // Switching to simple mode - try to extract values from JSON
      try {
        const config = JSON.parse(configJson);
        const extracted = extractSimpleModeFromConfig(config);
        if (extracted) {
          setExchangeName(extracted.exchangeName);
          setPairs(extracted.pairs);
        }
        // If extraction fails, keep current simple mode values
      } catch {
        // Keep current simple mode values if JSON is invalid
      }
    }
    setAdvancedMode(checked);
  };

  // Validate JSON when in advanced mode
  const handleConfigJsonChange = (value: string) => {
    setConfigJson(value);
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  // Validate trading pairs when in simple mode
  const handlePairsChange = (value: string) => {
    setPairs(value);
    const error = validateTradingPairs(value);
    setPairsError(error);
  };

  // Debounced search function
  const debouncedSearch = useMemo(
    () =>
      debounce(async (search: string) => {
        if (!activeOrganizationId) return;

        const { data } = await searchStrategies({
          variables: {
            search: search || undefined,
            ownerID: activeOrganizationId,
            first: 20,
          },
        });

        const strategies = data?.strategies?.edges
          ?.map(edge => edge?.node)
          .filter((node): node is StrategyOption => node !== null && node !== undefined) || [];

        // Ensure selected strategy is always in options
        setStrategyOptions(() => {
          if (selectedStrategy && !strategies.some(s => s.id === selectedStrategy.id)) {
            return [selectedStrategy, ...strategies];
          }
          return strategies;
        });
      }, 300),
    [activeOrganizationId, searchStrategies, selectedStrategy]
  );

  // Load initial strategies when dialog opens
  useEffect(() => {
    if (open && activeOrganizationId) {
      debouncedSearch('');
    }
  }, [open, activeOrganizationId, debouncedSearch]);

  // Load pre-selected strategy
  useEffect(() => {
    if (open && preSelectedStrategyId && activeOrganizationId) {
      getStrategyById({ variables: { id: preSelectedStrategyId } }).then(({ data }) => {
        const strategy = data?.strategies?.edges?.[0]?.node;
        if (strategy) {
          setSelectedStrategy(strategy as StrategyOption);
          // Also add to options if not already there
          setStrategyOptions(prev => {
            if (prev.some(s => s.id === strategy.id)) return prev;
            return [strategy as StrategyOption, ...prev];
          });
        }
      });
    }
  }, [open, preSelectedStrategyId, activeOrganizationId, getStrategyById]);

  // Search when input changes
  const handleStrategyInputChange = useCallback(
    (_event: React.SyntheticEvent, newInputValue: string) => {
      setStrategyInputValue(newInputValue);
      debouncedSearch(newInputValue);
    },
    [debouncedSearch]
  );

  // Update dates when preset changes
  const handlePresetChange = (_event: React.MouseEvent<HTMLElement>, newPreset: DatePreset | null) => {
    if (!newPreset) return;

    setDatePreset(newPreset);

    if (newPreset === 'custom') {
      // Keep current custom dates
      return;
    }

    const now = dayjs();
    let start: Dayjs;

    switch (newPreset) {
      case '1week':
        start = now.subtract(1, 'week');
        break;
      case '1month':
        start = now.subtract(1, 'month');
        break;
      case '3months':
        start = now.subtract(3, 'months');
        break;
      case '6months':
        start = now.subtract(6, 'months');
        break;
      case '1year':
        start = now.subtract(1, 'year');
        break;
      default:
        start = now.subtract(1, 'month');
    }

    setStartDate(start);
    setEndDate(now);
  };

  const handleSubmit = async () => {
    if (!selectedStrategy?.id || !runnerID || !startDate || !endDate) {
      return;
    }

    // Get config from appropriate source
    let config: Record<string, unknown>;
    if (advancedMode) {
      try {
        config = JSON.parse(configJson);
      } catch {
        setJsonError('Invalid JSON');
        return;
      }
    } else {
      config = buildConfigFromSimpleMode(exchangeName, pairs);
    }

    try {
      const result = await runBacktest({
        variables: {
          input: {
            strategyID: selectedStrategy.id,
            runnerID,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            config,
          },
        },
      });

      // Only close and reset if mutation was successful
      if (result.data?.runBacktest) {
        const backtestId = result.data.runBacktest.id;
        const newStrategyId = result.data.runBacktest.strategy?.id;

        // Reset form
        setSelectedStrategy(null);
        setStrategyInputValue('');
        setRunnerID('');
        setDatePreset('1month');
        setStartDate(dayjs().subtract(1, 'month'));
        setEndDate(dayjs());
        setAdvancedMode(false);
        setExchangeName('binance');
        setPairs('BTC/USDT, ETH/USDT');
        setPairsError(null);
        setConfigJson('');
        setJsonError(null);

        // Call the new callback if provided (for staying in place and tracking)
        if (onBacktestCreated) {
          onBacktestCreated(backtestId);
        }

        onSuccess(newStrategyId);
        onClose();
      }
      // If there are errors, they will be displayed via the error state
    } catch (err) {
      console.error('Failed to create backtest:', err);
      // Error will be displayed via the error state from the mutation hook
    }
  };

  const isSubmitDisabled = loading || !selectedStrategy?.id || !runnerID || !startDate || !endDate || (advancedMode && !!jsonError) || (!advancedMode && !!pairsError);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Create New Backtest</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Autocomplete
              value={selectedStrategy}
              onChange={(_event, newValue) => setSelectedStrategy(newValue)}
              inputValue={strategyInputValue}
              onInputChange={handleStrategyInputChange}
              options={strategyOptions}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              loading={searchLoading}
              filterOptions={(x) => x} // Disable built-in filtering, we filter server-side
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Strategy"
                  required
                  placeholder="Search strategies..."
                  slotProps={{
                    input: {
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {searchLoading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    },
                  }}
                />
              )}
              renderOption={(props, option) => {
                const { key, ...otherProps } = props;
                return (
                  <li key={key} {...otherProps}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 1 }}>
                      <Typography>{option.name}</Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Chip
                          label={`v${option.versionNumber}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                        {option.isLatest && (
                          <Chip
                            label="Latest"
                            size="small"
                            color="success"
                          />
                        )}
                      </Box>
                    </Box>
                  </li>
                );
              }}
              noOptionsText={searchLoading ? "Searching..." : "No strategies found"}
            />

            <RunnerSelector
              value={runnerID}
              onChange={setRunnerID}
              required
              dataReadyOnly
            />

            <Divider />

            {/* Config Section */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SettingsIcon fontSize="small" />
                  Backtest Configuration
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={advancedMode}
                      onChange={(e) => handleModeSwitch(e.target.checked)}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">Advanced (JSON)</Typography>}
                />
              </Box>

              {!advancedMode ? (
                // Simple Mode
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControl fullWidth required>
                    <InputLabel>Exchange</InputLabel>
                    <Select
                      value={exchangeName}
                      onChange={(e) => setExchangeName(e.target.value)}
                      label="Exchange"
                    >
                      {SUPPORTED_EXCHANGES.map((exchange) => (
                        <MenuItem key={exchange.id} value={exchange.id}>
                          {exchange.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    label="Trading Pairs"
                    value={pairs}
                    onChange={(e) => handlePairsChange(e.target.value)}
                    multiline
                    rows={2}
                    required
                    placeholder="BTC/USDT, ETH/USDT"
                    error={!!pairsError}
                    helperText={pairsError || "Comma-separated list of trading pairs (e.g., BTC/USDT, ETH/USDT)"}
                  />
                </Box>
              ) : (
                // Advanced Mode - JSON Editor
                <TextField
                  label="Config JSON"
                  value={configJson}
                  onChange={(e) => handleConfigJsonChange(e.target.value)}
                  multiline
                  rows={8}
                  fullWidth
                  error={!!jsonError}
                  helperText={jsonError || 'Edit the full Freqtrade backtest configuration'}
                  sx={{
                    '& .MuiInputBase-input': {
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                    },
                  }}
                />
              )}
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarMonthIcon fontSize="small" />
                Backtest Time Range
              </Typography>

              <ToggleButtonGroup
                value={datePreset}
                exclusive
                onChange={handlePresetChange}
                aria-label="date range preset"
                size="small"
                fullWidth
                sx={{ mt: 1, mb: 2 }}
              >
                <ToggleButton value="1week">
                  Last Week
                </ToggleButton>
                <ToggleButton value="1month">
                  Last Month
                </ToggleButton>
                <ToggleButton value="3months">
                  Last 3 Months
                </ToggleButton>
                <ToggleButton value="6months">
                  Last 6 Months
                </ToggleButton>
                <ToggleButton value="1year">
                  Last Year
                </ToggleButton>
                <ToggleButton value="custom">
                  Custom
                </ToggleButton>
              </ToggleButtonGroup>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={(newValue) => {
                    setStartDate(newValue);
                    if (datePreset !== 'custom') {
                      setDatePreset('custom');
                    }
                  }}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                    },
                  }}
                />
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={(newValue) => {
                    setEndDate(newValue);
                    if (datePreset !== 'custom') {
                      setDatePreset('custom');
                    }
                  }}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                    },
                  }}
                />
              </Box>
            </Box>

            <Alert severity="info">
              The backtest configuration will be merged with the strategy's configuration.
              Exchange and pair settings here will override the strategy defaults.
            </Alert>

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
            disabled={isSubmitDisabled}
          >
            {loading ? 'Creating...' : 'Create Backtest'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};
