// Package billing implements the credit-based billing system for VolatiCloud.
//
// # Overview
//
// Organizations have a prepaid credit balance consumed by runner usage.
// Stripe Billing manages subscriptions and payments. Credits are deducted
// hourly (same cadence as existing usage aggregation).
//
// Core model: 1 credit = $1. Subscriptions auto-deposit credits monthly.
// Users can also manually deposit. When balance hits zero, operations are
// suspended (bots stopped, new resource creation blocked).
//
// # Subscription Plans
//
//	| Plan       | Price    | Monthly Deposit |
//	|------------|----------|-----------------|
//	| Starter    | Free     | $5              |
//	| Pro        | $29/mo   | $60             |
//	| Enterprise | $79/mo   | $200            |
//	| Custom     | Variable | Variable        |
//
// # Architecture
//
//	```mermaid
//	flowchart TD
//	    Stripe[Stripe API] -->|Webhooks| WH[webhook.go]
//	    WH -->|invoice.payment_succeeded| Sub[subscription.go]
//	    Sub -->|ProcessSubscriptionDeposit| Bal[balance.go]
//	    Agg[UsageAggregatorWorker] -->|DeductHourlyCosts| Ded[deduction.go]
//	    Ded --> Bal
//	    Res[GraphQL Resolvers] -->|EnsureSufficientCredits| Enf[enforcement.go]
//	    Enf --> Bal
//	    OrgCreate[organization.Create] -->|EnsureBalanceExists| Bal
//	```
//
// # Key Functions
//
//   - GetBalance / AddCredits / DeductCredits — balance operations (balance.go)
//   - EnsureSufficientCredits — enforcement gate for resolvers (enforcement.go)
//   - DeductHourlyCosts — hourly cost deduction from aggregations (deduction.go)
//   - ProcessSubscriptionDeposit — top-up logic on payment (subscription.go)
//   - ExtractPlanMetadata — read plan details from Stripe subscription (onboarding.go)
//   - HasFeature — feature gating check (features.go)
//   - NewWebhookHandler — Stripe webhook HTTP handler (webhook.go)
//
// # Enforcement Policy
//
// Subscriptions are mandatory for all app access (see ADR-0025):
//   - EnsureSufficientCredits rejects orgs without CreditBalance records
//   - HasFeature rejects orgs without active/canceling subscriptions
//   - Frontend SubscriptionGate blocks dashboard routes for orgs without subscriptions
//   - Organization settings and billing pages remain accessible for self-service subscribe
package billing
