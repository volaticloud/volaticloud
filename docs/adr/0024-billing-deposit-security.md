# ADR-0024: Billing Deposit Security — Preventing Credit Leaks

**Status:** Accepted
**Date:** 2026-01-31

## Context

The credit-based billing system (ADR-0022) deposits credits into an organization's balance when subscription invoices are paid. Multiple Stripe webhook events and application code paths can trigger credit deposits, creating a risk of duplicate or unearned deposits if not carefully controlled.

## Threat Model

### Deposit Trigger Paths

Every path that adds credits to a balance must be accounted for:

| # | Trigger | Function | When |
|---|---------|----------|------|
| 1 | User subscribes via Checkout | `handleSubscriptionCheckout` → `ProcessSubscriptionDeposit` | Initial subscription |
| 2 | Stripe fires `invoice.payment_succeeded` | `handleInvoicePaymentSucceeded` → `ProcessSubscriptionDeposit` | Every paid invoice |
| 3 | User pays manual deposit via Checkout | `handleCheckoutCompleted` → `AddCredits` | One-time deposit |
| 4 | First org auto-assign | `AssignStarterPlanIfFirstOrg` → `AddCredits` | Org creation |
| 5 | Admin adds credits | `AdminAddCredits` → `AddCredits` | Manual admin action |

### Identified Vulnerabilities (Pre-Fix)

#### V1: Double Deposit on Initial Subscription (CRITICAL)

When a user subscribes via Checkout, Stripe fires **two** events:
1. `checkout.session.completed` → deposits with reference `session.ID`
2. `invoice.payment_succeeded` (billing_reason=`subscription_create`) → deposits with reference `invoice.ID`

Different reference IDs bypass idempotency → **2× the monthly deposit**.

#### V2: Proration Invoice Triggers Full Deposit (CRITICAL)

When a user upgrades plans (e.g., Starter $5/mo → Enterprise $200/mo):
1. `ChangeSubscriptionPlan` calls Stripe with `ProrationBehavior: "create_prorations"`
2. Stripe charges the prorated price difference (e.g., $77)
3. Stripe fires `invoice.payment_succeeded` (billing_reason=`subscription_update`)
4. `ProcessSubscriptionDeposit` reads the **new** `monthlyDeposit` ($200) and deposits it

**Exploit:** Upgrade → get $200 deposit for $77 → immediately downgrade → Stripe credits ~$77 back. Net cost ≈ $0, net credits = $200.

#### V3: Double Deposit on Starter Auto-Assign (MODERATE)

Org creation calls `AddCredits` with reference `starter_init:{ownerID}`. Then Stripe fires `invoice.payment_succeeded` (billing_reason=`subscription_create`) with reference `invoice.ID`. Different references → **2× starter deposit**.

#### V4: Admin-Assigned Subscription Invoice (LOW)

`AdminAssignSubscription` creates a Stripe subscription directly. Stripe fires `invoice.payment_succeeded` with `subscription_create`. Since the admin resolver does NOT call `ProcessSubscriptionDeposit` locally, this results in exactly one deposit — **not vulnerable**, but worth documenting as a dependency on the webhook filter.

## Decision

### Rule: Each subscription lifecycle event triggers exactly ONE deposit through exactly ONE path

```
┌─────────────────────────┬──────────────────────────────┬─────────────────────────┐
│ Event                   │ Deposit Path                 │ invoice.payment_succeeded│
├─────────────────────────┼──────────────────────────────┼─────────────────────────┤
│ User subscribes         │ checkout.session.completed    │ SKIP (subscription_     │
│ (via Checkout)          │ → handleSubscriptionCheckout  │ create)                 │
├─────────────────────────┼──────────────────────────────┼─────────────────────────┤
│ Auto-assign starter     │ AssignStarterPlanIfFirstOrg   │ SKIP (subscription_     │
│ (org creation)          │ → AddCredits                  │ create)                 │
├─────────────────────────┼──────────────────────────────┼─────────────────────────┤
│ Admin assigns plan      │ invoice.payment_succeeded     │ SKIP (subscription_     │
│                         │ (no local deposit in admin    │ create) — deposit comes │
│                         │ resolver)                     │ from nowhere! See note. │
├─────────────────────────┼──────────────────────────────┼─────────────────────────┤
│ Monthly renewal         │ invoice.payment_succeeded     │ ALLOW (subscription_    │
│                         │ → ProcessSubscriptionDeposit  │ cycle)                  │
├─────────────────────────┼──────────────────────────────┼─────────────────────────┤
│ Plan upgrade/downgrade  │ (none — no deposit)           │ SKIP (subscription_     │
│                         │                               │ update)                 │
├─────────────────────────┼──────────────────────────────┼─────────────────────────┤
│ Manual deposit          │ checkout.session.completed    │ N/A (not a subscription │
│                         │ → AddCredits (actual amount)  │ invoice)                │
└─────────────────────────┴──────────────────────────────┴─────────────────────────┘
```

> **Note on AdminAssignSubscription:** After this fix, admin-assigned subscriptions do NOT receive an initial deposit because `invoice.payment_succeeded` with `subscription_create` is now skipped, and the admin resolver doesn't call `ProcessSubscriptionDeposit`. This is intentional — admins should use `AdminAddCredits` separately if an initial deposit is needed. This prevents accidental double-deposits if the admin flow is later refactored.

### Implementation

**`handleInvoicePaymentSucceeded` in `internal/billing/webhook.go`:**

```go
// SECURITY: Only deposit credits for recurring subscription renewals.
if invoice.BillingReason != stripe.InvoiceBillingReasonSubscriptionCycle {
    log.Printf("Skipping deposit for invoice %s (billing_reason=%s)", invoice.ID, invoice.BillingReason)
    return nil
}
```

This single filter eliminates V1, V2, V3, and V4 simultaneously.

### Idempotency (Defense in Depth)

`AddCredits` checks `referenceID` uniqueness before depositing. This prevents duplicate processing if Stripe retries a webhook. Every deposit path provides a unique, stable reference:

- Checkout subscription: `session.ID`
- Starter auto-assign: `starter_init:{ownerID}`
- Manual deposit: `session.ID`
- Renewal: `invoice.ID`

### What Stripe's `create_prorations` Does

- **Upgrade:** Stripe creates an invoice for the price difference (charged immediately). `billing_reason=subscription_update`.
- **Downgrade:** Stripe creates a credit note applied to the next invoice. `billing_reason=subscription_update`.
- **Neither** triggers a credit deposit after this fix.

## Consequences

### Positive
- Eliminates all identified credit leak vectors
- Single, auditable filter point for deposit authorization
- Each lifecycle event has exactly one deposit path — no ambiguity
- Idempotency provides defense-in-depth against webhook retries

### Negative
- Admin-assigned subscriptions no longer get automatic initial deposits (must use `AdminAddCredits`)
- If Stripe changes `BillingReason` semantics, deposits could silently stop — monitoring recommended

### Future Considerations
- Add alerting/monitoring on skipped invoices to detect anomalies
- Consider a plan change cooldown if Stripe processing fee abuse becomes a concern
- Consider rate-limiting `ChangeSubscriptionPlan` to prevent rapid switching
- If adding trials or coupons, audit deposit paths again for new vectors
