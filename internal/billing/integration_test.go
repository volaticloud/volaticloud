package billing

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v82"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/credittransaction"
	"volaticloud/internal/ent/enttest"
	"volaticloud/internal/ent/stripesubscription"
	"volaticloud/internal/enum"
)

// setupIntegrationDB creates a fresh in-memory DB and a mock Stripe API.
func setupIntegrationDB(t *testing.T, dbName string) (*ent.Client, *mockStripeAPI) {
	t.Helper()
	client := enttest.Open(t, "sqlite3", fmt.Sprintf("file:%s?mode=memory&cache=shared&_fk=1", dbName))
	t.Cleanup(func() { client.Close() })
	return client, &mockStripeAPI{}
}

// createActiveSubscription creates a StripeSubscription + CreditBalance for an org.
func createActiveSubscription(ctx context.Context, t *testing.T, client *ent.Client, ownerID, subID string, monthlyDeposit float64, features []string) {
	t.Helper()
	now := time.Now()
	_, err := client.StripeSubscription.Create().
		SetOwnerID(ownerID).
		SetStripeCustomerID("cus_" + ownerID).
		SetStripeSubscriptionID(subID).
		SetStripePriceID("price_test").
		SetPlanName("Pro").
		SetMonthlyDeposit(monthlyDeposit).
		SetStatus(enum.StripeSubActive).
		SetFeatures(features).
		SetCurrentPeriodStart(now).
		SetCurrentPeriodEnd(now.Add(30 * 24 * time.Hour)).
		Save(ctx)
	require.NoError(t, err)
	require.NoError(t, EnsureBalanceExists(ctx, client, ownerID))
}

func TestBillingFlow_SubscriptionLifecycle(t *testing.T) {
	client, mock := setupIntegrationDB(t, "integ_lifecycle")
	ctx := context.Background()

	ownerID := "org-lifecycle"
	subID := "sub_lifecycle_001"
	now := time.Now().Unix()

	// Mock: GetSubscription returns a Pro subscription
	mock.getSubscriptionFn = func(id string) (*stripe.Subscription, error) {
		return &stripe.Subscription{
			ID:     id,
			Status: stripe.SubscriptionStatusActive,
			Customer: &stripe.Customer{
				ID: "cus_lifecycle",
			},
			Items: &stripe.SubscriptionItemList{
				Data: []*stripe.SubscriptionItem{
					{
						CurrentPeriodStart: now,
						CurrentPeriodEnd:   now + 30*24*3600,
						Price: &stripe.Price{
							ID: "price_pro",
							Product: &stripe.Product{
								Name: "Pro Plan",
								Metadata: map[string]string{
									"display_name":    "Pro",
									"monthly_deposit": "60",
									"features":        "live_trading,backtesting",
								},
							},
						},
					},
				},
			},
			LatestInvoice: &stripe.Invoice{
				ID: "inv_initial",
			},
		}, nil
	}

	// Step 1: Checkout creates subscription + initial deposit
	session := map[string]interface{}{
		"id": "cs_lifecycle_001",
		"metadata": map[string]interface{}{
			"owner_id": ownerID,
			"type":     "subscription_checkout",
		},
		"subscription": map[string]interface{}{
			"id": subID,
		},
	}
	event := makeEvent("checkout.session.completed", session)
	require.NoError(t, handleCheckoutCompleted(ctx, client, mock, event))

	sub, err := client.StripeSubscription.Query().
		Where(stripesubscription.OwnerID(ownerID)).Only(ctx)
	require.NoError(t, err)
	assert.Equal(t, enum.StripeSubActive, sub.Status)

	bal, err := GetBalance(ctx, client, ownerID)
	require.NoError(t, err)
	assert.Equal(t, 60.0, bal.Balance)

	txCount, err := client.CreditTransaction.Query().
		Where(credittransaction.OwnerID(ownerID)).Count(ctx)
	require.NoError(t, err)
	assert.Equal(t, 1, txCount)

	// Step 2: Invoice renewal deposits
	invoice := map[string]interface{}{
		"id":             "inv_cycle_001",
		"billing_reason": "subscription_cycle",
		"parent": map[string]interface{}{
			"subscription_details": map[string]interface{}{
				"subscription": map[string]interface{}{
					"id": subID,
				},
			},
		},
	}
	event = makeEvent("invoice.payment_succeeded", invoice)
	require.NoError(t, handleInvoicePaymentSucceeded(ctx, client, nil, event))

	bal, _ = GetBalance(ctx, client, ownerID)
	assert.Equal(t, 120.0, bal.Balance)

	// Step 3: Enforcement allows
	assert.NoError(t, EnsureSufficientCredits(ctx, client, ownerID))

	// Step 4: Feature check
	assert.NoError(t, HasFeature(ctx, client, ownerID, "live_trading"))
	assert.Error(t, HasFeature(ctx, client, ownerID, "code_mode"))

	// Step 5: Subscription update — Enterprise with code_mode
	subUpdate := map[string]interface{}{
		"id":                   subID,
		"status":               "active",
		"cancel_at_period_end": false,
		"items": map[string]interface{}{
			"data": []interface{}{
				map[string]interface{}{
					"current_period_start": now,
					"current_period_end":   now + 30*24*3600,
					"price": map[string]interface{}{
						"product": map[string]interface{}{
							"name": "Enterprise Plan",
							"metadata": map[string]interface{}{
								"display_name":    "Enterprise",
								"monthly_deposit": "200",
								"features":        "live_trading,backtesting,code_mode",
							},
						},
					},
				},
			},
		},
	}
	event = makeEvent("customer.subscription.updated", subUpdate)
	require.NoError(t, handleSubscriptionUpdated(ctx, client, nil, event))
	assert.NoError(t, HasFeature(ctx, client, ownerID, "code_mode"))

	// Step 6: Cancel at period end
	subCancel := map[string]interface{}{
		"id":                   subID,
		"status":               "active",
		"cancel_at_period_end": true,
		"items": map[string]interface{}{
			"data": []interface{}{
				map[string]interface{}{
					"current_period_start": now,
					"current_period_end":   now + 30*24*3600,
				},
			},
		},
	}
	event = makeEvent("customer.subscription.updated", subCancel)
	require.NoError(t, handleSubscriptionUpdated(ctx, client, nil, event))

	sub, _ = client.StripeSubscription.Query().
		Where(stripesubscription.OwnerID(ownerID)).Only(ctx)
	assert.Equal(t, enum.StripeSubCanceling, sub.Status)

	// Features still work during canceling period
	assert.NoError(t, HasFeature(ctx, client, ownerID, "live_trading"))

	// Step 7: Subscription deleted
	subDel := map[string]interface{}{
		"id":     subID,
		"status": "canceled",
	}
	event = makeEvent("customer.subscription.deleted", subDel)
	require.NoError(t, handleSubscriptionDeleted(ctx, client, event))

	sub, _ = client.StripeSubscription.Query().
		Where(stripesubscription.OwnerID(ownerID)).Only(ctx)
	assert.Equal(t, enum.StripeSubCanceled, sub.Status)

	// No subscription = allow per graceful degradation
	assert.NoError(t, HasFeature(ctx, client, ownerID, "live_trading"))
}

func TestBillingFlow_CreditDepletion(t *testing.T) {
	client, _ := setupIntegrationDB(t, "integ_depletion")
	ctx := context.Background()

	ownerID := "org-depletion"
	createActiveSubscription(ctx, t, client, ownerID, "sub_depletion", 60, []string{"live_trading"})

	// Step 1: AddCredits 10.0
	_, err := AddCredits(ctx, client, ownerID, 10.0, enum.CreditTxManualDeposit, "seed", "seed-depletion")
	require.NoError(t, err)

	// Step 2: Deduct 4.0 → balance=6.0
	bal, err := DeductCredits(ctx, client, ownerID, 4.0, "Hourly usage", "hourly:org-depletion:2025-01-01T10:00:00Z")
	require.NoError(t, err)
	assert.Equal(t, 6.0, bal.Balance)
	assert.False(t, bal.Suspended)

	// Step 3: Enforcement allows
	assert.NoError(t, EnsureSufficientCredits(ctx, client, ownerID))

	// Step 4: Deduct 10.0 (exceeds balance) → balance=0, suspended
	bal, err = DeductCredits(ctx, client, ownerID, 10.0, "Hourly usage", "hourly:org-depletion:2025-01-01T11:00:00Z")
	require.NoError(t, err)
	assert.Equal(t, 0.0, bal.Balance)
	assert.True(t, bal.Suspended)

	// Step 5: Enforcement fails
	err = EnsureSufficientCredits(ctx, client, ownerID)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "suspended")

	// Step 6: AddCredits 50.0 → unsuspended
	bal, err = AddCredits(ctx, client, ownerID, 50.0, enum.CreditTxManualDeposit, "refill", "refill-depletion")
	require.NoError(t, err)
	assert.Equal(t, 50.0, bal.Balance)
	assert.False(t, bal.Suspended)

	// Step 7: Enforcement allows
	assert.NoError(t, EnsureSufficientCredits(ctx, client, ownerID))

	// Step 8: Verify full transaction ledger
	txns, err := client.CreditTransaction.Query().
		Where(credittransaction.OwnerID(ownerID)).
		Order(ent.Asc(credittransaction.FieldCreatedAt)).
		All(ctx)
	require.NoError(t, err)
	require.Len(t, txns, 4)

	assert.Equal(t, 10.0, txns[0].Amount)
	assert.Equal(t, 10.0, txns[0].BalanceAfter)
	assert.Equal(t, -4.0, txns[1].Amount)
	assert.Equal(t, 6.0, txns[1].BalanceAfter)
	assert.Equal(t, -10.0, txns[2].Amount)
	assert.Equal(t, 0.0, txns[2].BalanceAfter)
	assert.Equal(t, 50.0, txns[3].Amount)
	assert.Equal(t, 50.0, txns[3].BalanceAfter)
}

func TestBillingFlow_IdempotentDeposit(t *testing.T) {
	client, _ := setupIntegrationDB(t, "integ_idemp_deposit")
	ctx := context.Background()

	ownerID := "org-idemp-dep"
	createActiveSubscription(ctx, t, client, ownerID, "sub_idemp", 60, []string{"live_trading"})

	// First deposit
	err := ProcessSubscriptionDeposit(ctx, client, ownerID, "inv_001")
	require.NoError(t, err)
	bal, _ := GetBalance(ctx, client, ownerID)
	assert.Equal(t, 60.0, bal.Balance)

	// Same invoice → idempotent
	err = ProcessSubscriptionDeposit(ctx, client, ownerID, "inv_001")
	require.NoError(t, err)
	bal, _ = GetBalance(ctx, client, ownerID)
	assert.Equal(t, 60.0, bal.Balance)

	txCount, _ := client.CreditTransaction.Query().
		Where(credittransaction.OwnerID(ownerID)).Count(ctx)
	assert.Equal(t, 1, txCount)

	// Different invoice
	err = ProcessSubscriptionDeposit(ctx, client, ownerID, "inv_002")
	require.NoError(t, err)
	bal, _ = GetBalance(ctx, client, ownerID)
	assert.Equal(t, 120.0, bal.Balance)

	txCount, _ = client.CreditTransaction.Query().
		Where(credittransaction.OwnerID(ownerID)).Count(ctx)
	assert.Equal(t, 2, txCount)
}

func TestBillingFlow_IdempotentDeduction(t *testing.T) {
	client, _ := setupIntegrationDB(t, "integ_idemp_deduct")
	ctx := context.Background()

	ownerID := "org-idemp-ded"
	require.NoError(t, EnsureBalanceExists(ctx, client, ownerID))
	_, err := AddCredits(ctx, client, ownerID, 100.0, enum.CreditTxManualDeposit, "fund", "fund-idemp")
	require.NoError(t, err)

	refID := "hourly:org:2025-01-01T10:00:00Z"

	// First deduction
	bal, err := DeductCredits(ctx, client, ownerID, 5.0, "Hourly usage", refID)
	require.NoError(t, err)
	assert.Equal(t, 95.0, bal.Balance)

	// Same reference → idempotent
	bal, err = DeductCredits(ctx, client, ownerID, 5.0, "Hourly usage", refID)
	require.NoError(t, err)
	assert.Equal(t, 95.0, bal.Balance)

	// Only 1 deduction transaction (plus 1 deposit = 2 total)
	deductCount, _ := client.CreditTransaction.Query().
		Where(
			credittransaction.OwnerID(ownerID),
			credittransaction.TypeEQ(enum.CreditTxUsageDeduction),
		).Count(ctx)
	assert.Equal(t, 1, deductCount)
}

func TestBillingFlow_AppendOnlyLedger(t *testing.T) {
	client, _ := setupIntegrationDB(t, "integ_append_only")
	ctx := context.Background()

	ownerID := "org-append"
	require.NoError(t, EnsureBalanceExists(ctx, client, ownerID))

	bal, err := AddCredits(ctx, client, ownerID, 10.0, enum.CreditTxManualDeposit, "test", "append-test")
	require.NoError(t, err)
	_ = bal

	txns, err := client.CreditTransaction.Query().
		Where(credittransaction.OwnerID(ownerID)).All(ctx)
	require.NoError(t, err)
	require.Len(t, txns, 1)
	txID := txns[0].ID

	// Attempt to delete single transaction
	err = client.CreditTransaction.DeleteOneID(txID).Exec(ctx)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "append-only")

	// Attempt to bulk delete
	_, err = client.CreditTransaction.Delete().Exec(ctx)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "append-only")

	// Transaction still exists
	exists, err := client.CreditTransaction.Query().
		Where(credittransaction.ID(txID)).Exist(ctx)
	require.NoError(t, err)
	assert.True(t, exists)
}

func TestBillingFlow_CheckoutThenInvoiceIdempotency(t *testing.T) {
	client, mock := setupIntegrationDB(t, "integ_checkout_inv")
	ctx := context.Background()

	ownerID := "org-checkout-inv"
	now := time.Now().Unix()

	mock.getSubscriptionFn = func(id string) (*stripe.Subscription, error) {
		return &stripe.Subscription{
			ID:     id,
			Status: stripe.SubscriptionStatusActive,
			Customer: &stripe.Customer{
				ID: "cus_checkout_inv",
			},
			Items: &stripe.SubscriptionItemList{
				Data: []*stripe.SubscriptionItem{
					{
						CurrentPeriodStart: now,
						CurrentPeriodEnd:   now + 30*24*3600,
						Price: &stripe.Price{
							ID: "price_pro",
							Product: &stripe.Product{
								Name: "Pro Plan",
								Metadata: map[string]string{
									"display_name":    "Pro",
									"monthly_deposit": "60",
									"features":        "live_trading",
								},
							},
						},
					},
				},
			},
			LatestInvoice: &stripe.Invoice{
				ID: "inv_initial",
			},
		}, nil
	}

	// Step 1: Checkout deposits with invoice ID "inv_initial"
	session := map[string]interface{}{
		"id": "cs_checkout_inv",
		"metadata": map[string]interface{}{
			"owner_id": ownerID,
			"type":     "subscription_checkout",
		},
		"subscription": map[string]interface{}{
			"id": "sub_checkout_inv",
		},
	}
	event := makeEvent("checkout.session.completed", session)
	require.NoError(t, handleCheckoutCompleted(ctx, client, mock, event))

	bal, _ := GetBalance(ctx, client, ownerID)
	assert.Equal(t, 60.0, bal.Balance)

	// Step 2: Invoice webhook arrives with same invoice ID → idempotent
	invoice := map[string]interface{}{
		"id":             "inv_initial",
		"billing_reason": "subscription_create",
		"parent": map[string]interface{}{
			"subscription_details": map[string]interface{}{
				"subscription": map[string]interface{}{
					"id": "sub_checkout_inv",
				},
			},
		},
	}
	event = makeEvent("invoice.payment_succeeded", invoice)
	require.NoError(t, handleInvoicePaymentSucceeded(ctx, client, nil, event))

	bal, _ = GetBalance(ctx, client, ownerID)
	assert.Equal(t, 60.0, bal.Balance) // Still 60, not 120

	// Exactly 1 transaction
	txCount, _ := client.CreditTransaction.Query().
		Where(credittransaction.OwnerID(ownerID)).Count(ctx)
	assert.Equal(t, 1, txCount)
}

func TestBillingFlow_SubscriptionUpdateSkipsDeposit(t *testing.T) {
	client, _ := setupIntegrationDB(t, "integ_update_skip")
	ctx := context.Background()

	ownerID := "org-update-skip"
	createActiveSubscription(ctx, t, client, ownerID, "sub_update_skip", 60, []string{"live_trading"})

	// Deposit initial credits
	err := ProcessSubscriptionDeposit(ctx, client, ownerID, "inv_initial_skip")
	require.NoError(t, err)
	bal, _ := GetBalance(ctx, client, ownerID)
	assert.Equal(t, 60.0, bal.Balance)

	// Proration invoice (subscription_update) must NOT trigger deposit
	invoice := map[string]interface{}{
		"id":             "inv_proration_001",
		"billing_reason": "subscription_update",
		"parent": map[string]interface{}{
			"subscription_details": map[string]interface{}{
				"subscription": map[string]interface{}{
					"id": "sub_update_skip",
				},
			},
		},
	}
	event := makeEvent("invoice.payment_succeeded", invoice)
	require.NoError(t, handleInvoicePaymentSucceeded(ctx, client, nil, event))

	bal, _ = GetBalance(ctx, client, ownerID)
	assert.Equal(t, 60.0, bal.Balance) // Unchanged
}

func TestBillingFlow_ManualDepositFlow(t *testing.T) {
	client, _ := setupIntegrationDB(t, "integ_manual_deposit")
	ctx := context.Background()

	ownerID := "org-manual"
	require.NoError(t, EnsureBalanceExists(ctx, client, ownerID))

	session := map[string]interface{}{
		"id":           "cs_manual_001",
		"amount_total": 2500, // $25.00 in cents
		"metadata": map[string]interface{}{
			"owner_id": ownerID,
			"type":     "manual_deposit",
		},
	}
	event := makeEvent("checkout.session.completed", session)
	require.NoError(t, handleCheckoutCompleted(ctx, client, nil, event))

	bal, err := GetBalance(ctx, client, ownerID)
	require.NoError(t, err)
	assert.Equal(t, 25.0, bal.Balance)

	// Verify transaction details
	txns, err := client.CreditTransaction.Query().
		Where(credittransaction.OwnerID(ownerID)).All(ctx)
	require.NoError(t, err)
	require.Len(t, txns, 1)
	assert.Equal(t, enum.CreditTxManualDeposit, txns[0].Type)
	assert.Equal(t, "cs_manual_001", txns[0].ReferenceID)

	// Verify JSON unmarshalling worked properly
	var sessionParsed map[string]interface{}
	raw, _ := json.Marshal(session)
	require.NoError(t, json.Unmarshal(raw, &sessionParsed))
}
