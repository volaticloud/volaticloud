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
  Close,
  History,
} from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { useGetStrategyForStudioQuery } from './strategy-studio.generated';
import { useUpdateStrategyMutation, useCreateStrategyMutation } from './strategies.generated';
import { useGetBacktestQuery } from '../Backtests/backtests.generated';
import { FreqtradeConfigForm, createDefaultFreqtradeConfig, mergeWithDefaults } from '../Freqtrade';
import { PythonCodeEditor } from './PythonCodeEditor';
import { VersionHistoryPanel } from './VersionHistoryPanel';
import { CreateBacktestDrawer } from '../Backtests/CreateBacktestDrawer';
import { BacktestResultsDrawer } from '../Backtests/BacktestResultsDrawer';
import { ConfirmDrawer, ContentDrawer } from '../shared/FormDrawer';
import { ToolbarActions, ToolbarAction } from '../shared/ToolbarActions';
import { useOrganizationNavigate, useActiveOrganization } from '../../contexts/OrganizationContext';
import { useSidebar } from '../../contexts/SidebarContext';
import { StrategyBuilder, UIBuilderConfig, createDefaultUIBuilderConfig } from '../StrategyBuilder';
import { StrategyStrategyBuilderMode } from '../../generated/types';
import { useUnsavedChangesGuard } from '../../hooks';

const StrategyStudio = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useOrganizationNavigate();
  const { setCollapsed } = useSidebar();
  const { activeOrganizationId } = useActiveOrganization();

  // Determine if we're in create mode (new strategy) or edit mode
  // When navigating to /strategies/new, id is undefined (no :id param in route)
  const isCreateMode = !id;

  // Default config for new strategies - includes all mandatory Freqtrade fields
  const defaultConfig = createDefaultFreqtradeConfig();

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
  const [backtestDrawerOpen, setBacktestDrawerOpen] = useState(false);
  const [activeBacktestId, setActiveBacktestId] = useState<string | null>(null);
  const [backtestResultsDrawerOpen, setBacktestResultsDrawerOpen] = useState(false);

  // UI Builder state
  const [builderMode, setBuilderMode] = useState<StrategyStrategyBuilderMode>(
    isCreateMode ? StrategyStrategyBuilderMode.Ui : StrategyStrategyBuilderMode.Code
  );
  const [uiBuilderConfig, setUiBuilderConfig] = useState<UIBuilderConfig | null>(
    isCreateMode ? createDefaultUIBuilderConfig() : null
  );
  const [ejectDrawerOpen, setEjectDrawerOpen] = useState(false);
  const [versionHistoryDrawerOpen, setVersionHistoryDrawerOpen] = useState(false);

  // Navigation guard - prevents accidental data loss
  const {
    safeNavigate,
    dialogOpen: leaveDialogOpen,
    cancelLeave,
    confirmLeave,
  } = useUnsavedChangesGuard({
    hasChanges,
    navigate,
  });

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
      // Merge existing config with defaults to ensure all required Freqtrade fields are present
      // This fixes issues with old strategies missing entry_pricing, exit_pricing, etc.
      const strategyConfig = strategy.config as Record<string, unknown> | null;
      setConfig(mergeWithDefaults(strategyConfig));
      setBuilderMode(strategy.builderMode || StrategyStrategyBuilderMode.Code);
      // Extract ui_builder config from strategy config if available
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
      setEjectDrawerOpen(true);
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
    setEjectDrawerOpen(false);
    setHasChanges(true);
  };

  // Sanitize strategy name to valid Python class name (PascalCase)
  // IMPORTANT: This must match backend runner.SanitizeStrategyFilename (internal/runner/backtest_types.go)
  // The backend uses this for ConfigMap keys and --strategy flag values
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

  /**
   * Save the strategy. Returns true if save succeeded, false otherwise.
   * @param closeAfterSave - If true, navigates to detail view after save
   * @returns Promise<boolean> - true if save succeeded
   */
  const handleSave = async (closeAfterSave = false): Promise<boolean> => {
    if (!name || !code || !config) {
      return false;
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
          return false;
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
          return true;
        }
        return false;
      } else {
        // Update existing strategy
        if (!strategy) return false;

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
          return true;
        }
        return false;
      }
    } catch (err) {
      console.error('Failed to save strategy:', err);
      return false;
    }
  };

  const handleCancel = () => {
    if (isCreateMode) {
      safeNavigate('/strategies');
    } else {
      safeNavigate(`/strategies/${id}`);
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
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        // Fill the parent container
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
      }}
    >
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
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h5" fontWeight={600} noWrap>
              {isCreateMode ? 'Create Strategy' : name || 'Strategy'}
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
            {hasChanges && (
              <Chip label="Unsaved" size="small" color="warning" variant="outlined" />
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
                  onClick={() => setBacktestResultsDrawerOpen(true)}
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
                  onClick={() => setBacktestResultsDrawerOpen(true)}
                  sx={{ cursor: 'pointer' }}
                />
              </Tooltip>
            )}
          </>
        )}

        {/* Toolbar Actions */}
        <ToolbarActions
          size="medium"
          actions={
            isCreateMode
              ? [
                  // Create mode actions
                  {
                    id: 'create',
                    label: 'Create Strategy',
                    loadingLabel: 'Creating...',
                    icon: <AddIcon />,
                    onClick: () => handleSave(true),
                    primary: true,
                    variant: 'contained',
                    disabled: !name || !code || !config || !activeOrganizationId,
                    loading: saving,
                  },
                  {
                    id: 'cancel',
                    label: 'Cancel',
                    icon: <Close />,
                    onClick: handleCancel,
                  },
                ]
              : ([
                  // Edit mode actions
                  {
                    id: 'save',
                    label: 'Save',
                    loadingLabel: 'Saving...',
                    icon: <Save />,
                    onClick: () => handleSave(false),
                    primary: true,
                    variant: 'contained',
                    disabled: !name || !code || !hasChanges,
                    loading: saving,
                  },
                  {
                    id: 'run-backtest',
                    label: isBacktestRunning ? 'Running...' : 'Run Backtest',
                    icon: <PlayArrow />,
                    onClick: () => setBacktestDrawerOpen(true),
                    disabled: hasChanges || isBacktestRunning,
                    color: 'secondary',
                  },
                  {
                    id: 'view-results',
                    label: 'View Results',
                    icon: <Assessment />,
                    onClick: () => setBacktestResultsDrawerOpen(true),
                    hidden: !isBacktestCompleted && !isBacktestFailed,
                    color: isBacktestCompleted ? 'success' : 'error',
                  },
                  {
                    id: 'save-close',
                    label: 'Save & Close',
                    loadingLabel: 'Saving...',
                    icon: <ExitToApp />,
                    onClick: () => handleSave(true),
                    disabled: !name || !code || !hasChanges,
                    loading: saving,
                    dividerBefore: true,
                  },
                  {
                    id: 'version-history',
                    label: 'Version History',
                    icon: <History />,
                    onClick: () => setVersionHistoryDrawerOpen(true),
                  },
                  {
                    id: 'cancel',
                    label: 'Cancel',
                    icon: <Close />,
                    onClick: handleCancel,
                  },
                ] as ToolbarAction[])
          }
        />
      </Paper>

      {saveError && (
        <Alert severity="error" sx={{ mx: 2, mt: 2 }}>
          Error saving strategy: {saveError.message}
        </Alert>
      )}

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          overflow: { xs: 'auto', md: 'hidden' },
          minHeight: 0,
        }}
      >
        {/* Left Panel - Code Editor or UI Builder */}
        <Box
          sx={{
            flex: { xs: 'none', md: 1 },
            height: { xs: 500, md: '100%' },
            minHeight: { xs: 400, md: 0 },
            display: 'flex',
            flexDirection: 'column',
            borderRight: { xs: 0, md: 1 },
            borderBottom: { xs: 1, md: 0 },
            borderColor: 'grey.200',
            overflow: 'hidden',
          }}
        >
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
            width: { xs: '100%', md: 400, lg: 500 },
            flex: { xs: 'none', md: 'none' },
            height: { xs: 'auto', md: '100%' },
            minHeight: { xs: 400, md: 0 },
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

              {saveError && (
                <FormHelperText error>
                  Error saving strategy: {saveError.message}
                </FormHelperText>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Backtest Drawer - only in edit mode */}
      {!isCreateMode && strategy && (
        <CreateBacktestDrawer
          open={backtestDrawerOpen}
          onClose={() => setBacktestDrawerOpen(false)}
          onSuccess={() => {
            // Don't navigate away - stay in studio
          }}
          onBacktestCreated={(backtestId) => {
            setActiveBacktestId(backtestId);
          }}
          preSelectedStrategyId={strategy.id}
        />
      )}

      {/* Backtest Results Drawer - only in edit mode */}
      {!isCreateMode && (
        <BacktestResultsDrawer
          open={backtestResultsDrawerOpen}
          onClose={() => setBacktestResultsDrawerOpen(false)}
          backtestId={activeBacktestId}
          polling={isBacktestRunning}
        />
      )}

      {/* Eject to Code Confirmation Drawer */}
      <ConfirmDrawer
        open={ejectDrawerOpen}
        onClose={() => setEjectDrawerOpen(false)}
        title="Eject to Code Mode?"
        message={
          <Box>
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
          </Box>
        }
        confirmLabel="Eject to Code"
        confirmColor="warning"
        onConfirm={handleConfirmEject}
      />

      {/* Leave confirmation dialog */}
      <Dialog open={leaveDialogOpen} onClose={cancelLeave}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="warning" />
          Unsaved Changes
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            You have unsaved changes that will be lost if you leave this page.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Do you want to save your changes before leaving?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelLeave}>Cancel</Button>
          <Button color="error" onClick={() => { setHasChanges(false); confirmLeave(); }}>
            Discard Changes
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              const success = await handleSave(false);
              if (success) {
                // Save succeeded (handleSave already set hasChanges=false), proceed with navigation
                confirmLeave();
              } else {
                // Save failed, close dialog but stay on page
                cancelLeave();
              }
            }}
          >
            Save & Leave
          </Button>
        </DialogActions>
      </Dialog>

      {/* Version History Drawer - only in edit mode */}
      {!isCreateMode && strategy && (
        <ContentDrawer
          open={versionHistoryDrawerOpen}
          onClose={() => setVersionHistoryDrawerOpen(false)}
          title="Version History"
        >
          <VersionHistoryPanel
            strategyName={strategy.name}
            currentCode={code}
            currentVersionNumber={strategy.versionNumber}
            onCopyFromVersion={handleChange(setCode)}
          />
        </ContentDrawer>
      )}
    </Box>
  );
};

export default StrategyStudio;