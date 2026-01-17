import { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Alert,
  Chip,
} from '@mui/material';
import {
  ShowChart,
  Login,
  Logout,
  TuneOutlined,
  Settings,
  Code,
} from '@mui/icons-material';
import {
  UIBuilderConfig,
  ConditionNode,
  IndicatorDefinition,
  StrategyParameters,
  CallbacksConfig,
  createDefaultUIBuilderConfig,
} from './types';
import { IndicatorSelector } from './IndicatorSelector';
import { ConditionNodeEditor } from './ConditionNode';
import { ParameterEditor } from './ParameterEditor';
import { StoplossBuilder } from './StoplossBuilder';
import { DCABuilder } from './DCABuilder';
import { EntryConfirmBuilder } from './EntryConfirmBuilder';
import { CodePreview } from './CodePreview';

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

  // Initialize with default config if null
  const config = value || createDefaultUIBuilderConfig();

  const handleIndicatorsChange = (indicators: IndicatorDefinition[]) => {
    onChange({ ...config, indicators });
  };

  const handleEntryConditionsChange = (entryConditions: ConditionNode) => {
    onChange({ ...config, entry_conditions: entryConditions });
  };

  const handleExitConditionsChange = (exitConditions: ConditionNode) => {
    onChange({ ...config, exit_conditions: exitConditions });
  };

  const handleParametersChange = (parameters: StrategyParameters) => {
    onChange({ ...config, parameters });
  };

  const handleCallbacksChange = (callbacks: CallbacksConfig) => {
    onChange({ ...config, callbacks });
  };

  const getConditionCount = (node: ConditionNode): number => {
    if (node.type === 'AND' || node.type === 'OR') {
      return (node as { children: ConditionNode[] }).children.reduce(
        (acc, child) => acc + getConditionCount(child),
        0
      );
    }
    return 1;
  };

  const entryCount = getConditionCount(config.entry_conditions);
  const exitCount = getConditionCount(config.exit_conditions);

  // Count active callbacks
  const activeCallbacksCount = [
    config.callbacks.custom_stoploss?.enabled,
    config.callbacks.dca?.enabled,
    config.callbacks.confirm_entry?.enabled,
  ].filter(Boolean).length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <Paper square elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="fullWidth"
        >
          <Tab
            icon={<ShowChart />}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Indicators
                {config.indicators.length > 0 && (
                  <Chip label={config.indicators.length} size="small" color="primary" />
                )}
              </Box>
            }
            iconPosition="start"
          />
          <Tab
            icon={<Login />}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Entry
                {entryCount > 0 && (
                  <Chip label={entryCount} size="small" color="success" />
                )}
              </Box>
            }
            iconPosition="start"
          />
          <Tab
            icon={<Logout />}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Exit
                {exitCount > 0 && (
                  <Chip label={exitCount} size="small" color="error" />
                )}
              </Box>
            }
            iconPosition="start"
          />
          <Tab
            icon={<TuneOutlined />}
            label="Parameters"
            iconPosition="start"
          />
          <Tab
            icon={<Settings />}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Advanced
                {activeCallbacksCount > 0 && (
                  <Chip label={activeCallbacksCount} size="small" color="info" />
                )}
              </Box>
            }
            iconPosition="start"
          />
          <Tab
            icon={<Code />}
            label="Preview"
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Indicators Tab */}
      <TabPanel value={activeTab} index={0}>
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

      {/* Entry Conditions Tab */}
      <TabPanel value={activeTab} index={1}>
        <Typography variant="subtitle2" gutterBottom>
          Entry Conditions
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Define when to open a new trade. All conditions in an AND group must be true.
          Any condition in an OR group can be true.
        </Typography>

        {config.indicators.length === 0 ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Add indicators first to create conditions based on technical analysis.
          </Alert>
        ) : null}

        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <ConditionNodeEditor
            node={config.entry_conditions}
            onChange={handleEntryConditionsChange}
            indicators={config.indicators}
          />
        </Box>
      </TabPanel>

      {/* Exit Conditions Tab */}
      <TabPanel value={activeTab} index={2}>
        <Typography variant="subtitle2" gutterBottom>
          Exit Conditions
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Define when to close an open trade. Exit conditions work together with
          stoploss and ROI settings.
        </Typography>

        {!config.parameters.use_exit_signal && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Exit signal is disabled in parameters. These conditions won't trigger exits.
          </Alert>
        )}

        {config.indicators.length === 0 ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Add indicators first to create exit conditions.
          </Alert>
        ) : null}

        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <ConditionNodeEditor
            node={config.exit_conditions}
            onChange={handleExitConditionsChange}
            indicators={config.indicators}
          />
        </Box>
      </TabPanel>

      {/* Parameters Tab */}
      <TabPanel value={activeTab} index={3}>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Typography variant="subtitle2" gutterBottom>
            Strategy Parameters
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure risk management settings including stoploss, take profit targets,
            and trailing stop behavior.
          </Typography>

          <ParameterEditor
            value={config.parameters}
            onChange={handleParametersChange}
          />
        </Box>
      </TabPanel>

      {/* Advanced/Callbacks Tab */}
      <TabPanel value={activeTab} index={4}>
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
          </Box>
        </Box>
      </TabPanel>

      {/* Code Preview Tab */}
      <TabPanel value={activeTab} index={5}>
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
