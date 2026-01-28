import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { RenameStrategyDrawer } from './RenameStrategyDrawer';
import { UpdateStrategyDocument } from './strategies.generated';

const createUpdateMock = (
  strategyId: string,
  name: string,
  description: string | undefined
): MockedResponse => ({
  request: {
    query: UpdateStrategyDocument,
    variables: {
      id: strategyId,
      input: {
        name,
        description,
      },
    },
  },
  result: {
    data: {
      updateStrategy: {
        __typename: 'Strategy',
        id: strategyId,
        name,
        description: description || null,
        code: 'test code',
        config: {},
      },
    },
  },
});

const renderWithProviders = (
  ui: React.ReactElement,
  mocks: MockedResponse[] = []
) => {
  return render(<MockedProvider mocks={mocks}>{ui}</MockedProvider>);
};

describe('RenameStrategyDrawer', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    strategyId: 'strategy-123',
    currentName: 'Original Name',
    currentDescription: 'Original description',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders in rename mode with pre-filled values', () => {
    renderWithProviders(<RenameStrategyDrawer {...defaultProps} />);

    expect(screen.getByText('Rename Strategy')).toBeInTheDocument();
    expect(screen.getByLabelText(/strategy name/i)).toHaveValue('Original Name');
    expect(screen.getByLabelText(/description/i)).toHaveValue('Original description');
  });

  it('shows Save button in rename mode', () => {
    renderWithProviders(<RenameStrategyDrawer {...defaultProps} />);
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
  });

  it('disables Save button when no changes made', () => {
    renderWithProviders(<RenameStrategyDrawer {...defaultProps} />);
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('enables Save button when name is changed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RenameStrategyDrawer {...defaultProps} />);

    const nameInput = screen.getByLabelText(/strategy name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'New Name');

    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
  });

  it('calls onSuccess and onClose after successful update', async () => {
    const user = userEvent.setup();
    const mocks = [createUpdateMock('strategy-123', 'New Name', 'Original description')];

    renderWithProviders(<RenameStrategyDrawer {...defaultProps} />, mocks);

    const nameInput = screen.getByLabelText(/strategy name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'New Name');

    const submitButton = screen.getByRole('button', { name: /^save$/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalledWith('New Name', 'Original description');
    });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onSuccess with updated description', async () => {
    const user = userEvent.setup();
    const mocks = [createUpdateMock('strategy-123', 'Original Name', 'New description')];

    renderWithProviders(<RenameStrategyDrawer {...defaultProps} />, mocks);

    const descInput = screen.getByLabelText(/description/i);
    await user.clear(descInput);
    await user.type(descInput, 'New description');

    const submitButton = screen.getByRole('button', { name: /^save$/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalledWith('Original Name', 'New description');
    });
  });

  it('does not render when closed', () => {
    renderWithProviders(<RenameStrategyDrawer {...defaultProps} open={false} />);
    expect(screen.queryByText('Rename Strategy')).not.toBeInTheDocument();
  });

  it('handles empty current description', () => {
    renderWithProviders(
      <RenameStrategyDrawer {...defaultProps} currentDescription="" />
    );

    expect(screen.getByLabelText(/description/i)).toHaveValue('');
  });
});
