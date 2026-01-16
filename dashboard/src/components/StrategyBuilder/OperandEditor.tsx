import { useState } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Chip,
  Popover,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  Functions,
  ShowChart,
  AttachMoney,
  AccessTime,
  TrendingUp,
  Calculate,
} from '@mui/icons-material';
import {
  Operand,
  OperandType,
  IndicatorDefinition,
  ConstantOperand,
  IndicatorOperand,
  PriceOperand,
  TradeContextOperand,
  TimeOperand,
  createConstantOperand,
  createIndicatorOperand,
  createPriceOperand,
} from './types';
import { INDICATORS } from './indicatorMeta';

const OPERAND_TYPE_ICONS: Record<OperandType, React.ElementType> = {
  CONSTANT: Functions,
  INDICATOR: ShowChart,
  PRICE: AttachMoney,
  TRADE_CONTEXT: TrendingUp,
  TIME: AccessTime,
  MARKET: TrendingUp,
  EXTERNAL: Functions,
  COMPUTED: Calculate,
  CUSTOM: Functions,
};

const PRICE_FIELDS = [
  { value: 'open', label: 'Open' },
  { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' },
  { value: 'close', label: 'Close' },
  { value: 'volume', label: 'Volume' },
  { value: 'ohlc4', label: 'OHLC/4' },
  { value: 'hlc3', label: 'HLC/3' },
  { value: 'hl2', label: 'HL/2' },
] as const;

const TRADE_CONTEXT_FIELDS = [
  { value: 'current_profit', label: 'Current Profit', description: 'Decimal (0.05 = 5%)' },
  { value: 'current_profit_pct', label: 'Profit %', description: 'Percentage value' },
  { value: 'entry_rate', label: 'Entry Price', description: 'Trade entry rate' },
  { value: 'current_rate', label: 'Current Price', description: 'Current market price' },
  { value: 'trade_duration', label: 'Duration (min)', description: 'Trade duration in minutes' },
  { value: 'nr_of_entries', label: 'Entry Count', description: 'Number of entries (DCA)' },
  { value: 'stake_amount', label: 'Stake Amount', description: 'Current stake' },
] as const;

const TIME_FIELDS = [
  { value: 'hour', label: 'Hour (0-23)' },
  { value: 'day_of_week', label: 'Day of Week (0-6)' },
  { value: 'day_of_month', label: 'Day of Month (1-31)' },
  { value: 'month', label: 'Month (1-12)' },
  { value: 'is_weekend', label: 'Is Weekend' },
] as const;

interface OperandEditorProps {
  value: Operand;
  onChange: (operand: Operand) => void;
  indicators: IndicatorDefinition[];
  showTradeContext?: boolean;
  label?: string;
}

export function OperandEditor({
  value,
  onChange,
  indicators,
  showTradeContext = false,
  label,
}: OperandEditorProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleTypeSelect = (type: OperandType) => {
    setAnchorEl(null);

    switch (type) {
      case 'CONSTANT':
        onChange(createConstantOperand(0));
        break;
      case 'INDICATOR':
        if (indicators.length > 0) {
          onChange(createIndicatorOperand(indicators[0].id));
        }
        break;
      case 'PRICE':
        onChange(createPriceOperand('close'));
        break;
      case 'TRADE_CONTEXT':
        onChange({
          type: 'TRADE_CONTEXT',
          field: 'current_profit',
        } as TradeContextOperand);
        break;
      case 'TIME':
        onChange({
          type: 'TIME',
          field: 'hour',
        } as TimeOperand);
        break;
    }
  };

  const Icon = OPERAND_TYPE_ICONS[value.type] || Functions;

  const renderEditor = () => {
    switch (value.type) {
      case 'CONSTANT': {
        const constOp = value as ConstantOperand;
        return (
          <TextField
            type="number"
            value={constOp.value ?? 0}
            onChange={(e) =>
              onChange({
                ...constOp,
                value: parseFloat(e.target.value) || 0,
              })
            }
            size="small"
            sx={{ width: 100 }}
            slotProps={{
              htmlInput: { step: 'any' }
            }}
          />
        );
      }

      case 'INDICATOR': {
        const indOp = value as IndicatorOperand;
        const selectedInd = indicators.find((i) => i.id === indOp.indicatorId);
        const meta = selectedInd ? INDICATORS[selectedInd.type] : null;

        return (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Indicator</InputLabel>
              <Select
                value={indOp.indicatorId}
                onChange={(e) =>
                  onChange(createIndicatorOperand(e.target.value, undefined, indOp.offset))
                }
                label="Indicator"
              >
                {indicators.map((ind) => {
                  const indMeta = INDICATORS[ind.type];
                  return (
                    <MenuItem key={ind.id} value={ind.id}>
                      {ind.label || indMeta?.name || ind.type}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>

            {meta && meta.outputs.length > 1 && (
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>Output</InputLabel>
                <Select
                  value={indOp.field || ''}
                  onChange={(e) =>
                    onChange(createIndicatorOperand(indOp.indicatorId, e.target.value || undefined, indOp.offset))
                  }
                  label="Output"
                >
                  <MenuItem value="">Default</MenuItem>
                  {meta.outputs
                    .filter((o) => o.field)
                    .map((output) => (
                      <MenuItem key={output.field} value={output.field}>
                        {output.name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            )}

            <TextField
              type="number"
              value={indOp.offset || 0}
              onChange={(e) =>
                onChange(createIndicatorOperand(indOp.indicatorId, indOp.field, parseInt(e.target.value) || 0))
              }
              size="small"
              sx={{ width: 80 }}
              label="Offset"
              slotProps={{
                htmlInput: { min: 0, max: 100 }
              }}
            />
          </Box>
        );
      }

      case 'PRICE': {
        const priceOp = value as PriceOperand;
        return (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Price</InputLabel>
              <Select
                value={priceOp.field}
                onChange={(e) =>
                  onChange(createPriceOperand(e.target.value as PriceOperand['field'], priceOp.offset))
                }
                label="Price"
              >
                {PRICE_FIELDS.map((field) => (
                  <MenuItem key={field.value} value={field.value}>
                    {field.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              type="number"
              value={priceOp.offset || 0}
              onChange={(e) =>
                onChange(createPriceOperand(priceOp.field, parseInt(e.target.value) || 0))
              }
              size="small"
              sx={{ width: 80 }}
              label="Offset"
              slotProps={{
                htmlInput: { min: 0, max: 100 }
              }}
            />
          </Box>
        );
      }

      case 'TRADE_CONTEXT': {
        const tradeOp = value as TradeContextOperand;
        return (
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Trade Field</InputLabel>
            <Select
              value={tradeOp.field}
              onChange={(e) =>
                onChange({
                  ...tradeOp,
                  field: e.target.value as TradeContextOperand['field'],
                })
              }
              label="Trade Field"
            >
              {TRADE_CONTEXT_FIELDS.map((field) => (
                <MenuItem key={field.value} value={field.value}>
                  {field.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      }

      case 'TIME': {
        const timeOp = value as TimeOperand;
        return (
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Time Field</InputLabel>
            <Select
              value={timeOp.field}
              onChange={(e) =>
                onChange({
                  ...timeOp,
                  field: e.target.value as TimeOperand['field'],
                })
              }
              label="Time Field"
            >
              {TIME_FIELDS.map((field) => (
                <MenuItem key={field.value} value={field.value}>
                  {field.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      }

      default:
        return (
          <Typography variant="body2" color="text.secondary">
            {value.type} not supported yet
          </Typography>
        );
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {label && (
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 40 }}>
          {label}
        </Typography>
      )}

      {/* Type selector chip */}
      <Chip
        icon={<Icon fontSize="small" />}
        label={value.type.replace('_', ' ')}
        size="small"
        variant="outlined"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ cursor: 'pointer' }}
      />

      {/* Value editor */}
      {renderEditor()}

      {/* Type selector popover */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <List dense sx={{ minWidth: 200 }}>
          <ListItemButton onClick={() => handleTypeSelect('CONSTANT')}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Functions fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Constant" secondary="Fixed number value" />
          </ListItemButton>

          {indicators.length > 0 && (
            <ListItemButton onClick={() => handleTypeSelect('INDICATOR')}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <ShowChart fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Indicator" secondary="Technical indicator" />
            </ListItemButton>
          )}

          <ListItemButton onClick={() => handleTypeSelect('PRICE')}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <AttachMoney fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Price" secondary="OHLCV data" />
          </ListItemButton>

          <Divider />

          <ListItemButton onClick={() => handleTypeSelect('TIME')}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <AccessTime fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Time" secondary="Time-based values" />
          </ListItemButton>

          {showTradeContext && (
            <ListItemButton onClick={() => handleTypeSelect('TRADE_CONTEXT')}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <TrendingUp fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Trade Context" secondary="Trade data (for callbacks)" />
            </ListItemButton>
          )}
        </List>
      </Popover>
    </Box>
  );
}
