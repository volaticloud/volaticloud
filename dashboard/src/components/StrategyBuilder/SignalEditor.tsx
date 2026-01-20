import { Box, Typography, Alert, Chip, Button } from '@mui/material';
import { TrendingUp, TrendingDown, Login, Logout, LinkOff } from '@mui/icons-material';
import { ConditionNode, IndicatorDefinition, StrategySignalDirection, SignalConfig, createDefaultSignalConfig } from './types';
import { ConditionNodeEditor } from './ConditionNode';

interface SignalEditorProps {
  direction: StrategySignalDirection;
  signalType: 'entry' | 'exit';
  config: SignalConfig | undefined;
  onChange: (config: SignalConfig) => void;
  indicators: IndicatorDefinition[];
  useExitSignal?: boolean;
  isMirrored?: boolean;
  /** Called when user wants to convert mirrored signal to manual editing */
  onDisableMirror?: () => void;
}

const DIRECTION_COLORS: Record<StrategySignalDirection, string> = {
  [StrategySignalDirection.Long]: '#4caf50',
  [StrategySignalDirection.Short]: '#f44336',
};

const DIRECTION_LABELS: Record<StrategySignalDirection, string> = {
  [StrategySignalDirection.Long]: 'Long',
  [StrategySignalDirection.Short]: 'Short',
};

export function SignalEditor({
  direction,
  signalType,
  config,
  onChange,
  indicators,
  useExitSignal = true,
  isMirrored = false,
  onDisableMirror,
}: SignalEditorProps) {
  const signalConfig = config || createDefaultSignalConfig();
  const color = DIRECTION_COLORS[direction];
  const directionLabel = DIRECTION_LABELS[direction];
  const isEntry = signalType === 'entry';

  const handleConditionsChange = (conditions: ConditionNode) => {
    if (isEntry) {
      onChange({
        ...signalConfig,
        entry_conditions: conditions,
      });
    } else {
      onChange({
        ...signalConfig,
        exit_conditions: conditions,
      });
    }
  };

  const currentConditions = isEntry
    ? signalConfig.entry_conditions
    : signalConfig.exit_conditions;

  // Count conditions
  const getConditionCount = (node: ConditionNode): number => {
    if (node.type === 'AND' || node.type === 'OR') {
      return (node as { children: ConditionNode[] }).children.reduce(
        (acc, child) => acc + getConditionCount(child),
        0
      );
    }
    return 1;
  };

  const conditionCount = getConditionCount(currentConditions);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 2,
          pb: 1,
          borderBottom: 2,
          borderColor: color,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: color,
          }}
        >
          {direction === StrategySignalDirection.Long ? (
            <TrendingUp />
          ) : (
            <TrendingDown />
          )}
          <Typography variant="subtitle1" fontWeight="bold">
            {directionLabel}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isEntry ? <Login fontSize="small" /> : <Logout fontSize="small" />}
          <Typography variant="subtitle2">
            {isEntry ? 'Entry' : 'Exit'} Conditions
          </Typography>
          {conditionCount > 0 && (
            <Chip
              label={conditionCount}
              size="small"
              sx={{
                backgroundColor: `${color}20`,
                color: color,
              }}
            />
          )}
        </Box>

        {isMirrored && (
          <Chip
            label="Mirrored"
            size="small"
            variant="outlined"
            sx={{ ml: 'auto' }}
          />
        )}
      </Box>

      {/* Description */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {isEntry
          ? `Define when to open a ${directionLabel.toLowerCase()} position. All conditions in an AND group must be true.`
          : `Define when to close a ${directionLabel.toLowerCase()} position. Exit conditions work with stoploss and ROI settings.`}
      </Typography>

      {/* Warnings */}
      {!isEntry && !useExitSignal && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Exit signal is disabled in parameters. These conditions won't trigger exits.
        </Alert>
      )}

      {indicators.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Add indicators first to create conditions based on technical analysis.
        </Alert>
      )}

      {isMirrored && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            onDisableMirror && (
              <Button
                color="inherit"
                size="small"
                startIcon={<LinkOff />}
                onClick={onDisableMirror}
              >
                Convert to manual
              </Button>
            )
          }
        >
          <Typography variant="body2">
            <strong>Auto-mirrored from {direction === StrategySignalDirection.Short ? 'Long' : 'Short'} signals.</strong>
            {' '}Comparisons and crossovers are automatically inverted. To edit independently, convert to manual.
          </Typography>
        </Alert>
      )}

      {/* Condition Editor */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <ConditionNodeEditor
          node={currentConditions}
          onChange={handleConditionsChange}
          indicators={indicators}
          readOnly={isMirrored}
        />
      </Box>
    </Box>
  );
}

export default SignalEditor;
