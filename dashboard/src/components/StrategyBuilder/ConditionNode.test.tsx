import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ConditionNodeEditor } from './ConditionNode';
import {
  createAndNode,
  createOrNode,
  createNotNode,
  createCompareNode,
  createConstantOperand,
  createIndicatorOperand,
  createCrossoverNode,
  createCrossunderNode,
  IndicatorDefinition,
  ConditionNode,
  IfThenElseNode,
  createId,
  OperandType,
  TradeContextOperand,
} from './types';
import { ComparisonOperator } from '../../generated/types';

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
    id: 'ema_fast',
    type: 'EMA',
    params: { period: 10 },
    label: 'EMA Fast',
  },
  {
    id: 'ema_slow',
    type: 'EMA',
    params: { period: 20 },
    label: 'EMA Slow',
  },
];

describe('ConditionNodeEditor', () => {
  const defaultProps = {
    onChange: vi.fn(),
    indicators: mockIndicators,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AND/OR Group Node', () => {
    it('renders AND group with correct label', () => {
      const andNode = createAndNode([]);
      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={andNode} />
        </TestWrapper>
      );

      expect(screen.getByText('AND')).toBeInTheDocument();
      expect(screen.getByText('Empty group')).toBeInTheDocument();
    });

    it('renders OR group with correct label', () => {
      const orNode = createOrNode([]);
      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={orNode} />
        </TestWrapper>
      );

      expect(screen.getByText('OR')).toBeInTheDocument();
    });

    it('shows condition count for non-empty group', () => {
      const compareNode = createCompareNode(
        createConstantOperand(1),
        ComparisonOperator.Gt,
        createConstantOperand(0)
      );
      const andNode = createAndNode([compareNode]);

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={andNode} />
        </TestWrapper>
      );

      expect(screen.getByText('1 condition')).toBeInTheDocument();
    });

    it('shows plural for multiple conditions', () => {
      const compareNode1 = createCompareNode(
        createConstantOperand(1),
        ComparisonOperator.Gt,
        createConstantOperand(0)
      );
      const compareNode2 = createCompareNode(
        createConstantOperand(2),
        ComparisonOperator.Lt,
        createConstantOperand(5)
      );
      const andNode = createAndNode([compareNode1, compareNode2]);

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={andNode} />
        </TestWrapper>
      );

      expect(screen.getByText('2 conditions')).toBeInTheDocument();
    });

    it('adds condition when clicking Add Condition button', async () => {
      const onChange = vi.fn();
      const andNode = createAndNode([]);

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={andNode} onChange={onChange} />
        </TestWrapper>
      );

      const addButton = screen.getByRole('button', { name: /condition/i });
      await userEvent.click(addButton);

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'AND',
          children: expect.arrayContaining([
            expect.objectContaining({ type: 'COMPARE' }),
          ]),
        })
      );
    });

    it('adds nested group when clicking Add Group button', async () => {
      const onChange = vi.fn();
      const andNode = createAndNode([]);

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={andNode} onChange={onChange} />
        </TestWrapper>
      );

      const addGroupButton = screen.getByRole('button', { name: /group/i });
      await userEvent.click(addGroupButton);

      // AND group should add OR subgroup
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'AND',
          children: expect.arrayContaining([
            expect.objectContaining({ type: 'OR' }),
          ]),
        })
      );
    });

    it('shows Crossover/Crossunder buttons when 2+ indicators', () => {
      const andNode = createAndNode([]);

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={andNode} />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /crossover/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /crossunder/i })).toBeInTheDocument();
    });

    it('hides Crossover/Crossunder buttons when fewer than 2 indicators', () => {
      const andNode = createAndNode([]);

      render(
        <TestWrapper>
          <ConditionNodeEditor
            {...defaultProps}
            node={andNode}
            indicators={[mockIndicators[0]]}
          />
        </TestWrapper>
      );

      expect(screen.queryByRole('button', { name: /crossover/i })).not.toBeInTheDocument();
    });
  });

  describe('NOT Node', () => {
    it('renders NOT node with child', () => {
      const compareNode = createCompareNode(
        createConstantOperand(1),
        ComparisonOperator.Gt,
        createConstantOperand(0)
      );
      const notNode = createNotNode(compareNode);

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={notNode} />
        </TestWrapper>
      );

      expect(screen.getByText('NOT')).toBeInTheDocument();
      // Child compare node should be rendered (has both left and right CONSTANT operands)
      expect(screen.getAllByText('CONSTANT').length).toBeGreaterThan(0);
    });

    it('unwraps NOT when selecting Remove NOT option', async () => {
      const onChange = vi.fn();
      const compareNode = createCompareNode(
        createConstantOperand(1),
        ComparisonOperator.Gt,
        createConstantOperand(0)
      );
      const notNode = createNotNode(compareNode);

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={notNode} onChange={onChange} />
        </TestWrapper>
      );

      // Open context menu
      const menuButton = screen.getAllByRole('button').find(
        (btn) => btn.querySelector('[data-testid="MoreVertIcon"]')
      );
      await userEvent.click(menuButton!);

      // Click Remove NOT
      await waitFor(() => {
        expect(screen.getByText(/remove not/i)).toBeInTheDocument();
      });
      await userEvent.click(screen.getByText(/remove not/i));

      // Should call onChange with the child node (unwrapped)
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'COMPARE' })
      );
    });
  });

  describe('COMPARE Node', () => {
    it('renders compare node with left operand, operator, and right operand', () => {
      const compareNode = createCompareNode(
        createIndicatorOperand('rsi_1'),
        ComparisonOperator.Lt,
        createConstantOperand(30)
      );

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={compareNode} />
        </TestWrapper>
      );

      expect(screen.getByText('INDICATOR')).toBeInTheDocument();
      expect(screen.getByText('CONSTANT')).toBeInTheDocument();
      // Operator selector should be present
      expect(screen.getByText('<')).toBeInTheDocument();
    });

    it('opens context menu with wrap options', async () => {
      const compareNode = createCompareNode(
        createConstantOperand(1),
        ComparisonOperator.Gt,
        createConstantOperand(0)
      );

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={compareNode} />
        </TestWrapper>
      );

      // Open context menu
      const menuButton = screen.getByRole('button', { name: '' });
      await userEvent.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText(/wrap in not/i)).toBeInTheDocument();
        expect(screen.getByText(/wrap in if/i)).toBeInTheDocument();
      });
    });

    it('wraps in NOT when selecting Wrap in NOT', async () => {
      const onChange = vi.fn();
      const compareNode = createCompareNode(
        createConstantOperand(1),
        ComparisonOperator.Gt,
        createConstantOperand(0)
      );

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={compareNode} onChange={onChange} />
        </TestWrapper>
      );

      // Open context menu
      const menuButton = screen.getByRole('button', { name: '' });
      await userEvent.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText(/wrap in not/i)).toBeInTheDocument();
      });
      await userEvent.click(screen.getByText(/wrap in not/i));

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'NOT',
          child: expect.objectContaining({ type: 'COMPARE' }),
        })
      );
    });
  });

  describe('CROSSOVER Node', () => {
    it('renders crossover node with series operands', () => {
      const crossoverNode = createCrossoverNode(
        createIndicatorOperand('ema_fast'),
        createIndicatorOperand('ema_slow')
      );

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={crossoverNode} />
        </TestWrapper>
      );

      expect(screen.getByText('crosses above')).toBeInTheDocument();
      // Both operand editors should show INDICATOR
      const indicatorChips = screen.getAllByText('INDICATOR');
      expect(indicatorChips.length).toBe(2);
    });

    it('can convert to crossunder', async () => {
      const onChange = vi.fn();
      const crossoverNode = createCrossoverNode(
        createIndicatorOperand('ema_fast'),
        createIndicatorOperand('ema_slow')
      );

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={crossoverNode} onChange={onChange} />
        </TestWrapper>
      );

      // Open context menu
      const menuButton = screen.getAllByRole('button').find(
        (btn) => btn.querySelector('[data-testid="MoreVertIcon"]')
      );
      await userEvent.click(menuButton!);

      await waitFor(() => {
        expect(screen.getByText(/change to crossunder/i)).toBeInTheDocument();
      });
      await userEvent.click(screen.getByText(/change to crossunder/i));

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'CROSSUNDER' })
      );
    });
  });

  describe('CROSSUNDER Node', () => {
    it('renders crossunder node with series operands', () => {
      const crossunderNode = createCrossunderNode(
        createIndicatorOperand('ema_fast'),
        createIndicatorOperand('ema_slow')
      );

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={crossunderNode} />
        </TestWrapper>
      );

      expect(screen.getByText('crosses below')).toBeInTheDocument();
    });

    it('can convert to crossover', async () => {
      const onChange = vi.fn();
      const crossunderNode = createCrossunderNode(
        createIndicatorOperand('ema_fast'),
        createIndicatorOperand('ema_slow')
      );

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={crossunderNode} onChange={onChange} />
        </TestWrapper>
      );

      // Open context menu
      const menuButton = screen.getAllByRole('button').find(
        (btn) => btn.querySelector('[data-testid="MoreVertIcon"]')
      );
      await userEvent.click(menuButton!);

      await waitFor(() => {
        expect(screen.getByText(/change to crossover/i)).toBeInTheDocument();
      });
      await userEvent.click(screen.getByText(/change to crossover/i));

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'CROSSOVER' })
      );
    });
  });

  describe('IF-THEN-ELSE Node', () => {
    it('renders IF-THEN-ELSE structure', () => {
      const ifNode: IfThenElseNode = {
        id: createId(),
        type: 'IF_THEN_ELSE',
        condition: createCompareNode(
          createConstantOperand(1),
          ComparisonOperator.Gt,
          createConstantOperand(0)
        ),
        then: createAndNode([]),
      };

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={ifNode} />
        </TestWrapper>
      );

      expect(screen.getByText('IF')).toBeInTheDocument();
      expect(screen.getByText('THEN')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add else/i })).toBeInTheDocument();
    });

    it('shows ELSE branch when present', () => {
      const ifNode: IfThenElseNode = {
        id: createId(),
        type: 'IF_THEN_ELSE',
        condition: createCompareNode(
          createConstantOperand(1),
          ComparisonOperator.Gt,
          createConstantOperand(0)
        ),
        then: createAndNode([]),
        else: createOrNode([]),
      };

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={ifNode} />
        </TestWrapper>
      );

      expect(screen.getByText('IF')).toBeInTheDocument();
      expect(screen.getByText('THEN')).toBeInTheDocument();
      expect(screen.getByText('ELSE')).toBeInTheDocument();
    });

    it('adds ELSE branch when clicking Add ELSE', async () => {
      const onChange = vi.fn();
      const ifNode: IfThenElseNode = {
        id: createId(),
        type: 'IF_THEN_ELSE',
        condition: createCompareNode(
          createConstantOperand(1),
          ComparisonOperator.Gt,
          createConstantOperand(0)
        ),
        then: createAndNode([]),
      };

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={ifNode} onChange={onChange} />
        </TestWrapper>
      );

      const addElseButton = screen.getByRole('button', { name: /add else/i });
      await userEvent.click(addElseButton);

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'IF_THEN_ELSE',
          else: expect.objectContaining({ type: 'AND' }),
        })
      );
    });
  });

  describe('Disabled State', () => {
    it('shows disabled indicator and reduces opacity', () => {
      const andNode = { ...createAndNode([]), disabled: true };

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={andNode} />
        </TestWrapper>
      );

      // Check for disabled icon
      expect(screen.getByTestId('VisibilityOffIcon')).toBeInTheDocument();
    });

    it('toggles disabled state via menu', async () => {
      const onChange = vi.fn();
      const compareNode = createCompareNode(
        createConstantOperand(1),
        ComparisonOperator.Gt,
        createConstantOperand(0)
      );

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={compareNode} onChange={onChange} />
        </TestWrapper>
      );

      // Open context menu
      const menuButton = screen.getByRole('button', { name: '' });
      await userEvent.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText(/disable/i)).toBeInTheDocument();
      });
      await userEvent.click(screen.getByText(/disable/i));

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ disabled: true })
      );
    });
  });

  describe('Collapse/Expand', () => {
    it('collapses group when clicking expand icon', async () => {
      const compareNode = createCompareNode(
        createConstantOperand(1),
        ComparisonOperator.Gt,
        createConstantOperand(0)
      );
      const andNode = createAndNode([compareNode]);

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={andNode} />
        </TestWrapper>
      );

      // Children should be visible initially (compare node has left and right CONSTANT operands)
      expect(screen.getAllByText('CONSTANT').length).toBeGreaterThan(0);

      // Click collapse button (ExpandLess icon)
      const collapseButton = screen.getByTestId('ExpandLessIcon').parentElement;
      await userEvent.click(collapseButton!);

      // After collapse, the add buttons should not be visible
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /condition/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Delete', () => {
    it('shows delete option when onDelete is provided', async () => {
      const onDelete = vi.fn();
      const compareNode = createCompareNode(
        createConstantOperand(1),
        ComparisonOperator.Gt,
        createConstantOperand(0)
      );

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={compareNode} onDelete={onDelete} />
        </TestWrapper>
      );

      // Open context menu
      const menuButton = screen.getByRole('button', { name: '' });
      await userEvent.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });
    });

    it('calls onDelete when delete is clicked', async () => {
      const onDelete = vi.fn();
      const compareNode = createCompareNode(
        createConstantOperand(1),
        ComparisonOperator.Gt,
        createConstantOperand(0)
      );

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={compareNode} onDelete={onDelete} />
        </TestWrapper>
      );

      // Open context menu
      const menuButton = screen.getByRole('button', { name: '' });
      await userEvent.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });
      await userEvent.click(screen.getByText('Delete'));

      expect(onDelete).toHaveBeenCalled();
    });

    it('hides delete option when onDelete is not provided', async () => {
      const compareNode = createCompareNode(
        createConstantOperand(1),
        ComparisonOperator.Gt,
        createConstantOperand(0)
      );

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={compareNode} />
        </TestWrapper>
      );

      // Open context menu
      const menuButton = screen.getByRole('button', { name: '' });
      await userEvent.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText(/wrap in not/i)).toBeInTheDocument();
      });
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    });
  });

  describe('Unknown Node Type', () => {
    it('renders fallback for unknown node type', () => {
      const unknownNode = {
        id: 'unknown_1',
        type: 'UNKNOWN_TYPE',
      } as unknown as ConditionNode;

      render(
        <TestWrapper>
          <ConditionNodeEditor {...defaultProps} node={unknownNode} />
        </TestWrapper>
      );

      expect(screen.getByText(/unknown node type/i)).toBeInTheDocument();
    });
  });

  describe('Smart TradeContext Field Handling', () => {
    describe('Boolean field (is_short)', () => {
      it('hides comparison operator for boolean TradeContext field', () => {
        const isShortOperand: TradeContextOperand = {
          type: OperandType.TradeContext,
          field: 'is_short',
        };
        const compareNode = createCompareNode(
          isShortOperand,
          ComparisonOperator.Eq,
          createConstantOperand(true)
        );

        render(
          <TestWrapper>
            <ConditionNodeEditor
              {...defaultProps}
              node={compareNode}
              showTradeContext={true}
            />
          </TestWrapper>
        );

        // Should show TRADE CONTEXT and the constant value
        expect(screen.getByText('TRADE CONTEXT')).toBeInTheDocument();
        expect(screen.getByText('CONSTANT')).toBeInTheDocument();

        // Should NOT show the comparison operator dropdown
        // Boolean fields have operator hidden
        const comboboxes = screen.getAllByRole('combobox');
        // There should be 3 comboboxes: Trade Field, Constant value (True/False)
        // NOT 4 (which would include the operator dropdown)
        const operatorValues = ['=', '≠', '<', '>', '≤', '≥'];
        const hasOperatorDropdown = comboboxes.some(cb => {
          const value = cb.textContent || '';
          return operatorValues.includes(value);
        });
        expect(hasOperatorDropdown).toBe(false);
      });

      it('shows True/False dropdown for boolean constant value', () => {
        const isShortOperand: TradeContextOperand = {
          type: OperandType.TradeContext,
          field: 'is_short',
        };
        const compareNode = createCompareNode(
          isShortOperand,
          ComparisonOperator.Eq,
          createConstantOperand(true)
        );

        render(
          <TestWrapper>
            <ConditionNodeEditor
              {...defaultProps}
              node={compareNode}
              showTradeContext={true}
            />
          </TestWrapper>
        );

        // Should show True as the selected value
        expect(screen.getByText('True')).toBeInTheDocument();
      });
    });

    describe('Enum field (side)', () => {
      it('shows comparison operator for enum TradeContext field', () => {
        const sideOperand: TradeContextOperand = {
          type: OperandType.TradeContext,
          field: 'side',
        };
        const compareNode = createCompareNode(
          sideOperand,
          ComparisonOperator.Eq,
          createConstantOperand('long')
        );

        render(
          <TestWrapper>
            <ConditionNodeEditor
              {...defaultProps}
              node={compareNode}
              showTradeContext={true}
            />
          </TestWrapper>
        );

        // Should show TRADE CONTEXT
        expect(screen.getByText('TRADE CONTEXT')).toBeInTheDocument();

        // Should show the = operator (enum fields show limited operators)
        expect(screen.getByText('=')).toBeInTheDocument();
      });

      it('shows Long/Short dropdown for side enum value', async () => {
        const sideOperand: TradeContextOperand = {
          type: OperandType.TradeContext,
          field: 'side',
        };
        const compareNode = createCompareNode(
          sideOperand,
          ComparisonOperator.Eq,
          createConstantOperand('long')
        );

        render(
          <TestWrapper>
            <ConditionNodeEditor
              {...defaultProps}
              node={compareNode}
              showTradeContext={true}
            />
          </TestWrapper>
        );

        // Should show Long as the selected value
        expect(screen.getByText('Long')).toBeInTheDocument();
      });
    });

    describe('String field (pair)', () => {
      it('shows text input for pair string value', () => {
        const pairOperand: TradeContextOperand = {
          type: OperandType.TradeContext,
          field: 'pair',
        };
        const compareNode = createCompareNode(
          pairOperand,
          ComparisonOperator.Eq,
          createConstantOperand('BTC/USDT')
        );

        render(
          <TestWrapper>
            <ConditionNodeEditor
              {...defaultProps}
              node={compareNode}
              showTradeContext={true}
            />
          </TestWrapper>
        );

        // Should show text input with the pair value
        const input = screen.getByPlaceholderText(/trading pair/i);
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue('BTC/USDT');
      });
    });

    describe('Number field (current_profit)', () => {
      it('shows full comparison operators for number TradeContext field', () => {
        const profitOperand: TradeContextOperand = {
          type: OperandType.TradeContext,
          field: 'current_profit',
        };
        const compareNode = createCompareNode(
          profitOperand,
          ComparisonOperator.Gt,
          createConstantOperand(0.05)
        );

        render(
          <TestWrapper>
            <ConditionNodeEditor
              {...defaultProps}
              node={compareNode}
              showTradeContext={true}
            />
          </TestWrapper>
        );

        // Should show TRADE CONTEXT
        expect(screen.getByText('TRADE CONTEXT')).toBeInTheDocument();

        // Should show the > operator
        expect(screen.getByText('>')).toBeInTheDocument();
      });

      it('shows number input for number constant value', () => {
        const profitOperand: TradeContextOperand = {
          type: OperandType.TradeContext,
          field: 'current_profit',
        };
        const compareNode = createCompareNode(
          profitOperand,
          ComparisonOperator.Gt,
          createConstantOperand(0.05)
        );

        render(
          <TestWrapper>
            <ConditionNodeEditor
              {...defaultProps}
              node={compareNode}
              showTradeContext={true}
            />
          </TestWrapper>
        );

        // Should show number input with the value
        const input = screen.getByRole('spinbutton');
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue(0.05);
      });
    });

    describe('Field type change updates constant value', () => {
      it('updates constant when changing from number to boolean field', async () => {
        const onChange = vi.fn();
        const profitOperand: TradeContextOperand = {
          type: OperandType.TradeContext,
          field: 'current_profit',
        };
        const compareNode = createCompareNode(
          profitOperand,
          ComparisonOperator.Gt,
          createConstantOperand(0.05)
        );

        render(
          <TestWrapper>
            <ConditionNodeEditor
              {...defaultProps}
              node={compareNode}
              onChange={onChange}
              showTradeContext={true}
            />
          </TestWrapper>
        );

        // Find and click on the trade field dropdown
        const tradeFieldCombobox = screen.getByText('Current Profit');
        await userEvent.click(tradeFieldCombobox);

        // Select Is Short
        await waitFor(() => {
          expect(screen.getByText('Is Short')).toBeInTheDocument();
        });
        await userEvent.click(screen.getByText('Is Short'));

        // onChange should be called with updated node
        expect(onChange).toHaveBeenCalled();
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];

        // Left operand should be is_short
        expect(lastCall.left.field).toBe('is_short');

        // Right operand should be updated to boolean
        expect(lastCall.right.value).toBe(true);

        // Operator should be set to Eq for boolean
        expect(lastCall.operator).toBe(ComparisonOperator.Eq);
      });
    });
  });
});
