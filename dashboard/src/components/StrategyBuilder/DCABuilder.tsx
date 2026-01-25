import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  TextField,
  Slider,
  InputAdornment,
  Divider,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { Add, Delete, Info, Layers } from '@mui/icons-material';
import { DCAConfig, DCARule, createId } from './types';
import { ToggleableSection } from './shared';
import { DEFAULT_DCA_CONFIG } from './constants';

interface DCABuilderProps {
  value: DCAConfig | undefined;
  onChange: (config: DCAConfig | undefined) => void;
}

export function DCABuilder({ value, onChange }: DCABuilderProps) {
  const config = value || DEFAULT_DCA_CONFIG;

  const handleToggleEnabled = (enabled: boolean) => {
    onChange({
      ...config,
      enabled,
    });
  };

  const handleMaxEntriesChange = (max_entries: number) => {
    // Ensure max_entries is at least rules.length + 1 (to account for initial entry)
    const minRequired = config.rules.length + 1;
    const validatedMaxEntries = Math.max(minRequired, Math.min(10, Math.max(1, max_entries)));
    onChange({
      ...config,
      max_entries: validatedMaxEntries,
    });
  };

  const handleCooldownChange = (cooldown_minutes: number) => {
    // Ensure cooldown is within valid range (0-1440 minutes = 0-24 hours)
    const validatedCooldown = Math.max(0, Math.min(1440, cooldown_minutes));
    onChange({
      ...config,
      cooldown_minutes: validatedCooldown,
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
        { id: createId(), price_drop_percent: newPriceDrop, stake_multiplier: newMultiplier },
      ],
    });
  };

  const handleRuleChange = (index: number, field: keyof DCARule, value: number) => {
    // Validate numeric fields
    let validatedValue = value;
    if (field === 'price_drop_percent') {
      // Price drop should be positive and reasonable (0-100%)
      validatedValue = Math.max(0, Math.min(100, value));
    } else if (field === 'stake_multiplier') {
      // Stake multiplier should be positive (0.1x-10x)
      validatedValue = Math.max(0.1, Math.min(10, value));
    }

    const newRules = [...config.rules];
    newRules[index] = { ...newRules[index], [field]: validatedValue };
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
  // Uses slice to get effective rules (consistent with UI display)
  const calculateTotalStake = () => {
    const effectiveRules = config.rules.slice(0, config.max_entries - 1);
    const total = 1 + effectiveRules.reduce((sum, rule) => sum + rule.stake_multiplier, 0);
    return total.toFixed(2);
  };

  return (
    <ToggleableSection
      title="DCA (Dollar Cost Averaging)"
      tooltip="Add to position when price drops, averaging down your entry"
      icon={<Layers color={config.enabled ? 'primary' : 'disabled'} />}
      enabled={config.enabled}
      onToggle={handleToggleEnabled}
      disabledContent={
        <Typography variant="body2" color="text.secondary">
          Enable to configure Dollar Cost Averaging (add to losing positions).
        </Typography>
      }
    >
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
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) handleMaxEntriesChange(val);
              }}
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
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) handleCooldownChange(val);
              }}
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
                <TableRow key={rule.id}>
                  <TableCell>{index + 2}</TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={rule.price_drop_percent}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) handleRuleChange(index, 'price_drop_percent', val);
                      }}
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
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) handleRuleChange(index, 'stake_multiplier', val);
                      }}
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
              Entry {i + 2}: ${(rule.stake_multiplier * 100).toFixed(0)} when price drops{' '}
              {rule.price_drop_percent}%
            </span>
          ))}
          <br />
          Total invested: ${(parseFloat(calculateTotalStake()) * 100).toFixed(0)}
        </Typography>
      </Alert>
    </ToggleableSection>
  );
}
