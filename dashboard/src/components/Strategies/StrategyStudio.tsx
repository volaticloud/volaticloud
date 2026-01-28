import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Paper,
  FormHelperText,
  Tooltip,
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
  InfoOutlined,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useGetStrategyForStudioQuery } from './strategy-studio.generated';
import { useUpdateStrategyMutation, useCreateStrategyMutation } from './strategies.generated';
import { useGetBacktestQuery, useBacktestProgressSubscription } from '../Backtests/backtests.generated';
import { FreqtradeConfigForm, createDefaultFreqtradeConfig, mergeWithDefaults, STRATEGY_SECTIONS } from '../Freqtrade';
import { PythonCodeEditor } from './PythonCodeEditor';
import { VersionHistoryPanel } from './VersionHistoryPanel';
import { RenameStrategyDrawer } from './RenameStrategyDrawer';
import { DEFAULT_STRATEGY_CODE } from './strategyDefaults';
import { CreateBacktestDrawer } from '../Backtests/CreateBacktestDrawer';
import { BacktestResultsDrawer } from '../Backtests/BacktestResultsDrawer';
import { ConfirmDrawer, ContentDrawer, ResponsivePanelLayout } from '../shared';
import type { TabDefinition, PanelGroupDefinition } from '../shared';
import { ToolbarActions, ToolbarAction } from '../shared/ToolbarActions';
import { useOrganizationNavigate, useActiveOrganization } from '../../contexts/OrganizationContext';
import { useSidebar } from '../../contexts/SidebarContext';
import { useBuilderTabs, UIBuilderConfig, createDefaultUIBuilderConfig } from '../StrategyBuilder';
import { StrategyStrategyBuilderMode } from '../../generated/types';
import { useUnsavedChangesGuard, useResponsiveLayout } from '../../hooks';

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
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};

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

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState(isCreateMode ? DEFAULT_STRATEGY_CODE : '');
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
  const [renameDrawerOpen, setRenameDrawerOpen] = useState(false);

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

  // Fetch initial backtest data
  const { data: backtestData, refetch: refetchBacktest } = useGetBacktestQuery({
    variables: { id: activeBacktestId! },
    skip: !activeBacktestId,
  });

  // Subscribe to real-time backtest progress updates via WebSocket
  const { data: backtestSubscriptionData } = useBacktestProgressSubscription({
    variables: { backtestId: activeBacktestId! },
    skip: !activeBacktestId,
  });

  // Use subscription data if available, otherwise fall back to query data
  const activeBacktest = backtestSubscriptionData?.backtestProgress || backtestData?.backtests?.edges?.[0]?.node;

  // Refetch full data when subscription indicates completion
  useEffect(() => {
    if (backtestSubscriptionData?.backtestProgress?.status === 'completed' ||
        backtestSubscriptionData?.backtestProgress?.status === 'failed') {
      refetchBacktest();
    }
  }, [backtestSubscriptionData, refetchBacktest]);
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

  // Confirm eject to code mode
  const handleConfirmEject = () => {
    setBuilderMode(StrategyStrategyBuilderMode.Code);
    setEjectDrawerOpen(false);
    setHasChanges(true);
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

  // Get responsive layout state
  const { isMobile } = useResponsiveLayout();

  // Handler for config changes
  const handleConfigChange = useCallback((value: object | null) => {
    setConfig(value);
    setHasChanges(true);
  }, []);

  // Get builder tabs from the hook
  const builderTabs = useBuilderTabs({
    value: uiBuilderConfig,
    onChange: handleUIBuilderConfigChange,
    className: toClassName(name),
    timeframe: (config as Record<string, unknown>)?.timeframe as string || '5m',
    stakeCurrency: (config as Record<string, unknown>)?.stake_currency as string || 'USDT',
    stakeAmount: (config as Record<string, unknown>)?.stake_amount as number || 100,
  });

  // Strategy settings tab content (shared between both modes)
  const strategySettingsContent = useMemo(
    () => (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
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
            onChange={handleConfigChange}
            hideSubmitButton
            defaultSections={STRATEGY_SECTIONS}
          />
        </Box>

        {saveError && (
          <FormHelperText error>Error saving strategy: {saveError.message}</FormHelperText>
        )}
      </Box>
    ),
    [config, saveError, handleConfigChange]
  );

  // General settings tab definition (name, description, freqtrade config)
  const generalSettingsTab: TabDefinition = useMemo(
    () => ({
      id: 'general',
      label: 'General',
      icon: <InfoOutlined />,
      content: strategySettingsContent,
    }),
    [strategySettingsContent]
  );

  // Handler for code changes
  const handleCodeChange = useCallback((value: string) => {
    setCode(value);
    setHasChanges(true);
  }, []);

  // Code tab definition (for code mode)
  const codeTab: TabDefinition = useMemo(
    () => ({
      id: 'code',
      label: 'Code',
      icon: <Code />,
      content: (
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <PythonCodeEditor value={code} onChange={handleCodeChange} height="100%" label="" />
        </Box>
      ),
    }),
    [code, handleCodeChange]
  );

  // Build panel groups based on builder mode and screen size
  const panelGroups: PanelGroupDefinition[] = useMemo(() => {
    if (builderMode === StrategyStrategyBuilderMode.Ui) {
      // UI Builder mode
      if (isMobile) {
        // Mobile: flatten all tabs into a single group (General first)
        return [
          {
            id: 'all',
            tabs: [generalSettingsTab, ...builderTabs],
          },
        ];
      }
      // Desktop: two panels - builder tabs + strategy settings
      return [
        {
          id: 'builder',
          title: 'Strategy Builder',
          tabs: builderTabs,
          panel: { defaultSize: 65, minSize: 40 },
        },
        {
          id: 'settings',
          title: 'Strategy Settings',
          tabs: [generalSettingsTab],
          panel: { defaultSize: 35, minSize: 25 },
        },
      ];
    } else {
      // Code mode
      if (isMobile) {
        // Mobile: General first, then code
        return [
          {
            id: 'all',
            tabs: [generalSettingsTab, codeTab],
          },
        ];
      }
      // Desktop: two panels - code editor + strategy settings
      return [
        {
          id: 'code',
          title: 'Strategy Code',
          tabs: [codeTab],
          panel: { defaultSize: 65, minSize: 40 },
        },
        {
          id: 'settings',
          title: 'Strategy Settings',
          tabs: [generalSettingsTab],
          panel: { defaultSize: 35, minSize: 25 },
        },
      ];
    }
  }, [builderMode, isMobile, builderTabs, generalSettingsTab, codeTab]);

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
              ? ([
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
                    tooltip: 'Create Strategy',
                    iconOnlyOnSmallScreen: true,
                  },
                  {
                    id: 'switch-mode',
                    label:
                      builderMode === StrategyStrategyBuilderMode.Ui
                        ? 'Switch to Code'
                        : 'Switch to Builder',
                    icon: builderMode === StrategyStrategyBuilderMode.Ui ? <Code /> : <Dashboard />,
                    onClick: () => {
                      if (builderMode === StrategyStrategyBuilderMode.Ui) {
                        setEjectDrawerOpen(true);
                      } else {
                        setBuilderMode(StrategyStrategyBuilderMode.Ui);
                        if (!uiBuilderConfig) {
                          setUiBuilderConfig(createDefaultUIBuilderConfig());
                        }
                        setHasChanges(true);
                      }
                    },
                    disabled:
                      builderMode === StrategyStrategyBuilderMode.Code &&
                      code !== DEFAULT_STRATEGY_CODE,
                    dividerBefore: true,
                  },
                  {
                    id: 'cancel',
                    label: 'Cancel',
                    icon: <Close />,
                    onClick: handleCancel,
                  },
                ] satisfies ToolbarAction[])
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
                    tooltip: 'Save',
                    iconOnlyOnSmallScreen: true,
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
                    id: 'rename',
                    label: 'Rename',
                    icon: <EditIcon />,
                    onClick: () => setRenameDrawerOpen(true),
                  },
                  {
                    id: 'switch-mode',
                    label:
                      builderMode === StrategyStrategyBuilderMode.Ui
                        ? 'Switch to Code'
                        : 'Switch to Builder',
                    icon: builderMode === StrategyStrategyBuilderMode.Ui ? <Code /> : <Dashboard />,
                    onClick: () => {
                      if (builderMode === StrategyStrategyBuilderMode.Ui) {
                        setEjectDrawerOpen(true);
                      } else if (code === DEFAULT_STRATEGY_CODE) {
                        setBuilderMode(StrategyStrategyBuilderMode.Ui);
                        if (!uiBuilderConfig) {
                          setUiBuilderConfig(createDefaultUIBuilderConfig());
                        }
                        setHasChanges(true);
                      }
                    },
                    disabled:
                      builderMode === StrategyStrategyBuilderMode.Code &&
                      code !== DEFAULT_STRATEGY_CODE,
                  },
                  {
                    id: 'cancel',
                    label: 'Cancel',
                    icon: <Close />,
                    onClick: handleCancel,
                  },
                ] satisfies ToolbarAction[])
          }
        />
      </Paper>

      {saveError && (
        <Alert severity="error" sx={{ mx: 2, mt: 2 }}>
          Error saving strategy: {saveError.message}
        </Alert>
      )}

      {/* Main Content - Responsive Panels */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <ResponsivePanelLayout groups={panelGroups} />
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
          width={600}
        >
          <VersionHistoryPanel
            strategyName={strategy.name}
            currentCode={code}
            currentVersionNumber={strategy.versionNumber}
            onCopyFromVersion={handleChange(setCode)}
          />
        </ContentDrawer>
      )}

      {/* Rename Strategy Drawer - only in edit mode */}
      {!isCreateMode && strategy && (
        <RenameStrategyDrawer
          open={renameDrawerOpen}
          onClose={() => setRenameDrawerOpen(false)}
          onSuccess={(newName, newDescription) => {
            // Update local state with new name/description
            setName(newName);
            setDescription(newDescription);
            // Also update config with strategy_name field (guard against null)
            setConfig((prev) => prev ? { ...prev, strategy_name: newName || undefined } : prev);
            // Update class name in code
            const className = toClassName(newName);
            setCode((prev) => {
              const updated = prev.replace(/class \w+\(IStrategy\):/, `class ${className}(IStrategy):`);
              // Mark as changed if code was actually modified
              if (updated !== prev) {
                setHasChanges(true);
              }
              return updated;
            });
          }}
          strategyId={strategy.id}
          currentName={name}
          currentDescription={description}
        />
      )}
    </Box>
  );
};

export default StrategyStudio;