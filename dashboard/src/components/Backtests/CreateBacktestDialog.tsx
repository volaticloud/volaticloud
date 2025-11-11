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
} from '@mui/material';
import { useState, useEffect } from 'react';
import { useCreateBacktestMutation, useGetBacktestOptionsQuery } from './backtests.generated';

interface CreateBacktestDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preSelectedStrategyId?: string;
}

export const CreateBacktestDialog = ({ open, onClose, onSuccess, preSelectedStrategyId }: CreateBacktestDialogProps) => {
  const [strategyID, setStrategyID] = useState('');
  const [runnerID, setRunnerID] = useState('');

  const { data: optionsData } = useGetBacktestOptionsQuery();
  const [createBacktest, { loading, error }] = useCreateBacktestMutation();

  // Set pre-selected strategy when dialog opens
  useEffect(() => {
    if (open && preSelectedStrategyId) {
      setStrategyID(preSelectedStrategyId);
    }
  }, [open, preSelectedStrategyId]);

  const handleSubmit = async () => {
    if (!strategyID || !runnerID) {
      return;
    }

    try {
      const result = await createBacktest({
        variables: {
          input: {
            strategyID,
            runnerID,
            status: 'pending' as any,
          },
        },
      });

      // Only close and reset if mutation was successful
      if (result.data?.createBacktest) {
        // Reset form
        setStrategyID('');
        setRunnerID('');

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

          <Alert severity="info">
            The backtest will use the strategy's configuration (pairs, timeframe, stake amount, etc.).
            No additional configuration is needed.
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
          disabled={loading || !strategyID || !runnerID}
        >
          {loading ? 'Creating...' : 'Create Backtest'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};