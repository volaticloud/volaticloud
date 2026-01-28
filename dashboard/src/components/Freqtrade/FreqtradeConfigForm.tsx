import { Box, ToggleButtonGroup, ToggleButton, Button } from '@mui/material';
import { useState } from 'react';
import { JSONEditor } from '../JSONEditor';
import EditNoteIcon from '@mui/icons-material/EditNote';
import CodeIcon from '@mui/icons-material/Code';
import SettingsIcon from '@mui/icons-material/Settings';
import { StructuredConfigForm } from './StructuredConfigForm';
import { FreqtradeConfig, mergeWithDefaults, ConfigSection, ALL_SECTIONS } from './defaultConfig';

interface FreqtradeConfigFormProps {
  value: object | null;
  onChange: (config: object) => void;
  onSubmit?: (config: object) => void;
  hideSubmitButton?: boolean;
  submitButtonText?: string;
  readOnly?: boolean;
  /**
   * Sections to show by default in form mode. If not provided, shows all sections.
   * Use this to show only relevant sections for different contexts (strategy vs bot).
   *
   * @example
   * // For strategy creation - show basic and risk settings
   * defaultSections={['basic', 'risk']}
   *
   * // For bot creation - show all settings
   * defaultSections={['basic', 'pricing', 'risk']}
   */
  defaultSections?: ConfigSection[];
  /** Whether to show the "Advanced Settings" toggle. Defaults to true. */
  showExtendedToggle?: boolean;
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
  defaultSections,
  showExtendedToggle = true,
}: FreqtradeConfigFormProps) {
  // Default to form mode for better UX
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [extendedMode, setExtendedMode] = useState(false);

  // Merge incoming value with defaults to ensure all mandatory fields are present
  const configWithDefaults = mergeWithDefaults(value as Partial<FreqtradeConfig> | null);

  // Determine if we should show the extended toggle
  const hasDefaultSections = defaultSections && defaultSections.length < ALL_SECTIONS.length;
  const shouldShowExtendedToggle = showExtendedToggle && hasDefaultSections && mode === 'form';

  const handleChange = (newValue: FreqtradeConfig | object | null) => {
    if (newValue) {
      onChange(newValue);
    }
  };

  return (
    <Box>
      {/* Mode Toggle Row */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        {/* Advanced Settings Toggle - Left side */}
        <Box>
          {shouldShowExtendedToggle && (
            <Button
              size="small"
              startIcon={<SettingsIcon />}
              onClick={() => setExtendedMode(!extendedMode)}
              color={extendedMode ? 'primary' : 'inherit'}
              sx={{ textTransform: 'none' }}
            >
              {extendedMode ? 'Show Less' : 'Advanced Settings'}
            </Button>
          )}
        </Box>

        {/* Form/JSON Toggle - Right side */}
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
          defaultSections={defaultSections}
          extendedMode={extendedMode}
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
