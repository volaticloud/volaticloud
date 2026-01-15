import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  TextField,
  Paper,
  Divider,
  FormHelperText,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack,
  Save,
  Restore,
  ExitToApp,
  PlayArrow,
  Assessment,
  CheckCircle,
  Error as ErrorIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { useGetStrategyForStudioQuery } from './strategy-studio.generated';
import { useUpdateStrategyMutation, useCreateStrategyMutation } from './strategies.generated';
import { useGetBacktestQuery } from '../Backtests/backtests.generated';
import { FreqtradeConfigForm } from '../Freqtrade/FreqtradeConfigForm';
import { PythonCodeEditor } from './PythonCodeEditor';
import { VersionHistoryPanel } from './VersionHistoryPanel';
import { CreateBacktestDialog } from '../Backtests/CreateBacktestDialog';
import { BacktestResultsDialog } from '../Backtests/BacktestResultsDialog';
import { useGroupNavigate, useActiveGroup } from '../../contexts/GroupContext';
import { useSidebar } from '../../contexts/SidebarContext';

const StrategyStudio = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useGroupNavigate();
  const { setCollapsed } = useSidebar();
  const { activeGroupId } = useActiveGroup();

  // Determine if we're in create mode (new strategy) or edit mode
  // When navigating to /strategies/new, id is undefined (no :id param in route)
  const isCreateMode = !id;

  // Default config for new strategies
  const defaultConfig = {
    stake_currency: 'USDT',
    stake_amount: 100,
    max_open_trades: 3,
    timeframe: '5m',
  };

  // Default code template for new strategies
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

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState(isCreateMode ? defaultCode : '');
  const [config, setConfig] = useState<object | null>(isCreateMode ? defaultConfig : null);
  const [hasChanges, setHasChanges] = useState(false);
  const [backtestDialogOpen, setBacktestDialogOpen] = useState(false);
  const [activeBacktestId, setActiveBacktestId] = useState<string | null>(null);
  const [backtestResultsDialogOpen, setBacktestResultsDialogOpen] = useState(false);

  const { data, loading, error } = useGetStrategyForStudioQuery({
    variables: { id: id! },
    skip: !id || isCreateMode,
  });

  const [updateStrategy, { loading: updating, error: updateError }] = useUpdateStrategyMutation();
  const [createStrategy, { loading: creating, error: createError }] = useCreateStrategyMutation();

  const saving = updating || creating;
  const saveError = updateError || createError;

  const strategy = data?.strategies?.edges?.[0]?.node;

  // Poll for active backtest status
  const { data: backtestData } = useGetBacktestQuery({
    variables: { id: activeBacktestId! },
    skip: !activeBacktestId,
    pollInterval: activeBacktestId ? 3000 : 0,
  });

  const activeBacktest = backtestData?.backtests?.edges?.[0]?.node;
  const isBacktestRunning = activeBacktest?.status === 'running' || activeBacktest?.status === 'pending';
  const isBacktestCompleted = activeBacktest?.status === 'completed';
  const isBacktestFailed = activeBacktest?.status === 'failed';

  // Auto-collapse sidebar on mount, restore on unmount
  useEffect(() => {
    // Only collapse on mount, don't store current state as it causes issues
    setCollapsed(true);

    return () => {
      // Restore to expanded on unmount
      setCollapsed(false);
    };
  }, [setCollapsed]);

  useEffect(() => {
    if (strategy) {
      setName(strategy.name);
      setDescription(strategy.description || '');
      setCode(strategy.code);
      setConfig(strategy.config || null);
      setHasChanges(false);
    }
  }, [strategy]);

  const handleChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => (value: T) => {
    setter(value);
    setHasChanges(true);
  };

  // Sanitize strategy name to valid Python class name (PascalCase)
  const toClassName = (str: string): string => {
    if (!str) return 'MyStrategy';
    // Remove invalid characters and convert to PascalCase
    return str
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
      .split(/\s+/) // Split by whitespace
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('') || 'MyStrategy';
  };

  // Handle name change with sync to config and code
  const handleNameChange = (newName: string) => {
    setName(newName);
    setHasChanges(true);

    // Update config with strategy_name field
    setConfig(prev => ({
      ...prev,
      strategy_name: newName || undefined,
    }));

    // Update class name in code
    const className = toClassName(newName);
    setCode(prev => prev.replace(/class \w+\(IStrategy\):/, `class ${className}(IStrategy):`));
  };

  const handleSave = async (closeAfterSave = false) => {
    if (!name || !code || !config) {
      return;
    }

    try {
      if (isCreateMode) {
        // Create new strategy
        if (!activeGroupId) {
          console.error('No active group selected');
          return;
        }

        const result = await createStrategy({
          variables: {
            input: {
              name,
              description: description || undefined,
              code,
              config,
              ownerID: activeGroupId,
            },
          },
        });

        if (result.data?.createStrategy) {
          const newStrategyId = result.data.createStrategy.id;
          if (closeAfterSave) {
            navigate(`/strategies/${newStrategyId}`);
          } else {
            // Navigate to edit mode for the new strategy
            navigate(`/strategies/${newStrategyId}/edit`, { replace: true });
            setHasChanges(false);
          }
        }
      } else {
        // Update existing strategy
        if (!strategy) return;

        const result = await updateStrategy({
          variables: {
            id: strategy.id,
            input: {
              name,
              description: description || undefined,
              code,
              config: config || undefined,
            },
          },
        });

        if (result.data?.updateStrategy) {
          const newStrategyId = result.data.updateStrategy.id;
          if (closeAfterSave) {
            navigate(`/strategies/${newStrategyId}`);
          } else {
            // Stay on the page but navigate to the new version
            navigate(`/strategies/${newStrategyId}/edit`, { replace: true });
            setHasChanges(false);
          }
        }
      }
    } catch (err) {
      console.error('Failed to save strategy:', err);
    }
  };

  const handleCancel = () => {
    if (isCreateMode) {
      navigate('/strategies');
    } else {
      navigate(`/strategies/${id}`);
    }
  };

  // Loading state - only for edit mode
  if (!isCreateMode && loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  // Error state - only for edit mode
  if (!isCreateMode && error) {
    return <Alert severity="error">Error loading strategy: {error.message}</Alert>;
  }

  // Not found state - only for edit mode
  if (!isCreateMode && !strategy) {
    return <Alert severity="warning">Strategy not found</Alert>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <IconButton onClick={handleCancel}>
          <ArrowBack />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h5" fontWeight={600}>
              {isCreateMode ? 'Create Strategy' : 'Strategy Studio'}
            </Typography>
            {!isCreateMode && strategy && (
              <>
                <Chip
                  label={`v${strategy.versionNumber}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
                {strategy.isLatest && (
                  <Chip label="Latest" size="small" color="success" />
                )}
                {!strategy.isLatest && (
                  <Chip
                    icon={<Restore />}
                    label="Restoring old version"
                    size="small"
                    color="warning"
                  />
                )}
              </>
            )}
            {isCreateMode && (
              <Chip
                icon={<AddIcon />}
                label="New Strategy"
                size="small"
                color="primary"
              />
            )}
            {hasChanges && (
              <Chip label="Unsaved changes" size="small" color="warning" variant="outlined" />
            )}
          </Box>
        </Box>
        {/* Backtest Status Indicator - only in edit mode */}
        {!isCreateMode && activeBacktestId && (
          <>
            {isBacktestRunning && (
              <Tooltip title="Backtest in progress">
                <Chip
                  icon={<CircularProgress size={14} />}
                  label="Backtest Running"
                  color="info"
                  size="small"
                />
              </Tooltip>
            )}
            {isBacktestCompleted && (
              <Tooltip title="Click to view results">
                <Chip
                  icon={<CheckCircle />}
                  label="Backtest Complete"
                  color="success"
                  size="small"
                  onClick={() => setBacktestResultsDialogOpen(true)}
                  sx={{ cursor: 'pointer' }}
                />
              </Tooltip>
            )}
            {isBacktestFailed && (
              <Tooltip title="Click to view details">
                <Chip
                  icon={<ErrorIcon />}
                  label="Backtest Failed"
                  color="error"
                  size="small"
                  onClick={() => setBacktestResultsDialogOpen(true)}
                  sx={{ cursor: 'pointer' }}
                />
              </Tooltip>
            )}
            {(isBacktestCompleted || isBacktestFailed) && (
              <Button
                variant="outlined"
                color={isBacktestCompleted ? 'success' : 'error'}
                startIcon={<Assessment />}
                onClick={() => setBacktestResultsDialogOpen(true)}
                size="small"
              >
                View Results
              </Button>
            )}
          </>
        )}
        {/* Run Backtest - only in edit mode */}
        {!isCreateMode && (
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<PlayArrow />}
            onClick={() => setBacktestDialogOpen(true)}
            disabled={hasChanges || isBacktestRunning}
          >
            {isBacktestRunning ? 'Running...' : 'Run Backtest'}
          </Button>
        )}
        <Button variant="outlined" onClick={handleCancel}>
          Cancel
        </Button>
        {isCreateMode ? (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleSave(true)}
            disabled={saving || !name || !code || !config || !activeGroupId}
          >
            {saving ? 'Creating...' : 'Create Strategy'}
          </Button>
        ) : (
          <>
            <Button
              variant="outlined"
              startIcon={<Save />}
              onClick={() => handleSave(false)}
              disabled={saving || !name || !code || !hasChanges}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              variant="contained"
              startIcon={<ExitToApp />}
              onClick={() => handleSave(true)}
              disabled={saving || !name || !code || !hasChanges}
            >
              {saving ? 'Saving...' : 'Save & Close'}
            </Button>
          </>
        )}
      </Paper>

      {saveError && (
        <Alert severity="error" sx={{ mx: 2, mt: 2 }}>
          Error saving strategy: {saveError.message}
        </Alert>
      )}

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel - Code Editor */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRight: 1,
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Strategy Code
            </Typography>
          </Box>
          <Box sx={{ flex: 1, position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              <PythonCodeEditor
                value={code}
                onChange={handleChange(setCode)}
                height="100%"
                label=""
              />
            </Box>
          </Box>
        </Box>

        {/* Right Panel - Configuration */}
        <Box
          sx={{
            width: { xs: '100%', md: '400px', lg: '500px' },
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Strategy Settings
            </Typography>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Strategy Name */}
              <TextField
                label="Strategy Name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                fullWidth
                size="small"
                helperText={`Class: ${toClassName(name)}`}
              />

              {/* Description */}
              <TextField
                label="Description"
                value={description}
                onChange={(e) => handleChange(setDescription)(e.target.value)}
                fullWidth
                multiline
                rows={3}
                size="small"
              />

              <Divider />

              {/* Freqtrade Config */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Freqtrade Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Configure trading parameters for backtesting and live trading.
                </Typography>
                <FreqtradeConfigForm
                  value={config}
                  onChange={handleChange(setConfig)}
                  hideSubmitButton
                />
              </Box>

              {/* Version History - only in edit mode */}
              {!isCreateMode && strategy && (
                <>
                  <Divider />
                  <VersionHistoryPanel
                    strategyName={strategy.name}
                    currentCode={code}
                    currentVersionNumber={strategy.versionNumber}
                    onCopyFromVersion={handleChange(setCode)}
                  />
                </>
              )}

              {saveError && (
                <FormHelperText error>
                  Error saving strategy: {saveError.message}
                </FormHelperText>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Backtest Dialog - only in edit mode */}
      {!isCreateMode && strategy && (
        <CreateBacktestDialog
          open={backtestDialogOpen}
          onClose={() => setBacktestDialogOpen(false)}
          onSuccess={() => {
            // Don't navigate away - stay in studio
          }}
          onBacktestCreated={(backtestId) => {
            setActiveBacktestId(backtestId);
          }}
          preSelectedStrategyId={strategy.id}
        />
      )}

      {/* Backtest Results Dialog - only in edit mode */}
      {!isCreateMode && (
        <BacktestResultsDialog
          open={backtestResultsDialogOpen}
          onClose={() => setBacktestResultsDialogOpen(false)}
          backtestId={activeBacktestId}
          polling={isBacktestRunning}
        />
      )}
    </Box>
  );
};

export default StrategyStudio;