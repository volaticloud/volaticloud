import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  Button,
  IconButton,
  TextField,
  Slider,
  Tooltip,
  InputAdornment,
  Divider,
  Collapse,
  Alert,
} from '@mui/material';
import {
  Add,
  Delete,
  Info,
  TrendingDown,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import {
  CustomStoplossConfig,
  StoplossRule,
  IndicatorDefinition,
  createId,
  createCompareNode,
  createConstantOperand,
} from './types';
import { ConditionNodeEditor } from './ConditionNode';

interface StoplossBuilderProps {
  value: CustomStoplossConfig | undefined;
  onChange: (config: CustomStoplossConfig | undefined) => void;
  indicators: IndicatorDefinition[];
}

const DEFAULT_STOPLOSS_CONFIG: CustomStoplossConfig = {
  enabled: false,
  rules: [],
  default_stoploss: -0.10,
  trailing: {
    enabled: false,
    positive: 0.01,
    positive_offset: 0.02,
  },
};

export function StoplossBuilder({ value, onChange, indicators }: StoplossBuilderProps) {
  const [expanded, setExpanded] = useState(true);

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
        { type: 'TRADE_CONTEXT', field: 'current_profit' },
        'gt',
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
      trailing: {
        ...(config.trailing || { positive: 0.01, positive_offset: 0.02 }),
        enabled,
      },
    });
  };

  const handleTrailingPositiveChange = (positive: number) => {
    onChange({
      ...config,
      trailing: {
        ...(config.trailing || { enabled: false, positive_offset: 0.02 }),
        positive,
      },
    });
  };

  const handleTrailingOffsetChange = (positive_offset: number) => {
    onChange({
      ...config,
      trailing: {
        ...(config.trailing || { enabled: false, positive: 0.01 }),
        positive_offset,
      },
    });
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
        <TrendingDown color={config.enabled ? 'error' : 'disabled'} />
        <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
          Custom Stoploss
        </Typography>
        <Tooltip title="Dynamic stoploss that adjusts based on profit levels">
          <Info fontSize="small" color="action" />
        </Tooltip>
        <Switch
          checked={config.enabled}
          onChange={(e) => handleToggleEnabled(e.target.checked)}
          size="small"
        />
      </Box>

      <Collapse in={expanded && config.enabled}>
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Default Stoploss */}
          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Default Stoploss (fallback)
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
              <Slider
                value={Math.abs(config.default_stoploss) * 100}
                onChange={(_, v) => handleDefaultStoplossChange(-(v as number) / 100)}
                min={1}
                max={50}
                step={0.5}
                sx={{ flex: 1 }}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `-${v}%`}
              />
              <TextField
                type="number"
                value={(config.default_stoploss * 100).toFixed(1)}
                onChange={(e) => handleDefaultStoplossChange(parseFloat(e.target.value) / 100)}
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
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteRule(index)}
                    color="error"
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>

                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    When condition is true:
                  </Typography>
                  <ConditionNodeEditor
                    node={rule.condition}
                    onChange={(condition) =>
                      handleRuleChange(index, { ...rule, condition })
                    }
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
                    onChange={(e) =>
                      handleRuleChange(index, {
                        ...rule,
                        stoploss: parseFloat(e.target.value) / 100,
                      })
                    }
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

            <Button
              size="small"
              startIcon={<Add />}
              onClick={handleAddRule}
              variant="outlined"
            >
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
                <Typography variant="body2">
                  Enable trailing stop within custom stoploss
                </Typography>
              }
            />

            {config.trailing?.enabled && (
              <Box sx={{ mt: 1, ml: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Trailing Stop Positive (lock in profit at)
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                    <Slider
                      value={(config.trailing.positive || 0.01) * 100}
                      onChange={(_, v) => handleTrailingPositiveChange((v as number) / 100)}
                      min={0.1}
                      max={10}
                      step={0.1}
                      sx={{ flex: 1 }}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(v) => `${v}%`}
                    />
                    <TextField
                      type="number"
                      value={((config.trailing.positive || 0.01) * 100).toFixed(1)}
                      onChange={(e) =>
                        handleTrailingPositiveChange(parseFloat(e.target.value) / 100)
                      }
                      size="small"
                      sx={{ width: 100 }}
                      slotProps={{
                        input: {
                          endAdornment: <InputAdornment position="end">%</InputAdornment>,
                        },
                        htmlInput: { step: 0.1 },
                      }}
                    />
                  </Box>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Trailing Stop Offset (activate when profit exceeds)
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                    <Slider
                      value={(config.trailing.positive_offset || 0.02) * 100}
                      onChange={(_, v) => handleTrailingOffsetChange((v as number) / 100)}
                      min={0.1}
                      max={10}
                      step={0.1}
                      sx={{ flex: 1 }}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(v) => `${v}%`}
                    />
                    <TextField
                      type="number"
                      value={((config.trailing.positive_offset || 0.02) * 100).toFixed(1)}
                      onChange={(e) =>
                        handleTrailingOffsetChange(parseFloat(e.target.value) / 100)
                      }
                      size="small"
                      sx={{ width: 100 }}
                      slotProps={{
                        input: {
                          endAdornment: <InputAdornment position="end">%</InputAdornment>,
                        },
                        htmlInput: { step: 0.1 },
                      }}
                    />
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Collapse>

      {!config.enabled && expanded && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Enable to configure dynamic stoploss that adjusts based on profit levels.
        </Typography>
      )}
    </Paper>
  );
}
