import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { OperandEditor } from './OperandEditor';
import {
  getTradeContextFieldMeta,
  shouldShowOperator,
  getDefaultConstantForField,
  TRADE_CONTEXT_FIELDS,
} from './tradeContextFields';
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

  describe('Field Metadata Helper Functions', () => {
    describe('getTradeContextFieldMeta', () => {
      it('returns metadata for number field', () => {
        const meta = getTradeContextFieldMeta('current_profit');
        expect(meta).toBeDefined();
        expect(meta?.valueType).toBe('number');
        expect(meta?.label).toBe('Current Profit');
      });

      it('returns metadata for boolean field', () => {
        const meta = getTradeContextFieldMeta('is_short');
        expect(meta).toBeDefined();
        expect(meta?.valueType).toBe('boolean');
        expect(meta?.showOperator).toBe(false);
      });

      it('returns metadata for enum field with options', () => {
        const meta = getTradeContextFieldMeta('side');
        expect(meta).toBeDefined();
        expect(meta?.valueType).toBe('enum');
        expect(meta?.enumOptions).toHaveLength(2);
        expect(meta?.enumOptions?.[0].value).toBe('long');
        expect(meta?.enumOptions?.[1].value).toBe('short');
      });

      it('returns metadata for string field', () => {
        const meta = getTradeContextFieldMeta('pair');
        expect(meta).toBeDefined();
        expect(meta?.valueType).toBe('string');
      });

      it('returns undefined for unknown field', () => {
        const meta = getTradeContextFieldMeta('unknown_field');
        expect(meta).toBeUndefined();
      });
    });

    describe('shouldShowOperator', () => {
      it('returns false for boolean fields', () => {
        expect(shouldShowOperator('is_short')).toBe(false);
      });

      it('returns true for number fields', () => {
        expect(shouldShowOperator('current_profit')).toBe(true);
        expect(shouldShowOperator('stake_amount')).toBe(true);
      });

      it('returns true for enum fields', () => {
        expect(shouldShowOperator('side')).toBe(true);
      });

      it('returns true for string fields', () => {
        expect(shouldShowOperator('pair')).toBe(true);
      });

      it('returns true for unknown fields (default)', () => {
        expect(shouldShowOperator('unknown_field')).toBe(true);
      });
    });

    describe('getDefaultConstantForField', () => {
      it('returns true for boolean fields', () => {
        expect(getDefaultConstantForField('is_short')).toBe(true);
      });

      it('returns 0 for number fields', () => {
        expect(getDefaultConstantForField('current_profit')).toBe(0);
        expect(getDefaultConstantForField('stake_amount')).toBe(0);
      });

      it('returns first enum option for enum fields', () => {
        expect(getDefaultConstantForField('side')).toBe('long');
      });

      it('returns empty string for string fields', () => {
        expect(getDefaultConstantForField('pair')).toBe('');
      });

      it('returns 0 for unknown fields (default)', () => {
        expect(getDefaultConstantForField('unknown_field')).toBe(0);
      });
    });

    describe('TRADE_CONTEXT_FIELDS', () => {
      it('contains all expected field types', () => {
        const valueTypes = TRADE_CONTEXT_FIELDS.map(f => f.valueType);
        expect(valueTypes).toContain('number');
        expect(valueTypes).toContain('boolean');
        expect(valueTypes).toContain('enum');
        expect(valueTypes).toContain('string');
      });

      it('has unique field values', () => {
        const fieldValues = TRADE_CONTEXT_FIELDS.map(f => f.value);
        const uniqueValues = new Set(fieldValues);
        expect(uniqueValues.size).toBe(fieldValues.length);
      });
    });
  });

  describe('Context-Aware Constant Rendering', () => {
    it('renders boolean dropdown when contextFieldMeta is boolean type', () => {
      const booleanMeta = getTradeContextFieldMeta('is_short')!;
      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={createConstantOperand(true)}
            contextFieldMeta={booleanMeta}
          />
        </TestWrapper>
      );

      // Should show True in a dropdown, not a number input
      expect(screen.getByText('True')).toBeInTheDocument();
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });

    it('renders enum dropdown with options when contextFieldMeta is enum type', async () => {
      const enumMeta = getTradeContextFieldMeta('side')!;
      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={createConstantOperand('long')}
            contextFieldMeta={enumMeta}
          />
        </TestWrapper>
      );

      // Should show Long in a dropdown
      expect(screen.getByText('Long')).toBeInTheDocument();

      // Click to open dropdown and verify options
      fireEvent.mouseDown(screen.getByText('Long'));
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Long' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Short' })).toBeInTheDocument();
      });
    });

    it('renders text input when contextFieldMeta is string type', () => {
      const stringMeta = getTradeContextFieldMeta('pair')!;
      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={createConstantOperand('BTC/USDT')}
            contextFieldMeta={stringMeta}
          />
        </TestWrapper>
      );

      // Should show text input with placeholder
      const input = screen.getByPlaceholderText(/trading pair/i);
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('BTC/USDT');
    });

    it('renders number input when contextFieldMeta is number type', () => {
      const numberMeta = getTradeContextFieldMeta('current_profit')!;
      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={createConstantOperand(0.05)}
            contextFieldMeta={numberMeta}
          />
        </TestWrapper>
      );

      // Should show number input
      const input = screen.getByRole('spinbutton');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue(0.05);
    });

    it('updates boolean value when changed', async () => {
      const onChange = vi.fn();
      const booleanMeta = getTradeContextFieldMeta('is_short')!;
      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={createConstantOperand(true)}
            onChange={onChange}
            contextFieldMeta={booleanMeta}
          />
        </TestWrapper>
      );

      // Click to open dropdown
      fireEvent.mouseDown(screen.getByText('True'));

      // Select False
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'False' })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('option', { name: 'False' }));

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CONSTANT',
          value: false,
        })
      );
    });

    it('updates enum value when changed', async () => {
      const onChange = vi.fn();
      const enumMeta = getTradeContextFieldMeta('side')!;
      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={createConstantOperand('long')}
            onChange={onChange}
            contextFieldMeta={enumMeta}
          />
        </TestWrapper>
      );

      // Click to open dropdown
      fireEvent.mouseDown(screen.getByText('Long'));

      // Select Short
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Short' })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('option', { name: 'Short' }));

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CONSTANT',
          value: 'short',
        })
      );
    });

    it('updates string value when changed', () => {
      const onChange = vi.fn();
      const stringMeta = getTradeContextFieldMeta('pair')!;
      render(
        <TestWrapper>
          <OperandEditor
            {...defaultProps}
            value={createConstantOperand('')}
            onChange={onChange}
            contextFieldMeta={stringMeta}
          />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText(/trading pair/i);
      fireEvent.change(input, { target: { value: 'ETH/USDT' } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CONSTANT',
          value: 'ETH/USDT',
        })
      );
    });
  });
});