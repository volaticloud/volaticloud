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
│ User subscribes         │ checkout.session.completed    │ ALLOW (subscription_    │
│ (via Checkout)          │ → handleSubscriptionCheckout  │ create) — idempotent    │
│                         │ → ProcessSubscriptionDeposit  │ via same invoice.ID     │
│                         │   (uses LatestInvoice.ID)     │ as referenceID          │
├─────────────────────────┼──────────────────────────────┼─────────────────────────┤
│ Auto-assign starter     │ AssignStarterPlanIfFirstOrg   │ ALLOW (subscription_    │
│ (org creation)          │ → AddCredits                  │ create) — idempotent    │
│                         │   (uses starter_init:{org})   │ via same invoice.ID     │
├─────────────────────────┼──────────────────────────────┼─────────────────────────┤
│ Admin assigns plan      │ invoice.payment_succeeded     │ ALLOW (subscription_    │
│                         │ (no local deposit in admin    │ create) — this is the   │
│                         │ resolver)                     │ only deposit path       │
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

> **Why `subscription_create` is ALLOWED:** Stripe fires `invoice.payment_succeeded` (billing_reason=`subscription_create`) before `checkout.session.completed` arrives. If we skip `subscription_create`, the checkout handler must always deposit — but the subscription record may not exist yet when the invoice webhook fires. By allowing both paths and using the **same invoice ID as referenceID**, idempotency guarantees exactly one deposit regardless of webhook ordering. This also ensures admin-assigned subscriptions (which have no checkout event) receive their initial deposit.
>
> **Defense in depth:** Even if both checkout and invoice webhooks process the same initial invoice, `AddCredits` checks `referenceID` uniqueness inside the transaction — the second call is a no-op. See `TestBillingFlow_CheckoutThenInvoiceIdempotency` for the test covering this race.

### Implementation

**`handleInvoicePaymentSucceeded` in `internal/billing/webhook.go`:**

```go
// Deposit credits for subscription invoices.
//
// billing_reason values we process:
//   - subscription_cycle:  Monthly/annual renewal → deposit credits
//   - subscription_create: Initial subscription invoice → deposit credits
//     (idempotent via invoice.ID — safe even if checkout also deposits)
//
// billing_reason values we skip:
//   - subscription_update: Proration from plan change → SKIP (prevents V2)
//   - manual:              One-off invoice → SKIP
switch invoice.BillingReason {
case stripe.InvoiceBillingReasonSubscriptionCycle,
    stripe.InvoiceBillingReasonSubscriptionCreate:
    // OK — process deposit
default:
    log.Printf("[BILLING] action=deposit_skip invoice=%s billing_reason=%s",
        invoice.ID, invoice.BillingReason)
    return nil
}
```

This filter eliminates V2 (proration exploit) directly. V1 and V3 are eliminated by idempotency — both the checkout/onboarding path and the invoice webhook use the same `invoice.ID` as referenceID, so only one deposit succeeds. V4 is resolved by allowing `subscription_create`, which gives admin-assigned subscriptions their initial deposit.

### Idempotency (Defense in Depth)

`AddCredits` checks `referenceID` uniqueness before depositing. This prevents duplicate processing if Stripe retries a webhook. Every deposit path provides a unique, stable reference:

- Checkout subscription: `LatestInvoice.ID` (same as invoice webhook → idempotent)
- Starter auto-assign: `starter_init:{ownerID}` (onboarding path, invoice webhook uses `invoice.ID`)
- Manual deposit: `session.ID`
- Invoice webhook (create/cycle): `invoice.ID`

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
