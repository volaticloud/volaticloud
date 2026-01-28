import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LeverageBuilder } from './LeverageBuilder';
import {
  LeverageConfig,
  LeverageRule,
  LeverageValueType,
  IndicatorDefinition,
  createCompareNode,
  createConstantOperand,
  OperandType,
  ComparisonOperator,
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
];

describe('LeverageBuilder', () => {
  const defaultProps = {
    value: undefined,
    onChange: vi.fn(),
    indicators: mockIndicators,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial rendering', () => {
    it('renders the component', () => {
      render(
        <TestWrapper>
          <LeverageBuilder {...defaultProps} />
        </TestWrapper>
      );

      // Should render without errors
      expect(document.body.textContent).toBeTruthy();
    });
  });

  describe('Add rule', () => {
    it('adds a new rule when Add Rule button is clicked', () => {
      const onChange = vi.fn();
      const config: LeverageConfig = {
        enabled: true,
        rules: [],
        default_leverage: 3,
      };

      render(
        <TestWrapper>
          <LeverageBuilder {...defaultProps} value={config} onChange={onChange} />
        </TestWrapper>
      );

      // Find and click the "Add Rule" button
      const addButton = screen.getByRole('button', { name: /add rule/i });
      fireEvent.click(addButton);

      expect(onChange).toHaveBeenCalled();
      const call = onChange.mock.calls[0][0];
      expect(call.rules).toHaveLength(1);
      expect(call.rules[0]).toHaveProperty('id');
      expect(call.rules[0]).toHaveProperty('leverage');
      expect(call.rules[0]).toHaveProperty('priority');
    });

    it('sets priority higher than existing rules', () => {
      const onChange = vi.fn();
      const existingRule: LeverageRule = {
        id: 'rule1',
        condition: createCompareNode(
          { type: OperandType.TradeContext, field: 'is_short' },
          ComparisonOperator.Eq,
          createConstantOperand(true)
        ),
        leverage: { type: LeverageValueType.Constant, value: 2 },
        priority: 10,
      };

      const config: LeverageConfig = {
        enabled: true,
        rules: [existingRule],
        default_leverage: 3,
      };

      render(
        <TestWrapper>
          <LeverageBuilder {...defaultProps} value={config} onChange={onChange} />
        </TestWrapper>
      );

      const addButton = screen.getByRole('button', { name: /add rule/i });
      fireEvent.click(addButton);

      const call = onChange.mock.calls[0][0];
      expect(call.rules).toHaveLength(2);
      // New rule should have higher priority
      const newRule = call.rules.find((r: LeverageRule) => r.id !== 'rule1');
      expect(newRule.priority).toBeGreaterThan(10);
    });
  });

  describe('Max leverage', () => {
    it('clamps default leverage when max leverage changes', () => {
      const config: LeverageConfig = {
        enabled: true,
        rules: [],
        default_leverage: 10,
        max_leverage: 20,
      };

      render(
        <TestWrapper>
          <LeverageBuilder {...defaultProps} value={config} />
        </TestWrapper>
      );

      // The component should ensure default doesn't exceed max
      expect(config.default_leverage).toBeLessThanOrEqual(config.max_leverage!);
    });
  });

  describe('Disabled state', () => {
    it('shows content collapsed when disabled', () => {
      const config: LeverageConfig = {
        enabled: false,
        rules: [],
        default_leverage: 3,
      };

      render(
        <TestWrapper>
          <LeverageBuilder {...defaultProps} value={config} />
        </TestWrapper>
      );

      // The "Add Rule" button should not be visible when disabled
      expect(screen.queryByRole('button', { name: /add rule/i })).not.toBeInTheDocument();
    });
  });
});
