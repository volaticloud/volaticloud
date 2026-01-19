import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing';
import { CreateOrganizationDialog } from './CreateOrganizationDialog';
import { CreateOrganizationDocument } from './organization.generated';

// Mock useAuth hook
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    signinSilent: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock successful creation response
const mockSuccessResponse = {
  request: {
    query: CreateOrganizationDocument,
    variables: {
      input: {
        title: 'My Organization',
        alias: undefined,
      },
    },
  },
  result: {
    data: {
      createOrganization: {
        __typename: 'CreateOrganizationResponse',
        id: 'org-uuid',
        title: 'My Organization',
        alias: 'my-organization',
      },
    },
  },
};

// Mock success with custom alias
const mockSuccessWithAliasResponse = {
  request: {
    query: CreateOrganizationDocument,
    variables: {
      input: {
        title: 'My Organization',
        alias: 'custom-alias',
      },
    },
  },
  result: {
    data: {
      createOrganization: {
        __typename: 'CreateOrganizationResponse',
        id: 'org-uuid',
        title: 'My Organization',
        alias: 'custom-alias',
      },
    },
  },
};

// Mock error response
const mockErrorResponse = {
  request: {
    query: CreateOrganizationDocument,
    variables: {
      input: {
        title: 'Duplicate Org',
        alias: undefined,
      },
    },
  },
  error: new Error('Organization with this alias already exists'),
};

describe('CreateOrganizationDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders dialog with correct title', () => {
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      expect(screen.getByText('Create New Organization')).toBeInTheDocument();
    });

    it('renders organization title input field', () => {
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      expect(screen.getByLabelText(/organization title/i)).toBeInTheDocument();
    });

    it('renders cancel and create buttons', () => {
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
    });

    it('renders customize alias button', () => {
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      expect(screen.getByRole('button', { name: /customize alias/i })).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} open={false} />
        </MockedProvider>
      );

      expect(screen.queryByText('Create New Organization')).not.toBeInTheDocument();
    });
  });

  describe('alias generation', () => {
    it('shows auto-generated alias preview when title is entered', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'My Organization');

      // Check for alias text in a strong element (may appear multiple times during animation)
      const strongElements = screen.getAllByText('my-organization');
      expect(strongElements.length).toBeGreaterThan(0);
    });

    it('generates alias with hyphens for spaces', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'Test Organization Name');

      const strongElements = screen.getAllByText('test-organization-name');
      expect(strongElements.length).toBeGreaterThan(0);
    });

    it('removes special characters from generated alias', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'My Org & Partners!');

      const strongElements = screen.getAllByText('my-org-partners');
      expect(strongElements.length).toBeGreaterThan(0);
    });

    it('removes diacritics from generated alias', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'Café Résumé');

      const strongElements = screen.getAllByText('cafe-resume');
      expect(strongElements.length).toBeGreaterThan(0);
    });
  });

  describe('custom alias', () => {
    it('shows alias input when customize alias is clicked', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      const customizeButton = screen.getByRole('button', { name: /customize alias/i });
      await user.click(customizeButton);

      expect(screen.getByLabelText(/organization alias/i)).toBeInTheDocument();
    });

    it('shows alias input field when advanced section is open', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'My Organization');

      // Open advanced section
      const customizeButton = screen.getByRole('button', { name: /customize alias/i });
      await user.click(customizeButton);

      // Now the alias input should be visible
      expect(screen.getByLabelText(/organization alias/i)).toBeInTheDocument();
      // And helper text should show the auto-generated alias
      expect(screen.getByText(/will be auto-generated as/i)).toBeInTheDocument();
    });

    it('converts custom alias to lowercase', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      // Open advanced section
      const customizeButton = screen.getByRole('button', { name: /customize alias/i });
      await user.click(customizeButton);

      const aliasInput = screen.getByLabelText(/organization alias/i);
      await user.type(aliasInput, 'MY-ALIAS');

      expect(aliasInput).toHaveValue('my-alias');
    });
  });

  describe('validation', () => {
    it('disables submit button when title is empty', () => {
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      const submitButton = screen.getByRole('button', { name: /create/i });
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when title is entered', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'My Organization');

      const submitButton = screen.getByRole('button', { name: /create/i });
      expect(submitButton).toBeEnabled();
    });

    it('shows error for alias that is too short', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      // Enter a title first
      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'My Organization');

      // Open advanced section
      const customizeButton = screen.getByRole('button', { name: /customize alias/i });
      await user.click(customizeButton);

      // Enter short alias
      const aliasInput = screen.getByLabelText(/organization alias/i);
      await user.clear(aliasInput);
      await user.type(aliasInput, 'ab');

      expect(screen.getByText(/alias must be at least 3 characters/i)).toBeInTheDocument();
    });

    it('shows error for alias with invalid characters', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      // Enter a title first
      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'My Organization');

      // Open advanced section
      const customizeButton = screen.getByRole('button', { name: /customize alias/i });
      await user.click(customizeButton);

      // Enter alias starting with hyphen
      const aliasInput = screen.getByLabelText(/organization alias/i);
      await user.clear(aliasInput);
      await user.type(aliasInput, '-invalid');

      expect(screen.getByText(/cannot start or end with hyphen/i)).toBeInTheDocument();
    });

    it('shows error for alias with consecutive hyphens', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      // Enter a title first
      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'My Organization');

      // Open advanced section
      const customizeButton = screen.getByRole('button', { name: /customize alias/i });
      await user.click(customizeButton);

      // Enter alias with consecutive hyphens
      const aliasInput = screen.getByLabelText(/organization alias/i);
      await user.clear(aliasInput);
      await user.type(aliasInput, 'my--alias');

      expect(screen.getByText(/cannot contain consecutive hyphens/i)).toBeInTheDocument();
    });

    it('disables submit button when alias has validation error', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      // Enter a title first
      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'My Organization');

      // Open advanced section and enter invalid alias
      const customizeButton = screen.getByRole('button', { name: /customize alias/i });
      await user.click(customizeButton);

      const aliasInput = screen.getByLabelText(/organization alias/i);
      await user.clear(aliasInput);
      await user.type(aliasInput, 'ab');

      const submitButton = screen.getByRole('button', { name: /create/i });
      expect(submitButton).toBeDisabled();
    });

    it('shows error for alias starting with dot', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      // Enter a title first
      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'My Organization');

      // Open advanced section
      const customizeButton = screen.getByRole('button', { name: /customize alias/i });
      await user.click(customizeButton);

      // Enter alias starting with dot
      const aliasInput = screen.getByLabelText(/organization alias/i);
      await user.clear(aliasInput);
      await user.type(aliasInput, '.hidden');

      expect(screen.getByText(/cannot start with a dot/i)).toBeInTheDocument();
    });

    it('shows error for alias with path traversal characters', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      // Enter a title first
      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'My Organization');

      // Open advanced section
      const customizeButton = screen.getByRole('button', { name: /customize alias/i });
      await user.click(customizeButton);

      // Enter alias with forward slash
      const aliasInput = screen.getByLabelText(/organization alias/i);
      await user.clear(aliasInput);
      await user.type(aliasInput, 'my/org');

      expect(screen.getByText(/invalid path characters/i)).toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('calls onClose when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      const delayedMock = {
        ...mockSuccessResponse,
        delay: 100,
      };

      render(
        <MockedProvider mocks={[delayedMock]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'My Organization');

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/creating/i)).toBeInTheDocument();
      });
    });

    it('disables form fields during loading', async () => {
      const user = userEvent.setup();
      const delayedMock = {
        ...mockSuccessResponse,
        delay: 500,
      };

      render(
        <MockedProvider mocks={[delayedMock]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'My Organization');

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/organization title/i)).toBeDisabled();
      });
    });

    it('calls onSuccess after successful creation', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[mockSuccessResponse]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'My Organization');

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(defaultProps.onSuccess).toHaveBeenCalled();
      });
    });

    it('calls onClose after successful creation', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[mockSuccessResponse]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'My Organization');

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    it('displays error message on failure', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[mockErrorResponse]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'Duplicate Org');

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/organization with this alias already exists/i)).toBeInTheDocument();
      });
    });

    it('submits with custom alias when provided', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[mockSuccessWithAliasResponse]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'My Organization');

      // Open advanced section and enter custom alias
      const customizeButton = screen.getByRole('button', { name: /customize alias/i });
      await user.click(customizeButton);

      const aliasInput = screen.getByLabelText(/organization alias/i);
      await user.type(aliasInput, 'custom-alias');

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(defaultProps.onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('form reset', () => {
    it('resets form when dialog closes', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      // Enter some data
      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'Test Organization');

      // Close dialog via cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Reopen dialog
      rerender(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} open={true} />
        </MockedProvider>
      );

      // Title should be cleared
      const newTitleInput = screen.getByLabelText(/organization title/i);
      expect(newTitleInput).toHaveValue('');
    });
  });
});

describe('generateAliasFromTitle', () => {
  // These tests verify the function behavior through the component UI
  it('handles empty title', async () => {
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <CreateOrganizationDialog open={true} onClose={vi.fn()} />
      </MockedProvider>
    );

    // No alias preview should be shown for empty title
    expect(screen.queryByText(/alias:/i)).not.toBeInTheDocument();
  });
});

describe('validateAlias', () => {
  // These tests verify validation through the component UI
  it('accepts valid alias', async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <CreateOrganizationDialog open={true} onClose={vi.fn()} />
      </MockedProvider>
    );

    const titleInput = screen.getByLabelText(/organization title/i);
    await user.type(titleInput, 'Test');

    // Open advanced and enter valid alias
    const customizeButton = screen.getByRole('button', { name: /customize alias/i });
    await user.click(customizeButton);

    const aliasInput = screen.getByLabelText(/organization alias/i);
    await user.clear(aliasInput);
    await user.type(aliasInput, 'valid-alias-123');

    // Should not show any error
    expect(screen.queryByText(/alias must be/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cannot start/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cannot contain consecutive/i)).not.toBeInTheDocument();
  });
});