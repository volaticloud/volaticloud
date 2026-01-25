import { useMemo, useCallback } from 'react';
import { Box, Typography, Divider } from '@mui/material';
import {
  ShowChart,
  TuneOutlined,
  SettingsApplications,
  Code,
  Login,
  Logout,
} from '@mui/icons-material';
import type { TabDefinition } from '../shared/ResponsivePanelLayout/types';
import {
  UIBuilderConfig,
  IndicatorDefinition,
  StrategyParameters,
  CallbacksConfig,
  SignalConfig,
  MirrorConfig,
  PositionMode,
  StrategySignalDirection,
  createDefaultUIBuilderConfig,
  createDefaultSignalConfig,
  normalizeUIBuilderConfig,
  applyMirrorConfig,
  shouldGenerateLongSignals,
  shouldGenerateShortSignals,
  getConditionCount,
} from './types';
import { IndicatorSelector } from './IndicatorSelector';
import { ParameterEditor } from './ParameterEditor';
import { StoplossBuilder } from './StoplossBuilder';
import { DCABuilder } from './DCABuilder';
import { EntryConfirmBuilder } from './EntryConfirmBuilder';
import { CodePreview } from './CodePreview';
import { PositionModeSelector } from './PositionModeSelector';
import { MirrorToggle } from './MirrorToggle';
import { SignalEditor } from './SignalEditor';

export interface UseBuilderTabsProps {
  /** Current UI Builder configuration */
  value: UIBuilderConfig | null;
  /** Callback when configuration changes */
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

/**
 * Hook that extracts tab definitions from StrategyBuilder.
 * Returns TabDefinition[] for use with ResponsivePanelLayout.
 */
export function useBuilderTabs({
  value,
  onChange,
  className = 'MyStrategy',
  timeframe = '5m',
  stakeCurrency = 'USDT',
  stakeAmount = 100,
}: UseBuilderTabsProps): TabDefinition[] {
  // Initialize with default config if null and normalize to v2 format
  const rawConfig = value || createDefaultUIBuilderConfig();
  const config = useMemo(() => normalizeUIBuilderConfig(rawConfig), [rawConfig]);

  // Apply mirror config to compute mirrored conditions for display
  const displayConfig = useMemo(() => applyMirrorConfig(config), [config]);

  // Determine which signals to show based on position mode
  const showLong = shouldGenerateLongSignals(config);
  const showShort = shouldGenerateShortSignals(config);

  // Check if short signals are mirrored
  const isMirrored =
    config.mirror_config?.enabled && config.position_mode === PositionMode.LongAndShort;
  const isShortMirrored = isMirrored && config.mirror_config?.source === StrategySignalDirection.Long;
  const isLongMirrored = isMirrored && config.mirror_config?.source === StrategySignalDirection.Short;

  // Handlers - wrapped in useCallback for stable references
  const handleIndicatorsChange = useCallback(
    (indicators: IndicatorDefinition[]) => {
      onChange({ ...config, indicators });
    },
    [config, onChange]
  );

  const handlePositionModeChange = useCallback(
    (positionMode: PositionMode) => {
      const newConfig = { ...config, position_mode: positionMode };

      // Initialize signal configs if needed
      if (
        (positionMode === PositionMode.LongOnly || positionMode === PositionMode.LongAndShort) &&
        !newConfig.long
      ) {
        newConfig.long = createDefaultSignalConfig();
      }
      if (
        (positionMode === PositionMode.ShortOnly || positionMode === PositionMode.LongAndShort) &&
        !newConfig.short
      ) {
        newConfig.short = createDefaultSignalConfig();
      }

      onChange(newConfig);
    },
    [config, onChange]
  );

  const handleLongSignalChange = useCallback(
    (longConfig: SignalConfig) => {
      onChange({ ...config, long: longConfig });
    },
    [config, onChange]
  );

  const handleShortSignalChange = useCallback(
    (shortConfig: SignalConfig) => {
      onChange({ ...config, short: shortConfig });
    },
    [config, onChange]
  );

  const handleMirrorConfigChange = useCallback(
    (mirrorConfig: MirrorConfig | undefined) => {
      onChange({ ...config, mirror_config: mirrorConfig });
    },
    [config, onChange]
  );

  const handleDisableMirror = useCallback(() => {
    onChange({
      ...config,
      mirror_config: config.mirror_config
        ? { ...config.mirror_config, enabled: false }
        : undefined,
    });
  }, [config, onChange]);

  const handleParametersChange = useCallback(
    (parameters: StrategyParameters) => {
      onChange({ ...config, parameters });
    },
    [config, onChange]
  );

  const handleCallbacksChange = useCallback(
    (callbacks: CallbacksConfig) => {
      onChange({ ...config, callbacks });
    },
    [config, onChange]
  );

  // Count conditions for each signal type
  const longEntryCount = showLong
    ? getConditionCount(isLongMirrored ? displayConfig.long?.entry_conditions : config.long?.entry_conditions)
    : 0;
  const longExitCount = showLong
    ? getConditionCount(isLongMirrored ? displayConfig.long?.exit_conditions : config.long?.exit_conditions)
    : 0;
  const shortEntryCount = showShort
    ? getConditionCount(isShortMirrored ? displayConfig.short?.entry_conditions : config.short?.entry_conditions)
    : 0;
  const shortExitCount = showShort
    ? getConditionCount(isShortMirrored ? displayConfig.short?.exit_conditions : config.short?.exit_conditions)
    : 0;

  // Count active callbacks
  const activeCallbacksCount = [
    config.callbacks.custom_stoploss?.enabled,
    config.callbacks.dca?.enabled,
    config.callbacks.confirm_entry?.enabled,
  ].filter(Boolean).length;

  // Build tabs array
  return useMemo<TabDefinition[]>(() => {
    const tabs: TabDefinition[] = [
      // Indicators Tab
      {
        id: 'indicators',
        label: 'Indicators',
        icon: <ShowChart />,
        badge: config.indicators.length > 0 ? config.indicators.length : undefined,
        badgeColor: 'primary',
        content: (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Technical Indicators
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add indicators to use in your entry and exit conditions.
            </Typography>
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <IndicatorSelector indicators={config.indicators} onChange={handleIndicatorsChange} />
            </Box>
          </Box>
        ),
      },
      // Logic Tab (position mode, mirror, parameters)
      {
        id: 'logic',
        label: 'Logic',
        icon: <TuneOutlined />,
        content: (
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Strategy Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Configure position mode and risk management settings.
            </Typography>

            <Box sx={{ mb: 3 }}>
              <PositionModeSelector
                value={config.position_mode || PositionMode.LongOnly}
                onChange={handlePositionModeChange}
              />
            </Box>

            <Divider sx={{ my: 3 }} />

            {config.position_mode === PositionMode.LongAndShort && (
              <Box sx={{ mb: 3 }}>
                <MirrorToggle value={config.mirror_config} onChange={handleMirrorConfigChange} />
              </Box>
            )}

            <Divider sx={{ my: 3 }} />

            <ParameterEditor value={config.parameters} onChange={handleParametersChange} />
          </Box>
        ),
      },
    ];

    // Long Entry Tab
    if (showLong) {
      tabs.push({
        id: 'long-entry',
        label: 'Long Entry',
        icon: <Login sx={{ color: '#4caf50' }} />,
        badge: longEntryCount > 0 ? longEntryCount : undefined,
        badgeColor: '#4caf50',
        content: (
          <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
            <SignalEditor
              direction={StrategySignalDirection.Long}
              signalType="entry"
              config={isLongMirrored ? displayConfig.long : config.long}
              onChange={handleLongSignalChange}
              indicators={config.indicators}
              isMirrored={isLongMirrored}
              onDisableMirror={isLongMirrored ? handleDisableMirror : undefined}
            />
          </Box>
        ),
      });

      // Long Exit Tab
      tabs.push({
        id: 'long-exit',
        label: 'Long Exit',
        icon: <Logout sx={{ color: '#4caf50' }} />,
        badge: longExitCount > 0 ? longExitCount : undefined,
        badgeColor: '#4caf50',
        content: (
          <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
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
          </Box>
        ),
      });
    }

    // Short Entry Tab
    if (showShort) {
      tabs.push({
        id: 'short-entry',
        label: 'Short Entry',
        icon: <Login sx={{ color: '#f44336' }} />,
        badge: shortEntryCount > 0 ? shortEntryCount : undefined,
        badgeColor: '#f44336',
        content: (
          <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
            <SignalEditor
              direction={StrategySignalDirection.Short}
              signalType="entry"
              config={isShortMirrored ? displayConfig.short : config.short}
              onChange={handleShortSignalChange}
              indicators={config.indicators}
              isMirrored={isShortMirrored}
              onDisableMirror={isShortMirrored ? handleDisableMirror : undefined}
            />
          </Box>
        ),
      });

      // Short Exit Tab
      tabs.push({
        id: 'short-exit',
        label: 'Short Exit',
        icon: <Logout sx={{ color: '#f44336' }} />,
        badge: shortExitCount > 0 ? shortExitCount : undefined,
        badgeColor: '#f44336',
        content: (
          <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
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
          </Box>
        ),
      });
    }

    // Advanced Tab
    tabs.push({
      id: 'advanced',
      label: 'Advanced',
      icon: <SettingsApplications />,
      badge: activeCallbacksCount > 0 ? activeCallbacksCount : undefined,
      badgeColor: 'info',
      content: (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Advanced Features
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure advanced strategy callbacks including custom stoploss, DCA, and entry
            confirmation filters.
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
              onChange={(dca) => handleCallbacksChange({ ...config.callbacks, dca })}
            />

            <EntryConfirmBuilder
              value={config.callbacks.confirm_entry}
              onChange={(confirm_entry) =>
                handleCallbacksChange({ ...config.callbacks, confirm_entry })
              }
              indicators={config.indicators}
            />
          </Box>
        </Box>
      ),
    });

    // Preview Tab
    tabs.push({
      id: 'preview',
      label: 'Preview',
      icon: <Code />,
      content: (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', p: 2 }}>
          <CodePreview
            config={config}
            className={className}
            timeframe={timeframe}
            stakeCurrency={stakeCurrency}
            stakeAmount={stakeAmount}
          />
        </Box>
      ),
    });

    return tabs;
  }, [
    config,
    displayConfig,
    showLong,
    showShort,
    isLongMirrored,
    isShortMirrored,
    longEntryCount,
    longExitCount,
    shortEntryCount,
    shortExitCount,
    activeCallbacksCount,
    className,
    timeframe,
    stakeCurrency,
    stakeAmount,
    handleIndicatorsChange,
    handlePositionModeChange,
    handleMirrorConfigChange,
    handleParametersChange,
    handleLongSignalChange,
    handleShortSignalChange,
    handleDisableMirror,
    handleCallbacksChange,
  ]);
}

export default useBuilderTabs;
