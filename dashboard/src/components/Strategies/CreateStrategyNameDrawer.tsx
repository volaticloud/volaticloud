import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  FormHelperText,
  Divider,
  CircularProgress,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { useState, useMemo } from 'react';
import { useCreateStrategyMutation } from './strategies.generated';
import { createDefaultFreqtradeConfig } from '../Freqtrade';
import { createDefaultUIBuilderConfig } from '../StrategyBuilder';
import { useActiveOrganization } from '../../contexts/OrganizationContext';
import { useDialogUnsavedChanges } from '../../hooks';
import { UnsavedChangesDrawer } from '../shared';
import { StrategyStrategyBuilderMode } from '../../generated/types';

interface CreateStrategyNameDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (strategyId: string) => void;
}

// Default code template for new strategies (UI Builder mode)
const defaultCode = `# pragma pylint: disable=missing-docstring, invalid-name, pointless-string-statement
from freqtrade.strategy import IStrategy
from pandas import DataFrame


class MyStrategy(IStrategy):
    """
    Sample strategy - customize this for your trading logic
    """

    # Strategy parameters
    minimal_roi = {"0": 0.1}
    stoploss = -0.10
    timeframe = '5m'

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # Add your indicators here
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # Define entry conditions
        dataframe['enter_long'] = 0
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # Define exit conditions
        dataframe['exit_long'] = 0
        return dataframe
`;

export const CreateStrategyNameDrawer = ({ open, onClose, onSuccess }: CreateStrategyNameDrawerProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { activeOrganizationId } = useActiveOrganization();
  const [createStrategy, { loading, error }] = useCreateStrategyMutation();

  // Track if form has been modified
  const hasChanges = useMemo(() => {
    return name !== '' || description !== '';
  }, [name, description]);

  const { handleClose, confirmDialogOpen, cancelClose, confirmClose } = useDialogUnsavedChanges({
    hasChanges,
    onClose,
  });

  const handleSubmit = async () => {
    if (!name.trim() || !activeOrganizationId) {
      return;
    }

    try {
      // Create strategy with default values - user will customize in Studio
      const defaultConfig = createDefaultFreqtradeConfig();
      const defaultUiBuilderConfig = createDefaultUIBuilderConfig();

      const result = await createStrategy({
        variables: {
          input: {
            name: name.trim(),
            description: description.trim() || undefined,
            code: defaultCode,
            config: {
              ...defaultConfig,
              ui_builder: defaultUiBuilderConfig,
            },
            builderMode: StrategyStrategyBuilderMode.Ui,
            ownerID: activeOrganizationId,
          },
        },
      });

      if (result.data?.createStrategy) {
        const newStrategyId = result.data.createStrategy.id;

        // Reset form
        setName('');
        setDescription('');

        // Notify parent with new strategy ID
        onSuccess(newStrategyId);
      }
    } catch (err) {
      console.error('Failed to create strategy:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && name.trim() && !loading) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 450 },
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
            Create New Strategy
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
            py: 3,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Give your strategy a name and optional description. You'll configure the trading logic in the Strategy Studio.
            </Typography>

            <TextField
              label="Strategy Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              required
              fullWidth
              autoFocus
              placeholder="e.g., RSI Momentum Strategy"
              helperText="Choose a descriptive name for your strategy"
            />

            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              placeholder="Briefly describe what this strategy does..."
              helperText="Optional - helps you remember the strategy's purpose"
            />

            {error && (
              <FormHelperText error>
                Error creating strategy: {error.message}
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
            disabled={loading || !name.trim() || !activeOrganizationId}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {loading ? 'Creating...' : 'Create & Open Studio'}
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
