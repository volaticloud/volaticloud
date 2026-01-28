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
import {
  TRADE_CONTEXT_FIELDS,
  TradeContextFieldMeta,
} from './tradeContextFields';

// Note: Only implemented operand types are included here
// MARKET operand is not yet implemented in the backend
const OPERAND_TYPE_ICONS: Partial<Record<OperandType, React.ElementType>> = {
  [OperandType.Constant]: Functions,
  [OperandType.Indicator]: ShowChart,
  [OperandType.Price]: AttachMoney,
  [OperandType.TradeContext]: TrendingUp,
  [OperandType.Time]: AccessTime,
  [OperandType.External]: Functions,
  [OperandType.Computed]: Calculate,
  [OperandType.Custom]: Functions,
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
  /** Override the list of available trade context fields (e.g., leverage callback has fewer fields) */
  tradeContextFields?: readonly TradeContextFieldMeta[];
  label?: string;
  /** When true, all editing is disabled (used for mirrored signals) */
  readOnly?: boolean;
  /** Context field metadata - used to render appropriate input for constant values */
  contextFieldMeta?: TradeContextFieldMeta;
}

export function OperandEditor({
  value,
  onChange,
  indicators,
  showTradeContext = false,
  tradeContextFields: tradeContextFieldsOverride,
  label,
  readOnly = false,
  contextFieldMeta,
}: OperandEditorProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleTypeSelect = (type: OperandType) => {
    setAnchorEl(null);

    switch (type) {
      case OperandType.Constant:
        onChange(createConstantOperand(0));
        break;
      case OperandType.Indicator:
        if (indicators.length > 0) {
          onChange(createIndicatorOperand(indicators[0].id));
        }
        break;
      case OperandType.Price:
        onChange(createPriceOperand('close'));
        break;
      case OperandType.TradeContext:
        onChange({
          type: OperandType.TradeContext,
          field: 'current_profit',
        } as TradeContextOperand);
        break;
      case OperandType.Time:
        onChange({
          type: OperandType.Time,
          field: 'hour',
        } as TimeOperand);
        break;
    }
  };

  const Icon = OPERAND_TYPE_ICONS[value.type] || Functions;

  const renderEditor = () => {
    switch (value.type) {
      case OperandType.Constant: {
        const constOp = value as ConstantOperand;

        // Use contextFieldMeta to determine the appropriate input type
        if (contextFieldMeta) {
          switch (contextFieldMeta.valueType) {
            case 'boolean':
              return (
                <FormControl size="small" sx={{ minWidth: 80 }} disabled={readOnly}>
                  <Select
                    value={constOp.value === true || constOp.value === 'true' ? 'true' : 'false'}
                    onChange={(e) =>
                      onChange({
                        ...constOp,
                        value: e.target.value === 'true',
                      })
                    }
                  >
                    <MenuItem value="true">True</MenuItem>
                    <MenuItem value="false">False</MenuItem>
                  </Select>
                </FormControl>
              );
            case 'enum':
              return (
                <FormControl size="small" sx={{ minWidth: 100 }} disabled={readOnly}>
                  <Select
                    value={constOp.value ?? contextFieldMeta.enumOptions?.[0]?.value ?? ''}
                    onChange={(e) =>
                      onChange({
                        ...constOp,
                        value: e.target.value,
                      })
                    }
                  >
                    {contextFieldMeta.enumOptions?.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              );
            case 'string':
              return (
                <TextField
                  value={constOp.value ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...constOp,
                      value: e.target.value,
                    })
                  }
                  size="small"
                  sx={{ width: 140 }}
                  disabled={readOnly}
                  placeholder={contextFieldMeta.description || 'Value'}
                />
              );
            case 'number':
            default:
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
                  disabled={readOnly}
                  slotProps={{
                    htmlInput: { step: 'any' }
                  }}
                />
              );
          }
        }

        // Fallback: determine type from current value
        if (typeof constOp.value === 'boolean') {
          return (
            <FormControl size="small" sx={{ minWidth: 80 }} disabled={readOnly}>
              <Select
                value={constOp.value ? 'true' : 'false'}
                onChange={(e) =>
                  onChange({
                    ...constOp,
                    value: e.target.value === 'true',
                  })
                }
              >
                <MenuItem value="true">True</MenuItem>
                <MenuItem value="false">False</MenuItem>
              </Select>
            </FormControl>
          );
        }
        if (typeof constOp.value === 'string') {
          return (
            <TextField
              value={constOp.value ?? ''}
              onChange={(e) =>
                onChange({
                  ...constOp,
                  value: e.target.value,
                })
              }
              size="small"
              sx={{ width: 120 }}
              disabled={readOnly}
              placeholder="Value"
            />
          );
        }
        // Default: number input
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
            disabled={readOnly}
            slotProps={{
              htmlInput: { step: 'any' }
            }}
          />
        );
      }

      case OperandType.Indicator: {
        const indOp = value as IndicatorOperand;
        const selectedInd = indicators.find((i) => i.id === indOp.indicatorId);
        const meta = selectedInd ? INDICATORS[selectedInd.type] : null;

        return (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 120 }} disabled={readOnly}>
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
              <FormControl size="small" sx={{ minWidth: 100 }} disabled={readOnly}>
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
              disabled={readOnly}
              slotProps={{
                htmlInput: { min: 0, max: 100 }
              }}
            />
          </Box>
        );
      }

      case OperandType.Price: {
        const priceOp = value as PriceOperand;
        return (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 100 }} disabled={readOnly}>
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
              disabled={readOnly}
              slotProps={{
                htmlInput: { min: 0, max: 100 }
              }}
            />
          </Box>
        );
      }

      case OperandType.TradeContext: {
        const tradeOp = value as TradeContextOperand;
        return (
          <FormControl size="small" sx={{ minWidth: 140 }} disabled={readOnly}>
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
              {(tradeContextFieldsOverride || TRADE_CONTEXT_FIELDS).map((field) => (
                <MenuItem key={field.value} value={field.value}>
                  {field.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      }

      case OperandType.Time: {
        const timeOp = value as TimeOperand;
        return (
          <FormControl size="small" sx={{ minWidth: 140 }} disabled={readOnly}>
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
        onClick={readOnly ? undefined : (e) => setAnchorEl(e.currentTarget)}
        sx={{ cursor: readOnly ? 'default' : 'pointer' }}
        disabled={readOnly}
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
          <ListItemButton onClick={() => handleTypeSelect(OperandType.Constant)}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Functions fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Constant" secondary="Fixed number value" />
          </ListItemButton>

          {indicators.length > 0 && (
            <ListItemButton onClick={() => handleTypeSelect(OperandType.Indicator)}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <ShowChart fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Indicator" secondary="Technical indicator" />
            </ListItemButton>
          )}

          <ListItemButton onClick={() => handleTypeSelect(OperandType.Price)}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <AttachMoney fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Price" secondary="OHLCV data" />
          </ListItemButton>

          <Divider />

          <ListItemButton onClick={() => handleTypeSelect(OperandType.Time)}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <AccessTime fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Time" secondary="Time-based values" />
          </ListItemButton>

          {showTradeContext && (
            <ListItemButton onClick={() => handleTypeSelect(OperandType.TradeContext)}>
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
