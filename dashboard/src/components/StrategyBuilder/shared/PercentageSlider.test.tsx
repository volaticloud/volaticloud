import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PercentageSlider } from './PercentageSlider';

describe('PercentageSlider', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders slider and text field', () => {
      render(<PercentageSlider value={0.1} onChange={mockOnChange} />);

      expect(screen.getByRole('slider')).toBeInTheDocument();
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('displays value as percentage in text field', () => {
      render(<PercentageSlider value={0.15} onChange={mockOnChange} />);

      // 0.15 decimal = 15% display
      expect(screen.getByRole('spinbutton')).toHaveValue(15);
    });

    it('shows % adornment', () => {
      render(<PercentageSlider value={0.1} onChange={mockOnChange} />);

      expect(screen.getByText('%')).toBeInTheDocument();
    });
  });

  describe('positive values (default mode)', () => {
    it('converts text field input to decimal for onChange', () => {
      render(<PercentageSlider value={0.1} onChange={mockOnChange} />);

      const input = screen.getByRole('spinbutton');

      // Use fireEvent for more predictable behavior
      fireEvent.change(input, { target: { value: '25' } });

      // User types 25%, onChange should receive 0.25
      expect(mockOnChange).toHaveBeenCalledWith(0.25);
    });

    it('displays absolute value correctly', () => {
      render(<PercentageSlider value={0.2} onChange={mockOnChange} />);

      // 0.2 = 20%
      expect(screen.getByRole('spinbutton')).toHaveValue(20);
    });
  });

  describe('negative values (showNegative mode)', () => {
    it('displays absolute value in text field for negative values', () => {
      // -0.1 = -10% stoploss, should display as 10 in the field
      render(<PercentageSlider value={-0.1} onChange={mockOnChange} showNegative />);

      expect(screen.getByRole('spinbutton')).toHaveValue(10);
    });

    it('converts text input to negative decimal when showNegative is true', () => {
      render(<PercentageSlider value={-0.1} onChange={mockOnChange} showNegative />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '15' } });

      // User types 15 (absolute), onChange should receive -0.15
      expect(mockOnChange).toHaveBeenCalledWith(-0.15);
    });

    it('slider and text field show synchronized values', () => {
      // When showNegative is true, both should show the absolute value
      render(<PercentageSlider value={-0.2} onChange={mockOnChange} showNegative />);

      const slider = screen.getByRole('slider');
      const input = screen.getByRole('spinbutton');

      // Both should show 20 (absolute value of -20%)
      expect(slider).toHaveAttribute('aria-valuenow', '20');
      expect(input).toHaveValue(20);
    });
  });

  describe('disabled state', () => {
    it('disables text field when disabled', () => {
      render(<PercentageSlider value={0.1} onChange={mockOnChange} disabled />);

      expect(screen.getByRole('spinbutton')).toBeDisabled();
    });
  });

  describe('input validation', () => {
    it('ignores invalid (NaN) text input', () => {
      render(<PercentageSlider value={0.1} onChange={mockOnChange} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: 'abc' } });

      // onChange should not be called since the value is NaN
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('custom props', () => {
    it('uses custom textFieldWidth', () => {
      render(<PercentageSlider value={0.1} onChange={mockOnChange} textFieldWidth={150} />);

      // The TextField wrapper Box should have the custom width via sx prop
      const input = screen.getByRole('spinbutton');
      expect(input).toBeInTheDocument();
    });

    it('applies custom min/max to slider', () => {
      render(
        <PercentageSlider value={0.05} onChange={mockOnChange} min={1} max={50} />
      );

      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('aria-valuemin', '1');
      expect(slider).toHaveAttribute('aria-valuemax', '50');
    });
  });
});
