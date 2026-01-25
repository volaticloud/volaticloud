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
 * Handles conversion between decimal (internal) and percentage (display).
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
  // Convert decimal to percentage for display
  const displayValue = showNegative ? Math.abs(value) * 100 : value * 100;

  // Handle slider change
  const handleSliderChange = (_: Event, newValue: number | number[]) => {
    const percentValue = newValue as number;
    const decimalValue = showNegative ? -(percentValue / 100) : percentValue / 100;
    onChange(decimalValue);
  };

  // Handle text field change
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const textValue = parseFloat(e.target.value);
    if (!isNaN(textValue)) {
      const decimalValue = textValue / 100;
      onChange(decimalValue);
    }
  };

  // Default value label format
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
        value={showNegative ? (value * 100).toFixed(1) : displayValue.toFixed(1)}
        onChange={handleTextChange}
        size="small"
        sx={{ width: textFieldWidth }}
        disabled={disabled}
        slotProps={{
          input: {
            endAdornment: <InputAdornment position="end">%</InputAdornment>,
          },
          htmlInput: {
            min: showNegative ? -max : min,
            max: showNegative ? -min : max,
            step,
          },
        }}
      />
    </Box>
  );
}

export default PercentageSlider;
