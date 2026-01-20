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
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
  Code,
  Dashboard,
  Warning,
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
import { useOrganizationNavigate, useActiveOrganization } from '../../contexts/OrganizationContext';
import { useSidebar } from '../../contexts/SidebarContext';
import { StrategyBuilder, UIBuilderConfig, createDefaultUIBuilderConfig } from '../StrategyBuilder';
import { StrategyStrategyBuilderMode } from '../../generated/types';

const StrategyStudio = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useOrganizationNavigate();
  const { setCollapsed } = useSidebar();
  const { activeOrganizationId } = useActiveOrganization();

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

  // UI Builder state
  const [builderMode, setBuilderMode] = useState<StrategyStrategyBuilderMode>(
    isCreateMode ? StrategyStrategyBuilderMode.Ui : StrategyStrategyBuilderMode.Code
  );
  const [uiBuilderConfig, setUiBuilderConfig] = useState<UIBuilderConfig | null>(
    isCreateMode ? createDefaultUIBuilderConfig() : null
  );
  const [ejectDialogOpen, setEjectDialogOpen] = useState(false);

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
      setBuilderMode(strategy.builderMode || StrategyStrategyBuilderMode.Code);
      // Extract ui_builder config from strategy config if available
      const strategyConfig = strategy.config as Record<string, unknown> | null;
      if (strategyConfig?.ui_builder) {
        setUiBuilderConfig(strategyConfig.ui_builder as UIBuilderConfig);
      } else {
        setUiBuilderConfig(null);
      }
      setHasChanges(false);
    }
  }, [strategy]);

  const handleChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => (value: T) => {
    setter(value);
    setHasChanges(true);
  };

  // Handle UI Builder config changes
  const handleUIBuilderConfigChange = (newConfig: UIBuilderConfig) => {
    setUiBuilderConfig(newConfig);
    setHasChanges(true);
  };

  // Handle mode toggle between UI and Code
  const handleModeChange = (_: React.MouseEvent<HTMLElement>, newMode: StrategyStrategyBuilderMode | null) => {
    if (newMode === null) return;

    // Switching from UI to Code requires ejection confirmation
    if (builderMode === StrategyStrategyBuilderMode.Ui && newMode === StrategyStrategyBuilderMode.Code) {
      setEjectDialogOpen(true);
      return;
    }

    // Switching from Code to UI is only allowed for new strategies
    if (builderMode === StrategyStrategyBuilderMode.Code && newMode === StrategyStrategyBuilderMode.Ui) {
      // Only allow if no code has been written (or it's the default template)
      if (code !== defaultCode && !isCreateMode) {
        // Cannot switch existing code-based strategies to UI mode
        return;
      }
      setBuilderMode(newMode);
      if (!uiBuilderConfig) {
        setUiBuilderConfig(createDefaultUIBuilderConfig());
      }
      setHasChanges(true);
    }
  };

  // Confirm eject to code mode
  const handleConfirmEject = () => {
    setBuilderMode(StrategyStrategyBuilderMode.Code);
    setEjectDialogOpen(false);
    setHasChanges(true);
  };

  // Sanitize strategy name to valid Python class name (PascalCase)
  const toClassName = (str: string): string => {
    if (!str) return 'MyStrategy';
    // Remove invalid characters
    const sanitized = str.replace(/[^a-zA-Z0-9\s]/g, '');
    if (!sanitized) return 'MyStrategy';

    // If no spaces, preserve original casing (already PascalCase or camelCase)
    // Just ensure first char is uppercase
    if (!sanitized.includes(' ')) {
      return sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
    }

    // Convert space-separated words to PascalCase
    return sanitized
      .split(/\s+/)
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
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

    // Build the full config object including ui_builder if in UI mode
    const fullConfig = {
      ...config,
      ...(builderMode === StrategyStrategyBuilderMode.Ui && uiBuilderConfig
        ? { ui_builder: uiBuilderConfig }
        : {}),
    };

    try {
      if (isCreateMode) {
        // Create new strategy
        if (!activeOrganizationId) {
          console.error('No active group selected');
          return;
        }

        const result = await createStrategy({
          variables: {
            input: {
              name,
              description: description || undefined,
              code,
              config: fullConfig,
              builderMode,
              ownerID: activeOrganizationId,
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
              config: fullConfig,
              builderMode,
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

        {/* Mode Toggle */}
        <ToggleButtonGroup
          value={builderMode}
          exclusive
          onChange={handleModeChange}
          size="small"
        >
          <ToggleButton
            value={StrategyStrategyBuilderMode.Ui}
            disabled={
              builderMode === StrategyStrategyBuilderMode.Code &&
              !isCreateMode &&
              code !== defaultCode
            }
          >
            <Tooltip title="Visual Builder">
              <Dashboard fontSize="small" sx={{ mr: 0.5 }} />
            </Tooltip>
            Builder
          </ToggleButton>
          <ToggleButton value={StrategyStrategyBuilderMode.Code}>
            <Tooltip title="Code Editor">
              <Code fontSize="small" sx={{ mr: 0.5 }} />
            </Tooltip>
            Code
          </ToggleButton>
        </ToggleButtonGroup>

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
            disabled={saving || !name || !code || !config || !activeOrganizationId}
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
        {/* Left Panel - Code Editor or UI Builder */}
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
              {builderMode === StrategyStrategyBuilderMode.Ui ? 'Strategy Builder' : 'Strategy Code'}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, position: 'relative', minHeight: 0 }}>
            {builderMode === StrategyStrategyBuilderMode.Ui ? (
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <StrategyBuilder
                  value={uiBuilderConfig}
                  onChange={handleUIBuilderConfigChange}
                  className={toClassName(name)}
                  timeframe={(config as Record<string, unknown>)?.timeframe as string || '5m'}
                  stakeCurrency={(config as Record<string, unknown>)?.stake_currency as string || 'USDT'}
                  stakeAmount={(config as Record<string, unknown>)?.stake_amount as number || 100}
                />
              </Box>
            ) : (
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                <PythonCodeEditor
                  value={code}
                  onChange={handleChange(setCode)}
                  height="100%"
                  label=""
                />
              </Box>
            )}
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

      {/* Eject to Code Confirmation Dialog */}
      <Dialog open={ejectDialogOpen} onClose={() => setEjectDialogOpen(false)}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="warning" />
          Eject to Code Mode?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            This will convert your strategy to code-only mode.
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Once ejected, you will have full control over the Python code but will no longer be able
            to edit using the visual builder.
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action cannot be undone. The visual builder configuration will be preserved in the
            strategy config but can only be edited as code.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEjectDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleConfirmEject}>
            Eject to Code
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StrategyStudio;