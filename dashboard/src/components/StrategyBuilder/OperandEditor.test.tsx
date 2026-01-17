import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { OperandEditor } from './OperandEditor';
import {
  createConstantOperand,
  createIndicatorOperand,
  createPriceOperand,
  IndicatorDefinition,
  Operand,
  TradeContextOperand,
  TimeOperand,
} from './types';

// MUI Theme wrapper for components
const theme = createTheme();
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

// Sample indicators for testing
const mockIndicators: IndicatorDefinition[] = [
  {
    id: 'rsi_1',
    type: 'RSI',
    params: { period: 14 },
    label: 'RSI (14)',
  },
  {
    id: 'macd_1',
    type: 'MACD',
    params: { fast: 12, slow: 26, signal: 9 },
    label: 'MACD',
  },
  {
    id: 'bb_1',
    type: 'BB',
    params: { period: 20, std_dev: 2 },
    label: 'Bollinger Bands',
  },
];

describe('OperandEditor', () => {
  const defaultProps = {
    value: createConstantOperand(0),
    onChange: vi.fn(),
    indicators: mockIndicators,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Constant Operand', () => {
    it('renders constant operand with input field', () => {
      render(
        <TestWrapper>
          <OperandEditor {...defaultProps} value={createConstantOperand(42)} />
        </TestWrapper>
      );

      // Should show CONSTANT chip
      expect(screen.getByText('CONSTANT')).toBeInTheDocument();

      // Should have number input with value
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(42);
    });

    it('updates constant value on change', async () => {
      const onChange = vi.fn();
      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={createConstantOperand(30)}
            onChange={onChange}
          />
        </TestWrapper>
      );

      const input = screen.getByRole('spinbutton');
      // Use fireEvent for more predictable behavior
      fireEvent.change(input, { target: { value: '50' } });

      expect(onChange).toHaveBeenCalled();
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(lastCall.type).toBe('CONSTANT');
      expect(lastCall.value).toBe(50);
    });

    it('handles decimal values', async () => {
      const onChange = vi.fn();
      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={createConstantOperand(0)}
            onChange={onChange}
          />
        </TestWrapper>
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '0.5' } });

      expect(onChange).toHaveBeenCalled();
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(lastCall.value).toBe(0.5);
    });
  });

  describe('Indicator Operand', () => {
    it('renders indicator operand with selector', () => {
      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={createIndicatorOperand('rsi_1')}
          />
        </TestWrapper>
      );

      expect(screen.getByText('INDICATOR')).toBeInTheDocument();
      // Check for indicator label and selected value (label appears in both label and legend elements)
      expect(screen.getAllByText('Indicator').length).toBeGreaterThan(0);
      expect(screen.getByText('RSI (14)')).toBeInTheDocument();
    });

    it('shows offset input for indicator', () => {
      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={createIndicatorOperand('rsi_1', undefined, 1)}
          />
        </TestWrapper>
      );

      expect(screen.getByLabelText('Offset')).toBeInTheDocument();
      expect(screen.getByLabelText('Offset')).toHaveValue(1);
    });

    it('calls onChange when indicator changes', async () => {
      const onChange = vi.fn();
      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={createIndicatorOperand('rsi_1')}
            onChange={onChange}
          />
        </TestWrapper>
      );

      // Change offset value
      const offsetInput = screen.getByLabelText('Offset');
      await userEvent.clear(offsetInput);
      await userEvent.type(offsetInput, '2');

      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('Price Operand', () => {
    it('renders price operand with field selector', () => {
      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={createPriceOperand('close')}
          />
        </TestWrapper>
      );

      expect(screen.getByText('PRICE')).toBeInTheDocument();
      // Check that price label is present (appears in label and legend)
      expect(screen.getAllByText('Price').length).toBeGreaterThan(0);
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('shows offset input for price', () => {
      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={createPriceOperand('high', 1)}
          />
        </TestWrapper>
      );

      expect(screen.getByLabelText('Offset')).toHaveValue(1);
    });
  });

  describe('Trade Context Operand', () => {
    it('renders trade context operand with field selector', () => {
      const tradeOp: TradeContextOperand = {
        type: 'TRADE_CONTEXT',
        field: 'current_profit',
      };

      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={tradeOp}
            showTradeContext={true}
          />
        </TestWrapper>
      );

      expect(screen.getByText('TRADE CONTEXT')).toBeInTheDocument();
      // Check that trade field is present (appears in label and legend)
      expect(screen.getAllByText('Trade Field').length).toBeGreaterThan(0);
      expect(screen.getByText('Current Profit')).toBeInTheDocument();
    });

    it('updates trade context field on change', async () => {
      const onChange = vi.fn();
      const tradeOp: TradeContextOperand = {
        type: 'TRADE_CONTEXT',
        field: 'current_profit',
      };

      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={tradeOp}
            onChange={onChange}
            showTradeContext={true}
          />
        </TestWrapper>
      );

      // Open the select by clicking the Current Profit value
      const selectValue = screen.getByText('Current Profit');
      fireEvent.mouseDown(selectValue);

      // Wait for menu to appear and click an option
      await waitFor(() => {
        expect(screen.getByText('Entry Price')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Entry Price'));

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TRADE_CONTEXT',
          field: 'entry_rate',
        })
      );
    });
  });

  describe('Time Operand', () => {
    it('renders time operand with field selector', () => {
      const timeOp: TimeOperand = {
        type: 'TIME',
        field: 'hour',
      };

      render(
        <TestWrapper>
          <OperandEditor {...defaultProps} value={timeOp} />
        </TestWrapper>
      );

      expect(screen.getByText('TIME')).toBeInTheDocument();
      // Check that time field is present and shows hour value
      expect(screen.getAllByText('Time Field').length).toBeGreaterThan(0);
      expect(screen.getByText('Hour (0-23)')).toBeInTheDocument();
    });
  });

  describe('Type Selector', () => {
    it('opens type selector popover on chip click', async () => {
      render(
        <TestWrapper>
          <OperandEditor {...defaultProps} value={createConstantOperand(0)} />
        </TestWrapper>
      );

      // Click on the type chip
      const chip = screen.getByText('CONSTANT');
      await userEvent.click(chip);

      // Popover should open with type options
      await waitFor(() => {
        expect(screen.getByText('Constant')).toBeInTheDocument();
        expect(screen.getByText('Price')).toBeInTheDocument();
        expect(screen.getByText('Time')).toBeInTheDocument();
      });
    });

    it('shows Indicator option when indicators are available', async () => {
      render(
        <TestWrapper>
          <OperandEditor {...defaultProps} value={createConstantOperand(0)} />
        </TestWrapper>
      );

      const chip = screen.getByText('CONSTANT');
      await userEvent.click(chip);

      await waitFor(() => {
        expect(screen.getByText('Indicator')).toBeInTheDocument();
      });
    });

    it('hides Indicator option when no indicators available', async () => {
      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            indicators={[]}
            value={createConstantOperand(0)}
          />
        </TestWrapper>
      );

      const chip = screen.getByText('CONSTANT');
      await userEvent.click(chip);

      await waitFor(() => {
        // Indicator option should not be present
        expect(screen.queryByText('Technical indicator')).not.toBeInTheDocument();
      });
    });

    it('shows Trade Context option when showTradeContext is true', async () => {
      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={createConstantOperand(0)}
            showTradeContext={true}
          />
        </TestWrapper>
      );

      const chip = screen.getByText('CONSTANT');
      await userEvent.click(chip);

      await waitFor(() => {
        expect(screen.getByText('Trade Context')).toBeInTheDocument();
      });
    });

    it('hides Trade Context option when showTradeContext is false', async () => {
      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={createConstantOperand(0)}
            showTradeContext={false}
          />
        </TestWrapper>
      );

      const chip = screen.getByText('CONSTANT');
      await userEvent.click(chip);

      await waitFor(() => {
        expect(screen.queryByText('Trade Context')).not.toBeInTheDocument();
      });
    });

    it('changes operand type when type is selected', async () => {
      const onChange = vi.fn();
      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={createConstantOperand(0)}
            onChange={onChange}
          />
        </TestWrapper>
      );

      // Open type selector
      const chip = screen.getByText('CONSTANT');
      await userEvent.click(chip);

      // Select Price type
      await waitFor(() => {
        expect(screen.getByText('Price')).toBeInTheDocument();
      });
      await userEvent.click(screen.getByText('Price'));

      // Should call onChange with PRICE operand
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PRICE',
          field: 'close',
        })
      );
    });

    it('changes to Indicator type with first indicator', async () => {
      const onChange = vi.fn();
      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={createConstantOperand(0)}
            onChange={onChange}
          />
        </TestWrapper>
      );

      // Open type selector
      const chip = screen.getByText('CONSTANT');
      await userEvent.click(chip);

      // Select Indicator type
      await waitFor(() => {
        expect(screen.getByText('Indicator')).toBeInTheDocument();
      });
      await userEvent.click(screen.getByText('Indicator'));

      // Should call onChange with first indicator
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INDICATOR',
          indicatorId: 'rsi_1',
        })
      );
    });
  });

  describe('Label', () => {
    it('renders label when provided', () => {
      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={createConstantOperand(0)}
            label="Left"
          />
        </TestWrapper>
      );

      expect(screen.getByText('Left')).toBeInTheDocument();
    });

    it('does not render label when not provided', () => {
      render(
        <TestWrapper>
          <OperandEditor {...defaultProps} value={createConstantOperand(0)} />
        </TestWrapper>
      );

      expect(screen.queryByText('Left')).not.toBeInTheDocument();
      expect(screen.queryByText('Right')).not.toBeInTheDocument();
    });
  });

  describe('Unsupported Operand Types', () => {
    it('shows message for unsupported operand type', () => {
      const customOperand: Operand = {
        type: 'CUSTOM' as any,
        pluginId: 'test',
        config: {},
      };

      render(
        <TestWrapper>
          <OperandEditor {...defaultProps} value={customOperand} />
        </TestWrapper>
      );

      expect(screen.getByText(/not supported yet/i)).toBeInTheDocument();
    });
  });
});