import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Slider,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import {
  FreqtradeConfig,
  PricingConfig,
  STAKE_CURRENCIES,
  TIMEFRAMES,
  PRICE_SIDES,
} from './defaultConfig';

interface StructuredConfigFormProps {
  value: FreqtradeConfig;
  onChange: (config: FreqtradeConfig) => void;
  readOnly?: boolean;
}

/**
 * Structured Freqtrade configuration form with grouped sections.
 *
 * Provides a clean, organized UI for configuring common Freqtrade settings
 * without overwhelming users with 100+ fields from the full schema.
 */
export function StructuredConfigForm({ value, onChange, readOnly = false }: StructuredConfigFormProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    pricing: false,
    risk: false,
  });

  const handleSectionChange = (section: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedSections(prev => ({ ...prev, [section]: isExpanded }));
  };

  const updateConfig = <K extends keyof FreqtradeConfig>(
    field: K,
    newValue: FreqtradeConfig[K]
  ) => {
    onChange({ ...value, [field]: newValue });
  };

  const updatePricing = (type: 'entry_pricing' | 'exit_pricing', field: keyof PricingConfig, newValue: PricingConfig[keyof PricingConfig]) => {
    onChange({
      ...value,
      [type]: {
        ...value[type],
        [field]: newValue,
      },
    });
  };

  const updateMinimalROI = (key: string, roiValue: number | null, remove = false) => {
    const currentROI = value.minimal_roi || {};
    if (remove) {
      const rest = Object.fromEntries(
        Object.entries(currentROI).filter(([k]) => k !== key)
      );
      updateConfig('minimal_roi', rest);
    } else if (roiValue !== null) {
      updateConfig('minimal_roi', { ...currentROI, [key]: roiValue });
    }
  };

  const addROIEntry = () => {
    const currentROI = value.minimal_roi || {};
    const existingMinutes = Object.keys(currentROI).map(Number).filter(n => !isNaN(n));
    const nextMinute = existingMinutes.length > 0 ? Math.max(...existingMinutes) + 30 : 30;
    updateConfig('minimal_roi', { ...currentROI, [nextMinute.toString()]: 0.05 });
  };

  return (
    <Box>
      {/* Basic Settings Section */}
      <Accordion
        expanded={expandedSections.basic}
        onChange={handleSectionChange('basic')}
        disableGutters
        elevation={0}
        sx={{ border: 1, borderColor: 'divider', '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={500}>Basic Settings</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            {/* Stake Currency */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small" disabled={readOnly}>
                <InputLabel>Stake Currency</InputLabel>
                <Select
                  value={value.stake_currency || 'USDT'}
                  label="Stake Currency"
                  onChange={(e: SelectChangeEvent) => updateConfig('stake_currency', e.target.value)}
                >
                  {STAKE_CURRENCIES.map(currency => (
                    <MenuItem key={currency} value={currency}>{currency}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>Currency used for trading</FormHelperText>
              </FormControl>
            </Grid>

            {/* Stake Amount */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Stake Amount"
                type="number"
                value={value.stake_amount || 10}
                onChange={(e) => updateConfig('stake_amount', parseFloat(e.target.value) || 10)}
                fullWidth
                size="small"
                disabled={readOnly}
                slotProps={{
                  input: {
                    endAdornment: <InputAdornment position="end">{value.stake_currency || 'USDT'}</InputAdornment>,
                  },
                  htmlInput: { min: 0, step: 0.1 },
                }}
                helperText="Amount to stake per trade"
              />
            </Grid>

            {/* Timeframe */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small" disabled={readOnly}>
                <InputLabel>Timeframe</InputLabel>
                <Select
                  value={value.timeframe || '5m'}
                  label="Timeframe"
                  onChange={(e: SelectChangeEvent) => updateConfig('timeframe', e.target.value)}
                >
                  {TIMEFRAMES.map(tf => (
                    <MenuItem key={tf.value} value={tf.value}>{tf.label}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>Candle timeframe for strategy</FormHelperText>
              </FormControl>
            </Grid>

            {/* Max Open Trades */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Max Open Trades"
                type="number"
                value={value.max_open_trades ?? 3}
                onChange={(e) => updateConfig('max_open_trades', parseInt(e.target.value, 10) || 3)}
                fullWidth
                size="small"
                disabled={readOnly}
                slotProps={{
                  htmlInput: { min: 1, max: 50, step: 1 },
                }}
                helperText="Maximum concurrent open positions"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Pricing Settings Section */}
      <Accordion
        expanded={expandedSections.pricing}
        onChange={handleSectionChange('pricing')}
        disableGutters
        elevation={0}
        sx={{ border: 1, borderTop: 0, borderColor: 'divider', '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={500}>Pricing Settings</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {/* Entry Pricing */}
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Entry Pricing
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small" disabled={readOnly}>
                <InputLabel>Price Side</InputLabel>
                <Select
                  value={value.entry_pricing?.price_side || 'other'}
                  label="Price Side"
                  onChange={(e: SelectChangeEvent) => updatePricing('entry_pricing', 'price_side', e.target.value as PricingConfig['price_side'])}
                >
                  {PRICE_SIDES.map(ps => (
                    <MenuItem key={ps.value} value={ps.value}>
                      <Tooltip title={ps.description} placement="right">
                        <span>{ps.label}</span>
                      </Tooltip>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={value.entry_pricing?.use_order_book ?? true}
                    onChange={(e) => updatePricing('entry_pricing', 'use_order_book', e.target.checked)}
                    disabled={readOnly}
                    size="small"
                  />
                }
                label="Use Order Book"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Order Book Top"
                type="number"
                value={value.entry_pricing?.order_book_top ?? 1}
                onChange={(e) => updatePricing('entry_pricing', 'order_book_top', parseInt(e.target.value, 10) || 1)}
                fullWidth
                size="small"
                disabled={readOnly || !value.entry_pricing?.use_order_book}
                slotProps={{
                  htmlInput: { min: 1, max: 50 },
                }}
              />
            </Grid>
          </Grid>

          {/* Exit Pricing */}
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Exit Pricing
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small" disabled={readOnly}>
                <InputLabel>Price Side</InputLabel>
                <Select
                  value={value.exit_pricing?.price_side || 'other'}
                  label="Price Side"
                  onChange={(e: SelectChangeEvent) => updatePricing('exit_pricing', 'price_side', e.target.value as PricingConfig['price_side'])}
                >
                  {PRICE_SIDES.map(ps => (
                    <MenuItem key={ps.value} value={ps.value}>
                      <Tooltip title={ps.description} placement="right">
                        <span>{ps.label}</span>
                      </Tooltip>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={value.exit_pricing?.use_order_book ?? true}
                    onChange={(e) => updatePricing('exit_pricing', 'use_order_book', e.target.checked)}
                    disabled={readOnly}
                    size="small"
                  />
                }
                label="Use Order Book"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Order Book Top"
                type="number"
                value={value.exit_pricing?.order_book_top ?? 1}
                onChange={(e) => updatePricing('exit_pricing', 'order_book_top', parseInt(e.target.value, 10) || 1)}
                fullWidth
                size="small"
                disabled={readOnly || !value.exit_pricing?.use_order_book}
                slotProps={{
                  htmlInput: { min: 1, max: 50 },
                }}
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Risk Management Section */}
      <Accordion
        expanded={expandedSections.risk}
        onChange={handleSectionChange('risk')}
        disableGutters
        elevation={0}
        sx={{ border: 1, borderTop: 0, borderColor: 'divider', '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={500}>Risk Management</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            {/* Stop Loss */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" gutterBottom>
                Stop Loss: {((value.stoploss ?? -0.1) * 100).toFixed(1)}%
              </Typography>
              <Slider
                value={(value.stoploss ?? -0.1) * 100}
                onChange={(_, newValue) => updateConfig('stoploss', (newValue as number) / 100)}
                min={-50}
                max={0}
                step={0.5}
                marks={[
                  { value: -50, label: '-50%' },
                  { value: -25, label: '-25%' },
                  { value: -10, label: '-10%' },
                  { value: 0, label: '0%' },
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v.toFixed(1)}%`}
                disabled={readOnly}
              />
              <FormHelperText>
                Maximum loss before exiting a trade (negative percentage)
              </FormHelperText>
            </Grid>

            {/* Trailing Stop */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={value.trailing_stop ?? false}
                    onChange={(e) => updateConfig('trailing_stop', e.target.checked)}
                    disabled={readOnly}
                  />
                }
                label="Enable Trailing Stop"
              />
              <FormHelperText>
                Dynamically adjust stop loss as price moves in your favor
              </FormHelperText>
            </Grid>

            {value.trailing_stop && (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Trailing Stop Positive"
                    type="number"
                    value={(value.trailing_stop_positive ?? 0.01) * 100}
                    onChange={(e) => updateConfig('trailing_stop_positive', parseFloat(e.target.value) / 100 || 0.01)}
                    fullWidth
                    size="small"
                    disabled={readOnly}
                    slotProps={{
                      input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                      htmlInput: { min: 0, max: 100, step: 0.1 },
                    }}
                    helperText="Trailing stop distance once in profit"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Trailing Stop Positive Offset"
                    type="number"
                    value={(value.trailing_stop_positive_offset ?? 0.01) * 100}
                    onChange={(e) => updateConfig('trailing_stop_positive_offset', parseFloat(e.target.value) / 100 || 0.01)}
                    fullWidth
                    size="small"
                    disabled={readOnly}
                    slotProps={{
                      input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                      htmlInput: { min: 0, max: 100, step: 0.1 },
                    }}
                    helperText="Profit level to activate trailing stop"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={value.trailing_only_offset_is_reached ?? false}
                        onChange={(e) => updateConfig('trailing_only_offset_is_reached', e.target.checked)}
                        disabled={readOnly}
                        size="small"
                      />
                    }
                    label="Only Trail After Offset"
                  />
                </Grid>
              </>
            )}

            {/* Minimal ROI */}
            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2">Minimal ROI</Typography>
                <IconButton size="small" onClick={addROIEntry} disabled={readOnly}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Box>
              <FormHelperText sx={{ mb: 1 }}>
                Minimum profit targets at different trade durations (in minutes)
              </FormHelperText>
              {Object.entries(value.minimal_roi || {}).map(([minutes, roi]) => (
                <Box key={minutes} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                  <TextField
                    label="Minutes"
                    type="number"
                    value={minutes}
                    onChange={(e) => {
                      const newMinutes = e.target.value;
                      if (newMinutes !== minutes) {
                        const updatedROI = { ...value.minimal_roi };
                        delete updatedROI[minutes];
                        updatedROI[newMinutes] = roi;
                        updateConfig('minimal_roi', updatedROI);
                      }
                    }}
                    size="small"
                    disabled={readOnly}
                    sx={{ width: 100 }}
                    slotProps={{
                      htmlInput: { min: 0 },
                    }}
                  />
                  <TextField
                    label="Target ROI"
                    type="number"
                    value={(roi * 100).toFixed(1)}
                    onChange={(e) => updateMinimalROI(minutes, parseFloat(e.target.value) / 100)}
                    size="small"
                    disabled={readOnly}
                    sx={{ flex: 1 }}
                    slotProps={{
                      input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                      htmlInput: { step: 0.1 },
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => updateMinimalROI(minutes, null, true)}
                    disabled={readOnly}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
