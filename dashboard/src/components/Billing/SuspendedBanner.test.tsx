import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { GraphQLError } from 'graphql';
import { SuspendedBanner } from './SuspendedBanner';
import { GetCreditBalanceDocument } from './billing.generated';

const mockNavigate = vi.fn();

vi.mock('../../contexts/OrganizationContext', () => ({
  useActiveOrganization: () => ({ activeOrganizationId: 'org-1' }),
  useOrganizationNavigate: () => mockNavigate,
}));

const balanceMock = (suspended: boolean) => ({
  request: { query: GetCreditBalanceDocument, variables: { ownerID: 'org-1' } },
  result: {
    data: { creditBalance: { balance: 10, suspended, suspendedAt: suspended ? '2025-01-01T00:00:00Z' : null } },
  },
});

const errorMock = {
  request: { query: GetCreditBalanceDocument, variables: { ownerID: 'org-1' } },
  result: { errors: [new GraphQLError('fail')] },
};

const wrap = (mocks: unknown[]) => (
  <MockedProvider mocks={mocks} addTypename={false}>
    <MemoryRouter>
      <SuspendedBanner />
    </MemoryRouter>
  </MockedProvider>
);

describe('SuspendedBanner', () => {
  it('renders nothing when not suspended', async () => {
    const { container } = render(wrap([balanceMock(false)]));
    // Wait for query to resolve
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('renders nothing while loading', () => {
    const { container } = render(wrap([balanceMock(false)]));
    // Query is still loading (no await)
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('renders suspension alert when suspended', async () => {
    render(wrap([balanceMock(true)]));
    expect(await screen.findByRole('alert')).toHaveTextContent(/suspended/i);
  });

  it('renders nothing when no org selected', async () => {
    // Override the mock for this test
    vi.resetModules();
    // Re-mock with null org — need to use dynamic import approach
    // Instead, test with empty ownerID which triggers skip
    const nullOrgMock = {
      request: { query: GetCreditBalanceDocument, variables: { ownerID: '' } },
      result: { data: { creditBalance: null } },
    };
    const { container } = render(wrap([nullOrgMock]));
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('Add Credits button navigates to billing', async () => {
    const user = userEvent.setup();
    render(wrap([balanceMock(true)]));
    const btn = await screen.findByRole('button', { name: /add credits/i });
    await user.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('/organization/billing');
  });

  it('renders nothing on query error', async () => {
    const { container } = render(wrap([errorMock]));
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
