import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CodePreview } from './CodePreview';
import { createDefaultUIBuilderConfig } from './types';

// Mock the Apollo mutation hook
const mockPreviewCode = vi.fn();
vi.mock('../Strategies/strategy-studio.generated', () => ({
  usePreviewStrategyCodeMutation: () => [mockPreviewCode, { loading: false, error: null }],
}));

// Mock Monaco Editor (heavy component that doesn't work well in tests)
vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value: string }) => (
    <pre data-testid="monaco-editor">{value}</pre>
  ),
}));

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn(),
};
Object.assign(navigator, { clipboard: mockClipboard });

// MUI Theme wrapper for components
const theme = createTheme();
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('CodePreview', () => {
  const defaultProps = {
    config: createDefaultUIBuilderConfig(),
    className: 'TestStrategy',
    timeframe: '5m',
    stakeCurrency: 'USDT',
    stakeAmount: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClipboard.writeText.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('renders header with title', () => {
      mockPreviewCode.mockResolvedValue({
        data: {
          previewStrategyCode: {
            success: true,
            code: '# Generated code',
            error: null,
          },
        },
      });

      render(
        <TestWrapper>
          <CodePreview {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Generated Python Code')).toBeInTheDocument();
    });

    it('triggers code generation on mount', async () => {
      mockPreviewCode.mockResolvedValue({
        data: {
          previewStrategyCode: {
            success: true,
            code: '# Generated code',
            error: null,
          },
        },
      });

      render(
        <TestWrapper>
          <CodePreview {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockPreviewCode).toHaveBeenCalledWith({
          variables: {
            config: expect.objectContaining({
              stake_currency: 'USDT',
              stake_amount: 100,
              timeframe: '5m',
              ui_builder: expect.any(Object),
            }),
            className: 'TestStrategy',
          },
        });
      });
    });
  });

  describe('Successful Code Generation', () => {
    it('displays generated code in editor', async () => {
      const generatedCode = 'class TestStrategy(IStrategy): pass';

      mockPreviewCode.mockResolvedValue({
        data: {
          previewStrategyCode: {
            success: true,
            code: generatedCode,
            error: null,
          },
        },
      });

      render(
        <TestWrapper>
          <CodePreview {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        const editor = screen.getByTestId('monaco-editor');
        expect(editor.textContent).toContain('TestStrategy');
      });
    });

    it('shows generation timestamp after successful generation', async () => {
      mockPreviewCode.mockResolvedValue({
        data: {
          previewStrategyCode: {
            success: true,
            code: '# Code',
            error: null,
          },
        },
      });

      render(
        <TestWrapper>
          <CodePreview {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/generated:/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when code generation fails', async () => {
      mockPreviewCode.mockResolvedValue({
        data: {
          previewStrategyCode: {
            success: false,
            code: '',
            error: 'Invalid configuration: missing indicators',
          },
        },
      });

      render(
        <TestWrapper>
          <CodePreview {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Invalid configuration: missing indicators')).toBeInTheDocument();
      });
    });

    it('displays generic error when mutation throws', async () => {
      mockPreviewCode.mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <CodePreview {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Copy Functionality', () => {
    it('copies code to clipboard when copy button is clicked', async () => {
      const generatedCode = '# Test code';
      mockPreviewCode.mockResolvedValue({
        data: {
          previewStrategyCode: {
            success: true,
            code: generatedCode,
            error: null,
          },
        },
      });

      render(
        <TestWrapper>
          <CodePreview {...defaultProps} />
        </TestWrapper>
      );

      // Wait for code to be generated
      await waitFor(() => {
        expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
      });

      // Click copy button
      const copyButton = screen.getByRole('button', { name: /copy code/i });
      await userEvent.click(copyButton);

      expect(mockClipboard.writeText).toHaveBeenCalledWith(generatedCode);
    });

    it('shows snackbar after copying', async () => {
      mockPreviewCode.mockResolvedValue({
        data: {
          previewStrategyCode: {
            success: true,
            code: '# Code',
            error: null,
          },
        },
      });

      render(
        <TestWrapper>
          <CodePreview {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
      });

      const copyButton = screen.getByRole('button', { name: /copy code/i });
      await userEvent.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText(/copied to clipboard/i)).toBeInTheDocument();
      });
    });

    it('disables copy button when no code is generated', async () => {
      mockPreviewCode.mockResolvedValue({
        data: {
          previewStrategyCode: {
            success: false,
            code: '',
            error: 'Error',
          },
        },
      });

      render(
        <TestWrapper>
          <CodePreview {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
      });

      const copyButton = screen.getByRole('button', { name: /copy code/i });
      expect(copyButton).toBeDisabled();
    });
  });

  describe('Regenerate Functionality', () => {
    it('regenerates code when refresh button is clicked', async () => {
      mockPreviewCode.mockResolvedValue({
        data: {
          previewStrategyCode: {
            success: true,
            code: '# Code v1',
            error: null,
          },
        },
      });

      render(
        <TestWrapper>
          <CodePreview {...defaultProps} />
        </TestWrapper>
      );

      // Wait for initial generation
      await waitFor(() => {
        expect(mockPreviewCode).toHaveBeenCalledTimes(1);
      });

      // Update mock for second call
      mockPreviewCode.mockResolvedValue({
        data: {
          previewStrategyCode: {
            success: true,
            code: '# Code v2',
            error: null,
          },
        },
      });

      // Click regenerate button
      const regenerateButton = screen.getByRole('button', { name: /regenerate preview/i });
      await userEvent.click(regenerateButton);

      await waitFor(() => {
        expect(mockPreviewCode).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Default ClassName', () => {
    it('uses MyStrategy as default when className is empty', async () => {
      mockPreviewCode.mockResolvedValue({
        data: {
          previewStrategyCode: {
            success: true,
            code: '# Code',
            error: null,
          },
        },
      });

      render(
        <TestWrapper>
          <CodePreview {...defaultProps} className="" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockPreviewCode).toHaveBeenCalledWith({
          variables: expect.objectContaining({
            className: 'MyStrategy',
          }),
        });
      });
    });
  });

  describe('Config Changes', () => {
    it('includes all config fields in mutation', async () => {
      mockPreviewCode.mockResolvedValue({
        data: {
          previewStrategyCode: {
            success: true,
            code: '# Code',
            error: null,
          },
        },
      });

      render(
        <TestWrapper>
          <CodePreview
            {...defaultProps}
            stakeCurrency="BTC"
            stakeAmount={0.1}
            timeframe="1h"
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockPreviewCode).toHaveBeenCalledWith({
          variables: {
            config: expect.objectContaining({
              stake_currency: 'BTC',
              stake_amount: 0.1,
              timeframe: '1h',
            }),
            className: 'TestStrategy',
          },
        });
      });
    });
  });
});
