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
} from '@mui/material';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useCreateBacktestMutation, useSearchStrategiesLazyQuery, useGetStrategyByIdLazyQuery } from './backtests.generated';
import { useActiveGroup } from '../../contexts/GroupContext';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
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

export const CreateBacktestDialog = ({ open, onClose, onSuccess, onBacktestCreated, preSelectedStrategyId }: CreateBacktestDialogProps) => {
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyOption | null>(null);
  const [strategyInputValue, setStrategyInputValue] = useState('');
  const [strategyOptions, setStrategyOptions] = useState<StrategyOption[]>([]);
  const [runnerID, setRunnerID] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('1month');
  const [startDate, setStartDate] = useState<Dayjs | null>(dayjs().subtract(1, 'month'));
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs());

  // Get active group for filtering strategies and runners
  const { activeGroupId } = useActiveGroup();

  const [searchStrategies, { loading: searchLoading }] = useSearchStrategiesLazyQuery();
  const [getStrategyById] = useGetStrategyByIdLazyQuery();
  const [createBacktest, { loading, error }] = useCreateBacktestMutation();

  // Debounced search function
  const debouncedSearch = useMemo(
    () =>
      debounce(async (search: string) => {
        if (!activeGroupId) return;

        const { data } = await searchStrategies({
          variables: {
            search: search || undefined,
            ownerID: activeGroupId,
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
    [activeGroupId, searchStrategies, selectedStrategy]
  );

  // Load initial strategies when dialog opens
  useEffect(() => {
    if (open && activeGroupId) {
      debouncedSearch('');
    }
  }, [open, activeGroupId, debouncedSearch]);

  // Load pre-selected strategy
  useEffect(() => {
    if (open && preSelectedStrategyId && activeGroupId) {
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
  }, [open, preSelectedStrategyId, activeGroupId, getStrategyById]);

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

    try {
      const result = await createBacktest({
        variables: {
          input: {
            strategyID: selectedStrategy.id,
            runnerID,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        },
      });

      // Only close and reset if mutation was successful
      if (result.data?.createBacktest) {
        const backtestId = result.data.createBacktest.id;
        const newStrategyId = result.data.createBacktest.strategy?.id;

        // Reset form
        setSelectedStrategy(null);
        setStrategyInputValue('');
        setRunnerID('');
        setDatePreset('1month');
        setStartDate(dayjs().subtract(1, 'month'));
        setEndDate(dayjs());

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
              The backtest will use the strategy's configuration (pairs, timeframe, stake amount, etc.)
              with the selected date range.
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
            disabled={loading || !selectedStrategy?.id || !runnerID || !startDate || !endDate}
          >
            {loading ? 'Creating...' : 'Create Backtest'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};