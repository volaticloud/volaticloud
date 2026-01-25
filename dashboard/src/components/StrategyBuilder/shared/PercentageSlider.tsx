import { Box, Slider, TextField, InputAdornment, SliderProps } from '@mui/material';

export interface PercentageSliderProps {
  /** Value as decimal (e.g., 0.1 for 10%) */
  value: number;
  /** Callback with value as decimal */
  onChange: (value: number) => void;
  /** Minimum value as percentage (default: 0) */
  min?: number;
  /** Maximum value as percentage (default: 100) */
  max?: number;
  /** Step value as percentage (default: 0.1) */
  step?: number;
  /** Width of the TextField (default: 100) */
  textFieldWidth?: number;
  /** Whether to show negative values (for stoploss) */
  showNegative?: boolean;
  /** Custom value label format */
  valueLabelFormat?: (value: number) => string;
  /** Custom marks for the slider */
  marks?: SliderProps['marks'];
  /** Whether the field is disabled */
  disabled?: boolean;
}

/**
 * Reusable percentage slider with synchronized TextField.
 *
 * Handles conversion between decimal (internal) and percentage (display).
 *
 * For showNegative mode (e.g., stoploss):
 * - Internal value is stored as negative decimal (e.g., -0.10 for -10%)
 * - Both slider and TextField display the ABSOLUTE percentage value (e.g., 10)
 * - Slider label shows the negative sign (e.g., "-10%")
 * - Moving slider right = larger absolute loss = more negative internal value
 */
export function PercentageSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 0.1,
  textFieldWidth = 100,
  showNegative = false,
  valueLabelFormat,
  marks,
  disabled = false,
}: PercentageSliderProps) {
  // Convert decimal to percentage for display (always positive for slider/text)
  const displayValue = Math.abs(value) * 100;

  // Handle slider change - apply negation for showNegative mode
  const handleSliderChange = (_: Event, newValue: number | number[]) => {
    const percentValue = newValue as number;
    const decimalValue = showNegative ? -(percentValue / 100) : percentValue / 100;
    onChange(decimalValue);
  };

  // Handle text field change - user enters absolute value, we apply sign
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const textValue = parseFloat(e.target.value);
    if (!isNaN(textValue)) {
      // For showNegative, negate the absolute value entered by user
      const decimalValue = showNegative ? -(textValue / 100) : textValue / 100;
      onChange(decimalValue);
    }
  };

  // Default value label format - adds negative sign for showNegative mode
  const defaultFormat = (v: number) => (showNegative ? `-${v}%` : `${v}%`);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Slider
        value={displayValue}
        onChange={handleSliderChange}
        min={min}
        max={max}
        step={step}
        sx={{ flex: 1 }}
        valueLabelDisplay="auto"
        valueLabelFormat={valueLabelFormat || defaultFormat}
        marks={marks}
        disabled={disabled}
      />
      <TextField
        type="number"
        value={displayValue.toFixed(1)}
        onChange={handleTextChange}
        size="small"
        sx={{ width: textFieldWidth }}
        disabled={disabled}
        slotProps={{
          input: {
            endAdornment: <InputAdornment position="end">%</InputAdornment>,
          },
          htmlInput: {
            min,
            max,
            step,
          },
        }}
      />
    </Box>
  );
}

export default PercentageSlider;
