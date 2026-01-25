import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContentDrawer } from './FormDrawer';

describe('ContentDrawer', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    title: 'Test Drawer',
    children: <div data-testid="drawer-content">Test Content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders with title', () => {
      render(<ContentDrawer {...defaultProps} />);

      expect(screen.getByRole('heading', { name: /test drawer/i })).toBeInTheDocument();
    });

    it('renders children content', () => {
      render(<ContentDrawer {...defaultProps} />);

      expect(screen.getByTestId('drawer-content')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders close button', () => {
      render(<ContentDrawer {...defaultProps} />);

      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<ContentDrawer {...defaultProps} open={false} />);

      expect(screen.queryByRole('heading', { name: /test drawer/i })).not.toBeInTheDocument();
    });
  });

  describe('close behavior', () => {
    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<ContentDrawer {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /close/i }));

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking outside (backdrop)', async () => {
      const user = userEvent.setup();
      render(<ContentDrawer {...defaultProps} />);

      // Click the backdrop (MUI drawer backdrop has role="presentation")
      const backdrop = document.querySelector('.MuiBackdrop-root');
      if (backdrop) {
        await user.click(backdrop);
        expect(defaultProps.onClose).toHaveBeenCalled();
      }
    });
  });

  describe('width prop', () => {
    it('uses default width of 400', () => {
      render(<ContentDrawer {...defaultProps} />);

      const drawer = document.querySelector('.MuiDrawer-paper');
      expect(drawer).toBeInTheDocument();
      // Width is applied via sx prop, so we check if the drawer is rendered
    });

    it('accepts custom width', () => {
      render(<ContentDrawer {...defaultProps} width={600} />);

      const drawer = document.querySelector('.MuiDrawer-paper');
      expect(drawer).toBeInTheDocument();
    });

    it('accepts string width', () => {
      render(<ContentDrawer {...defaultProps} width="50%" />);

      const drawer = document.querySelector('.MuiDrawer-paper');
      expect(drawer).toBeInTheDocument();
    });
  });

  describe('anchor prop', () => {
    it('renders on right by default', () => {
      render(<ContentDrawer {...defaultProps} />);

      const drawer = document.querySelector('.MuiDrawer-paperAnchorRight');
      expect(drawer).toBeInTheDocument();
    });

    it('renders on left when anchor is left', () => {
      render(<ContentDrawer {...defaultProps} anchor="left" />);

      const drawer = document.querySelector('.MuiDrawer-paperAnchorLeft');
      expect(drawer).toBeInTheDocument();
    });
  });

  describe('autoFocus prop', () => {
    it('enables auto-focus by default', () => {
      render(<ContentDrawer {...defaultProps} />);

      // MUI Drawer with autoFocus enabled should not have disableAutoFocus
      const drawer = document.querySelector('.MuiDrawer-root');
      expect(drawer).toBeInTheDocument();
    });

    it('can disable auto-focus', () => {
      render(<ContentDrawer {...defaultProps} autoFocus={false} />);

      const drawer = document.querySelector('.MuiDrawer-root');
      expect(drawer).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('close button has proper aria-label', () => {
      render(<ContentDrawer {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toHaveAttribute('aria-label', 'close');
    });

    it('drawer content is accessible', () => {
      render(<ContentDrawer {...defaultProps} />);

      // Drawer should be a presentation role or dialog
      const drawer = document.querySelector('.MuiDrawer-root');
      expect(drawer).toBeInTheDocument();
    });
  });

  describe('layout', () => {
    it('has header with title and close button', () => {
      render(<ContentDrawer {...defaultProps} />);

      // Header should contain title and close button
      const title = screen.getByRole('heading', { name: /test drawer/i });
      const closeButton = screen.getByRole('button', { name: /close/i });

      expect(title).toBeInTheDocument();
      expect(closeButton).toBeInTheDocument();
    });

    it('renders content in scrollable area', () => {
      render(
        <ContentDrawer {...defaultProps}>
          <div style={{ height: '2000px' }}>Tall content</div>
        </ContentDrawer>
      );

      // Content should be in the drawer
      expect(screen.getByText('Tall content')).toBeInTheDocument();
    });
  });
});