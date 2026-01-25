import {
  Box,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Divider,
  Alert,
} from '@mui/material';
// Note: Slider removed - using PercentageSlider component instead
import { Add, Delete, TrendingDown } from '@mui/icons-material';
import {
  CustomStoplossConfig,
  StoplossRule,
  TrailingConfig,
  IndicatorDefinition,
  createId,
  createCompareNode,
  createConstantOperand,
  OperandType,
  ComparisonOperator,
} from './types';
import { ConditionNodeEditor } from './ConditionNode';
import { ToggleableSection, PercentageSlider } from './shared';
import { DEFAULT_STOPLOSS_CONFIG } from './constants';

/** Default trailing config values for consistent initialization */
const DEFAULT_TRAILING: TrailingConfig = {
  enabled: false,
  positive: 0.01,
  positive_offset: 0.02,
};

/** Get or create trailing config with consistent defaults */
function getOrCreateTrailing(existing?: TrailingConfig): TrailingConfig {
  return existing ?? { ...DEFAULT_TRAILING };
}

interface StoplossBuilderProps {
  value: CustomStoplossConfig | undefined;
  onChange: (config: CustomStoplossConfig | undefined) => void;
  indicators: IndicatorDefinition[];
}

export function StoplossBuilder({ value, onChange, indicators }: StoplossBuilderProps) {
  const config = value || DEFAULT_STOPLOSS_CONFIG;

  const handleToggleEnabled = (enabled: boolean) => {
    onChange({
      ...config,
      enabled,
    });
  };

  const handleDefaultStoplossChange = (stoploss: number) => {
    onChange({
      ...config,
      default_stoploss: stoploss,
    });
  };

  const handleAddRule = () => {
    // Create a rule that triggers at profit > 5% with -1% stoploss
    const newRule: StoplossRule = {
      id: createId(),
      condition: createCompareNode(
        { type: OperandType.TradeContext, field: 'current_profit' },
        ComparisonOperator.Gt,
        createConstantOperand(0.05)
      ),
      stoploss: -0.01,
    };

    onChange({
      ...config,
      rules: [...config.rules, newRule],
    });
  };

  const handleRuleChange = (index: number, updatedRule: StoplossRule) => {
    const newRules = [...config.rules];
    newRules[index] = updatedRule;
    onChange({
      ...config,
      rules: newRules,
    });
  };

  const handleDeleteRule = (index: number) => {
    onChange({
      ...config,
      rules: config.rules.filter((_, i) => i !== index),
    });
  };

  const handleTrailingToggle = (enabled: boolean) => {
    onChange({
      ...config,
      trailing: { ...getOrCreateTrailing(config.trailing), enabled },
    });
  };

  const handleTrailingPositiveChange = (positive: number) => {
    onChange({
      ...config,
      trailing: { ...getOrCreateTrailing(config.trailing), positive },
    });
  };

  const handleTrailingOffsetChange = (positive_offset: number) => {
    onChange({
      ...config,
      trailing: { ...getOrCreateTrailing(config.trailing), positive_offset },
    });
  };

  return (
    <ToggleableSection
      title="Custom Stoploss"
      tooltip="Dynamic stoploss that adjusts based on profit levels"
      icon={<TrendingDown color={config.enabled ? 'error' : 'disabled'} />}
      enabled={config.enabled}
      onToggle={handleToggleEnabled}
      disabledContent={
        <Typography variant="body2" color="text.secondary">
          Enable to configure dynamic stoploss that adjusts based on profit levels.
        </Typography>
      }
    >
      {/* Default Stoploss */}
      <Box>
        <Typography variant="caption" color="text.secondary" gutterBottom>
          Default Stoploss (fallback)
        </Typography>
        <Box sx={{ mt: 1 }}>
          <PercentageSlider
            value={config.default_stoploss}
            onChange={handleDefaultStoplossChange}
            showNegative
            min={1}
            max={50}
            step={0.5}
          />
        </Box>
      </Box>

      <Divider />

      {/* Profit-Based Stoploss Rules */}
      <Box>
        <Typography variant="caption" color="text.secondary" gutterBottom>
          Profit-Based Stoploss Rules
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Define dynamic stoploss levels based on current profit. Rules are evaluated in order.
        </Typography>

        {config.rules.length === 0 && (
          <Alert severity="info" sx={{ mb: 1 }}>
            No rules defined. Add rules to enable dynamic stoploss adjustment.
          </Alert>
        )}

        {config.rules.map((rule, index) => (
          <Paper
            key={rule.id}
            variant="outlined"
            sx={{ p: 1.5, mb: 1, bgcolor: 'background.default' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="body2" fontWeight={500}>
                Rule {index + 1}
              </Typography>
              <Box sx={{ flex: 1 }} />
              <IconButton size="small" onClick={() => handleDeleteRule(index)} color="error">
                <Delete fontSize="small" />
              </IconButton>
            </Box>

            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                When condition is true:
              </Typography>
              <ConditionNodeEditor
                node={rule.condition}
                onChange={(condition) => handleRuleChange(index, { ...rule, condition })}
                indicators={indicators}
                showTradeContext
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Set stoploss to:
              </Typography>
              <TextField
                type="number"
                value={(rule.stoploss * 100).toFixed(1)}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value)) {
                    handleRuleChange(index, { ...rule, stoploss: value / 100 });
                  }
                }}
                size="small"
                sx={{ width: 100 }}
                slotProps={{
                  input: {
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  },
                  htmlInput: { step: 0.5 },
                }}
              />
            </Box>
          </Paper>
        ))}

        <Button size="small" startIcon={<Add />} onClick={handleAddRule} variant="outlined">
          Add Rule
        </Button>
      </Box>

      <Divider />

      {/* Trailing Stop Integration */}
      <Box>
        <FormControlLabel
          control={
            <Switch
              checked={config.trailing?.enabled || false}
              onChange={(e) => handleTrailingToggle(e.target.checked)}
              size="small"
            />
          }
          label={
            <Typography variant="body2">Enable trailing stop within custom stoploss</Typography>
          }
        />

        {config.trailing?.enabled && (
          <Box sx={{ mt: 1, ml: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Trailing Stop Positive (lock in profit at)
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <PercentageSlider
                  value={config.trailing.positive || 0.01}
                  onChange={handleTrailingPositiveChange}
                  min={0.1}
                  max={10}
                  step={0.1}
                />
              </Box>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Trailing Stop Offset (activate when profit exceeds)
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <PercentageSlider
                  value={config.trailing.positive_offset || 0.02}
                  onChange={handleTrailingOffsetChange}
                  min={0.1}
                  max={10}
                  step={0.1}
                />
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </ToggleableSection>
  );
}
