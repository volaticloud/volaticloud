import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Switch,
  Button,
  IconButton,
  TextField,
  Slider,
  Tooltip,
  InputAdornment,
  Divider,
  Collapse,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Add,
  Delete,
  Info,
  Layers,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { DCAConfig, DCARule } from './types';

interface DCABuilderProps {
  value: DCAConfig | undefined;
  onChange: (config: DCAConfig | undefined) => void;
}

const DEFAULT_DCA_CONFIG: DCAConfig = {
  enabled: false,
  max_entries: 3,
  rules: [
    { price_drop_percent: 5, stake_multiplier: 1.5 },
    { price_drop_percent: 10, stake_multiplier: 2.0 },
  ],
  cooldown_minutes: 60,
};

export function DCABuilder({ value, onChange }: DCABuilderProps) {
  const [expanded, setExpanded] = useState(true);

  const config = value || DEFAULT_DCA_CONFIG;

  const handleToggleEnabled = (enabled: boolean) => {
    onChange({
      ...config,
      enabled,
    });
  };

  const handleMaxEntriesChange = (max_entries: number) => {
    onChange({
      ...config,
      max_entries,
    });
  };

  const handleCooldownChange = (cooldown_minutes: number) => {
    onChange({
      ...config,
      cooldown_minutes,
    });
  };

  const handleAddRule = () => {
    const lastRule = config.rules[config.rules.length - 1];
    const newPriceDrop = lastRule ? lastRule.price_drop_percent + 5 : 5;
    const newMultiplier = lastRule ? lastRule.stake_multiplier + 0.5 : 1.5;

    onChange({
      ...config,
      rules: [
        ...config.rules,
        { price_drop_percent: newPriceDrop, stake_multiplier: newMultiplier },
      ],
    });
  };

  const handleRuleChange = (index: number, field: keyof DCARule, value: number) => {
    const newRules = [...config.rules];
    newRules[index] = { ...newRules[index], [field]: value };
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

  // Calculate total stake after all DCA entries
  const calculateTotalStake = () => {
    let total = 1; // Initial stake
    for (let i = 0; i < Math.min(config.max_entries - 1, config.rules.length); i++) {
      total += config.rules[i].stake_multiplier;
    }
    return total.toFixed(2);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
        <Layers color={config.enabled ? 'primary' : 'disabled'} />
        <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
          DCA (Dollar Cost Averaging)
        </Typography>
        <Tooltip title="Add to position when price drops, averaging down your entry">
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
          {/* Max Entries */}
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Maximum Entries
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                <Slider
                  value={config.max_entries}
                  onChange={(_, v) => handleMaxEntriesChange(v as number)}
                  min={1}
                  max={10}
                  step={1}
                  marks={[
                    { value: 1, label: '1' },
                    { value: 5, label: '5' },
                    { value: 10, label: '10' },
                  ]}
                  sx={{ flex: 1 }}
                  valueLabelDisplay="auto"
                />
                <TextField
                  type="number"
                  value={config.max_entries}
                  onChange={(e) => handleMaxEntriesChange(parseInt(e.target.value) || 1)}
                  size="small"
                  sx={{ width: 80 }}
                  slotProps={{
                    htmlInput: { min: 1, max: 10 },
                  }}
                />
              </Box>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Cooldown Between Entries
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                <Slider
                  value={config.cooldown_minutes || 0}
                  onChange={(_, v) => handleCooldownChange(v as number)}
                  min={0}
                  max={240}
                  step={15}
                  sx={{ flex: 1 }}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}m`}
                />
                <TextField
                  type="number"
                  value={config.cooldown_minutes || 0}
                  onChange={(e) => handleCooldownChange(parseInt(e.target.value) || 0)}
                  size="small"
                  sx={{ width: 80 }}
                  slotProps={{
                    input: {
                      endAdornment: <InputAdornment position="end">min</InputAdornment>,
                    },
                    htmlInput: { min: 0 },
                  }}
                />
              </Box>
            </Box>
          </Box>

          <Divider />

          {/* DCA Rules */}
          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              DCA Rules (Price Drop Triggers)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Define when to add to position and how much stake to add.
            </Typography>

            {config.rules.length === 0 && (
              <Alert severity="info" sx={{ mb: 1 }}>
                No DCA rules defined. Add rules to enable averaging down.
              </Alert>
            )}

            <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Entry #</TableCell>
                    <TableCell>Price Drop (%)</TableCell>
                    <TableCell>Stake Multiplier</TableCell>
                    <TableCell width={50}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>1 (Initial)</TableCell>
                    <TableCell>0%</TableCell>
                    <TableCell>1.0x</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                  {config.rules.map((rule, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 2}</TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={rule.price_drop_percent}
                          onChange={(e) =>
                            handleRuleChange(
                              index,
                              'price_drop_percent',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          size="small"
                          sx={{ width: 80 }}
                          slotProps={{
                            input: {
                              endAdornment: <InputAdornment position="end">%</InputAdornment>,
                            },
                            htmlInput: { min: 0, step: 1 },
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={rule.stake_multiplier}
                          onChange={(e) =>
                            handleRuleChange(
                              index,
                              'stake_multiplier',
                              parseFloat(e.target.value) || 1
                            )
                          }
                          size="small"
                          sx={{ width: 80 }}
                          slotProps={{
                            input: {
                              endAdornment: <InputAdornment position="end">x</InputAdornment>,
                            },
                            htmlInput: { min: 0.1, step: 0.1 },
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteRule(index)}
                          disabled={config.rules.length <= 1}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                size="small"
                startIcon={<Add />}
                onClick={handleAddRule}
                variant="outlined"
                disabled={config.rules.length >= config.max_entries - 1}
              >
                Add DCA Level
              </Button>
              <Typography variant="body2" color="text.secondary">
                Total stake if all entries filled: <strong>{calculateTotalStake()}x</strong>
              </Typography>
            </Box>
          </Box>

          {/* Example visualization */}
          <Alert severity="info" icon={<Info />}>
            <Typography variant="body2">
              <strong>Example:</strong> If initial stake is $100:
              <br />
              Entry 1: $100 at entry price
              {config.rules.slice(0, config.max_entries - 1).map((rule, i) => (
                <span key={i}>
                  <br />
                  Entry {i + 2}: ${(rule.stake_multiplier * 100).toFixed(0)} when price drops {rule.price_drop_percent}%
                </span>
              ))}
              <br />
              Total invested: ${(parseFloat(calculateTotalStake()) * 100).toFixed(0)}
            </Typography>
          </Alert>
        </Box>
      </Collapse>

      {!config.enabled && expanded && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Enable to configure Dollar Cost Averaging (add to losing positions).
        </Typography>
      )}
    </Paper>
  );
}
