import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Chip,
  Divider,
} from '@mui/material';
import {
  ShowChart,
  TuneOutlined,
  Settings,
  Code,
  TrendingUp,
  TrendingDown,
} from '@mui/icons-material';
import {
  UIBuilderConfig,
  IndicatorDefinition,
  StrategyParameters,
  CallbacksConfig,
  SignalConfig,
  MirrorConfig,
  PositionMode,
  TradingMode,
  StrategySignalDirection,
  createDefaultUIBuilderConfig,
  createDefaultSignalConfig,
  normalizeUIBuilderConfig,
  applyMirrorConfig,
  shouldGenerateLongSignals,
  shouldGenerateShortSignals,
  isLeverageAvailable,
  isShortingAvailable,
  getConditionCount,
} from './types';
import { IndicatorSelector } from './IndicatorSelector';
import { ParameterEditor } from './ParameterEditor';
import { StoplossBuilder } from './StoplossBuilder';
import { DCABuilder } from './DCABuilder';
import { EntryConfirmBuilder } from './EntryConfirmBuilder';
import { LeverageBuilder } from './LeverageBuilder';
import { CodePreview } from './CodePreview';
import { PositionModeSelector } from './PositionModeSelector';
import { TradingModeSelector } from './TradingModeSelector';
import { MirrorToggle } from './MirrorToggle';
import { SignalEditor } from './SignalEditor';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      sx={{
        flex: 1,
        overflow: 'hidden',
        p: 2,
        display: value === index ? 'flex' : 'none',
        flexDirection: 'column',
        minHeight: 0, // Important for nested flex containers to allow shrinking
      }}
    >
      {children}
    </Box>
  );
}

interface StrategyBuilderProps {
  value: UIBuilderConfig | null;
  onChange: (config: UIBuilderConfig) => void;
  /** Strategy class name for code preview */
  className?: string;
  /** Timeframe for code preview (e.g., '5m', '1h') */
  timeframe?: string;
  /** Stake currency for code preview (e.g., 'USDT') */
  stakeCurrency?: string;
  /** Stake amount for code preview */
  stakeAmount?: number;
}

export function StrategyBuilder({
  value,
  onChange,
  className = 'MyStrategy',
  timeframe = '5m',
  stakeCurrency = 'USDT',
  stakeAmount = 100,
}: StrategyBuilderProps) {
  const [activeTab, setActiveTab] = useState(0);

  // Initialize with default config if null and normalize to v2 format
  const rawConfig = value || createDefaultUIBuilderConfig();
  const config = useMemo(() => normalizeUIBuilderConfig(rawConfig), [rawConfig]);

  // Apply mirror config to compute mirrored conditions for display
  // This is separate from config (source of truth) to show computed mirrored values
  const displayConfig = useMemo(() => applyMirrorConfig(config), [config]);

  // Determine which signals to show based on position mode
  const showLong = shouldGenerateLongSignals(config);
  const showShort = shouldGenerateShortSignals(config);

  // Check trading mode capabilities
  const canShort = isShortingAvailable(config);
  const leverageAvailable = isLeverageAvailable(config);

  // Check if short signals are mirrored
  const isMirrored = config.mirror_config?.enabled &&
    config.position_mode === PositionMode.LongAndShort;
  const isShortMirrored = isMirrored && config.mirror_config?.source === StrategySignalDirection.Long;
  const isLongMirrored = isMirrored && config.mirror_config?.source === StrategySignalDirection.Short;

  const handleIndicatorsChange = (indicators: IndicatorDefinition[]) => {
    onChange({ ...config, indicators });
  };

  const handleTradingModeChange = (tradingMode: TradingMode) => {
    const newConfig = { ...config, trading_mode: tradingMode };

    // If switching to Spot mode, reset position mode to LongOnly (no shorting in spot)
    if (tradingMode === TradingMode.Spot) {
      if (newConfig.position_mode === PositionMode.ShortOnly || newConfig.position_mode === PositionMode.LongAndShort) {
        newConfig.position_mode = PositionMode.LongOnly;
        // Disable mirror config since it requires both long and short
        if (newConfig.mirror_config?.enabled) {
          newConfig.mirror_config = { ...newConfig.mirror_config, enabled: false };
        }
      }
      // Disable leverage in spot mode
      if (newConfig.callbacks.leverage?.enabled) {
        newConfig.callbacks = {
          ...newConfig.callbacks,
          leverage: { ...newConfig.callbacks.leverage, enabled: false },
        };
      }
    }

    onChange(newConfig);
  };

  const handlePositionModeChange = (positionMode: PositionMode) => {
    const newConfig = { ...config, position_mode: positionMode };

    // Initialize signal configs if needed
    if ((positionMode === PositionMode.LongOnly || positionMode === PositionMode.LongAndShort) && !newConfig.long) {
      newConfig.long = createDefaultSignalConfig();
    }
    if ((positionMode === PositionMode.ShortOnly || positionMode === PositionMode.LongAndShort) && !newConfig.short) {
      newConfig.short = createDefaultSignalConfig();
    }

    onChange(newConfig);
  };

  const handleLongSignalChange = (longConfig: SignalConfig) => {
    onChange({ ...config, long: longConfig });
  };

  const handleShortSignalChange = (shortConfig: SignalConfig) => {
    onChange({ ...config, short: shortConfig });
  };

  const handleMirrorConfigChange = (mirrorConfig: MirrorConfig | undefined) => {
    onChange({ ...config, mirror_config: mirrorConfig });
  };

  const handleDisableMirror = () => {
    // Disable mirroring - this keeps the current mirrored conditions but allows manual editing
    onChange({
      ...config,
      mirror_config: config.mirror_config
        ? { ...config.mirror_config, enabled: false }
        : undefined,
    });
  };

  const handleParametersChange = (parameters: StrategyParameters) => {
    onChange({ ...config, parameters });
  };

  const handleCallbacksChange = (callbacks: CallbacksConfig) => {
    onChange({ ...config, callbacks });
  };

  // Count conditions for each signal type (use displayConfig for mirrored signals)
  const longEntryCount = showLong ? getConditionCount(
    isLongMirrored ? displayConfig.long?.entry_conditions : config.long?.entry_conditions
  ) : 0;
  const longExitCount = showLong ? getConditionCount(
    isLongMirrored ? displayConfig.long?.exit_conditions : config.long?.exit_conditions
  ) : 0;
  const shortEntryCount = showShort ? getConditionCount(
    isShortMirrored ? displayConfig.short?.entry_conditions : config.short?.entry_conditions
  ) : 0;
  const shortExitCount = showShort ? getConditionCount(
    isShortMirrored ? displayConfig.short?.exit_conditions : config.short?.exit_conditions
  ) : 0;

  // Count active callbacks
  const activeCallbacksCount = [
    config.callbacks.custom_stoploss?.enabled,
    config.callbacks.dca?.enabled,
    config.callbacks.confirm_entry?.enabled,
    config.callbacks.leverage?.enabled,
  ].filter(Boolean).length;

  // Build dynamic tabs based on position mode
  type TabConfig = {
    id: string;
    icon: React.ReactElement;
    label: string;
    badge?: number;
    badgeColor?: string;
  };

  const tabs = useMemo<TabConfig[]>(() => {
    const result: TabConfig[] = [
      {
        id: 'indicators',
        icon: <ShowChart />,
        label: 'Indicators',
        badge: config.indicators.length > 0 ? config.indicators.length : undefined,
        badgeColor: 'primary',
      },
      {
        id: 'settings',
        icon: <TuneOutlined />,
        label: 'Settings',
      },
    ];

    // Add signal tabs based on position mode
    if (showLong) {
      result.push({
        id: 'long-entry',
        icon: <TrendingUp sx={{ color: '#4caf50' }} />,
        label: 'Long Entry',
        badge: longEntryCount > 0 ? longEntryCount : undefined,
        badgeColor: '#4caf50',
      });
      // Long Exit tab only if use_exit_signal is enabled
      if (config.parameters.use_exit_signal) {
        result.push({
          id: 'long-exit',
          icon: <TrendingUp sx={{ color: '#4caf50' }} />,
          label: 'Long Exit',
          badge: longExitCount > 0 ? longExitCount : undefined,
          badgeColor: '#4caf50',
        });
      }
    }

    if (showShort) {
      result.push({
        id: 'short-entry',
        icon: <TrendingDown sx={{ color: '#f44336' }} />,
        label: 'Short Entry',
        badge: shortEntryCount > 0 ? shortEntryCount : undefined,
        badgeColor: '#f44336',
      });
      // Short Exit tab only if use_exit_signal is enabled
      if (config.parameters.use_exit_signal) {
        result.push({
          id: 'short-exit',
          icon: <TrendingDown sx={{ color: '#f44336' }} />,
          label: 'Short Exit',
          badge: shortExitCount > 0 ? shortExitCount : undefined,
          badgeColor: '#f44336',
        });
      }
    }

    // Add advanced and preview tabs
    result.push({
      id: 'advanced',
      icon: <Settings />,
      label: 'Advanced',
      badge: activeCallbacksCount > 0 ? activeCallbacksCount : undefined,
      badgeColor: 'info',
    });
    result.push({
      id: 'preview',
      icon: <Code />,
      label: 'Preview',
    });

    return result;
  }, [showLong, showShort, config.indicators.length, longEntryCount, longExitCount, shortEntryCount, shortExitCount, activeCallbacksCount]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <Paper square elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              icon={tab.icon}
              data-testid={`tab-${tab.id}`}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {tab.label}
                  {tab.badge !== undefined && (
                    <Chip
                      label={tab.badge}
                      size="small"
                      sx={{
                        backgroundColor: tab.badgeColor === 'primary' || tab.badgeColor === 'info'
                          ? undefined
                          : `${tab.badgeColor}20`,
                        color: tab.badgeColor === 'primary' || tab.badgeColor === 'info'
                          ? undefined
                          : tab.badgeColor,
                      }}
                      color={tab.badgeColor === 'primary' ? 'primary' : tab.badgeColor === 'info' ? 'info' : undefined}
                    />
                  )}
                </Box>
              }
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Paper>

      {/* Indicators Tab */}
      <TabPanel value={activeTab} index={tabs.findIndex(t => t.id === 'indicators')}>
        <Typography variant="subtitle2" gutterBottom>
          Technical Indicators
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Add indicators to use in your entry and exit conditions. Each indicator can be
          referenced multiple times with different parameters.
        </Typography>

        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <IndicatorSelector
            indicators={config.indicators}
            onChange={handleIndicatorsChange}
          />
        </Box>
      </TabPanel>

      {/* Settings Tab (Trading Mode + Position Mode + Parameters) */}
      <TabPanel value={activeTab} index={tabs.findIndex(t => t.id === 'settings')}>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Typography variant="subtitle2" gutterBottom>
            Strategy Settings
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure trading mode, position mode, and risk management settings.
          </Typography>

          {/* Trading Mode Selector */}
          <Box sx={{ mb: 3 }}>
            <TradingModeSelector
              value={config.trading_mode || TradingMode.Spot}
              onChange={handleTradingModeChange}
            />
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Position Mode Selector */}
          <Box sx={{ mb: 3 }}>
            <PositionModeSelector
              value={config.position_mode || PositionMode.LongOnly}
              onChange={handlePositionModeChange}
              allowShort={canShort}
            />
          </Box>

          {/* Mirror Toggle (only for Long & Short mode) */}
          {config.position_mode === PositionMode.LongAndShort && canShort && (
            <>
              <Divider sx={{ my: 3 }} />
              <Box sx={{ mb: 3 }}>
                <MirrorToggle
                  value={config.mirror_config}
                  onChange={handleMirrorConfigChange}
                />
              </Box>
            </>
          )}

          <Divider sx={{ my: 3 }} />

          {/* Parameters */}
          <ParameterEditor
            value={config.parameters}
            onChange={handleParametersChange}
          />
        </Box>
      </TabPanel>

      {/* Long Entry Tab */}
      {showLong && (
        <TabPanel value={activeTab} index={tabs.findIndex(t => t.id === 'long-entry')}>
          <SignalEditor
            direction={StrategySignalDirection.Long}
            signalType="entry"
            config={isLongMirrored ? displayConfig.long : config.long}
            onChange={handleLongSignalChange}
            indicators={config.indicators}
            isMirrored={isLongMirrored}
            onDisableMirror={isLongMirrored ? handleDisableMirror : undefined}
          />
        </TabPanel>
      )}

      {/* Long Exit Tab */}
      {showLong && config.parameters.use_exit_signal && (
        <TabPanel value={activeTab} index={tabs.findIndex(t => t.id === 'long-exit')}>
          <SignalEditor
            direction={StrategySignalDirection.Long}
            signalType="exit"
            config={isLongMirrored ? displayConfig.long : config.long}
            onChange={handleLongSignalChange}
            indicators={config.indicators}
            useExitSignal={config.parameters.use_exit_signal}
            isMirrored={isLongMirrored}
            onDisableMirror={isLongMirrored ? handleDisableMirror : undefined}
          />
        </TabPanel>
      )}

      {/* Short Entry Tab */}
      {showShort && (
        <TabPanel value={activeTab} index={tabs.findIndex(t => t.id === 'short-entry')}>
          <SignalEditor
            direction={StrategySignalDirection.Short}
            signalType="entry"
            config={isShortMirrored ? displayConfig.short : config.short}
            onChange={handleShortSignalChange}
            indicators={config.indicators}
            isMirrored={isShortMirrored}
            onDisableMirror={isShortMirrored ? handleDisableMirror : undefined}
          />
        </TabPanel>
      )}

      {/* Short Exit Tab */}
      {showShort && config.parameters.use_exit_signal && (
        <TabPanel value={activeTab} index={tabs.findIndex(t => t.id === 'short-exit')}>
          <SignalEditor
            direction={StrategySignalDirection.Short}
            signalType="exit"
            config={isShortMirrored ? displayConfig.short : config.short}
            onChange={handleShortSignalChange}
            indicators={config.indicators}
            useExitSignal={config.parameters.use_exit_signal}
            isMirrored={isShortMirrored}
            onDisableMirror={isShortMirrored ? handleDisableMirror : undefined}
          />
        </TabPanel>
      )}

      {/* Advanced/Callbacks Tab */}
      <TabPanel value={activeTab} index={tabs.findIndex(t => t.id === 'advanced')}>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Typography variant="subtitle2" gutterBottom>
            Advanced Features
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure advanced strategy callbacks including custom stoploss, DCA,
            and entry confirmation filters.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <StoplossBuilder
              value={config.callbacks.custom_stoploss}
              onChange={(custom_stoploss) =>
                handleCallbacksChange({ ...config.callbacks, custom_stoploss })
              }
              indicators={config.indicators}
            />

            <DCABuilder
              value={config.callbacks.dca}
              onChange={(dca) =>
                handleCallbacksChange({ ...config.callbacks, dca })
              }
            />

            <EntryConfirmBuilder
              value={config.callbacks.confirm_entry}
              onChange={(confirm_entry) =>
                handleCallbacksChange({ ...config.callbacks, confirm_entry })
              }
              indicators={config.indicators}
            />

            {leverageAvailable && (
              <LeverageBuilder
                value={config.callbacks.leverage}
                onChange={(leverage) =>
                  handleCallbacksChange({ ...config.callbacks, leverage })
                }
                indicators={config.indicators}
              />
            )}
            {!leverageAvailable && (
              <Box sx={{ p: 2, bgcolor: 'action.disabledBackground', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Leverage configuration is only available in Margin or Futures trading mode.
                  Change the trading mode in the Settings tab to enable leverage.
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </TabPanel>

      {/* Code Preview Tab */}
      <TabPanel value={activeTab} index={tabs.findIndex(t => t.id === 'preview')}>
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <CodePreview
            config={config}
            className={className}
            timeframe={timeframe}
            stakeCurrency={stakeCurrency}
            stakeAmount={stakeAmount}
          />
        </Box>
      </TabPanel>
    </Box>
  );
}

export default StrategyBuilder;
