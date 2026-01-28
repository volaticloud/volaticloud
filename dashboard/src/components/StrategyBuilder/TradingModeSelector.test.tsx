import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { TradingModeSelector } from './TradingModeSelector';
import { TradingMode } from './types';

// MUI Theme wrapper for components
const theme = createTheme();
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('TradingModeSelector', () => {
  const defaultProps = {
    value: TradingMode.Spot,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial rendering', () => {
    it('renders all trading mode options', () => {
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Spot')).toBeInTheDocument();
      expect(screen.getByText('Margin')).toBeInTheDocument();
      expect(screen.getByText('Futures')).toBeInTheDocument();
    });

    it('renders with Spot mode selected by default', () => {
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} value={TradingMode.Spot} />
        </TestWrapper>
      );

      const spotButton = screen.getByRole('button', { name: /spot/i });
      expect(spotButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('renders with Margin mode selected', () => {
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} value={TradingMode.Margin} />
        </TestWrapper>
      );

      const marginButton = screen.getByRole('button', { name: /margin/i });
      expect(marginButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('renders with Futures mode selected', () => {
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} value={TradingMode.Futures} />
        </TestWrapper>
      );

      const futuresButton = screen.getByRole('button', { name: /futures/i });
      expect(futuresButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('displays Trading Mode label', () => {
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Trading Mode')).toBeInTheDocument();
    });
  });

  describe('Mode selection', () => {
    it('calls onChange with Margin when Margin button is clicked', () => {
      const onChange = vi.fn();
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} value={TradingMode.Spot} onChange={onChange} />
        </TestWrapper>
      );

      const marginButton = screen.getByRole('button', { name: /margin/i });
      fireEvent.click(marginButton);

      expect(onChange).toHaveBeenCalledWith(TradingMode.Margin);
    });

    it('calls onChange with Futures when Futures button is clicked', () => {
      const onChange = vi.fn();
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} value={TradingMode.Spot} onChange={onChange} />
        </TestWrapper>
      );

      const futuresButton = screen.getByRole('button', { name: /futures/i });
      fireEvent.click(futuresButton);

      expect(onChange).toHaveBeenCalledWith(TradingMode.Futures);
    });

    it('calls onChange with Spot when Spot button is clicked from Margin', () => {
      const onChange = vi.fn();
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} value={TradingMode.Margin} onChange={onChange} />
        </TestWrapper>
      );

      const spotButton = screen.getByRole('button', { name: /spot/i });
      fireEvent.click(spotButton);

      expect(onChange).toHaveBeenCalledWith(TradingMode.Spot);
    });

    it('does not call onChange when clicking already selected mode', () => {
      const onChange = vi.fn();
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} value={TradingMode.Spot} onChange={onChange} />
        </TestWrapper>
      );

      const spotButton = screen.getByRole('button', { name: /spot/i });
      fireEvent.click(spotButton);

      // onChange should not be called since the mode is already selected
      // Note: MUI ToggleButtonGroup handles this by passing null when same button is clicked
      // and we ignore null values in our handler
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Disabled state', () => {
    it('disables all buttons when disabled prop is true', () => {
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} disabled />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    it('does not call onChange when disabled and button is clicked', () => {
      const onChange = vi.fn();
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} disabled onChange={onChange} />
        </TestWrapper>
      );

      const marginButton = screen.getByRole('button', { name: /margin/i });
      fireEvent.click(marginButton);

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Mode descriptions', () => {
    it('shows Spot mode description when Spot is selected', () => {
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} value={TradingMode.Spot} />
        </TestWrapper>
      );

      expect(screen.getByText(/spot trading/i)).toBeInTheDocument();
    });

    it('shows Margin mode description when Margin is selected', () => {
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} value={TradingMode.Margin} />
        </TestWrapper>
      );

      // Use more specific text to avoid matching both description and warning
      expect(screen.getByText(/margin trading with borrowed funds$/i)).toBeInTheDocument();
    });

    it('shows Futures mode description when Futures is selected', () => {
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} value={TradingMode.Futures} />
        </TestWrapper>
      );

      expect(screen.getByText(/perpetual futures/i)).toBeInTheDocument();
    });
  });

  describe('Feature chips', () => {
    it('shows "Long positions only" feature for Spot mode', () => {
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} value={TradingMode.Spot} />
        </TestWrapper>
      );

      expect(screen.getByText('Long positions only')).toBeInTheDocument();
    });

    it('shows "No leverage" feature for Spot mode', () => {
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} value={TradingMode.Spot} />
        </TestWrapper>
      );

      expect(screen.getByText('No leverage')).toBeInTheDocument();
    });

    it('shows "Leverage available" feature for Margin mode', () => {
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} value={TradingMode.Margin} />
        </TestWrapper>
      );

      expect(screen.getByText('Leverage available')).toBeInTheDocument();
    });

    it('shows "Long & short positions" feature for Futures mode', () => {
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} value={TradingMode.Futures} />
        </TestWrapper>
      );

      expect(screen.getByText('Long & short positions')).toBeInTheDocument();
    });
  });

  describe('Warning alerts', () => {
    it('shows warning alert for Margin mode', () => {
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} value={TradingMode.Margin} />
        </TestWrapper>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/margin trading involves borrowed funds/i)).toBeInTheDocument();
    });

    it('shows warning alert for Futures mode', () => {
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} value={TradingMode.Futures} />
        </TestWrapper>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/futures trading involves leverage/i)).toBeInTheDocument();
    });

    it('does not show warning alert for Spot mode', () => {
      render(
        <TestWrapper>
          <TradingModeSelector {...defaultProps} value={TradingMode.Spot} />
        </TestWrapper>
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
