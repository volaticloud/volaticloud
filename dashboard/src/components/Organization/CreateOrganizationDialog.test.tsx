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
// Note: GraphQL API uses 'alias' field name (Keycloak terminology), but in dashboard we call it "ID"
const mockSuccessResponse = {
  request: {
    query: CreateOrganizationDocument,
    variables: {
      input: {
        title: 'My Organization',
        alias: undefined, // Auto-generated from title
      },
    },
  },
  result: {
    data: {
      createOrganization: {
        __typename: 'CreateOrganizationResponse',
        id: 'my-organization', // This is the human-readable ID
        title: 'My Organization',
        alias: 'my-organization',
      },
    },
  },
};

// Mock success with custom ID
const mockSuccessWithAliasResponse = {
  request: {
    query: CreateOrganizationDocument,
    variables: {
      input: {
        title: 'My Organization',
        alias: 'custom-alias', // GraphQL field name is 'alias'
      },
    },
  },
  result: {
    data: {
      createOrganization: {
        __typename: 'CreateOrganizationResponse',
        id: 'custom-alias',
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
  error: new Error('Organization with this ID already exists'),
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

    it('renders customize ID button', () => {
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      expect(screen.getByRole('button', { name: /customize id/i })).toBeInTheDocument();
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

  describe('ID generation', () => {
    it('shows auto-generated ID preview when title is entered', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'My Organization');

      // Check for ID text in a strong element (may appear multiple times during animation)
      const strongElements = screen.getAllByText('my-organization');
      expect(strongElements.length).toBeGreaterThan(0);
    });

    it('generates ID with hyphens for spaces', async () => {
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

    it('removes special characters from generated ID', async () => {
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

    it('removes diacritics from generated ID', async () => {
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

  describe('custom ID', () => {
    it('shows ID input when customize ID is clicked', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      const customizeButton = screen.getByRole('button', { name: /customize id/i });
      await user.click(customizeButton);

      expect(screen.getByLabelText(/organization id/i)).toBeInTheDocument();
    });

    it('shows ID input field when advanced section is open', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'My Organization');

      // Open advanced section
      const customizeButton = screen.getByRole('button', { name: /customize id/i });
      await user.click(customizeButton);

      // Now the ID input should be visible
      expect(screen.getByLabelText(/organization id/i)).toBeInTheDocument();
      // And helper text should show the auto-generated ID
      expect(screen.getByText(/will be auto-generated as/i)).toBeInTheDocument();
    });

    it('converts custom ID to lowercase', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      // Open advanced section
      const customizeButton = screen.getByRole('button', { name: /customize id/i });
      await user.click(customizeButton);

      const idInput = screen.getByLabelText(/organization id/i);
      await user.type(idInput, 'MY-ID');

      expect(idInput).toHaveValue('my-id');
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

    it('shows error for ID that is too short', async () => {
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
      const customizeButton = screen.getByRole('button', { name: /customize id/i });
      await user.click(customizeButton);

      // Enter short ID
      const idInput = screen.getByLabelText(/organization id/i);
      await user.clear(idInput);
      await user.type(idInput, 'ab');

      expect(screen.getByText(/id must be at least 3 characters/i)).toBeInTheDocument();
    });

    it('shows error for ID with invalid characters', async () => {
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
      const customizeButton = screen.getByRole('button', { name: /customize id/i });
      await user.click(customizeButton);

      // Enter ID starting with hyphen
      const idInput = screen.getByLabelText(/organization id/i);
      await user.clear(idInput);
      await user.type(idInput, '-invalid');

      expect(screen.getByText(/cannot start or end with hyphen/i)).toBeInTheDocument();
    });

    it('shows error for ID with consecutive hyphens', async () => {
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
      const customizeButton = screen.getByRole('button', { name: /customize id/i });
      await user.click(customizeButton);

      // Enter ID with consecutive hyphens
      const idInput = screen.getByLabelText(/organization id/i);
      await user.clear(idInput);
      await user.type(idInput, 'my--id');

      expect(screen.getByText(/cannot contain consecutive hyphens/i)).toBeInTheDocument();
    });

    it('disables submit button when ID has validation error', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      // Enter a title first
      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'My Organization');

      // Open advanced section and enter invalid ID
      const customizeButton = screen.getByRole('button', { name: /customize id/i });
      await user.click(customizeButton);

      const idInput = screen.getByLabelText(/organization id/i);
      await user.clear(idInput);
      await user.type(idInput, 'ab');

      const submitButton = screen.getByRole('button', { name: /create/i });
      expect(submitButton).toBeDisabled();
    });

    it('shows error for ID starting with dot', async () => {
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
      const customizeButton = screen.getByRole('button', { name: /customize id/i });
      await user.click(customizeButton);

      // Enter ID starting with dot
      const idInput = screen.getByLabelText(/organization id/i);
      await user.clear(idInput);
      await user.type(idInput, '.hidden');

      expect(screen.getByText(/cannot start with a dot/i)).toBeInTheDocument();
    });

    it('shows error for ID with path traversal characters', async () => {
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
      const customizeButton = screen.getByRole('button', { name: /customize id/i });
      await user.click(customizeButton);

      // Enter ID with forward slash
      const idInput = screen.getByLabelText(/organization id/i);
      await user.clear(idInput);
      await user.type(idInput, 'my/org');

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
        expect(screen.getByText(/organization with this id already exists/i)).toBeInTheDocument();
      });
    });

    it('submits with custom ID when provided', async () => {
      const user = userEvent.setup();
      render(
        <MockedProvider mocks={[mockSuccessWithAliasResponse]} addTypename={false}>
          <CreateOrganizationDialog {...defaultProps} />
        </MockedProvider>
      );

      const titleInput = screen.getByLabelText(/organization title/i);
      await user.type(titleInput, 'My Organization');

      // Open advanced section and enter custom ID
      const customizeButton = screen.getByRole('button', { name: /customize id/i });
      await user.click(customizeButton);

      const idInput = screen.getByLabelText(/organization id/i);
      await user.type(idInput, 'custom-alias');

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

describe('generateIdFromTitle', () => {
  // These tests verify the function behavior through the component UI
  it('handles empty title', async () => {
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <CreateOrganizationDialog open={true} onClose={vi.fn()} />
      </MockedProvider>
    );

    // No ID preview should be shown for empty title
    expect(screen.queryByText(/^id:/i)).not.toBeInTheDocument();
  });
});

describe('validateId', () => {
  // These tests verify validation through the component UI
  it('accepts valid ID', async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <CreateOrganizationDialog open={true} onClose={vi.fn()} />
      </MockedProvider>
    );

    const titleInput = screen.getByLabelText(/organization title/i);
    await user.type(titleInput, 'Test');

    // Open advanced and enter valid ID
    const customizeButton = screen.getByRole('button', { name: /customize id/i });
    await user.click(customizeButton);

    const idInput = screen.getByLabelText(/organization id/i);
    await user.clear(idInput);
    await user.type(idInput, 'valid-id-123');

    // Should not show any error
    expect(screen.queryByText(/id must be/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cannot start/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cannot contain consecutive/i)).not.toBeInTheDocument();
  });
});