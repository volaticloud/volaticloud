import { Box, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { useState } from 'react';
import { JSONEditor } from '../JSONEditor';
import EditNoteIcon from '@mui/icons-material/EditNote';
import CodeIcon from '@mui/icons-material/Code';
import { StructuredConfigForm } from './StructuredConfigForm';
import { FreqtradeConfig, mergeWithDefaults } from './defaultConfig';

interface FreqtradeConfigFormProps {
  value: object | null;
  onChange: (config: object) => void;
  onSubmit?: (config: object) => void;
  hideSubmitButton?: boolean;
  submitButtonText?: string;
  readOnly?: boolean;
}

/**
 * Reusable Freqtrade configuration form component
 *
 * Provides two editing modes:
 * - Form mode (default): Structured form with grouped sections for common settings
 * - JSON mode: Full JSON editor for advanced configuration
 *
 * The form automatically applies sensible defaults for all mandatory Freqtrade
 * fields, allowing strategies to run backtests without manual configuration.
 *
 * @example
 * ```tsx
 * const [config, setConfig] = useState(null);
 *
 * <FreqtradeConfigForm
 *   value={config}
 *   onChange={setConfig}
 * />
 * ```
 */
export function FreqtradeConfigForm({
  value,
  onChange,
  readOnly = false,
}: FreqtradeConfigFormProps) {
  // Default to form mode for better UX
  const [mode, setMode] = useState<'form' | 'json'>('form');

  // Merge incoming value with defaults to ensure all mandatory fields are present
  const configWithDefaults = mergeWithDefaults(value as Partial<FreqtradeConfig> | null);

  const handleChange = (newValue: FreqtradeConfig | object | null) => {
    if (newValue) {
      onChange(newValue);
    }
  };

  return (
    <Box>
      {/* Mode Toggle */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_, newMode) => {
            if (newMode) setMode(newMode);
          }}
          size="small"
          aria-label="config editor mode"
        >
          <ToggleButton value="form" aria-label="form mode">
            <EditNoteIcon sx={{ mr: 0.5, fontSize: '1.2rem' }} />
            Form
          </ToggleButton>
          <ToggleButton value="json" aria-label="json mode">
            <CodeIcon sx={{ mr: 0.5, fontSize: '1.2rem' }} />
            JSON
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Form Mode - Structured fields */}
      {mode === 'form' && (
        <StructuredConfigForm
          value={configWithDefaults}
          onChange={handleChange}
          readOnly={readOnly}
        />
      )}

      {/* JSON Mode - Full editor */}
      {mode === 'json' && (
        <JSONEditor
          value={configWithDefaults}
          onChange={(newValue) => {
            if (newValue) {
              handleChange(newValue);
            }
          }}
          height="500px"
          placeholder={`{
  "stake_currency": "USDT",
  "stake_amount": 10,
  "max_open_trades": 3,
  "timeframe": "5m",
  "entry_pricing": {
    "price_side": "other",
    "use_order_book": true,
    "order_book_top": 1
  },
  "exit_pricing": {
    "price_side": "other",
    "use_order_book": true,
    "order_book_top": 1
  },
  "stoploss": -0.10,
  "minimal_roi": {
    "0": 0.1
  }
}`}
        />
      )}
    </Box>
  );
}
