# ADR-0023: Self-Service Subscription Management

Date: 2026-01-31

## Status

Accepted

## Context and Problem Statement

ADR-0022 established the credit-based billing system with Stripe integration, but subscription management (subscribe, change plan, cancel) required admin intervention. Users need self-service flows to manage their own subscriptions from the billing page.

Key questions this ADR addresses:

- How does subscribing work?
- What happens when a user cancels?
- What happens to credits and money when switching plans?
- What happens to credits when canceling?

## Decision Drivers

- Users must be able to subscribe without admin help
- Plan changes must be fair (prorated)
- Cancellation must not immediately disrupt service
- Credits are prepaid and non-refundable (simpler accounting)
- Stripe should remain the source of truth for subscription state

## Decision Outcome

### Subscribe Flow

Users subscribe via Stripe Checkout (hosted payment page). The flow is:

```mermaid
sequenceDiagram
    participant U as User
    participant D as Dashboard
    participant API as GraphQL API
    participant S as Stripe
    participant WH as Webhook Handler

    U->>D: Click "Subscribe" on plan card
    D->>API: createSubscriptionSession(ownerID, priceID)
    API->>S: Create Checkout Session (mode: subscription)
    S-->>API: Session URL
    API-->>D: Redirect URL
    D->>S: Redirect to Stripe Checkout
    U->>S: Enter payment details, confirm
    S->>WH: checkout.session.completed (type: subscription_checkout)
    WH->>WH: Fetch full subscription with product metadata
    WH->>WH: Create/update StripeSubscription record
    WH->>WH: ProcessSubscriptionDeposit (initial credit top-up)
    S->>WH: invoice.payment_succeeded (first invoice)
```

**Guard rails:**

- If org already has an active or canceling subscription, the mutation returns an error
- If org previously had a canceled subscription, the existing Stripe customer ID is reused
- If no prior subscription exists, a new Stripe customer is created

### Change Plan Flow

Plan changes use Stripe's subscription update API with prorations:

```mermaid
sequenceDiagram
    participant U as User
    participant D as Dashboard
    participant API as GraphQL API
    participant S as Stripe

    U->>D: Click "Switch Plan", confirm in dialog
    D->>API: changeSubscriptionPlan(ownerID, newPriceID)
    API->>S: Get current subscription (find item ID)
    API->>S: Update subscription item with new price
    Note over S: Proration: create_prorations
    S-->>API: Updated subscription
    API->>API: Extract plan metadata, update DB immediately
    API-->>D: Updated SubscriptionInfo
    Note over S: Stripe fires customer.subscription.updated
    Note over S: Webhook also syncs (idempotent)
```

**Proration behavior (`create_prorations`):**

- **Upgrading** (e.g., Starter -> Pro): User is charged the prorated difference for the remaining days on the next invoice. The new higher monthly deposit takes effect at the next renewal.
- **Downgrading** (e.g., Pro -> Starter): User receives a prorated credit on the next invoice. The new lower monthly deposit takes effect at the next renewal.
- **Credits are NOT adjusted** during plan change. Existing credit balance is untouched. Only the `monthlyDeposit` amount changes for future renewals.

**If the subscription was in `canceling` state**, switching plans also clears the `cancel_at_period_end` flag, re-activating the subscription.

### Cancel Flow

Cancellation uses Stripe's "cancel at period end" — the subscription stays active until the billing period expires:

```mermaid
sequenceDiagram
    participant U as User
    participant D as Dashboard
    participant API as GraphQL API
    participant S as Stripe

    U->>D: Click "Cancel Subscription", confirm in dialog
    D->>API: cancelSubscription(ownerID)
    API->>S: Update subscription: cancel_at_period_end = true
    API->>API: Set DB status to "canceling"
    API-->>D: Updated SubscriptionInfo (status: canceling)
    Note over D: Shows "Cancels on [date]" instead of "Renews on [date]"
    Note over S: At period end...
    S->>API: customer.subscription.deleted webhook
    API->>API: Set DB status to "canceled"
```

**What happens on cancel:**

| Aspect | Behavior | Rationale |
|--------|----------|-----------|
| **Service access** | Continues until period end | User paid for the full period |
| **Credits** | Remain in balance, continue to be usable | Credits are prepaid, non-refundable |
| **Monthly deposit** | No more deposits after cancellation | No renewal = no deposit |
| **Money refund** | No refund for current period | Stripe handles this — `cancel_at_period_end` means no prorated refund |
| **Feature gating** | Features remain until period end | Status is `canceling` (not `canceled`) |
| **Re-subscribe** | User can subscribe to any plan after cancellation | Reuses existing Stripe customer ID |

### Subscription Status Lifecycle

```mermaid
stateDiagram-v2
    [*] --> active: Subscribe (checkout completed)
    active --> active: Plan change
    active --> canceling: Cancel at period end
    canceling --> active: Plan change (re-activates)
    canceling --> canceled: Period ends (Stripe webhook)
    active --> past_due: Payment fails
    past_due --> active: Payment succeeds
    past_due --> canceled: Exhausted retries
    canceled --> active: Re-subscribe (new checkout)
```

### Credit Deposit Rules on Renewal

The `ProcessSubscriptionDeposit` function (from ADR-0022) has specific rules:

1. **Only deposits if status is `active`** — `canceling` subscriptions skip deposits
2. **Full deposit**: The full `monthlyDeposit` amount is always added. Manual deposits are independent and do not reduce the subscription deposit
3. **Idempotent**: Uses `reference_id` to prevent duplicate deposits on webhook retries

## Implementation

### Key Files

- `internal/enum/billing.go` — Added `StripeSubCanceling` status
- `internal/billing/stripe.go` — `CreateSubscriptionCheckoutSession`, `UpdateSubscriptionPrice`, `CancelSubscriptionAtPeriodEnd`
- `internal/billing/webhook.go` — `handleSubscriptionCheckout`, updated `mapStripeStatusWithCancel`
- `internal/graph/schema.graphqls` — 3 new mutations with `@hasScope` ORGANIZATION edit
- `internal/graph/schema.resolvers.go` — Resolver implementations
- `dashboard/src/components/Billing/billing.graphql` — Frontend GraphQL operations
- `dashboard/src/pages/Organization/OrganizationBillingPage.tsx` — Subscribe/Switch/Cancel UI

### GraphQL Mutations

```graphql
# Start a new subscription via Stripe Checkout
createSubscriptionSession(ownerID: String!, priceID: String!): String!
  @hasScope(resource: "ownerID", scope: "edit", resourceType: ORGANIZATION)

# Change plan on existing subscription (with proration)
changeSubscriptionPlan(ownerID: String!, newPriceID: String!): SubscriptionInfo!
  @hasScope(resource: "ownerID", scope: "edit", resourceType: ORGANIZATION)

# Cancel at end of current billing period
cancelSubscription(ownerID: String!): SubscriptionInfo!
  @hasScope(resource: "ownerID", scope: "edit", resourceType: ORGANIZATION)
```

## Consequences

### Positive

- Users can fully manage subscriptions without admin intervention
- Stripe Checkout handles PCI compliance for payment collection
- Prorations are fair and automatic via Stripe
- Cancellation is non-disruptive (service continues until period end)
- Credits persist through cancellation (no clawback complexity)

### Negative

- No immediate refunds on cancellation (by design — credits model is prepaid)
- Plan change requires confirmation dialog (extra click) to prevent accidental changes
- Webhook dependency: subscription record creation happens asynchronously after checkout

### Risks

- If Stripe webhook is delayed after checkout, user returns to billing page before subscription appears. Mitigated by 3-second delayed refetch on `?subscription=success` return.
- Plan change updates DB immediately AND via webhook — must be idempotent. Current implementation is safe because webhook uses same extraction logic.

## References

- [ADR-0022](0022-credit-based-billing.md) — Credit-Based Billing System (foundation)
- [ADR-0008](0008-multi-tenant-authorization.md) — Multi-Tenant Authorization (scope enforcement)
- [Stripe Checkout Subscriptions](https://docs.stripe.com/billing/subscriptions/build-subscriptions?ui=checkout)
- [Stripe Subscription Prorations](https://docs.stripe.com/billing/subscriptions/prorations)
- [Stripe Cancel at Period End](https://docs.stripe.com/billing/subscriptions/cancel)
