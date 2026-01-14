import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing';
import { InviteUserDialog } from './InviteUserDialog';
import { InviteOrganizationUserDocument } from './organization.generated';

// Mock successful invitation response
const mockSuccessResponse = {
  request: {
    query: InviteOrganizationUserDocument,
    variables: {
      organizationId: 'test-org-123',
      input: {
        email: 'newuser@example.com',
        firstName: 'John',
        lastName: 'Doe',
        redirectUrl: 'http://localhost:3000/?orgId=test-org-123',
      },
    },
  },
  result: {
    data: {
      inviteOrganizationUser: {
        id: 'invitation-uuid',
        email: 'newuser@example.com',
        firstName: 'John',
        lastName: 'Doe',
        organizationId: 'test-org-123',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    },
  },
};

// Mock error response
const mockErrorResponse = {
  request: {
    query: InviteOrganizationUserDocument,
    variables: {
      organizationId: 'test-org-123',
      input: {
        email: 'invalid@example.com',
        firstName: undefined,
        lastName: undefined,
        redirectUrl: 'http://localhost:3000/?orgId=test-org-123',
      },
    },
  },
  error: new Error('User already invited'),
};

describe('InviteUserDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    organizationId: 'test-org-123',
    organizationName: 'Test Organization',
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with correct title', () => {
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <InviteUserDialog {...defaultProps} />
      </MockedProvider>
    );

    expect(screen.getByText('Invite User to Test Organization')).toBeInTheDocument();
  });

  it('renders email input field', () => {
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <InviteUserDialog {...defaultProps} />
      </MockedProvider>
    );

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('renders first name and last name fields', () => {
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <InviteUserDialog {...defaultProps} />
      </MockedProvider>
    );

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
  });

  it('displays viewer role info alert', () => {
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <InviteUserDialog {...defaultProps} />
      </MockedProvider>
    );

    expect(screen.getByText(/viewer/i)).toBeInTheDocument();
  });

  it('disables submit button when email is empty', () => {
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <InviteUserDialog {...defaultProps} />
      </MockedProvider>
    );

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    expect(submitButton).toBeDisabled();
  });

  it('disables submit button when email is invalid', async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <InviteUserDialog {...defaultProps} />
      </MockedProvider>
    );

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'invalid-email');

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when email is valid', async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <InviteUserDialog {...defaultProps} />
      </MockedProvider>
    );

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'valid@example.com');

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    expect(submitButton).toBeEnabled();
  });

  it('validates email format correctly', async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <InviteUserDialog {...defaultProps} />
      </MockedProvider>
    );

    const emailInput = screen.getByLabelText(/email/i);

    // Test invalid emails
    await user.type(emailInput, 'notanemail');
    expect(screen.getByRole('button', { name: /send invitation/i })).toBeDisabled();

    await user.clear(emailInput);
    await user.type(emailInput, 'missing@domain');
    expect(screen.getByRole('button', { name: /send invitation/i })).toBeDisabled();

    // Test valid email
    await user.clear(emailInput);
    await user.type(emailInput, 'valid@example.com');
    expect(screen.getByRole('button', { name: /send invitation/i })).toBeEnabled();
  });

  it('calls onClose when Close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <InviteUserDialog {...defaultProps} />
      </MockedProvider>
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('resets form when dialog closes', async () => {
    const { rerender } = render(
      <MockedProvider mocks={[]} addTypename={false}>
        <InviteUserDialog {...defaultProps} />
      </MockedProvider>
    );

    // Enter some data
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    // Close dialog
    rerender(
      <MockedProvider mocks={[]} addTypename={false}>
        <InviteUserDialog {...defaultProps} open={false} />
      </MockedProvider>
    );

    // Reopen dialog
    rerender(
      <MockedProvider mocks={[]} addTypename={false}>
        <InviteUserDialog {...defaultProps} open={true} />
      </MockedProvider>
    );

    // Email should be cleared
    const newEmailInput = screen.getByLabelText(/email/i);
    expect(newEmailInput).toHaveValue('');
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();

    // Create a mock that delays response
    const delayedMock = {
      ...mockSuccessResponse,
      delay: 100,
    };

    render(
      <MockedProvider mocks={[delayedMock]} addTypename={false}>
        <InviteUserDialog {...defaultProps} />
      </MockedProvider>
    );

    const emailInput = screen.getByLabelText(/email/i);
    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);

    await user.type(emailInput, 'newuser@example.com');
    await user.type(firstNameInput, 'John');
    await user.type(lastNameInput, 'Doe');

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    await user.click(submitButton);

    // Button should show loading state
    await waitFor(() => {
      expect(screen.getByText(/sending/i)).toBeInTheDocument();
    });
  });

  it('displays success message after successful invitation', async () => {
    const user = userEvent.setup();

    render(
      <MockedProvider mocks={[mockSuccessResponse]} addTypename={false}>
        <InviteUserDialog {...defaultProps} />
      </MockedProvider>
    );

    const emailInput = screen.getByLabelText(/email/i);
    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);

    await user.type(emailInput, 'newuser@example.com');
    await user.type(firstNameInput, 'John');
    await user.type(lastNameInput, 'Doe');

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invitation sent/i)).toBeInTheDocument();
    });
  });

  it('calls onSuccess callback after successful invitation', async () => {
    const user = userEvent.setup();

    render(
      <MockedProvider mocks={[mockSuccessResponse]} addTypename={false}>
        <InviteUserDialog {...defaultProps} />
      </MockedProvider>
    );

    const emailInput = screen.getByLabelText(/email/i);
    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);

    await user.type(emailInput, 'newuser@example.com');
    await user.type(firstNameInput, 'John');
    await user.type(lastNameInput, 'Doe');

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });
  });

  it('clears form after successful submission', async () => {
    const user = userEvent.setup();

    render(
      <MockedProvider mocks={[mockSuccessResponse]} addTypename={false}>
        <InviteUserDialog {...defaultProps} />
      </MockedProvider>
    );

    const emailInput = screen.getByLabelText(/email/i);
    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);

    await user.type(emailInput, 'newuser@example.com');
    await user.type(firstNameInput, 'John');
    await user.type(lastNameInput, 'Doe');

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toHaveValue('');
      expect(screen.getByLabelText(/first name/i)).toHaveValue('');
      expect(screen.getByLabelText(/last name/i)).toHaveValue('');
    });
  });

  it('displays error message on failure', async () => {
    const user = userEvent.setup();

    render(
      <MockedProvider mocks={[mockErrorResponse]} addTypename={false}>
        <InviteUserDialog {...defaultProps} />
      </MockedProvider>
    );

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'invalid@example.com');

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/user already invited/i)).toBeInTheDocument();
    });
  });

  it('disables all form fields during loading', async () => {
    const user = userEvent.setup();

    // Create a mock with delay to catch loading state
    const delayedMock = {
      ...mockSuccessResponse,
      delay: 500,
    };

    render(
      <MockedProvider mocks={[delayedMock]} addTypename={false}>
        <InviteUserDialog {...defaultProps} />
      </MockedProvider>
    );

    const emailInput = screen.getByLabelText(/email/i);
    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);

    await user.type(emailInput, 'newuser@example.com');
    await user.type(firstNameInput, 'John');
    await user.type(lastNameInput, 'Doe');

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    await user.click(submitButton);

    // Check that fields are disabled during loading
    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeDisabled();
      expect(screen.getByLabelText(/first name/i)).toBeDisabled();
      expect(screen.getByLabelText(/last name/i)).toBeDisabled();
    });
  });

  it('does not render when closed', () => {
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <InviteUserDialog {...defaultProps} open={false} />
      </MockedProvider>
    );

    expect(screen.queryByText('Invite User to Test Organization')).not.toBeInTheDocument();
  });
});
