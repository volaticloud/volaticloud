import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { CreateStrategyNameDrawer } from './CreateStrategyNameDrawer';
import { CreateStrategyDocument } from './strategies.generated';
import { StrategyStrategyBuilderMode } from '../../generated/types';

// Mock the default config creators
vi.mock('../Freqtrade', () => ({
  createDefaultFreqtradeConfig: () => ({ timeframe: '5m' }),
}));

vi.mock('../StrategyBuilder', () => ({
  createDefaultUIBuilderConfig: () => ({ version: 1 }),
}));

// Mock the organization context
vi.mock('../../contexts/OrganizationContext', () => ({
  useActiveOrganization: vi.fn(() => ({
    activeOrganizationId: 'org-123',
    organizations: [],
    setActiveOrganizationId: vi.fn(),
  })),
}));

// Import the mocked hook to be able to modify it per test
import { useActiveOrganization } from '../../contexts/OrganizationContext';
const mockUseActiveOrganization = vi.mocked(useActiveOrganization);

const createSuccessMock = (
  name: string,
  description: string | undefined,
  strategyId: string = 'strategy-123'
): MockedResponse => ({
  request: {
    query: CreateStrategyDocument,
  },
  variableMatcher: (variables) => {
    return (
      variables.input.name === name &&
      variables.input.description === description &&
      variables.input.ownerID === 'org-123' &&
      variables.input.builderMode === StrategyStrategyBuilderMode.Ui
    );
  },
  result: {
    data: {
      createStrategy: {
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

describe('CreateStrategyNameDrawer', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default mock
    mockUseActiveOrganization.mockReturnValue({
      activeOrganizationId: 'org-123',
      activeOrganization: { id: 'org-123', title: 'Test Org' },
      availableOrganizationIds: ['org-123'],
      organizations: [{ id: 'org-123', title: 'Test Org' }],
      setActiveOrganization: vi.fn(),
    });
  });

  it('renders the drawer with create mode', () => {
    renderWithProviders(<CreateStrategyNameDrawer {...defaultProps} />);
    expect(screen.getByText('Create New Strategy')).toBeInTheDocument();
  });

  it('calls onSuccess and onClose after successful creation', async () => {
    const user = userEvent.setup();
    const mocks = [createSuccessMock('Test Strategy', undefined)];

    renderWithProviders(<CreateStrategyNameDrawer {...defaultProps} />, mocks);

    const nameInput = screen.getByLabelText(/strategy name/i);
    await user.type(nameInput, 'Test Strategy');

    const submitButton = screen.getByRole('button', { name: /create & open studio/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalledWith('strategy-123');
    });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows error when no active organization', async () => {
    const user = userEvent.setup();
    mockUseActiveOrganization.mockReturnValue({
      activeOrganizationId: null,
      activeOrganization: null,
      availableOrganizationIds: [],
      organizations: [],
      setActiveOrganization: vi.fn(),
    });

    renderWithProviders(<CreateStrategyNameDrawer {...defaultProps} />);

    const nameInput = screen.getByLabelText(/strategy name/i);
    await user.type(nameInput, 'Test Strategy');

    const submitButton = screen.getByRole('button', { name: /create & open studio/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/no active organization/i)).toBeInTheDocument();
    });
  });

  it('does not render when closed', () => {
    renderWithProviders(<CreateStrategyNameDrawer {...defaultProps} open={false} />);
    expect(screen.queryByText('Create New Strategy')).not.toBeInTheDocument();
  });
});
