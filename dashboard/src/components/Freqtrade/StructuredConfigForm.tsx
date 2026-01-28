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
  OrderTypesConfig,
  OrderTimeInForceConfig,
  STAKE_CURRENCIES,
  TIMEFRAMES,
  PRICE_SIDES,
  ConfigSection,
  ALL_SECTIONS,
} from './defaultConfig';

/** Trading modes available in Freqtrade */
const TRADING_MODES = [
  { value: 'spot', label: 'Spot', description: 'Regular spot trading' },
  { value: 'margin', label: 'Margin', description: 'Margin trading with leverage' },
  { value: 'futures', label: 'Futures', description: 'Futures/perpetual contracts' },
] as const;

/** Margin modes for margin/futures trading */
const MARGIN_MODES = [
  { value: 'cross', label: 'Cross', description: 'Share margin across positions' },
  { value: 'isolated', label: 'Isolated', description: 'Separate margin per position' },
] as const;

/** Order types */
const ORDER_TYPES = [
  { value: 'limit', label: 'Limit' },
  { value: 'market', label: 'Market' },
] as const;

/** Time in force options */
const TIME_IN_FORCE_OPTIONS = [
  { value: 'GTC', label: 'GTC', description: 'Good Till Cancelled' },
  { value: 'FOK', label: 'FOK', description: 'Fill Or Kill' },
  { value: 'IOC', label: 'IOC', description: 'Immediate Or Cancel' },
  { value: 'PO', label: 'PO', description: 'Post Only' },
] as const;

interface StructuredConfigFormProps {
  value: FreqtradeConfig;
  onChange: (config: FreqtradeConfig) => void;
  readOnly?: boolean;
  /** Sections to show by default (before extended mode). If not provided, shows all sections. */
  defaultSections?: ConfigSection[];
  /** Whether extended mode is enabled (controlled by parent). */
  extendedMode?: boolean;
}

/**
 * Structured Freqtrade configuration form with grouped sections.
 *
 * Provides a clean, organized UI for configuring common Freqtrade settings
 * without overwhelming users with 100+ fields from the full schema.
 *
 * @example
 * ```tsx
 * // Show only basic section by default, with toggle for extended mode
 * <StructuredConfigForm
 *   value={config}
 *   onChange={setConfig}
 *   defaultSections={['basic']}
 *   showExtendedToggle
 * />
 *
 * // Show all sections (default behavior)
 * <StructuredConfigForm value={config} onChange={setConfig} />
 * ```
 */
export function StructuredConfigForm({
  value,
  onChange,
  readOnly = false,
  defaultSections,
  extendedMode = false,
}: StructuredConfigFormProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    trading: false,
    orders: false,
    pricing: false,
    risk: false,
    exits: false,
  });

  // Determine which sections to show
  const hasDefaultSections = defaultSections && defaultSections.length < ALL_SECTIONS.length;
  const visibleSections = hasDefaultSections && !extendedMode
    ? defaultSections
    : ALL_SECTIONS;

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

  const updateOrderTypes = (field: keyof OrderTypesConfig, newValue: OrderTypesConfig[keyof OrderTypesConfig]) => {
    onChange({
      ...value,
      order_types: {
        entry: 'limit',
        exit: 'limit',
        stoploss: 'market',
        stoploss_on_exchange: false,
        ...value.order_types,
        [field]: newValue,
      },
    });
  };

  const updateOrderTimeInForce = (field: keyof OrderTimeInForceConfig, newValue: OrderTimeInForceConfig[keyof OrderTimeInForceConfig]) => {
    onChange({
      ...value,
      order_time_in_force: {
        entry: 'GTC',
        exit: 'GTC',
        ...value.order_time_in_force,
        [field]: newValue,
      },
    });
  };

  // Helper to determine if section should have connected border (no top border)
  const shouldConnectBorder = (section: ConfigSection): boolean => {
    const sectionIndex = visibleSections.indexOf(section);
    return sectionIndex > 0;
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
      {visibleSections.includes('basic') && (
      <Accordion
        expanded={expandedSections.basic}
        onChange={handleSectionChange('basic')}
        disableGutters
        elevation={0}
        sx={{ border: 1, borderTop: shouldConnectBorder('basic') ? 0 : 1, borderColor: 'divider', '&:before': { display: 'none' } }}
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
      )}

      {/* Trading Mode Section */}
      {visibleSections.includes('trading') && (
      <Accordion
        expanded={expandedSections.trading}
        onChange={handleSectionChange('trading')}
        disableGutters
        elevation={0}
        sx={{ border: 1, borderTop: shouldConnectBorder('trading') ? 0 : 1, borderColor: 'divider', '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={500}>Trading Mode</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            {/* Dry Run */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={value.dry_run ?? true}
                    onChange={(e) => updateConfig('dry_run', e.target.checked)}
                    disabled={readOnly}
                  />
                }
                label="Dry Run Mode"
              />
              <FormHelperText>
                Paper trading without real money
              </FormHelperText>
            </Grid>

            {/* Dry Run Wallet */}
            {(value.dry_run ?? true) && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Dry Run Wallet"
                  type="number"
                  value={value.dry_run_wallet ?? 1000}
                  onChange={(e) => updateConfig('dry_run_wallet', parseFloat(e.target.value) || 1000)}
                  fullWidth
                  size="small"
                  disabled={readOnly}
                  slotProps={{
                    input: {
                      endAdornment: <InputAdornment position="end">{value.stake_currency || 'USDT'}</InputAdornment>,
                    },
                    htmlInput: { min: 0 },
                  }}
                  helperText="Starting balance for paper trading"
                />
              </Grid>
            )}

            {/* Trading Mode */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small" disabled={readOnly}>
                <InputLabel>Trading Mode</InputLabel>
                <Select
                  value={value.trading_mode || 'spot'}
                  label="Trading Mode"
                  onChange={(e: SelectChangeEvent) => updateConfig('trading_mode', e.target.value as FreqtradeConfig['trading_mode'])}
                >
                  {TRADING_MODES.map(mode => (
                    <MenuItem key={mode.value} value={mode.value}>
                      <Tooltip title={mode.description} placement="right">
                        <span>{mode.label}</span>
                      </Tooltip>
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Type of trading (spot, margin, futures)</FormHelperText>
              </FormControl>
            </Grid>

            {/* Margin Mode - only shown for margin/futures */}
            {(value.trading_mode === 'margin' || value.trading_mode === 'futures') && (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth size="small" disabled={readOnly}>
                    <InputLabel>Margin Mode</InputLabel>
                    <Select
                      value={value.margin_mode || 'isolated'}
                      label="Margin Mode"
                      onChange={(e: SelectChangeEvent) => updateConfig('margin_mode', e.target.value as FreqtradeConfig['margin_mode'])}
                    >
                      {MARGIN_MODES.map(mode => (
                        <MenuItem key={mode.value} value={mode.value}>
                          <Tooltip title={mode.description} placement="right">
                            <span>{mode.label}</span>
                          </Tooltip>
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>How margin is allocated</FormHelperText>
                  </FormControl>
                </Grid>

                {/* Liquidation Buffer */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Liquidation Buffer"
                    type="number"
                    value={value.liquidation_buffer ?? 0.05}
                    onChange={(e) => updateConfig('liquidation_buffer', parseFloat(e.target.value) || 0.05)}
                    fullWidth
                    size="small"
                    disabled={readOnly}
                    slotProps={{
                      htmlInput: { min: 0, max: 0.99, step: 0.01 },
                    }}
                    helperText="Safety buffer ratio to avoid liquidation (0-0.99)"
                  />
                </Grid>
              </>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>
      )}

      {/* Order Settings Section */}
      {visibleSections.includes('orders') && (
      <Accordion
        expanded={expandedSections.orders}
        onChange={handleSectionChange('orders')}
        disableGutters
        elevation={0}
        sx={{ border: 1, borderTop: shouldConnectBorder('orders') ? 0 : 1, borderColor: 'divider', '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={500}>Order Settings</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {/* Order Types */}
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Order Types
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small" disabled={readOnly}>
                <InputLabel>Entry Order</InputLabel>
                <Select
                  value={value.order_types?.entry || 'limit'}
                  label="Entry Order"
                  onChange={(e: SelectChangeEvent) => updateOrderTypes('entry', e.target.value as OrderTypesConfig['entry'])}
                >
                  {ORDER_TYPES.map(type => (
                    <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small" disabled={readOnly}>
                <InputLabel>Exit Order</InputLabel>
                <Select
                  value={value.order_types?.exit || 'limit'}
                  label="Exit Order"
                  onChange={(e: SelectChangeEvent) => updateOrderTypes('exit', e.target.value as OrderTypesConfig['exit'])}
                >
                  {ORDER_TYPES.map(type => (
                    <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small" disabled={readOnly}>
                <InputLabel>Stoploss Order</InputLabel>
                <Select
                  value={value.order_types?.stoploss || 'market'}
                  label="Stoploss Order"
                  onChange={(e: SelectChangeEvent) => updateOrderTypes('stoploss', e.target.value as OrderTypesConfig['stoploss'])}
                >
                  {ORDER_TYPES.map(type => (
                    <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={value.order_types?.stoploss_on_exchange ?? false}
                    onChange={(e) => updateOrderTypes('stoploss_on_exchange', e.target.checked)}
                    disabled={readOnly}
                    size="small"
                  />
                }
                label="Stoploss on Exchange"
              />
              <FormHelperText>
                Place stoploss order directly on exchange for faster execution
              </FormHelperText>
            </Grid>
          </Grid>

          {/* Time in Force */}
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Time in Force
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small" disabled={readOnly}>
                <InputLabel>Entry TIF</InputLabel>
                <Select
                  value={value.order_time_in_force?.entry || 'GTC'}
                  label="Entry TIF"
                  onChange={(e: SelectChangeEvent) => updateOrderTimeInForce('entry', e.target.value as OrderTimeInForceConfig['entry'])}
                >
                  {TIME_IN_FORCE_OPTIONS.map(tif => (
                    <MenuItem key={tif.value} value={tif.value}>
                      <Tooltip title={tif.description} placement="right">
                        <span>{tif.label}</span>
                      </Tooltip>
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>How long entry orders remain active</FormHelperText>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small" disabled={readOnly}>
                <InputLabel>Exit TIF</InputLabel>
                <Select
                  value={value.order_time_in_force?.exit || 'GTC'}
                  label="Exit TIF"
                  onChange={(e: SelectChangeEvent) => updateOrderTimeInForce('exit', e.target.value as OrderTimeInForceConfig['exit'])}
                >
                  {TIME_IN_FORCE_OPTIONS.map(tif => (
                    <MenuItem key={tif.value} value={tif.value}>
                      <Tooltip title={tif.description} placement="right">
                        <span>{tif.label}</span>
                      </Tooltip>
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>How long exit orders remain active</FormHelperText>
              </FormControl>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
      )}

      {/* Pricing Settings Section */}
      {visibleSections.includes('pricing') && (
      <Accordion
        expanded={expandedSections.pricing}
        onChange={handleSectionChange('pricing')}
        disableGutters
        elevation={0}
        sx={{ border: 1, borderTop: shouldConnectBorder('pricing') ? 0 : 1, borderColor: 'divider', '&:before': { display: 'none' } }}
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
      )}

      {/* Risk Management Section */}
      {visibleSections.includes('risk') && (
      <Accordion
        expanded={expandedSections.risk}
        onChange={handleSectionChange('risk')}
        disableGutters
        elevation={0}
        sx={{ border: 1, borderTop: shouldConnectBorder('risk') ? 0 : 1, borderColor: 'divider', '&:before': { display: 'none' } }}
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
      )}

      {/* Exit Strategy Section */}
      {visibleSections.includes('exits') && (
      <Accordion
        expanded={expandedSections.exits}
        onChange={handleSectionChange('exits')}
        disableGutters
        elevation={0}
        sx={{ border: 1, borderTop: shouldConnectBorder('exits') ? 0 : 1, borderColor: 'divider', '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={500}>Exit Strategy</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            {/* Use Exit Signal */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={value.use_exit_signal ?? true}
                    onChange={(e) => updateConfig('use_exit_signal', e.target.checked)}
                    disabled={readOnly}
                  />
                }
                label="Use Exit Signal"
              />
              <FormHelperText>
                Honor exit signals from strategy
              </FormHelperText>
            </Grid>

            {/* Exit Profit Only */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={value.exit_profit_only ?? false}
                    onChange={(e) => updateConfig('exit_profit_only', e.target.checked)}
                    disabled={readOnly}
                  />
                }
                label="Exit Profit Only"
              />
              <FormHelperText>
                Only exit when trade is profitable
              </FormHelperText>
            </Grid>

            {/* Exit Profit Offset */}
            {value.exit_profit_only && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Exit Profit Offset"
                  type="number"
                  value={(value.exit_profit_offset ?? 0) * 100}
                  onChange={(e) => updateConfig('exit_profit_offset', parseFloat(e.target.value) / 100 || 0)}
                  fullWidth
                  size="small"
                  disabled={readOnly}
                  slotProps={{
                    input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                    htmlInput: { min: 0, max: 100, step: 0.1 },
                  }}
                  helperText="Minimum profit required to honor exit signal"
                />
              </Grid>
            )}

            {/* Ignore ROI if Entry Signal */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={value.ignore_roi_if_entry_signal ?? false}
                    onChange={(e) => updateConfig('ignore_roi_if_entry_signal', e.target.checked)}
                    disabled={readOnly}
                  />
                }
                label="Ignore ROI if Entry Signal"
              />
              <FormHelperText>
                Skip ROI exit if new entry signal is present
              </FormHelperText>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
      )}
    </Box>
  );
}
