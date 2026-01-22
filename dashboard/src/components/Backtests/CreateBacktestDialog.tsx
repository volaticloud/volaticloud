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
import EditIcon from '@mui/icons-material/Edit';
import { RunnerSelector, type RunnerDataAvailable } from '../shared/RunnerSelector';
import { JSONEditor } from '../JSONEditor';
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
  config?: Record<string, unknown> | null;
}

// Strategy config fields we care about for inheritance
interface StrategyConfigFields {
  timeframe?: string;
  pair_whitelist?: string[];
}

// Extract relevant fields from strategy config
const extractStrategyConfigFields = (config: Record<string, unknown> | null | undefined): StrategyConfigFields => {
  if (!config) return {};

  const result: StrategyConfigFields = {};

  // Extract timeframe
  if (typeof config.timeframe === 'string') {
    result.timeframe = config.timeframe;
  }

  // Extract pair_whitelist - can be at top level or inside exchange
  if (Array.isArray(config.pair_whitelist)) {
    result.pair_whitelist = config.pair_whitelist;
  } else if (config.exchange && typeof config.exchange === 'object') {
    const exchange = config.exchange as Record<string, unknown>;
    if (Array.isArray(exchange.pair_whitelist)) {
      result.pair_whitelist = exchange.pair_whitelist;
    }
  }

  return result;
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

// Validates trading pair format: BASE/QUOTE or BASE/QUOTE:SETTLE (e.g., BTC/USDT or BTC/USDT:USDT for futures)
// Returns null if valid, error message if invalid
//
// IMPORTANT: This validation logic is duplicated in the backend for server-side validation.
// If you modify this function, you MUST also update the backend validation:
// - Backend: internal/backtest/validation.go (validateTradingPair)
// Both implementations must stay in sync to ensure consistent behavior.
const validateTradingPair = (pair: string): string | null => {
  const trimmed = pair.trim();
  if (!trimmed) return 'Empty trading pair';

  // Check for futures format: BASE/QUOTE:SETTLE
  const settleMatch = trimmed.match(/^([^/]+)\/([^:]+):([^:]+)$/);
  if (settleMatch) {
    const [, base, quote, settle] = settleMatch;
    const alphanumeric = /^[A-Za-z0-9]+$/;
    if (!alphanumeric.test(base)) return `Invalid pair "${trimmed}": base currency contains invalid characters`;
    if (!alphanumeric.test(quote)) return `Invalid pair "${trimmed}": quote currency contains invalid characters`;
    if (!alphanumeric.test(settle)) return `Invalid pair "${trimmed}": settlement currency contains invalid characters`;
    return null;
  }

  // Check for spot format: BASE/QUOTE
  const parts = trimmed.split('/');
  if (parts.length !== 2) {
    return `Invalid format "${trimmed}": expected BASE/QUOTE (e.g., BTC/USDT) or BASE/QUOTE:SETTLE (e.g., BTC/USDT:USDT)`;
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

// Validates all trading pairs format
// Returns null if all valid, first error message if any invalid
const validateTradingPairsFormat = (pairs: string[]): string | null => {
  if (pairs.length === 0) {
    return 'At least one trading pair is required';
  }

  for (const pair of pairs) {
    const error = validateTradingPair(pair);
    if (error) return error;
  }

  return null;
};

// Unified validation result interface
interface BacktestConfigValidationResult {
  exchangeError: string | null;
  pairsError: string | null;
  timeframeError: string | null;
  formatError: string | null;  // For pair format validation
}

// Unified validation function for backtest config against runner data
// Used by BOTH simple mode and advanced mode (JSON editor)
const validateBacktestConfigAgainstRunner = (
  config: {
    exchange?: string;
    pairs?: string[];
    timeframe?: string;
  },
  runnerData: RunnerDataAvailable | null
): BacktestConfigValidationResult => {
  const result: BacktestConfigValidationResult = {
    exchangeError: null,
    pairsError: null,
    timeframeError: null,
    formatError: null,
  };

  // If no runner data, skip runner-based validation
  if (!runnerData?.exchanges?.length) {
    // Still validate pair format
    if (config.pairs && config.pairs.length > 0) {
      result.formatError = validateTradingPairsFormat(config.pairs);
    }
    return result;
  }

  const availableExchanges = runnerData.exchanges.map(e => e.name.toLowerCase());

  // Validate exchange
  if (config.exchange) {
    if (!availableExchanges.includes(config.exchange.toLowerCase())) {
      result.exchangeError = `Exchange "${config.exchange}" not available on this runner. Available: ${runnerData.exchanges.map(e => e.name).join(', ')}`;
    }
  }

  // Validate pairs format first
  if (config.pairs && config.pairs.length > 0) {
    result.formatError = validateTradingPairsFormat(config.pairs);
  }

  // Validate pairs against runner (only if exchange is valid and pairs format is valid)
  if (config.pairs && config.pairs.length > 0 && !result.exchangeError && !result.formatError) {
    const exchangeName = config.exchange ?? 'binance';
    const exchangeData = runnerData.exchanges.find(
      e => e.name.toLowerCase() === exchangeName.toLowerCase()
    );

    if (exchangeData?.pairs?.length) {
      const availablePairs = new Set(exchangeData.pairs.map(p => p.pair.toUpperCase()));
      const invalidPairs = config.pairs.filter(p => !availablePairs.has(p.toUpperCase()));
      if (invalidPairs.length > 0) {
        result.pairsError = `Pair(s) not available on runner: ${invalidPairs.join(', ')}`;
      }
    }
  }

  // Validate timeframe against runner (only if exchange and pairs are valid)
  if (config.timeframe && !result.exchangeError && !result.pairsError && !result.formatError) {
    const exchangeName = config.exchange ?? 'binance';
    const exchangeData = runnerData.exchanges.find(
      e => e.name.toLowerCase() === exchangeName.toLowerCase()
    );

    if (exchangeData?.pairs?.length && config.pairs && config.pairs.length > 0) {
      // Check if timeframe exists for all config pairs
      for (const pairName of config.pairs) {
        const pairData = exchangeData.pairs.find(p => p.pair.toUpperCase() === pairName.toUpperCase());
        if (pairData) {
          const pairTimeframes = pairData.timeframes?.map(t => t.timeframe) ?? [];
          if (!pairTimeframes.includes(config.timeframe)) {
            result.timeframeError = `Timeframe "${config.timeframe}" not available for pair ${pairName}`;
            break;
          }
        }
      }
    }
  }

  return result;
};

// Extract config values from JSON for validation
const extractConfigFromJson = (configObject: Record<string, unknown> | null): {
  exchange?: string;
  pairs?: string[];
  timeframe?: string;
} => {
  if (!configObject) return {};

  const result: { exchange?: string; pairs?: string[]; timeframe?: string } = {};

  // Extract exchange name
  const exchangeConfig = configObject.exchange as Record<string, unknown> | undefined;
  if (exchangeConfig?.name && typeof exchangeConfig.name === 'string') {
    result.exchange = exchangeConfig.name;
  }

  // Extract pairs
  if (exchangeConfig?.pair_whitelist && Array.isArray(exchangeConfig.pair_whitelist)) {
    result.pairs = exchangeConfig.pair_whitelist as string[];
  }

  // Extract timeframe
  if (configObject.timeframe && typeof configObject.timeframe === 'string') {
    result.timeframe = configObject.timeframe;
  }

  return result;
};

// Build config JSON from simple mode inputs
// Only include values that are explicitly overridden (not inherited from strategy)
// exchangeOverride: null = use strategy default, string = override
// pairsOverride: null = use strategy default, string[] = override
// timeframeOverride: null = use strategy default, string = override
const buildConfigFromSimpleMode = (
  exchangeOverride: string | null,
  pairsOverride: string[] | null,
  timeframeOverride: string | null
): Record<string, unknown> => {
  const config: Record<string, unknown> = {};

  // Always include exchange (required for backtest)
  const exchangeConfig: Record<string, unknown> = {
    name: exchangeOverride ?? 'binance',
  };

  // Only include pair_whitelist if overridden
  if (pairsOverride !== null && pairsOverride.length > 0) {
    exchangeConfig.pair_whitelist = pairsOverride.map(p => p.trim().toUpperCase()).filter(p => p.length > 0);
    config.pairlists = [{ method: 'StaticPairList' }];
  }

  config.exchange = exchangeConfig;

  // Only include timeframe if overridden
  if (timeframeOverride !== null) {
    config.timeframe = timeframeOverride;
  }

  return config;
};

// Try to extract simple mode values from config JSON
const extractSimpleModeFromConfig = (config: Record<string, unknown>): { exchangeName: string; pairs: string[] } | null => {
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
      pairs: pairWhitelist,
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
  const [configJson, setConfigJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Override state - null means "inherit from strategy", non-null means "user override"
  const [exchangeOverride, setExchangeOverride] = useState<string | null>('binance');
  const [pairsOverride, setPairsOverride] = useState<string[] | null>(['BTC/USDT', 'ETH/USDT']);
  const [timeframeOverride, setTimeframeOverride] = useState<string | null>(null);

  // Runner data availability
  const [runnerDataAvailable, setRunnerDataAvailable] = useState<RunnerDataAvailable | null>(null);

  // Computed inherited values from strategy
  const strategyConfigFields = useMemo(() => {
    return extractStrategyConfigFields(selectedStrategy?.config);
  }, [selectedStrategy]);

  // Effective values (override or inherited)
  const effectiveExchange = exchangeOverride ?? 'binance';
  const effectivePairs = useMemo(() => {
    return pairsOverride ?? strategyConfigFields.pair_whitelist ?? [];
  }, [pairsOverride, strategyConfigFields.pair_whitelist]);
  const effectiveTimeframe = timeframeOverride ?? strategyConfigFields.timeframe ?? null;

  // Compute available exchanges from runner data
  const availableExchanges = useMemo(() => {
    if (!runnerDataAvailable?.exchanges?.length) {
      // No data available - show all supported exchanges
      return SUPPORTED_EXCHANGES;
    }
    // Filter to only exchanges that have data on the runner
    const runnerExchangeNames = new Set(runnerDataAvailable.exchanges.map(e => e.name.toLowerCase()));
    const filtered = SUPPORTED_EXCHANGES.filter(e => runnerExchangeNames.has(e.id));
    return filtered;
  }, [runnerDataAvailable]);

  // Compute available pairs for the selected exchange
  const availablePairs = useMemo(() => {
    if (!runnerDataAvailable?.exchanges?.length) {
      return null;
    }
    const exchangeData = runnerDataAvailable.exchanges.find(e => e.name.toLowerCase() === effectiveExchange.toLowerCase());
    if (!exchangeData?.pairs?.length) {
      return null;
    }
    const pairs = exchangeData.pairs.map(p => p.pair);
    return pairs;
  }, [runnerDataAvailable, effectiveExchange]);

  // Compute available date range for the selected exchange
  const availableDateRange = useMemo(() => {
    if (!runnerDataAvailable?.exchanges?.length) return null;
    const exchangeData = runnerDataAvailable.exchanges.find(e => e.name.toLowerCase() === effectiveExchange.toLowerCase());
    if (!exchangeData?.pairs?.length) return null;

    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (const pair of exchangeData.pairs) {
      for (const tf of pair.timeframes ?? []) {
        if (tf.from) {
          const fromDate = new Date(tf.from);
          if (!minDate || fromDate < minDate) minDate = fromDate;
        }
        if (tf.to) {
          const toDate = new Date(tf.to);
          if (!maxDate || toDate > maxDate) maxDate = toDate;
        }
      }
    }

    return minDate && maxDate ? { from: minDate, to: maxDate } : null;
  }, [runnerDataAvailable, effectiveExchange]);

  // Compute available timeframes for selected exchange and pairs
  // Uses INTERSECTION: only shows timeframes available for ALL selected pairs
  const availableTimeframes = useMemo(() => {
    if (!runnerDataAvailable?.exchanges?.length) return null;

    const exchangeData = runnerDataAvailable.exchanges.find(
      e => e.name.toLowerCase() === effectiveExchange.toLowerCase()
    );
    if (!exchangeData?.pairs?.length) return null;

    const selectedPairSet = new Set(effectivePairs.map(p => p.toUpperCase()));
    const tfOrder = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];

    // If no pairs selected, show union of all timeframes from all pairs
    if (selectedPairSet.size === 0) {
      const allTimeframes = new Set<string>();
      for (const pair of exchangeData.pairs) {
        for (const tf of pair.timeframes ?? []) {
          allTimeframes.add(tf.timeframe);
        }
      }
      return Array.from(allTimeframes).sort((a, b) => {
        const aIdx = tfOrder.indexOf(a);
        const bIdx = tfOrder.indexOf(b);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });
    }

    // If pairs selected, use INTERSECTION - only timeframes available for ALL selected pairs
    let intersectionTimeframes: Set<string> | null = null;

    for (const pair of exchangeData.pairs) {
      if (selectedPairSet.has(pair.pair.toUpperCase())) {
        const pairTimeframes = new Set((pair.timeframes ?? []).map(tf => tf.timeframe));

        if (intersectionTimeframes === null) {
          // First selected pair - initialize with its timeframes
          intersectionTimeframes = pairTimeframes;
        } else {
          // Intersect with existing timeframes
          intersectionTimeframes = new Set(
            [...intersectionTimeframes].filter(tf => pairTimeframes.has(tf))
          );
        }
      }
    }

    if (!intersectionTimeframes || intersectionTimeframes.size === 0) return [];

    return Array.from(intersectionTimeframes).sort((a, b) => {
      const aIdx = tfOrder.indexOf(a);
      const bIdx = tfOrder.indexOf(b);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });
  }, [runnerDataAvailable, effectiveExchange, effectivePairs]);

  // Clear timeframe override if it's no longer available (due to pair selection change)
  useEffect(() => {
    if (timeframeOverride && availableTimeframes && availableTimeframes.length > 0) {
      if (!availableTimeframes.includes(timeframeOverride)) {
        // Current timeframe not available for all selected pairs, reset to first available
        setTimeframeOverride(availableTimeframes[0]);
      }
    }
  }, [availableTimeframes, timeframeOverride]);

  // Get active group for filtering strategies and runners
  const { activeOrganizationId } = useActiveOrganization();

  const [searchStrategies, { loading: searchLoading }] = useSearchStrategiesLazyQuery();
  const [getStrategyById] = useGetStrategyByIdLazyQuery();
  const [runBacktest, { loading, error }] = useRunBacktestMutation();

  // When runner data changes, update exchange and pairs if needed
  // Note: Using refs to avoid circular dependency with state updates
  const handleRunnerDataLoaded = useCallback((data: RunnerDataAvailable | null) => {
    setRunnerDataAvailable(data);

    if (data?.exchanges?.length) {
      // Use functional updates to avoid dependency on current state values
      setExchangeOverride(currentExchange => {
        const runnerExchangeNames = new Set(data.exchanges!.map(e => e.name.toLowerCase()));
        const exchange = currentExchange ?? 'binance';
        if (!runnerExchangeNames.has(exchange.toLowerCase())) {
          // Current exchange not available, switch to first available
          return data.exchanges![0]?.name.toLowerCase() ?? 'binance';
        }
        return currentExchange;
      });

      // Update pairs based on the exchange that will be selected
      setPairsOverride(currentPairs => {
        // Only update if user has already overridden pairs (not inheriting from strategy)
        if (currentPairs === null) {
          return null;
        }
        // Find the exchange data for the first available exchange
        const exchangeData = data.exchanges![0];
        if (exchangeData?.pairs?.length) {
                    return exchangeData.pairs.map(p => p.pair).slice(0, 3);
        }
        return currentPairs;
      });
    }
  }, []);

  // Sync config JSON when simple mode values change
  useEffect(() => {
    if (!advancedMode) {
      const config = buildConfigFromSimpleMode(exchangeOverride, pairsOverride, timeframeOverride);
      setConfigJson(JSON.stringify(config, null, 2));
    }
  }, [advancedMode, exchangeOverride, pairsOverride, timeframeOverride]);

  // Handle mode switch
  const handleModeSwitch = (checked: boolean) => {
    if (checked) {
      // Switching to advanced mode - sync current simple mode to JSON
      const config = buildConfigFromSimpleMode(exchangeOverride, pairsOverride, timeframeOverride);
      setConfigJson(JSON.stringify(config, null, 2));
      setJsonError(null);
    } else {
      // Switching to simple mode - try to extract values from JSON
      try {
        const config = JSON.parse(configJson);
        const extracted = extractSimpleModeFromConfig(config);
        if (extracted) {
          setExchangeOverride(extracted.exchangeName);
          setPairsOverride(extracted.pairs);
        }
        // Extract timeframe if present
        if (typeof config.timeframe === 'string') {
          setTimeframeOverride(config.timeframe);
        }
        // If extraction fails, keep current simple mode values
      } catch {
        // Keep current simple mode values if JSON is invalid
      }
    }
    setAdvancedMode(checked);
  };

  // Parse configJson for JSONEditor component
  const configObject = useMemo(() => {
    try {
      return configJson ? JSON.parse(configJson) : null;
    } catch {
      return null;
    }
  }, [configJson]);

  // Handle JSONEditor changes (object-based)
  const handleJsonEditorChange = useCallback((value: object | null) => {
    if (value) {
      setConfigJson(JSON.stringify(value, null, 2));
      setJsonError(null);
    } else {
      setConfigJson('{}');
      setJsonError(null);
    }
  }, []);

  // Validate JSON config against runner's available data
  // Unified validation - used by BOTH simple mode and advanced mode
  // This ensures 100% consistency between form and JSON editor
  const configValidation = useMemo((): BacktestConfigValidationResult => {
    if (advancedMode) {
      // Advanced mode: extract values from JSON and validate
      const extractedConfig = extractConfigFromJson(configObject as Record<string, unknown> | null);
      return validateBacktestConfigAgainstRunner(extractedConfig, runnerDataAvailable);
    } else {
      // Simple mode: use form values
      return validateBacktestConfigAgainstRunner(
        {
          exchange: effectiveExchange,
          pairs: effectivePairs.length > 0 ? effectivePairs : undefined,
          timeframe: effectiveTimeframe ?? undefined,
        },
        runnerDataAvailable
      );
    }
  }, [advancedMode, configObject, runnerDataAvailable, effectiveExchange, effectivePairs, effectiveTimeframe]);

  // Combined error message for JSON editor display
  const jsonConfigValidationError = useMemo(() => {
    if (!advancedMode) return null;
    const errors = [
      configValidation.exchangeError,
      configValidation.formatError,
      configValidation.pairsError,
      configValidation.timeframeError,
    ].filter(Boolean);
    return errors.length > 0 ? errors.join('. ') : null;
  }, [advancedMode, configValidation]);

  // Handle pairs change - validation is handled by unified configValidation
  const handlePairsChange = (newPairs: string[]) => {
    setPairsOverride(newPairs);
  };

  // Reset override states when strategy changes
  useEffect(() => {
    if (selectedStrategy) {
      const fields = extractStrategyConfigFields(selectedStrategy.config);
      // If strategy has pairs/timeframe configured, inherit them by setting override to null
      if (fields.pair_whitelist && fields.pair_whitelist.length > 0) {
        setPairsOverride(null);
              }
      if (fields.timeframe) {
        setTimeframeOverride(null);
      }
    }
  }, [selectedStrategy]); // Reset when strategy changes (includes config)

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
      config = buildConfigFromSimpleMode(exchangeOverride, pairsOverride, timeframeOverride);
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
        setExchangeOverride('binance');
        setPairsOverride(['BTC/USDT', 'ETH/USDT']);
        setTimeframeOverride(null);
                setConfigJson('');
        setJsonError(null);
        setRunnerDataAvailable(null);

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

  // Validation: need at least pairs (inherited or overridden) to run backtest
  const hasPairs = effectivePairs.length > 0;
  const hasValidationErrors = !!(
    configValidation.exchangeError ||
    configValidation.pairsError ||
    configValidation.timeframeError ||
    configValidation.formatError
  );
  const isSubmitDisabled = loading || !selectedStrategy?.id || !runnerID || !startDate || !endDate ||
    (advancedMode && (!!jsonError || hasValidationErrors)) ||
    (!advancedMode && (!hasPairs || hasValidationErrors));

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
              onDataAvailableLoaded={handleRunnerDataLoaded}
            />

            {/* Config Section - show when runner is selected */}
            {runnerID ? (
              <>
                <Divider />
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
                  {/* Exchange Selector */}
                  <FormControl fullWidth required>
                    <InputLabel>Exchange</InputLabel>
                    <Select
                      value={effectiveExchange}
                      onChange={(e) => {
                        const newExchange = e.target.value;
                        setExchangeOverride(newExchange);
                        // Update pairs to available pairs for the new exchange (only if user is overriding)
                        if (pairsOverride !== null && runnerDataAvailable?.exchanges?.length) {
                          const exchangeData = runnerDataAvailable.exchanges.find(
                            ex => ex.name.toLowerCase() === newExchange.toLowerCase()
                          );
                          if (exchangeData?.pairs?.length) {
                            setPairsOverride(exchangeData.pairs.map(p => p.pair).slice(0, 3));
                                                      }
                        }
                      }}
                      label="Exchange"
                    >
                      {availableExchanges.map((exchange) => (
                        <MenuItem key={exchange.id} value={exchange.id}>
                          {exchange.name}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText error={!!configValidation.exchangeError}>
                      {configValidation.exchangeError ||
                        (runnerDataAvailable?.exchanges?.length
                          ? `${availableExchanges.length} exchange(s) with data available on this runner`
                          : 'All supported exchanges (runner has no data availability metadata)')}
                    </FormHelperText>
                  </FormControl>

                  {/* Trading Pairs with Inheritance */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">Trading Pairs *</Typography>
                      {strategyConfigFields.pair_whitelist && pairsOverride === null && (
                        <Chip
                          label="Inherited from strategy"
                          size="small"
                          color="default"
                          variant="outlined"
                          onClick={() => setPairsOverride(strategyConfigFields.pair_whitelist ?? [])}
                          onDelete={() => setPairsOverride(strategyConfigFields.pair_whitelist ?? [])}
                          deleteIcon={<EditIcon fontSize="small" />}
                          sx={{ cursor: 'pointer' }}
                        />
                      )}
                    </Box>

                    {pairsOverride !== null || !strategyConfigFields.pair_whitelist ? (
                      <Autocomplete
                        multiple
                        freeSolo
                        value={effectivePairs}
                        onChange={(_event, newValue) => handlePairsChange(newValue as string[])}
                        options={availablePairs ?? []}
                        filterSelectedOptions
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder={effectivePairs.length === 0 ? "Select or type pairs..." : ""}
                            error={!!(configValidation.pairsError || configValidation.formatError)}
                            helperText={
                              configValidation.formatError ||
                              configValidation.pairsError ||
                              (availablePairs
                                ? `${availablePairs.length} pair(s) available on this runner for ${effectiveExchange}`
                                : 'Type pairs like BTC/USDT or BTC/USDT:USDT (futures). No data metadata available on runner.')
                            }
                          />
                        )}
                        renderTags={(value, getTagProps) =>
                          value.map((option, index) => {
                            const { key, ...tagProps } = getTagProps({ index });
                            return (
                              <Chip
                                key={key}
                                label={option}
                                size="small"
                                {...tagProps}
                              />
                            );
                          })
                        }
                      />
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                        {strategyConfigFields.pair_whitelist.map((pair) => (
                          <Chip key={pair} label={pair} size="small" variant="outlined" />
                        ))}
                      </Box>
                    )}
                  </Box>

                  {/* Timeframe Selector with Inheritance */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">Timeframe</Typography>
                      {strategyConfigFields.timeframe && timeframeOverride === null && (
                        <Chip
                          label="Inherited from strategy"
                          size="small"
                          color="default"
                          variant="outlined"
                          onClick={() => setTimeframeOverride(strategyConfigFields.timeframe ?? '5m')}
                          onDelete={() => setTimeframeOverride(strategyConfigFields.timeframe ?? '5m')}
                          deleteIcon={<EditIcon fontSize="small" />}
                          sx={{ cursor: 'pointer' }}
                        />
                      )}
                    </Box>

                    {timeframeOverride !== null || !strategyConfigFields.timeframe ? (
                      <FormControl fullWidth size="small">
                        <Select
                          value={effectiveTimeframe ?? ''}
                          onChange={(e) => setTimeframeOverride(e.target.value || null)}
                          displayEmpty
                        >
                          <MenuItem value="">
                            <em>Use strategy default</em>
                          </MenuItem>
                          {(availableTimeframes ?? ['1m', '5m', '15m', '30m', '1h', '4h', '1d']).map((tf) => (
                            <MenuItem key={tf} value={tf}>{tf}</MenuItem>
                          ))}
                        </Select>
                        {configValidation.timeframeError ? (
                          <FormHelperText error>
                            {configValidation.timeframeError}
                          </FormHelperText>
                        ) : availableTimeframes && availableTimeframes.length === 0 && effectivePairs.length > 0 ? (
                          <FormHelperText error>
                            No common timeframes for selected pairs. Try removing some pairs.
                          </FormHelperText>
                        ) : availableTimeframes ? (
                          <FormHelperText>
                            {availableTimeframes.length} timeframe(s) available
                            {effectivePairs.length > 0 ? ' for all selected pairs' : ' on this runner'}
                          </FormHelperText>
                        ) : null}
                      </FormControl>
                    ) : (
                      <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Chip label={strategyConfigFields.timeframe} size="small" variant="outlined" />
                      </Box>
                    )}
                  </Box>

                  {availableDateRange && (
                    <Alert severity="info" sx={{ py: 0 }}>
                      Data available from {dayjs(availableDateRange.from).format('YYYY-MM-DD')} to {dayjs(availableDateRange.to).format('YYYY-MM-DD')}
                    </Alert>
                  )}
                </Box>
              ) : (
                // Advanced Mode - JSON Editor with Monaco
                <JSONEditor
                  value={configObject}
                  onChange={handleJsonEditorChange}
                  label="Backtest Configuration"
                  helperText={jsonConfigValidationError || "Edit the full Freqtrade backtest configuration"}
                  error={!!jsonError || !!jsonConfigValidationError}
                  height="300px"
                />
              )}
                </Box>
              </>
            ) : null}

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
