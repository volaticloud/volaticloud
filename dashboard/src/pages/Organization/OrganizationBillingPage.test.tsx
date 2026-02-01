import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { OrganizationBillingPage } from './OrganizationBillingPage';
import {
  GetCreditBalanceDocument,
  GetCreditTransactionsDocument,
  GetSubscriptionInfoDocument,
  GetAvailablePlansDocument,
  CreateDepositSessionDocument,
  CreateSubscriptionSessionDocument,
  ChangeSubscriptionPlanDocument,
  CancelSubscriptionDocument,
  GetPaymentHistoryDocument,
} from '../../components/Billing/billing.generated';
import { CreditTransactionType } from '../../generated/types';

// --- Mocks ---

vi.mock('../../contexts/OrganizationContext', () => ({
  useActiveOrganization: () => ({ activeOrganizationId: 'org-1' }),
  useOrganizationNavigate: () => vi.fn(),
}));

// --- Helpers ---

const balanceMock = (balance: number, suspended = false): MockedResponse => ({
  request: { query: GetCreditBalanceDocument, variables: { ownerID: 'org-1' } },
  result: {
    data: { creditBalance: { balance, suspended, suspendedAt: suspended ? '2025-01-01T00:00:00Z' : null } },
  },
});

const subMock = (sub: Record<string, unknown> | null): MockedResponse => ({
  request: { query: GetSubscriptionInfoDocument, variables: { ownerID: 'org-1' } },
  result: { data: { subscriptionInfo: sub } },
});

const txMock = (transactions: Record<string, unknown>[] = []): MockedResponse => ({
  request: {
    query: GetCreditTransactionsDocument,
    variables: { ownerID: 'org-1', limit: 10, offset: 0 },
  },
  result: { data: { creditTransactions: transactions } },
});

const plansMock = (plans: Record<string, unknown>[] = []): MockedResponse => ({
  request: { query: GetAvailablePlansDocument },
  result: { data: { availablePlans: plans } },
});

const invoiceMock = (invoices: Record<string, unknown>[] = []): MockedResponse => ({
  request: { query: GetPaymentHistoryDocument, variables: { ownerID: 'org-1', limit: 50 } },
  result: { data: { paymentHistory: invoices } },
});

const baseMocks = (overrides: Partial<{
  balance: MockedResponse;
  sub: MockedResponse;
  tx: MockedResponse;
  plans: MockedResponse;
  invoices: MockedResponse;
}> = {}) => [
  overrides.balance ?? balanceMock(45.5),
  overrides.sub ?? subMock(null),
  overrides.tx ?? txMock(),
  overrides.plans ?? plansMock(),
  overrides.invoices ?? invoiceMock(),
];

const activeSub = {
  planName: 'Pro',
  monthlyDeposit: 50,
  status: 'active',
  currentPeriodEnd: '2025-06-01T00:00:00Z',
  features: ['live_trading', 'backtesting'],
};

const samplePlans = [
  {
    priceId: 'price_starter',
    productId: 'prod_1',
    displayName: 'Starter',
    description: 'For beginners',
    priceAmount: 10,
    monthlyDeposit: 10,
    features: ['backtesting'],
    displayOrder: 1,
  },
  {
    priceId: 'price_pro',
    productId: 'prod_2',
    displayName: 'Pro',
    description: 'For pros',
    priceAmount: 50,
    monthlyDeposit: 50,
    features: ['live_trading', 'backtesting'],
    displayOrder: 2,
  },
];

const sampleTx = (id: string, amount: number, type: CreditTransactionType) => ({
  id,
  amount,
  balanceAfter: 100 + amount,
  type,
  description: `tx-${id}`,
  referenceID: null,
  createdAt: '2025-01-15T10:00:00Z',
});

const wrap = (mocks: MockedResponse[], initialEntries: string[] = ['/billing']) => (
  <MockedProvider mocks={mocks} addTypename={false}>
    <MemoryRouter initialEntries={initialEntries}>
      <OrganizationBillingPage />
    </MemoryRouter>
  </MockedProvider>
);

// --- Tests ---

describe('OrganizationBillingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Prevent actual navigation
    delete (window as Record<string, unknown>).location;
    (window as Record<string, unknown>).location = { href: '', assign: vi.fn() };
  });

  describe('Loading & Balance', () => {
    it('shows loading skeleton while queries are pending', () => {
      render(wrap(baseMocks()));
      // Skeleton elements should be present before data loads
      expect(document.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    });

    it('renders balance card with formatted amount', async () => {
      render(wrap(baseMocks()));
      expect(await screen.findByText('$45.50')).toBeInTheDocument();
    });
  });

  describe('Subscription States', () => {
    it('active subscription shows plan info', async () => {
      render(wrap(baseMocks({ sub: subMock(activeSub) })));
      expect(await screen.findByText('Pro')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText(/50\.00 monthly deposit/)).toBeInTheDocument();
    });

    it('canceling subscription shows canceling chip', async () => {
      render(wrap(baseMocks({ sub: subMock({ ...activeSub, status: 'canceling' }) })));
      expect(await screen.findByText('Canceling')).toBeInTheDocument();
    });

    it('no subscription shows "No active subscription"', async () => {
      render(wrap(baseMocks({ sub: subMock(null) })));
      expect(await screen.findByText('No active subscription')).toBeInTheDocument();
    });

    it('past_due shows warning chip', async () => {
      render(wrap(baseMocks({ sub: subMock({ ...activeSub, status: 'past_due' }) })));
      expect(await screen.findByText('past_due')).toBeInTheDocument();
    });
  });

  describe('Suspension', () => {
    it('suspended shows alert banner', async () => {
      render(wrap(baseMocks({ balance: balanceMock(0, true) })));
      expect(await screen.findByText(/suspended due to insufficient credits/i)).toBeInTheDocument();
    });
  });

  describe('Deposit Flow', () => {
    it('deposit button opens dialog', async () => {
      const user = userEvent.setup();
      render(wrap(baseMocks()));
      const btn = await screen.findByRole('button', { name: /add credits/i });
      await user.click(btn);
      expect(await screen.findByLabelText(/amount/i)).toBeInTheDocument();
      expect(screen.getByText(/redirected to stripe/i)).toBeInTheDocument();
    });

    it('deposit submits amount and redirects', async () => {
      const user = userEvent.setup();
      const depositMutation: MockedResponse = {
        request: {
          query: CreateDepositSessionDocument,
          variables: { ownerID: 'org-1', amount: 25 },
        },
        result: { data: { createDepositSession: 'https://checkout.stripe.com/session-123' } },
      };
      render(wrap([...baseMocks(), depositMutation]));

      const addBtn = await screen.findByRole('button', { name: /add credits/i });
      await user.click(addBtn);

      const input = screen.getByLabelText(/amount/i);
      await user.clear(input);
      await user.type(input, '25');

      const payBtn = screen.getByRole('button', { name: /continue to payment/i });
      await user.click(payBtn);

      await waitFor(() => {
        expect(window.location.href).toBe('https://checkout.stripe.com/session-123');
      });
    });
  });

  describe('Subscription Actions', () => {
    it('subscribe button calls mutation', async () => {
      const user = userEvent.setup();
      const subscribeMutation: MockedResponse = {
        request: {
          query: CreateSubscriptionSessionDocument,
          variables: { ownerID: 'org-1', priceID: 'price_starter' },
        },
        result: { data: { createSubscriptionSession: 'https://checkout.stripe.com/sub-123' } },
      };
      render(wrap([...baseMocks({ sub: subMock(null), plans: plansMock(samplePlans) }), subscribeMutation]));

      // With no active sub, plans show "Subscribe" buttons
      const subscribeBtns = await screen.findAllByRole('button', { name: /^subscribe$/i });
      const subscribeBtn = subscribeBtns[0];
      await user.click(subscribeBtn);

      await waitFor(() => {
        expect(window.location.href).toBe('https://checkout.stripe.com/sub-123');
      });
    });

    it('change plan opens confirmation and calls mutation', async () => {
      const user = userEvent.setup();
      const starterOnly = [samplePlans[0]]; // Only Starter, not Pro
      const changeMutation: MockedResponse = {
        request: {
          query: ChangeSubscriptionPlanDocument,
          variables: { ownerID: 'org-1', newPriceID: 'price_starter' },
        },
        result: {
          data: {
            changeSubscriptionPlan: {
              planName: 'Starter',
              monthlyDeposit: 10,
              status: 'active',
              currentPeriodEnd: '2025-06-01T00:00:00Z',
              features: ['backtesting'],
            },
          },
        },
      };
      render(wrap([
        ...baseMocks({ sub: subMock(activeSub), plans: plansMock(starterOnly) }),
        changeMutation,
        subMock({ ...activeSub, planName: 'Starter' }),
      ]));

      // Use exact name to avoid matching FAQ accordion summary "What happens when I switch plans?"
      const switchBtn = await screen.findByRole('button', { name: 'Switch Plan' });
      await user.click(switchBtn);

      // Confirmation dialog
      expect(await screen.findByText(/are you sure you want to switch/i)).toBeInTheDocument();
      const confirmBtn = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText(/switched to starter plan/i)).toBeInTheDocument();
      });
    });

    it('cancel subscription opens confirmation and calls mutation', async () => {
      const user = userEvent.setup();
      const cancelMutation: MockedResponse = {
        request: {
          query: CancelSubscriptionDocument,
          variables: { ownerID: 'org-1' },
        },
        result: {
          data: {
            cancelSubscription: {
              planName: 'Pro',
              monthlyDeposit: 50,
              status: 'canceling',
              currentPeriodEnd: '2025-06-01T00:00:00Z',
              features: ['live_trading', 'backtesting'],
            },
          },
        },
      };
      render(wrap([
        ...baseMocks({ sub: subMock(activeSub) }),
        cancelMutation,
        subMock({ ...activeSub, status: 'canceling' }),
      ]));

      const cancelBtn = await screen.findByRole('button', { name: /cancel subscription/i });
      await user.click(cancelBtn);

      expect(await screen.findByText(/are you sure you want to cancel/i)).toBeInTheDocument();
      const confirmBtn = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText(/will cancel at the end/i)).toBeInTheDocument();
      });
    });
  });

  describe('Stripe Return Params', () => {
    it('deposit=success shows success snackbar', async () => {
      render(wrap(baseMocks(), ['/billing?deposit=success']));
      expect(await screen.findByText(/payment successful/i)).toBeInTheDocument();
    });

    it('subscription=success shows success snackbar', async () => {
      render(wrap(baseMocks(), ['/billing?subscription=success']));
      expect(await screen.findByText(/subscription activated/i)).toBeInTheDocument();
    });
  });

  describe('Transactions Table', () => {
    it('renders transaction rows', async () => {
      const transactions = [
        sampleTx('tx-1', 50, CreditTransactionType.SubscriptionDeposit),
        sampleTx('tx-2', 25, CreditTransactionType.ManualDeposit),
        sampleTx('tx-3', -10, CreditTransactionType.UsageDeduction),
      ];
      render(wrap(baseMocks({ tx: txMock(transactions) })));

      // Wait for data
      expect(await screen.findByText('Subscription Deposit')).toBeInTheDocument();
      expect(screen.getByText('Manual Deposit')).toBeInTheDocument();
      expect(screen.getByText('Usage Deduction')).toBeInTheDocument();
      expect(screen.getByText('+$50.00')).toBeInTheDocument();
      expect(screen.getByText('-$10.00')).toBeInTheDocument();
    });

    it('shows empty state for no transactions', async () => {
      render(wrap(baseMocks({ tx: txMock([]) })));
      expect(await screen.findByText(/no transactions yet/i)).toBeInTheDocument();
    });
  });

  describe('FAQ', () => {
    it('FAQ accordion expands on click', async () => {
      const user = userEvent.setup();
      render(wrap(baseMocks()));

      const faqBtn = await screen.findByText(/what happens when i cancel/i);
      // Content should not be visible initially (accordion collapsed)
      expect(screen.queryByText(/remains active until the end/i)).not.toBeVisible();

      await user.click(faqBtn);

      await waitFor(() => {
        expect(screen.getByText(/remains active until the end/i)).toBeVisible();
      });
    });
  });
});
