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
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
  Divider,
  Chip,
} from '@mui/material';
import { useState, useEffect } from 'react';
import { useCreateBacktestMutation, useGetBacktestOptionsQuery } from './backtests.generated';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';

interface CreateBacktestDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preSelectedStrategyId?: string;
}

type DatePreset = '1week' | '1month' | '3months' | '6months' | '1year' | 'custom';

export const CreateBacktestDialog = ({ open, onClose, onSuccess, preSelectedStrategyId }: CreateBacktestDialogProps) => {
  const [strategyID, setStrategyID] = useState('');
  const [runnerID, setRunnerID] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('1month');
  const [startDate, setStartDate] = useState<Dayjs | null>(dayjs().subtract(1, 'month'));
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs());

  const { data: optionsData } = useGetBacktestOptionsQuery();
  const [createBacktest, { loading, error }] = useCreateBacktestMutation();

  // Set pre-selected strategy when dialog opens
  useEffect(() => {
    if (open && preSelectedStrategyId) {
      setStrategyID(preSelectedStrategyId);
    }
  }, [open, preSelectedStrategyId]);

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
    if (!strategyID || !runnerID || !startDate || !endDate) {
      return;
    }

    try {
      const result = await createBacktest({
        variables: {
          input: {
            strategyID,
            runnerID,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        },
      });

      // Only close and reset if mutation was successful
      if (result.data?.createBacktest) {
        // Reset form
        setStrategyID('');
        setRunnerID('');
        setDatePreset('1month');
        setStartDate(dayjs().subtract(1, 'month'));
        setEndDate(dayjs());

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
    <LocalizationProvider dateAdapter={AdapterDayjs}>
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
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 1 }}>
                      <Typography>{strategy.name}</Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Chip
                          label={`v${strategy.versionNumber}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                        {strategy.isLatest && (
                          <Chip
                            label="Latest"
                            size="small"
                            color="success"
                          />
                        )}
                      </Box>
                    </Box>
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
            disabled={loading || !strategyID || !runnerID || !startDate || !endDate}
          >
            {loading ? 'Creating...' : 'Create Backtest'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};