# 0025. Mandatory Subscription Enforcement

Date: 2026-02-01

## Status

Accepted

## Context and Problem Statement

ADR-0022 introduced credit-based billing with subscriptions and credit balances. The initial implementation included escape hatches in `HasFeature` and `EnsureSufficientCredits` that returned `nil` (allowed access) when no subscription or balance record existed. This was intended as a migration path for organizations created before the billing system, but it creates an indefinite bypass — any org without a subscription gets unlimited free access with no enforcement.

Subscriptions are no longer auto-assigned on org creation. Users must subscribe manually via Stripe Checkout (which requires payment credentials). New organizations are blocked by the `SubscriptionGate` until the user subscribes. The escape hatches are a liability.

## Decision Drivers

- Eliminate indefinite free access loophole
- Simplify billing logic (no special cases for "pre-billing" orgs)
- Ensure all resource usage is tracked against a subscription
- Provide clear UX when subscription is missing or expired
- Maintain access for `canceling` subscriptions (active until period end, per ADR-0023)

## Considered Options

### Option 1: Remove escape hatches + frontend gate

Remove backend escape hatches so `HasFeature` and `EnsureSufficientCredits` reject orgs without records. Add a `SubscriptionGate` component in the dashboard that blocks all main app routes and shows a subscribe page.

**Pros:**

- Fail-closed: no subscription = no access at both layers
- Self-service: users can subscribe immediately from the blocking page
- Clean: no special-case logic in enforcement functions

**Cons:**

- Pre-existing orgs without subscriptions are immediately blocked
- Requires test updates (graph tests need billing records)

### Option 2: Grace period with migration

Keep escape hatches temporarily, add a migration job that assigns Starter plans to all existing orgs, then remove escape hatches.

**Pros:**

- No disruption for existing orgs

**Cons:**

- Complexity of migration job
- Escape hatches remain in codebase during grace period
- Subscriptions require manual Checkout, so affected orgs are unlikely to exist

### Option 3: Frontend-only gate (keep backend escape hatches)

Add the `SubscriptionGate` UI but leave backend escape hatches intact.

**Pros:**

- Less disruptive backend change

**Cons:**

- API still allows ungated access
- Inconsistent enforcement between frontend and backend

## Decision Outcome

Chosen option: **Option 1 — Remove escape hatches + frontend gate**. Subscriptions require manual Stripe Checkout with payment credentials, and fail-closed enforcement at both layers is the safest approach.

### Frontend Gate

- `SubscriptionGate` wraps `DashboardLayout`'s `<Outlet />`, blocking all main app routes (bots, strategies, exchanges, backtests, trades, runners, alerts)
- Organization settings, profile, and billing pages are under `OrganizationLayout` — **not gated** — so users can always navigate to billing and subscribe
- Polls subscription status every 60s to catch webhook-driven status changes
- Shows `NoSubscriptionView` with plan cards and Stripe Checkout subscribe flow

### Backend Enforcement

- `HasFeature`: returns error if no `StripeSubscription` record exists (was: return nil)
- `EnsureSufficientCredits`: returns error if no `CreditBalance` record exists (was: return nil)

### Subscription Status Lifecycle

| Status | Access | Action |
|--------|--------|--------|
| `active` | Full access | — |
| `canceling` | Full access until period end | Per ADR-0023 |
| `canceled` | Blocked | Must resubscribe |
| `past_due` | Blocked | Must fix payment |
| No subscription | Blocked | Must subscribe |

### Consequences

**Positive:**

- Eliminates indefinite free access loophole
- Consistent enforcement at both frontend and backend
- Self-service subscribe flow reduces support burden
- Simpler billing code (no special cases)

**Negative:**

- Any org without a subscription is immediately blocked (mitigated: subscribe flow is on the blocking page)
- Graph integration tests need billing records in setup

## Implementation

### Key Files

- `internal/billing/features.go:20` — `HasFeature` rejects missing subscription
- `internal/billing/enforcement.go:25` — `EnsureSufficientCredits` rejects missing balance
- `dashboard/src/components/Billing/SubscriptionGate.tsx` — Gate component wrapping DashboardLayout outlet
- `dashboard/src/components/Billing/NoSubscriptionView.tsx` — Blocking page with plan cards + Stripe Checkout
- `dashboard/src/components/Layout/DashboardLayout.tsx:57` — Integration point

### Route Architecture

```
DashboardLayout (has SubscriptionGate)
├── / (dashboard)
├── /bots
├── /strategies
├── /exchanges
├── /backtests
├── /trades
├── /runners
└── /alerts

OrganizationLayout (NO SubscriptionGate)
├── /organization/details
├── /organization/users
├── /organization/usage
└── /organization/billing  ← always accessible
```

## Validation

- `go test ./internal/billing/...` — no-subscription cases return errors
- `SubscriptionGate.test.tsx` — 6 tests covering all subscription states
- Graph integration tests use `CreateTestBillingRecords` helper

## References

- [ADR-0022](0022-credit-based-billing.md) — Credit-Based Billing System
- [ADR-0023](0023-self-service-subscription-management.md) — Self-Service Subscription Management
- [ADR-0024](0024-billing-deposit-security.md) — Billing Deposit Security
