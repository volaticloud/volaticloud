import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { GraphQLError } from 'graphql';
import { SubscriptionGate } from './SubscriptionGate';
import { GetSubscriptionInfoDocument } from './billing.generated';

vi.mock('../../contexts/OrganizationContext', () => ({
  useActiveOrganization: () => ({ activeOrganizationId: 'org-1' }),
  useOrganizationNavigate: () => vi.fn(),
}));

// Also mock NoSubscriptionView to simplify assertions
vi.mock('./NoSubscriptionView', () => ({
  NoSubscriptionView: () => <div data-testid="no-subscription-view">No Subscription</div>,
}));

const subMock = (status: string | null) => ({
  request: { query: GetSubscriptionInfoDocument, variables: { ownerID: 'org-1' } },
  result: {
    data: status
      ? {
          subscriptionInfo: {
            planName: 'starter',
            monthlyDeposit: 10,
            status,
            currentPeriodEnd: '2025-12-31T00:00:00Z',
            features: ['live_trading', 'backtesting'],
          },
        }
      : { subscriptionInfo: null },
  },
});

const errorMock = {
  request: { query: GetSubscriptionInfoDocument, variables: { ownerID: 'org-1' } },
  result: { errors: [new GraphQLError('fail')] },
};

const wrap = (mocks: unknown[], children?: React.ReactNode) => (
  <MockedProvider mocks={mocks} addTypename={false}>
    <MemoryRouter>
      <SubscriptionGate>{children ?? <div data-testid="child">Protected Content</div>}</SubscriptionGate>
    </MemoryRouter>
  </MockedProvider>
);

describe('SubscriptionGate', () => {
  it('renders children when subscription is active', async () => {
    render(wrap([subMock('active')]));
    expect(await screen.findByTestId('child')).toBeInTheDocument();
  });

  it('renders children when subscription is canceling', async () => {
    render(wrap([subMock('canceling')]));
    expect(await screen.findByTestId('child')).toBeInTheDocument();
  });

  it('renders NoSubscriptionView when no subscription', async () => {
    render(wrap([subMock(null)]));
    expect(await screen.findByTestId('no-subscription-view')).toBeInTheDocument();
  });

  it('renders NoSubscriptionView when subscription is canceled', async () => {
    render(wrap([subMock('canceled')]));
    expect(await screen.findByTestId('no-subscription-view')).toBeInTheDocument();
  });

  it('renders NoSubscriptionView when subscription is past_due', async () => {
    render(wrap([subMock('past_due')]));
    expect(await screen.findByTestId('no-subscription-view')).toBeInTheDocument();
  });

  it('renders NoSubscriptionView on query error', async () => {
    render(wrap([errorMock]));
    expect(await screen.findByTestId('no-subscription-view')).toBeInTheDocument();
  });
});
