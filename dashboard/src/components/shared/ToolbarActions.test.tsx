import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Edit } from '@mui/icons-material';
import { ToolbarActions, OverflowMenu, ToolbarAction } from './ToolbarActions';

describe('ToolbarActions', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders primary actions as buttons', () => {
      const actions: ToolbarAction[] = [
        { id: 'save', label: 'Save', onClick: mockOnClick, primary: true },
        { id: 'cancel', label: 'Cancel', onClick: mockOnClick, primary: true },
      ];

      render(<ToolbarActions actions={actions} />);

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('renders secondary actions in overflow menu', async () => {
      const user = userEvent.setup();
      const actions: ToolbarAction[] = [
        { id: 'edit', label: 'Edit', onClick: mockOnClick },
        { id: 'delete', label: 'Delete', onClick: mockOnClick },
      ];

      render(<ToolbarActions actions={actions} />);

      // Click the overflow menu button
      const menuButton = screen.getByRole('button', { name: /more actions/i });
      await user.click(menuButton);

      // Menu items should be visible
      expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
    });

    it('renders both primary and secondary actions', async () => {
      const user = userEvent.setup();
      const actions: ToolbarAction[] = [
        { id: 'save', label: 'Save', onClick: mockOnClick, primary: true },
        { id: 'delete', label: 'Delete', onClick: mockOnClick },
      ];

      render(<ToolbarActions actions={actions} />);

      // Primary action as button
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();

      // Open overflow menu for secondary action
      const menuButton = screen.getByRole('button', { name: /more actions/i });
      await user.click(menuButton);

      expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
    });

    it('does not render overflow menu when no secondary actions', () => {
      const actions: ToolbarAction[] = [
        { id: 'save', label: 'Save', onClick: mockOnClick, primary: true },
      ];

      render(<ToolbarActions actions={actions} />);

      expect(screen.queryByRole('button', { name: /more actions/i })).not.toBeInTheDocument();
    });
  });

  describe('hidden actions', () => {
    it('filters out hidden actions', () => {
      const actions: ToolbarAction[] = [
        { id: 'save', label: 'Save', onClick: mockOnClick, primary: true },
        { id: 'hidden', label: 'Hidden', onClick: mockOnClick, primary: true, hidden: true },
      ];

      render(<ToolbarActions actions={actions} />);

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /hidden/i })).not.toBeInTheDocument();
    });

    it('filters hidden actions from overflow menu', async () => {
      const user = userEvent.setup();
      const actions: ToolbarAction[] = [
        { id: 'edit', label: 'Edit', onClick: mockOnClick },
        { id: 'hidden', label: 'Hidden', onClick: mockOnClick, hidden: true },
      ];

      render(<ToolbarActions actions={actions} />);

      const menuButton = screen.getByRole('button', { name: /more actions/i });
      await user.click(menuButton);

      expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /hidden/i })).not.toBeInTheDocument();
    });
  });

  describe('loading states', () => {
    it('shows loading spinner on primary button when loading', () => {
      const actions: ToolbarAction[] = [
        { id: 'save', label: 'Save', onClick: mockOnClick, primary: true, loading: true },
      ];

      render(<ToolbarActions actions={actions} />);

      const button = screen.getByRole('button', { name: /save/i });
      expect(button).toBeDisabled();
      expect(within(button).getByRole('progressbar')).toBeInTheDocument();
    });

    it('shows loadingLabel when loading', () => {
      const actions: ToolbarAction[] = [
        {
          id: 'save',
          label: 'Save',
          loadingLabel: 'Saving...',
          onClick: mockOnClick,
          primary: true,
          loading: true,
        },
      ];

      render(<ToolbarActions actions={actions} />);

      // Button's aria-label stays as "Save" but visible text shows "Saving..."
      const button = screen.getByRole('button', { name: /save/i });
      expect(button).toHaveTextContent('Saving...');
    });

    it('disables menu items when loading', async () => {
      const user = userEvent.setup();
      const actions: ToolbarAction[] = [
        { id: 'delete', label: 'Delete', onClick: mockOnClick, loading: true },
      ];

      render(<ToolbarActions actions={actions} />);

      const menuButton = screen.getByRole('button', { name: /more actions/i });
      await user.click(menuButton);

      const menuItem = screen.getByRole('menuitem', { name: /delete/i });
      expect(menuItem).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('disabled states', () => {
    it('disables primary button when disabled', () => {
      const actions: ToolbarAction[] = [
        { id: 'save', label: 'Save', onClick: mockOnClick, primary: true, disabled: true },
      ];

      render(<ToolbarActions actions={actions} />);

      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });

    it('disables menu items when disabled', async () => {
      const user = userEvent.setup();
      const actions: ToolbarAction[] = [
        { id: 'delete', label: 'Delete', onClick: mockOnClick, disabled: true },
      ];

      render(<ToolbarActions actions={actions} />);

      const menuButton = screen.getByRole('button', { name: /more actions/i });
      await user.click(menuButton);

      const menuItem = screen.getByRole('menuitem', { name: /delete/i });
      expect(menuItem).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('click handlers', () => {
    it('calls onClick when primary button is clicked', async () => {
      const user = userEvent.setup();
      const actions: ToolbarAction[] = [
        { id: 'save', label: 'Save', onClick: mockOnClick, primary: true },
      ];

      render(<ToolbarActions actions={actions} />);

      await user.click(screen.getByRole('button', { name: /save/i }));

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick and closes menu when menu item is clicked', async () => {
      const user = userEvent.setup();
      const actions: ToolbarAction[] = [
        { id: 'delete', label: 'Delete', onClick: mockOnClick },
      ];

      render(<ToolbarActions actions={actions} />);

      // Open menu
      const menuButton = screen.getByRole('button', { name: /more actions/i });
      await user.click(menuButton);

      // Click menu item
      await user.click(screen.getByRole('menuitem', { name: /delete/i }));

      expect(mockOnClick).toHaveBeenCalledTimes(1);
      // Menu should be closed
      expect(screen.queryByRole('menuitem', { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe('dividers', () => {
    it('renders divider before menu item when dividerBefore is true', async () => {
      const user = userEvent.setup();
      const actions: ToolbarAction[] = [
        { id: 'edit', label: 'Edit', onClick: mockOnClick },
        { id: 'delete', label: 'Delete', onClick: mockOnClick, dividerBefore: true },
      ];

      render(<ToolbarActions actions={actions} />);

      const menuButton = screen.getByRole('button', { name: /more actions/i });
      await user.click(menuButton);

      // Check for separator
      expect(screen.getByRole('separator')).toBeInTheDocument();
    });

    it('does not render divider for first item even with dividerBefore', async () => {
      const user = userEvent.setup();
      const actions: ToolbarAction[] = [
        { id: 'edit', label: 'Edit', onClick: mockOnClick, dividerBefore: true },
      ];

      render(<ToolbarActions actions={actions} />);

      const menuButton = screen.getByRole('button', { name: /more actions/i });
      await user.click(menuButton);

      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });
  });

  describe('tooltips', () => {
    it('renders tooltip for primary action with tooltip prop', async () => {
      const user = userEvent.setup();
      const actions: ToolbarAction[] = [
        { id: 'save', label: 'Save', onClick: mockOnClick, primary: true, tooltip: 'Save changes' },
      ];

      render(<ToolbarActions actions={actions} />);

      const button = screen.getByRole('button', { name: /save/i });
      await user.hover(button);

      // Tooltip should appear (MUI tooltips have role="tooltip")
      expect(await screen.findByRole('tooltip', { name: /save changes/i })).toBeInTheDocument();
    });
  });

  describe('button variants and colors', () => {
    it('applies variant to primary button', () => {
      const actions: ToolbarAction[] = [
        { id: 'save', label: 'Save', onClick: mockOnClick, primary: true, variant: 'contained' },
      ];

      render(<ToolbarActions actions={actions} />);

      const button = screen.getByRole('button', { name: /save/i });
      expect(button).toHaveClass('MuiButton-contained');
    });

    it('applies color to primary button', () => {
      const actions: ToolbarAction[] = [
        { id: 'delete', label: 'Delete', onClick: mockOnClick, primary: true, color: 'error' },
      ];

      render(<ToolbarActions actions={actions} />);

      const button = screen.getByRole('button', { name: /delete/i });
      expect(button).toHaveClass('MuiButton-colorError');
    });
  });

  describe('accessibility', () => {
    it('has proper aria attributes on overflow menu button', () => {
      const actions: ToolbarAction[] = [
        { id: 'edit', label: 'Edit', onClick: mockOnClick },
      ];

      render(<ToolbarActions actions={actions} />);

      const menuButton = screen.getByRole('button', { name: /more actions/i });
      expect(menuButton).toHaveAttribute('aria-haspopup', 'true');
    });

    it('sets aria-expanded when menu is open', async () => {
      const user = userEvent.setup();
      const actions: ToolbarAction[] = [
        { id: 'edit', label: 'Edit', onClick: mockOnClick },
      ];

      render(<ToolbarActions actions={actions} />);

      const menuButton = screen.getByRole('button', { name: /more actions/i });
      expect(menuButton).not.toHaveAttribute('aria-expanded');

      await user.click(menuButton);

      expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('has aria-label on primary buttons', () => {
      const actions: ToolbarAction[] = [
        { id: 'save', label: 'Save', onClick: mockOnClick, primary: true },
      ];

      render(<ToolbarActions actions={actions} />);

      const button = screen.getByRole('button', { name: /save/i });
      expect(button).toHaveAttribute('aria-label', 'Save');
    });
  });
});

describe('OverflowMenu', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders menu button', () => {
      const items: ToolbarAction[] = [
        { id: 'edit', label: 'Edit', onClick: mockOnClick },
      ];

      render(<OverflowMenu items={items} />);

      expect(screen.getByRole('button', { name: /more actions/i })).toBeInTheDocument();
    });

    it('returns null when no visible items', () => {
      const items: ToolbarAction[] = [
        { id: 'hidden', label: 'Hidden', onClick: mockOnClick, hidden: true },
      ];

      const { container } = render(<OverflowMenu items={items} />);

      expect(container).toBeEmptyDOMElement();
    });

    it('renders custom icon when provided', () => {
      const items: ToolbarAction[] = [
        { id: 'edit', label: 'Edit', onClick: mockOnClick },
      ];

      render(<OverflowMenu items={items} icon={<Edit data-testid="custom-icon" />} />);

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('renders menu items when clicked', async () => {
      const user = userEvent.setup();
      const items: ToolbarAction[] = [
        { id: 'edit', label: 'Edit', onClick: mockOnClick },
        { id: 'delete', label: 'Delete', onClick: mockOnClick },
      ];

      render(<OverflowMenu items={items} />);

      await user.click(screen.getByRole('button', { name: /more actions/i }));

      expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
    });
  });

  describe('click handlers', () => {
    it('calls onClick and closes menu when item is clicked', async () => {
      const user = userEvent.setup();
      const items: ToolbarAction[] = [
        { id: 'edit', label: 'Edit', onClick: mockOnClick },
      ];

      render(<OverflowMenu items={items} />);

      await user.click(screen.getByRole('button', { name: /more actions/i }));
      await user.click(screen.getByRole('menuitem', { name: /edit/i }));

      expect(mockOnClick).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menuitem', { name: /edit/i })).not.toBeInTheDocument();
    });
  });

  describe('custom tooltip', () => {
    it('renders custom tooltip', async () => {
      const user = userEvent.setup();
      const items: ToolbarAction[] = [
        { id: 'edit', label: 'Edit', onClick: mockOnClick },
      ];

      render(<OverflowMenu items={items} tooltip="Actions" />);

      await user.hover(screen.getByRole('button', { name: /more actions/i }));

      expect(await screen.findByRole('tooltip', { name: /actions/i })).toBeInTheDocument();
    });
  });
});