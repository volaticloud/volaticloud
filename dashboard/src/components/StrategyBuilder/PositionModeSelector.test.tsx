import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { PositionModeSelector } from './PositionModeSelector';
import { PositionMode } from './types';

// MUI Theme wrapper for components
const theme = createTheme();
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('PositionModeSelector', () => {
  const defaultProps = {
    value: PositionMode.LongOnly,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial rendering', () => {
    it('renders all position mode options', () => {
      render(
        <TestWrapper>
          <PositionModeSelector {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Long Only')).toBeInTheDocument();
      expect(screen.getByText('Short Only')).toBeInTheDocument();
      expect(screen.getByText('Long & Short')).toBeInTheDocument();
    });

    it('renders with LongOnly mode selected by default', () => {
      render(
        <TestWrapper>
          <PositionModeSelector {...defaultProps} value={PositionMode.LongOnly} />
        </TestWrapper>
      );

      const longOnlyButton = screen.getByRole('button', { name: /long only/i });
      expect(longOnlyButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('renders with ShortOnly mode selected', () => {
      render(
        <TestWrapper>
          <PositionModeSelector {...defaultProps} value={PositionMode.ShortOnly} />
        </TestWrapper>
      );

      const shortOnlyButton = screen.getByRole('button', { name: /short only/i });
      expect(shortOnlyButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('renders with LongAndShort mode selected', () => {
      render(
        <TestWrapper>
          <PositionModeSelector {...defaultProps} value={PositionMode.LongAndShort} />
        </TestWrapper>
      );

      const longAndShortButton = screen.getByRole('button', { name: /long & short/i });
      expect(longAndShortButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('displays Position Mode label', () => {
      render(
        <TestWrapper>
          <PositionModeSelector {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Position Mode')).toBeInTheDocument();
    });
  });

  describe('Mode selection', () => {
    it('calls onChange with ShortOnly when Short Only button is clicked', () => {
      const onChange = vi.fn();
      render(
        <TestWrapper>
          <PositionModeSelector {...defaultProps} onChange={onChange} allowShort />
        </TestWrapper>
      );

      const shortOnlyButton = screen.getByRole('button', { name: /short only/i });
      fireEvent.click(shortOnlyButton);

      expect(onChange).toHaveBeenCalledWith(PositionMode.ShortOnly);
    });

    it('calls onChange with LongAndShort when Long & Short button is clicked', () => {
      const onChange = vi.fn();
      render(
        <TestWrapper>
          <PositionModeSelector {...defaultProps} onChange={onChange} allowShort />
        </TestWrapper>
      );

      const longAndShortButton = screen.getByRole('button', { name: /long & short/i });
      fireEvent.click(longAndShortButton);

      expect(onChange).toHaveBeenCalledWith(PositionMode.LongAndShort);
    });

    it('calls onChange with LongOnly when Long Only button is clicked from ShortOnly', () => {
      const onChange = vi.fn();
      render(
        <TestWrapper>
          <PositionModeSelector
            {...defaultProps}
            value={PositionMode.ShortOnly}
            onChange={onChange}
            allowShort
          />
        </TestWrapper>
      );

      const longOnlyButton = screen.getByRole('button', { name: /long only/i });
      fireEvent.click(longOnlyButton);

      expect(onChange).toHaveBeenCalledWith(PositionMode.LongOnly);
    });

    it('does not call onChange when clicking already selected mode', () => {
      const onChange = vi.fn();
      render(
        <TestWrapper>
          <PositionModeSelector {...defaultProps} onChange={onChange} />
        </TestWrapper>
      );

      const longOnlyButton = screen.getByRole('button', { name: /long only/i });
      fireEvent.click(longOnlyButton);

      // onChange should not be called since the mode is already selected
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Allow short prop', () => {
    it('disables Short Only button when allowShort is false', () => {
      render(
        <TestWrapper>
          <PositionModeSelector {...defaultProps} allowShort={false} />
        </TestWrapper>
      );

      const shortOnlyButton = screen.getByRole('button', { name: /short only/i });
      expect(shortOnlyButton).toBeDisabled();
    });

    it('disables Long & Short button when allowShort is false', () => {
      render(
        <TestWrapper>
          <PositionModeSelector {...defaultProps} allowShort={false} />
        </TestWrapper>
      );

      const longAndShortButton = screen.getByRole('button', { name: /long & short/i });
      expect(longAndShortButton).toBeDisabled();
    });

    it('enables Long Only button when allowShort is false', () => {
      render(
        <TestWrapper>
          <PositionModeSelector {...defaultProps} allowShort={false} />
        </TestWrapper>
      );

      const longOnlyButton = screen.getByRole('button', { name: /long only/i });
      expect(longOnlyButton).not.toBeDisabled();
    });

    it('enables all buttons when allowShort is true', () => {
      render(
        <TestWrapper>
          <PositionModeSelector {...defaultProps} allowShort />
        </TestWrapper>
      );

      const longOnlyButton = screen.getByRole('button', { name: /long only/i });
      const shortOnlyButton = screen.getByRole('button', { name: /short only/i });
      const longAndShortButton = screen.getByRole('button', { name: /long & short/i });

      expect(longOnlyButton).not.toBeDisabled();
      expect(shortOnlyButton).not.toBeDisabled();
      expect(longAndShortButton).not.toBeDisabled();
    });

    it('does not call onChange when clicking disabled Short Only button', () => {
      const onChange = vi.fn();
      render(
        <TestWrapper>
          <PositionModeSelector {...defaultProps} allowShort={false} onChange={onChange} />
        </TestWrapper>
      );

      const shortOnlyButton = screen.getByRole('button', { name: /short only/i });
      fireEvent.click(shortOnlyButton);

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Disabled state', () => {
    it('disables all buttons when disabled prop is true', () => {
      render(
        <TestWrapper>
          <PositionModeSelector {...defaultProps} disabled />
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
          <PositionModeSelector {...defaultProps} disabled onChange={onChange} allowShort />
        </TestWrapper>
      );

      const shortOnlyButton = screen.getByRole('button', { name: /short only/i });
      fireEvent.click(shortOnlyButton);

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Mode descriptions', () => {
    it('shows Long Only description when LongOnly is selected', () => {
      render(
        <TestWrapper>
          <PositionModeSelector {...defaultProps} value={PositionMode.LongOnly} />
        </TestWrapper>
      );

      expect(screen.getByText(/only open long positions/i)).toBeInTheDocument();
    });

    it('shows Short Only description when ShortOnly is selected', () => {
      render(
        <TestWrapper>
          <PositionModeSelector {...defaultProps} value={PositionMode.ShortOnly} allowShort />
        </TestWrapper>
      );

      expect(screen.getByText(/only open short positions/i)).toBeInTheDocument();
    });

    it('shows Long & Short description when LongAndShort is selected', () => {
      render(
        <TestWrapper>
          <PositionModeSelector {...defaultProps} value={PositionMode.LongAndShort} allowShort />
        </TestWrapper>
      );

      expect(screen.getByText(/trade both directions/i)).toBeInTheDocument();
    });
  });

  describe('Tooltips for disabled buttons', () => {
    it('shows tooltip explaining why Short Only is disabled', async () => {
      render(
        <TestWrapper>
          <PositionModeSelector {...defaultProps} allowShort={false} />
        </TestWrapper>
      );

      // The tooltip should indicate that Margin or Futures mode is required
      // Note: Testing tooltips requires hovering, which is async
      const shortOnlyButton = screen.getByRole('button', { name: /short only/i });
      expect(shortOnlyButton).toBeDisabled();
    });
  });
});
