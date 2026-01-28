import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Divider,
  Alert,
  Slider,
  Chip,
  Menu,
  MenuItem,
  ListItemText,
  Tooltip,
  Switch,
} from '@mui/material';
import {
  Add,
  Delete,
  TrendingUp,
  DragIndicator,
  ContentCopy,
  ArrowUpward,
  ArrowDownward,
} from '@mui/icons-material';
import {
  LeverageConfig,
  LeverageRule,
  LeverageValue,
  LeverageConstantValue,
  IndicatorDefinition,
  ConditionNode,
  createId,
  createCompareNode,
  createConstantOperand,
  OperandType,
  ComparisonOperator,
  LeverageValueType,
  sortLeverageRulesByPriority,
} from './types';
import { ConditionNodeEditor } from './ConditionNode';
import { ToggleableSection } from './shared';
import { DEFAULT_LEVERAGE_CONFIG } from './constants';

interface LeverageBuilderProps {
  value: LeverageConfig | undefined;
  onChange: (config: LeverageConfig | undefined) => void;
  indicators: IndicatorDefinition[];
}

/**
 * LeverageBuilder component for configuring dynamic leverage rules.
 *
 * Leverage is only applicable in futures trading mode and allows users to:
 * - Set different leverage based on conditions (indicators, pair, side, etc.)
 * - Define rules evaluated in priority order (highest first)
 * - Set a default leverage when no rules match
 * - Cap maximum leverage globally
 */
export function LeverageBuilder({ value, onChange, indicators }: LeverageBuilderProps) {
  const config = value || DEFAULT_LEVERAGE_CONFIG;
  const [templateAnchor, setTemplateAnchor] = useState<null | HTMLElement>(null);

  // Sort rules by priority for display
  const sortedRules = sortLeverageRulesByPriority(config.rules);

  const handleToggleEnabled = (enabled: boolean) => {
    onChange({
      ...config,
      enabled,
    });
  };

  const handleDefaultLeverageChange = (leverage: number) => {
    onChange({
      ...config,
      default_leverage: Math.max(1, Math.min(leverage, config.max_leverage || 125)),
    });
  };

  const handleMaxLeverageChange = (maxLeverage: number) => {
    onChange({
      ...config,
      max_leverage: Math.max(1, maxLeverage),
      // Ensure default doesn't exceed max
      default_leverage: Math.min(config.default_leverage, maxLeverage),
    });
  };

  const handleAddRule = () => {
    // Create a new rule with default condition checking is_short
    const newRule: LeverageRule = {
      id: createId(),
      condition: createCompareNode(
        { type: OperandType.TradeContext, field: 'is_short' },
        ComparisonOperator.Eq,
        createConstantOperand(true)
      ),
      leverage: {
        type: LeverageValueType.Constant,
        value: 2,
      } as LeverageConstantValue,
      priority: config.rules.length > 0
        ? Math.max(...config.rules.map(r => r.priority)) + 1
        : 10,
    };

    onChange({
      ...config,
      rules: [...config.rules, newRule],
    });
  };

  const handleRuleChange = (id: string, updates: Partial<LeverageRule>) => {
    const newRules = config.rules.map(rule =>
      rule.id === id ? { ...rule, ...updates } : rule
    );
    onChange({
      ...config,
      rules: newRules,
    });
  };

  const handleRuleConditionChange = (id: string, condition: ConditionNode) => {
    handleRuleChange(id, { condition });
  };

  const handleRuleLeverageChange = (id: string, leverageValue: number) => {
    const clampedValue = Math.max(1, Math.min(leverageValue, config.max_leverage || 125));
    handleRuleChange(id, {
      leverage: {
        type: LeverageValueType.Constant,
        value: clampedValue,
      } as LeverageConstantValue,
    });
  };

  const handleRulePriorityChange = (id: string, priority: number) => {
    handleRuleChange(id, { priority: Math.max(0, priority) });
  };

  const handleDeleteRule = (id: string) => {
    onChange({
      ...config,
      rules: config.rules.filter(rule => rule.id !== id),
    });
  };

  const handleDuplicateRule = (id: string) => {
    const ruleToDuplicate = config.rules.find(r => r.id === id);
    if (ruleToDuplicate) {
      const newRule: LeverageRule = {
        ...ruleToDuplicate,
        id: createId(),
        label: ruleToDuplicate.label ? `${ruleToDuplicate.label} (copy)` : undefined,
        priority: ruleToDuplicate.priority - 1,
      };
      onChange({
        ...config,
        rules: [...config.rules, newRule],
      });
    }
  };

  const handleToggleRuleDisabled = (id: string) => {
    const rule = config.rules.find(r => r.id === id);
    if (rule) {
      handleRuleChange(id, { disabled: !rule.disabled });
    }
  };

  const handleMovePriority = (id: string, direction: 'up' | 'down') => {
    const rule = config.rules.find(r => r.id === id);
    if (rule) {
      handleRuleChange(id, {
        priority: direction === 'up' ? rule.priority + 1 : Math.max(0, rule.priority - 1)
      });
    }
  };

  // Template handlers
  const handleTemplateClick = (event: React.MouseEvent<HTMLElement>) => {
    setTemplateAnchor(event.currentTarget);
  };

  const handleTemplateClose = () => {
    setTemplateAnchor(null);
  };

  const applyTemplate = (template: 'simple' | 'per-side' | 'volatility') => {
    let newRules: LeverageRule[] = [];

    switch (template) {
      case 'simple':
        // No rules, just default leverage
        break;

      case 'per-side':
        // Different leverage for long/short
        newRules = [
          {
            id: createId(),
            condition: createCompareNode(
              { type: OperandType.TradeContext, field: 'is_short' },
              ComparisonOperator.Eq,
              createConstantOperand(true)
            ),
            leverage: { type: LeverageValueType.Constant, value: 2 } as LeverageConstantValue,
            priority: 10,
            label: 'Conservative shorts',
          },
        ];
        break;

      case 'volatility': {
        // Reduce leverage in high volatility (requires ATR indicator)
        const hasATR = indicators.some(ind => ind.type === 'ATR');
        if (hasATR) {
          const atrIndicator = indicators.find(ind => ind.type === 'ATR');
          newRules = [
            {
              id: createId(),
              condition: createCompareNode(
                { type: OperandType.Indicator, indicatorId: atrIndicator!.id },
                ComparisonOperator.Gt,
                createConstantOperand(0.03)
              ),
              leverage: { type: LeverageValueType.Constant, value: 1 } as LeverageConstantValue,
              priority: 10,
              label: 'Low leverage in high volatility',
            },
          ];
        }
        break;
      }
    }

    onChange({
      ...config,
      rules: newRules,
      default_leverage: 3,
    });
    handleTemplateClose();
  };

  const getLeverageValue = (leverage: LeverageValue): number => {
    if (leverage.type === LeverageValueType.Constant) {
      return (leverage as LeverageConstantValue).value;
    }
    return 1; // Default for expression type (shown differently)
  };

  return (
    <ToggleableSection
      title="Leverage"
      tooltip="Configure dynamic leverage for futures trading. Rules are evaluated in priority order (highest first)."
      icon={<TrendingUp color={config.enabled ? 'primary' : 'disabled'} />}
      enabled={config.enabled}
      onToggle={handleToggleEnabled}
      disabledContent={
        <Typography variant="body2" color="text.secondary">
          Enable to configure dynamic leverage for futures trading. Leverage only applies when trading
          futures/perpetuals.
        </Typography>
      }
    >
      {/* Warning about futures mode */}
      <Alert severity="info" sx={{ mb: 1 }}>
        Leverage configuration only applies when trading in futures/perpetuals mode. Make sure your
        exchange and bot are configured for futures trading.
      </Alert>

      {/* Default and Max Leverage */}
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Default Leverage (when no rules match)
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
            <Slider
              value={config.default_leverage}
              onChange={(_, v) => handleDefaultLeverageChange(v as number)}
              min={1}
              max={config.max_leverage || 10}
              step={1}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${v}x`}
              sx={{ flex: 1 }}
            />
            <TextField
              type="number"
              value={config.default_leverage}
              onChange={(e) => handleDefaultLeverageChange(parseFloat(e.target.value) || 1)}
              size="small"
              sx={{ width: 80 }}
              slotProps={{
                input: {
                  endAdornment: <InputAdornment position="end">x</InputAdornment>,
                },
                htmlInput: { min: 1, max: config.max_leverage || 125, step: 1 },
              }}
            />
          </Box>
        </Box>

        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Maximum Leverage Cap
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
            <Slider
              value={config.max_leverage || 10}
              onChange={(_, v) => handleMaxLeverageChange(v as number)}
              min={1}
              max={125}
              step={1}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${v}x`}
              sx={{ flex: 1 }}
            />
            <TextField
              type="number"
              value={config.max_leverage || 10}
              onChange={(e) => handleMaxLeverageChange(parseFloat(e.target.value) || 10)}
              size="small"
              sx={{ width: 80 }}
              slotProps={{
                input: {
                  endAdornment: <InputAdornment position="end">x</InputAdornment>,
                },
                htmlInput: { min: 1, max: 125, step: 1 },
              }}
            />
          </Box>
        </Box>
      </Box>

      <Divider />

      {/* Rules Section */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Leverage Rules (evaluated by priority, first match wins)
          </Typography>
          <Button size="small" variant="text" onClick={handleTemplateClick}>
            Quick Templates
          </Button>
          <Menu
            anchorEl={templateAnchor}
            open={Boolean(templateAnchor)}
            onClose={handleTemplateClose}
          >
            <MenuItem onClick={() => applyTemplate('simple')}>
              <ListItemText
                primary="Simple Fixed"
                secondary="No rules, just default leverage"
              />
            </MenuItem>
            <MenuItem onClick={() => applyTemplate('per-side')}>
              <ListItemText
                primary="Long/Short"
                secondary="Different leverage for shorts"
              />
            </MenuItem>
            <MenuItem
              onClick={() => applyTemplate('volatility')}
              disabled={!indicators.some(ind => ind.type === 'ATR')}
            >
              <ListItemText
                primary="Volatility-Based"
                secondary="Reduce leverage in high ATR (requires ATR indicator)"
              />
            </MenuItem>
          </Menu>
        </Box>

        {sortedRules.length === 0 && (
          <Alert severity="info" sx={{ mb: 1 }}>
            No rules defined. Default leverage will always be used. Add rules to enable conditional
            leverage based on indicators, pair, or trade side.
          </Alert>
        )}

        {sortedRules.map((rule) => (
          <Paper
            key={rule.id}
            variant="outlined"
            sx={{
              p: 1.5,
              mb: 1,
              bgcolor: rule.disabled ? 'action.disabledBackground' : 'background.default',
              opacity: rule.disabled ? 0.6 : 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <DragIndicator fontSize="small" color="action" sx={{ cursor: 'grab' }} />
              <Chip
                label={`Priority: ${rule.priority}`}
                size="small"
                variant="outlined"
              />
              {rule.label && (
                <Typography variant="body2" fontWeight={500}>
                  {rule.label}
                </Typography>
              )}
              <Box sx={{ flex: 1 }} />

              <Tooltip title="Move up (higher priority)">
                <IconButton
                  size="small"
                  onClick={() => handleMovePriority(rule.id, 'up')}
                >
                  <ArrowUpward fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Move down (lower priority)">
                <IconButton
                  size="small"
                  onClick={() => handleMovePriority(rule.id, 'down')}
                >
                  <ArrowDownward fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Duplicate rule">
                <IconButton
                  size="small"
                  onClick={() => handleDuplicateRule(rule.id)}
                >
                  <ContentCopy fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={rule.disabled ? 'Enable rule' : 'Disable rule'}>
                <Switch
                  size="small"
                  checked={!rule.disabled}
                  onChange={() => handleToggleRuleDisabled(rule.id)}
                />
              </Tooltip>
              <IconButton
                size="small"
                onClick={() => handleDeleteRule(rule.id)}
                color="error"
              >
                <Delete fontSize="small" />
              </IconButton>
            </Box>

            {/* Priority input */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
                Priority:
              </Typography>
              <TextField
                type="number"
                value={rule.priority}
                onChange={(e) => handleRulePriorityChange(rule.id, parseInt(e.target.value) || 0)}
                size="small"
                sx={{ width: 80 }}
                slotProps={{
                  htmlInput: { min: 0, step: 1 },
                }}
                disabled={rule.disabled}
              />
              <Typography variant="caption" color="text.secondary">
                (higher = evaluated first)
              </Typography>
            </Box>

            {/* Condition */}
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                When condition is true:
              </Typography>
              {rule.condition ? (
                <ConditionNodeEditor
                  node={rule.condition}
                  onChange={(condition) => handleRuleConditionChange(rule.id, condition)}
                  indicators={indicators}
                  showTradeContext
                  readOnly={rule.disabled}
                />
              ) : (
                <Alert severity="info" sx={{ mt: 0.5 }}>
                  No condition - rule always matches (catch-all)
                </Alert>
              )}
            </Box>

            {/* Leverage Value */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Set leverage to:
              </Typography>
              <Slider
                value={getLeverageValue(rule.leverage)}
                onChange={(_, v) => handleRuleLeverageChange(rule.id, v as number)}
                min={1}
                max={config.max_leverage || 10}
                step={1}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v}x`}
                sx={{ width: 150 }}
                disabled={rule.disabled}
              />
              <TextField
                type="number"
                value={getLeverageValue(rule.leverage)}
                onChange={(e) => handleRuleLeverageChange(rule.id, parseFloat(e.target.value) || 1)}
                size="small"
                sx={{ width: 80 }}
                disabled={rule.disabled}
                slotProps={{
                  input: {
                    endAdornment: <InputAdornment position="end">x</InputAdornment>,
                  },
                  htmlInput: { min: 1, max: config.max_leverage || 125, step: 1 },
                }}
              />
            </Box>

            {/* Optional label */}
            <Box sx={{ mt: 1 }}>
              <TextField
                placeholder="Optional label for this rule"
                value={rule.label || ''}
                onChange={(e) => handleRuleChange(rule.id, { label: e.target.value || undefined })}
                size="small"
                fullWidth
                disabled={rule.disabled}
              />
            </Box>
          </Paper>
        ))}

        <Button size="small" startIcon={<Add />} onClick={handleAddRule} variant="outlined">
          Add Rule
        </Button>
      </Box>
    </ToggleableSection>
  );
}

export default LeverageBuilder;
