import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrategyNameDrawer } from './StrategyNameDrawer';

describe('StrategyNameDrawer', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    mode: 'create' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders drawer when open', () => {
      render(<StrategyNameDrawer {...defaultProps} />);
      expect(screen.getByText('Create New Strategy')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<StrategyNameDrawer {...defaultProps} open={false} />);
      expect(screen.queryByText('Create New Strategy')).not.toBeInTheDocument();
    });

    it('renders strategy name input field', () => {
      render(<StrategyNameDrawer {...defaultProps} />);
      expect(screen.getByLabelText(/strategy name/i)).toBeInTheDocument();
    });

    it('renders description input field', () => {
      render(<StrategyNameDrawer {...defaultProps} />);
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it('renders cancel and submit buttons', () => {
      render(<StrategyNameDrawer {...defaultProps} />);
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create & open studio/i })).toBeInTheDocument();
    });
  });

  describe('create mode', () => {
    it('shows create mode title and description', () => {
      render(<StrategyNameDrawer {...defaultProps} mode="create" />);
      expect(screen.getByText('Create New Strategy')).toBeInTheDocument();
      expect(screen.getByText(/give your strategy a name/i)).toBeInTheDocument();
    });

    it('shows helper text for name field in create mode', () => {
      render(<StrategyNameDrawer {...defaultProps} mode="create" />);
      expect(screen.getByText(/choose a descriptive name/i)).toBeInTheDocument();
    });

    it('shows "Create & Open Studio" button text', () => {
      render(<StrategyNameDrawer {...defaultProps} mode="create" />);
      expect(screen.getByRole('button', { name: /create & open studio/i })).toBeInTheDocument();
    });
  });

  describe('rename mode', () => {
    const renameProps = {
      ...defaultProps,
      mode: 'rename' as const,
      initialName: 'Original Strategy',
      initialDescription: 'Original description',
    };

    it('shows rename mode title', () => {
      render(<StrategyNameDrawer {...renameProps} />);
      expect(screen.getByText('Rename Strategy')).toBeInTheDocument();
    });

    it('does not show description text in rename mode', () => {
      render(<StrategyNameDrawer {...renameProps} />);
      expect(screen.queryByText(/give your strategy a name/i)).not.toBeInTheDocument();
    });

    it('shows "Save" button text', () => {
      render(<StrategyNameDrawer {...renameProps} />);
      expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    });

    it('pre-fills form with initial values', () => {
      render(<StrategyNameDrawer {...renameProps} />);
      expect(screen.getByLabelText(/strategy name/i)).toHaveValue('Original Strategy');
      expect(screen.getByLabelText(/description/i)).toHaveValue('Original description');
    });

    it('disables submit when no changes made', () => {
      render(<StrategyNameDrawer {...renameProps} />);
      expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    });

    it('enables submit when name is changed', async () => {
      const user = userEvent.setup();
      render(<StrategyNameDrawer {...renameProps} />);

      const nameInput = screen.getByLabelText(/strategy name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'New Name');

      expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
    });
  });

  describe('validation', () => {
    it('disables submit button when name is empty', () => {
      render(<StrategyNameDrawer {...defaultProps} />);
      expect(screen.getByRole('button', { name: /create & open studio/i })).toBeDisabled();
    });

    it('enables submit button when name is entered', async () => {
      const user = userEvent.setup();
      render(<StrategyNameDrawer {...defaultProps} />);

      const nameInput = screen.getByLabelText(/strategy name/i);
      await user.type(nameInput, 'My Strategy');

      expect(screen.getByRole('button', { name: /create & open studio/i })).toBeEnabled();
    });

    it('disables submit when name is only whitespace', async () => {
      const user = userEvent.setup();
      render(<StrategyNameDrawer {...defaultProps} />);

      const nameInput = screen.getByLabelText(/strategy name/i);
      await user.type(nameInput, '   ');

      expect(screen.getByRole('button', { name: /create & open studio/i })).toBeDisabled();
    });
  });

  describe('form submission', () => {
    it('calls onSubmit with trimmed values', async () => {
      const user = userEvent.setup();
      render(<StrategyNameDrawer {...defaultProps} />);

      const nameInput = screen.getByLabelText(/strategy name/i);
      const descInput = screen.getByLabelText(/description/i);

      await user.type(nameInput, '  My Strategy  ');
      await user.type(descInput, '  My description  ');

      const submitButton = screen.getByRole('button', { name: /create & open studio/i });
      await user.click(submitButton);

      expect(defaultProps.onSubmit).toHaveBeenCalledWith('My Strategy', 'My description');
    });

    it('submits on Enter key press in name field', async () => {
      const user = userEvent.setup();
      render(<StrategyNameDrawer {...defaultProps} />);

      const nameInput = screen.getByLabelText(/strategy name/i);
      await user.type(nameInput, 'My Strategy{Enter}');

      expect(defaultProps.onSubmit).toHaveBeenCalledWith('My Strategy', '');
    });

    it('does not submit on Shift+Enter', async () => {
      const user = userEvent.setup();
      render(<StrategyNameDrawer {...defaultProps} />);

      const nameInput = screen.getByLabelText(/strategy name/i);
      await user.type(nameInput, 'My Strategy');
      await user.keyboard('{Shift>}{Enter}{/Shift}');

      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      render(<StrategyNameDrawer {...defaultProps} loading={true} />);

      const nameInput = screen.getByLabelText(/strategy name/i);
      await user.type(nameInput, 'My Strategy');

      expect(screen.getByRole('button', { name: /creating/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
    });

    it('shows "Saving..." in rename mode when loading', async () => {
      const user = userEvent.setup();
      render(
        <StrategyNameDrawer
          {...defaultProps}
          mode="rename"
          initialName="Old Name"
          loading={true}
        />
      );

      const nameInput = screen.getByLabelText(/strategy name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'New Name');

      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays error message when error prop is provided', () => {
      render(
        <StrategyNameDrawer
          {...defaultProps}
          error={new Error('Something went wrong')}
        />
      );

      expect(screen.getByText(/error creating strategy.*something went wrong/i)).toBeInTheDocument();
    });

    it('displays rename error message in rename mode', () => {
      render(
        <StrategyNameDrawer
          {...defaultProps}
          mode="rename"
          error={new Error('Strategy not found')}
        />
      );

      expect(screen.getByText(/error renaming strategy.*strategy not found/i)).toBeInTheDocument();
    });
  });

  describe('cancel and unsaved changes', () => {
    it('calls onClose when Cancel is clicked on empty form', async () => {
      const user = userEvent.setup();
      render(<StrategyNameDrawer {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('shows confirmation when Cancel is clicked with unsaved changes', async () => {
      const user = userEvent.setup();
      render(<StrategyNameDrawer {...defaultProps} />);

      const nameInput = screen.getByLabelText(/strategy name/i);
      await user.type(nameInput, 'Test');

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Should show unsaved changes dialog
      expect(screen.getByRole('button', { name: /discard changes/i })).toBeInTheDocument();
    });

    it('closes drawer when discard is confirmed', async () => {
      const user = userEvent.setup();
      render(<StrategyNameDrawer {...defaultProps} />);

      const nameInput = screen.getByLabelText(/strategy name/i);
      await user.type(nameInput, 'Test');

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      const discardButton = screen.getByRole('button', { name: /discard changes/i });
      await user.click(discardButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('form reset on open', () => {
    it('resets form values when drawer reopens', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<StrategyNameDrawer {...defaultProps} />);

      // Type something
      const nameInput = screen.getByLabelText(/strategy name/i);
      await user.type(nameInput, 'Test Strategy');

      // Close and reopen
      rerender(<StrategyNameDrawer {...defaultProps} open={false} />);
      rerender(<StrategyNameDrawer {...defaultProps} open={true} />);

      // Should be reset
      expect(screen.getByLabelText(/strategy name/i)).toHaveValue('');
    });

    it('updates form values when initial values change in rename mode', async () => {
      const renameProps = {
        ...defaultProps,
        mode: 'rename' as const,
        initialName: 'First Name',
        initialDescription: 'First description',
      };

      const { rerender } = render(<StrategyNameDrawer {...renameProps} />);
      expect(screen.getByLabelText(/strategy name/i)).toHaveValue('First Name');

      // Close and reopen with new values
      rerender(<StrategyNameDrawer {...renameProps} open={false} />);
      rerender(
        <StrategyNameDrawer
          {...renameProps}
          open={true}
          initialName="Second Name"
          initialDescription="Second description"
        />
      );

      expect(screen.getByLabelText(/strategy name/i)).toHaveValue('Second Name');
      expect(screen.getByLabelText(/description/i)).toHaveValue('Second description');
    });
  });
});
