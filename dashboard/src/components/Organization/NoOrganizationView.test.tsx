import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoOrganizationView } from './NoOrganizationView';

// Mock CreateOrganizationDrawer to isolate NoOrganizationView tests
vi.mock('./CreateOrganizationDrawer', () => ({
  CreateOrganizationDrawer: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="create-org-drawer">
        <button onClick={onClose}>Close Drawer</button>
      </div>
    ) : null,
}));

describe('NoOrganizationView', () => {
  it('renders the blocker page with correct title', () => {
    render(<NoOrganizationView />);

    expect(screen.getByText('Create Your Organization')).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(<NoOrganizationView />);

    expect(
      screen.getByText(/you don't have any organizations yet/i)
    ).toBeInTheDocument();
  });

  it('renders info alert about admin role', () => {
    render(<NoOrganizationView />);

    expect(
      screen.getByText(/you will automatically become the administrator/i)
    ).toBeInTheDocument();
  });

  it('renders Create Organization button', () => {
    render(<NoOrganizationView />);

    expect(
      screen.getByRole('button', { name: /create organization/i })
    ).toBeInTheDocument();
  });

  it('opens drawer when Create Organization button is clicked', async () => {
    const user = userEvent.setup();
    render(<NoOrganizationView />);

    expect(screen.queryByTestId('create-org-drawer')).not.toBeInTheDocument();

    const createButton = screen.getByRole('button', { name: /create organization/i });
    await user.click(createButton);

    expect(screen.getByTestId('create-org-drawer')).toBeInTheDocument();
  });

  it('closes drawer when onClose is called', async () => {
    const user = userEvent.setup();
    render(<NoOrganizationView />);

    // Open drawer
    const createButton = screen.getByRole('button', { name: /create organization/i });
    await user.click(createButton);
    expect(screen.getByTestId('create-org-drawer')).toBeInTheDocument();

    // Close drawer
    const closeButton = screen.getByText('Close Drawer');
    await user.click(closeButton);

    expect(screen.queryByTestId('create-org-drawer')).not.toBeInTheDocument();
  });
});
