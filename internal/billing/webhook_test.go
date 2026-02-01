package billing

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v82"

	"volaticloud/internal/ent/enttest"
	"volaticloud/internal/ent/stripesubscription"
	"volaticloud/internal/enum"
)

// mockStripeAPI implements StripeAPI for testing.
type mockStripeAPI struct {
	getSubscriptionFn    func(id string) (*stripe.Subscription, error)
	cancelSubscriptionFn func(id string) (*stripe.Subscription, error)
}

func (m *mockStripeAPI) GetSubscription(id string) (*stripe.Subscription, error) {
	if m.getSubscriptionFn != nil {
		return m.getSubscriptionFn(id)
	}
	return nil, fmt.Errorf("GetSubscription not mocked")
}

func (m *mockStripeAPI) CancelSubscription(id string) (*stripe.Subscription, error) {
	if m.cancelSubscriptionFn != nil {
		return m.cancelSubscriptionFn(id)
	}
	return nil, fmt.Errorf("CancelSubscription not mocked")
}

// --- NewWebhookHandler HTTP tests ---

func TestNewWebhookHandler_InvalidSignature(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:wh_handler_bad?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	handler := NewWebhookHandler(client, &mockStripeAPI{}, "whsec_test")

	// No Stripe-Signature header → invalid signature
	req := httptest.NewRequest(http.MethodPost, "/webhooks/stripe", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()
	handler(rec, req)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestNewWebhookHandler_EmptyBody(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:wh_handler_empty?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	handler := NewWebhookHandler(client, &mockStripeAPI{}, "whsec_test")

	req := httptest.NewRequest(http.MethodPost, "/webhooks/stripe", strings.NewReader(""))
	rec := httptest.NewRecorder()
	handler(rec, req)
	// Empty body with no signature → unauthorized
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// makeEvent constructs a stripe.Event with the given type and JSON payload.
func makeEvent(eventType string, payload interface{}) stripe.Event {
	raw, _ := json.Marshal(payload)
	return stripe.Event{
		Type: stripe.EventType(eventType),
		Data: &stripe.EventData{Raw: raw},
	}
}

// --- handleInvoicePaymentSucceeded ---

func TestHandleInvoicePaymentSucceeded(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:wh_inv_success?mode=memory&cache=shared&_fk=1")
	defer client.Close()
	ctx := context.Background()

	// Create subscription + balance for "org-inv"
	_, err := client.StripeSubscription.Create().
		SetOwnerID("org-inv").
		SetStripeCustomerID("cus_inv").
		SetStripeSubscriptionID("sub_inv_001").
		SetStripePriceID("price_inv").
		SetPlanName("pro").
		SetMonthlyDeposit(60).
		SetStatus(enum.StripeSubActive).
		SetFeatures([]string{"live_trading"}).
		SetCurrentPeriodStart(time.Now()).
		SetCurrentPeriodEnd(time.Now().Add(30 * 24 * time.Hour)).
		Save(ctx)
	require.NoError(t, err)
	require.NoError(t, EnsureBalanceExists(ctx, client, "org-inv"))

	t.Run("deposits credits for subscription_cycle invoice", func(t *testing.T) {
		// Stripe invoice JSON structure for v82
		invoice := map[string]interface{}{
			"id":             "inv_cycle_001",
			"billing_reason": "subscription_cycle",
			"parent": map[string]interface{}{
				"subscription_details": map[string]interface{}{
					"subscription": map[string]interface{}{
						"id": "sub_inv_001",
					},
				},
			},
		}

		event := makeEvent("invoice.payment_succeeded", invoice)
		err := handleInvoicePaymentSucceeded(ctx, client, nil, event)
		require.NoError(t, err)

		bal, err := GetBalance(ctx, client, "org-inv")
		require.NoError(t, err)
		assert.Equal(t, 60.0, bal.Balance)
	})

	t.Run("deposits credits for subscription_create invoice", func(t *testing.T) {
		// Create another org for this test
		_, err := client.StripeSubscription.Create().
			SetOwnerID("org-inv-create").
			SetStripeCustomerID("cus_inv2").
			SetStripeSubscriptionID("sub_inv_002").
			SetStripePriceID("price_inv").
			SetPlanName("starter").
			SetMonthlyDeposit(5).
			SetStatus(enum.StripeSubActive).
			SetFeatures([]string{"live_trading"}).
			SetCurrentPeriodStart(time.Now()).
			SetCurrentPeriodEnd(time.Now().Add(30 * 24 * time.Hour)).
			Save(ctx)
		require.NoError(t, err)
		require.NoError(t, EnsureBalanceExists(ctx, client, "org-inv-create"))

		invoice := map[string]interface{}{
			"id":             "inv_create_001",
			"billing_reason": "subscription_create",
			"parent": map[string]interface{}{
				"subscription_details": map[string]interface{}{
					"subscription": map[string]interface{}{
						"id": "sub_inv_002",
					},
				},
			},
		}

		event := makeEvent("invoice.payment_succeeded", invoice)
		err = handleInvoicePaymentSucceeded(ctx, client, nil, event)
		require.NoError(t, err)

		bal, err := GetBalance(ctx, client, "org-inv-create")
		require.NoError(t, err)
		assert.Equal(t, 5.0, bal.Balance)
	})

	t.Run("skips deposit for subscription_update (proration)", func(t *testing.T) {
		invoice := map[string]interface{}{
			"id":             "inv_prorate_001",
			"billing_reason": "subscription_update",
			"parent": map[string]interface{}{
				"subscription_details": map[string]interface{}{
					"subscription": map[string]interface{}{
						"id": "sub_inv_001",
					},
				},
			},
		}

		balBefore, _ := GetBalance(ctx, client, "org-inv")
		event := makeEvent("invoice.payment_succeeded", invoice)
		err := handleInvoicePaymentSucceeded(ctx, client, nil, event)
		require.NoError(t, err)

		balAfter, _ := GetBalance(ctx, client, "org-inv")
		assert.Equal(t, balBefore.Balance, balAfter.Balance) // No change
	})

	t.Run("skips deposit for manual invoice", func(t *testing.T) {
		invoice := map[string]interface{}{
			"id":             "inv_manual_001",
			"billing_reason": "manual",
			"parent": map[string]interface{}{
				"subscription_details": map[string]interface{}{
					"subscription": map[string]interface{}{
						"id": "sub_inv_001",
					},
				},
			},
		}

		balBefore, _ := GetBalance(ctx, client, "org-inv")
		event := makeEvent("invoice.payment_succeeded", invoice)
		err := handleInvoicePaymentSucceeded(ctx, client, nil, event)
		require.NoError(t, err)

		balAfter, _ := GetBalance(ctx, client, "org-inv")
		assert.Equal(t, balBefore.Balance, balAfter.Balance) // No change
	})

	t.Run("skips non-subscription invoice (no parent)", func(t *testing.T) {
		invoice := map[string]interface{}{
			"id":             "inv_oneoff_001",
			"billing_reason": "subscription_cycle",
		}

		event := makeEvent("invoice.payment_succeeded", invoice)
		err := handleInvoicePaymentSucceeded(ctx, client, nil, event)
		require.NoError(t, err) // Should return nil, not error
	})

	t.Run("fails for unknown subscription ID", func(t *testing.T) {
		invoice := map[string]interface{}{
			"id":             "inv_unknown_001",
			"billing_reason": "subscription_cycle",
			"parent": map[string]interface{}{
				"subscription_details": map[string]interface{}{
					"subscription": map[string]interface{}{
						"id": "sub_nonexistent",
					},
				},
			},
		}

		event := makeEvent("invoice.payment_succeeded", invoice)
		err := handleInvoicePaymentSucceeded(ctx, client, nil, event)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "subscription not found")
	})

	t.Run("idempotent deposit with same invoice ID", func(t *testing.T) {
		// org-inv already got 60.0 from inv_cycle_001
		// Retry same invoice should be idempotent
		invoice := map[string]interface{}{
			"id":             "inv_cycle_001",
			"billing_reason": "subscription_cycle",
			"parent": map[string]interface{}{
				"subscription_details": map[string]interface{}{
					"subscription": map[string]interface{}{
						"id": "sub_inv_001",
					},
				},
			},
		}

		event := makeEvent("invoice.payment_succeeded", invoice)
		err := handleInvoicePaymentSucceeded(ctx, client, nil, event)
		require.NoError(t, err)

		bal, _ := GetBalance(ctx, client, "org-inv")
		assert.Equal(t, 60.0, bal.Balance) // Still 60, not 120
	})

	t.Run("fails on invalid JSON", func(t *testing.T) {
		event := stripe.Event{
			Type: "invoice.payment_succeeded",
			Data: &stripe.EventData{Raw: json.RawMessage(`{invalid}`)},
		}
		err := handleInvoicePaymentSucceeded(ctx, client, nil, event)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "unmarshal")
	})
}

// --- handleSubscriptionUpdated ---

func TestHandleSubscriptionUpdated(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:wh_sub_update?mode=memory&cache=shared&_fk=1")
	defer client.Close()
	ctx := context.Background()

	now := time.Now()
	periodEnd := now.Add(30 * 24 * time.Hour)

	// Create existing subscription
	_, err := client.StripeSubscription.Create().
		SetOwnerID("org-update").
		SetStripeCustomerID("cus_upd").
		SetStripeSubscriptionID("sub_upd_001").
		SetStripePriceID("price_starter").
		SetPlanName("starter").
		SetMonthlyDeposit(5).
		SetStatus(enum.StripeSubActive).
		SetFeatures([]string{"live_trading"}).
		SetCurrentPeriodStart(now).
		SetCurrentPeriodEnd(periodEnd).
		Save(ctx)
	require.NoError(t, err)

	t.Run("updates status to active", func(t *testing.T) {
		subData := map[string]interface{}{
			"id":                   "sub_upd_001",
			"status":               "active",
			"cancel_at_period_end": false,
			"items": map[string]interface{}{
				"data": []interface{}{
					map[string]interface{}{
						"current_period_start": now.Unix(),
						"current_period_end":   periodEnd.Unix(),
					},
				},
			},
		}

		event := makeEvent("customer.subscription.updated", subData)
		err := handleSubscriptionUpdated(ctx, client, nil, event)
		require.NoError(t, err)

		sub, _ := client.StripeSubscription.Query().
			Where(stripesubscription.StripeSubscriptionID("sub_upd_001")).
			Only(ctx)
		assert.Equal(t, enum.StripeSubActive, sub.Status)
	})

	t.Run("updates status to canceling when cancel_at_period_end", func(t *testing.T) {
		subData := map[string]interface{}{
			"id":                   "sub_upd_001",
			"status":               "active",
			"cancel_at_period_end": true,
			"items": map[string]interface{}{
				"data": []interface{}{
					map[string]interface{}{
						"current_period_start": now.Unix(),
						"current_period_end":   periodEnd.Unix(),
					},
				},
			},
		}

		event := makeEvent("customer.subscription.updated", subData)
		err := handleSubscriptionUpdated(ctx, client, nil, event)
		require.NoError(t, err)

		sub, _ := client.StripeSubscription.Query().
			Where(stripesubscription.StripeSubscriptionID("sub_upd_001")).
			Only(ctx)
		assert.Equal(t, enum.StripeSubCanceling, sub.Status)
	})

	t.Run("updates plan metadata when product info present", func(t *testing.T) {
		subData := map[string]interface{}{
			"id":                   "sub_upd_001",
			"status":               "active",
			"cancel_at_period_end": false,
			"items": map[string]interface{}{
				"data": []interface{}{
					map[string]interface{}{
						"current_period_start": now.Unix(),
						"current_period_end":   periodEnd.Unix(),
						"price": map[string]interface{}{
							"product": map[string]interface{}{
								"name": "Pro Plan",
								"metadata": map[string]interface{}{
									"display_name":    "Pro",
									"monthly_deposit": "60",
									"features":        "live_trading,backtesting,code_mode",
								},
							},
						},
					},
				},
			},
		}

		event := makeEvent("customer.subscription.updated", subData)
		err := handleSubscriptionUpdated(ctx, client, nil, event)
		require.NoError(t, err)

		sub, _ := client.StripeSubscription.Query().
			Where(stripesubscription.StripeSubscriptionID("sub_upd_001")).
			Only(ctx)
		assert.Equal(t, "Pro", sub.PlanName)
		assert.Equal(t, 60.0, sub.MonthlyDeposit)
		assert.Equal(t, []string{"live_trading", "backtesting", "code_mode"}, sub.Features)
	})

	t.Run("skips plan name update when product name is empty", func(t *testing.T) {
		// This is the bug we fixed — empty product name should not crash
		subData := map[string]interface{}{
			"id":                   "sub_upd_001",
			"status":               "active",
			"cancel_at_period_end": false,
			"items": map[string]interface{}{
				"data": []interface{}{
					map[string]interface{}{
						"current_period_start": now.Unix(),
						"current_period_end":   periodEnd.Unix(),
						"price": map[string]interface{}{
							"product": map[string]interface{}{
								"name":     "",
								"metadata": map[string]interface{}{},
							},
						},
					},
				},
			},
		}

		event := makeEvent("customer.subscription.updated", subData)
		err := handleSubscriptionUpdated(ctx, client, nil, event)
		require.NoError(t, err) // Should NOT crash with validator error

		sub, _ := client.StripeSubscription.Query().
			Where(stripesubscription.StripeSubscriptionID("sub_upd_001")).
			Only(ctx)
		// Plan name should remain "Pro" from previous test (not overwritten with "")
		assert.Equal(t, "Pro", sub.PlanName)
	})

	t.Run("skips unknown subscription gracefully", func(t *testing.T) {
		subData := map[string]interface{}{
			"id":                   "sub_unknown_999",
			"status":               "active",
			"cancel_at_period_end": false,
			"items": map[string]interface{}{
				"data": []interface{}{
					map[string]interface{}{
						"current_period_start": now.Unix(),
						"current_period_end":   periodEnd.Unix(),
					},
				},
			},
		}

		event := makeEvent("customer.subscription.updated", subData)
		err := handleSubscriptionUpdated(ctx, client, nil, event)
		assert.NoError(t, err) // Should not error, just skip
	})

	t.Run("fails on invalid JSON", func(t *testing.T) {
		event := stripe.Event{
			Type: "customer.subscription.updated",
			Data: &stripe.EventData{Raw: json.RawMessage(`{bad json}`)},
		}
		err := handleSubscriptionUpdated(ctx, client, nil, event)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "unmarshal")
	})
}

// --- handleSubscriptionDeleted ---

func TestHandleSubscriptionDeleted(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:wh_sub_delete?mode=memory&cache=shared&_fk=1")
	defer client.Close()
	ctx := context.Background()

	// Create subscription
	_, err := client.StripeSubscription.Create().
		SetOwnerID("org-del").
		SetStripeCustomerID("cus_del").
		SetStripeSubscriptionID("sub_del_001").
		SetStripePriceID("price_del").
		SetPlanName("pro").
		SetMonthlyDeposit(60).
		SetStatus(enum.StripeSubActive).
		SetFeatures([]string{"live_trading"}).
		SetCurrentPeriodStart(time.Now()).
		SetCurrentPeriodEnd(time.Now().Add(30 * 24 * time.Hour)).
		Save(ctx)
	require.NoError(t, err)

	t.Run("marks subscription as canceled", func(t *testing.T) {
		subData := map[string]interface{}{
			"id":     "sub_del_001",
			"status": "canceled",
		}

		event := makeEvent("customer.subscription.deleted", subData)
		err := handleSubscriptionDeleted(ctx, client, event)
		require.NoError(t, err)

		sub, _ := client.StripeSubscription.Query().
			Where(stripesubscription.StripeSubscriptionID("sub_del_001")).
			Only(ctx)
		assert.Equal(t, enum.StripeSubCanceled, sub.Status)
	})

	t.Run("ignores unknown subscription", func(t *testing.T) {
		subData := map[string]interface{}{
			"id":     "sub_unknown_999",
			"status": "canceled",
		}

		event := makeEvent("customer.subscription.deleted", subData)
		err := handleSubscriptionDeleted(ctx, client, event)
		assert.NoError(t, err) // Should not error
	})

	t.Run("fails on invalid JSON", func(t *testing.T) {
		event := stripe.Event{
			Type: "customer.subscription.deleted",
			Data: &stripe.EventData{Raw: json.RawMessage(`{bad}`)},
		}
		err := handleSubscriptionDeleted(ctx, client, event)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "unmarshal")
	})
}

// --- handleCheckoutCompleted (manual_deposit) ---

func TestHandleCheckoutCompleted(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:wh_checkout?mode=memory&cache=shared&_fk=1")
	defer client.Close()
	ctx := context.Background()

	require.NoError(t, EnsureBalanceExists(ctx, client, "org-checkout"))

	t.Run("manual_deposit adds credits", func(t *testing.T) {
		session := map[string]interface{}{
			"id":           "cs_test_manual_001",
			"amount_total": 2500, // $25.00 in cents
			"metadata": map[string]interface{}{
				"owner_id": "org-checkout",
				"type":     "manual_deposit",
			},
		}

		event := makeEvent("checkout.session.completed", session)
		err := handleCheckoutCompleted(ctx, client, nil, event)
		require.NoError(t, err)

		bal, _ := GetBalance(ctx, client, "org-checkout")
		assert.Equal(t, 25.0, bal.Balance)
	})

	t.Run("manual_deposit is idempotent", func(t *testing.T) {
		session := map[string]interface{}{
			"id":           "cs_test_manual_001", // Same ID as above
			"amount_total": 2500,
			"metadata": map[string]interface{}{
				"owner_id": "org-checkout",
				"type":     "manual_deposit",
			},
		}

		event := makeEvent("checkout.session.completed", session)
		err := handleCheckoutCompleted(ctx, client, nil, event)
		require.NoError(t, err)

		bal, _ := GetBalance(ctx, client, "org-checkout")
		assert.Equal(t, 25.0, bal.Balance) // Not doubled
	})

	t.Run("fails when owner_id missing", func(t *testing.T) {
		session := map[string]interface{}{
			"id":           "cs_test_no_owner",
			"amount_total": 1000,
			"metadata":     map[string]interface{}{},
		}

		event := makeEvent("checkout.session.completed", session)
		err := handleCheckoutCompleted(ctx, client, nil, event)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "missing owner_id")
	})

	t.Run("unknown checkout type is handled gracefully", func(t *testing.T) {
		session := map[string]interface{}{
			"id":           "cs_test_unknown",
			"amount_total": 1000,
			"metadata": map[string]interface{}{
				"owner_id": "org-checkout",
				"type":     "something_weird",
			},
		}

		event := makeEvent("checkout.session.completed", session)
		err := handleCheckoutCompleted(ctx, client, nil, event)
		assert.NoError(t, err) // Logs but doesn't error
	})

	t.Run("fails on invalid JSON", func(t *testing.T) {
		event := stripe.Event{
			Type: "checkout.session.completed",
			Data: &stripe.EventData{Raw: json.RawMessage(`{bad}`)},
		}
		err := handleCheckoutCompleted(ctx, client, nil, event)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "unmarshal")
	})
}

// --- handleInvoicePaymentFailed (log-only, no errors) ---

func TestHandleInvoicePaymentFailed(t *testing.T) {
	t.Run("handles valid invoice", func(t *testing.T) {
		invoice := map[string]interface{}{
			"id":         "inv_fail_001",
			"amount_due": 2900,
			"customer": map[string]interface{}{
				"id": "cus_fail",
			},
		}

		event := makeEvent("invoice.payment_failed", invoice)
		// Should not panic
		handleInvoicePaymentFailed(event)
	})

	t.Run("handles invoice without customer", func(t *testing.T) {
		invoice := map[string]interface{}{
			"id":         "inv_fail_002",
			"amount_due": 2900,
		}

		event := makeEvent("invoice.payment_failed", invoice)
		// Should not panic even with nil customer
		handleInvoicePaymentFailed(event)
	})

	t.Run("handles invalid JSON gracefully", func(t *testing.T) {
		event := stripe.Event{
			Type: "invoice.payment_failed",
			Data: &stripe.EventData{Raw: json.RawMessage(`{bad}`)},
		}
		// Should not panic, just logs
		handleInvoicePaymentFailed(event)
	})
}

// --- Unit tests for helpers ---

func TestMapStripeStatusWithCancel(t *testing.T) {
	tests := []struct {
		name              string
		status            string
		cancelAtPeriodEnd bool
		expected          enum.StripeSubStatus
	}{
		{"active", "active", false, enum.StripeSubActive},
		{"active with cancel_at_period_end", "active", true, enum.StripeSubCanceling},
		{"past_due", "past_due", false, enum.StripeSubPastDue},
		{"past_due with cancel_at_period_end", "past_due", true, enum.StripeSubPastDue},
		{"canceled", "canceled", false, enum.StripeSubCanceled},
		{"incomplete", "incomplete", false, enum.StripeSubCanceled},
		{"incomplete_expired", "incomplete_expired", false, enum.StripeSubCanceled},
		{"trialing", "trialing", false, enum.StripeSubCanceled},
		{"unpaid", "unpaid", false, enum.StripeSubCanceled},
		{"unknown status", "something_else", false, enum.StripeSubCanceled},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := mapStripeStatusWithCancel(tt.status, tt.cancelAtPeriodEnd)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSubscriptionPeriodStart(t *testing.T) {
	now := time.Now().Unix()

	t.Run("extracts from items data", func(t *testing.T) {
		sub := &stripe.Subscription{
			Items: &stripe.SubscriptionItemList{
				Data: []*stripe.SubscriptionItem{
					{CurrentPeriodStart: now},
				},
			},
		}
		result := subscriptionPeriodStart(sub)
		assert.Equal(t, time.Unix(now, 0), result)
	})

	t.Run("falls back to StartDate when no items", func(t *testing.T) {
		sub := &stripe.Subscription{
			StartDate: now,
			Items: &stripe.SubscriptionItemList{
				Data: []*stripe.SubscriptionItem{},
			},
		}
		result := subscriptionPeriodStart(sub)
		assert.Equal(t, time.Unix(now, 0), result)
	})

	t.Run("falls back to StartDate when items nil", func(t *testing.T) {
		sub := &stripe.Subscription{
			StartDate: now,
		}
		result := subscriptionPeriodStart(sub)
		assert.Equal(t, time.Unix(now, 0), result)
	})
}

func TestSubscriptionPeriodEnd(t *testing.T) {
	now := time.Now().Unix()
	endTime := now + 30*24*3600

	t.Run("extracts from items data", func(t *testing.T) {
		sub := &stripe.Subscription{
			Items: &stripe.SubscriptionItemList{
				Data: []*stripe.SubscriptionItem{
					{CurrentPeriodEnd: endTime},
				},
			},
		}
		result := subscriptionPeriodEnd(sub)
		assert.Equal(t, time.Unix(endTime, 0), result)
	})

	t.Run("falls back to StartDate + 30 days when no items", func(t *testing.T) {
		sub := &stripe.Subscription{
			StartDate: now,
			Items: &stripe.SubscriptionItemList{
				Data: []*stripe.SubscriptionItem{},
			},
		}
		result := subscriptionPeriodEnd(sub)
		expected := time.Unix(now, 0).Add(30 * 24 * time.Hour)
		assert.Equal(t, expected, result)
	})
}

func TestMetaOrDefault(t *testing.T) {
	tests := []struct {
		name       string
		meta       map[string]string
		key        string
		defaultVal string
		expected   string
	}{
		{"returns value when present", map[string]string{"key": "val"}, "key", "def", "val"},
		{"returns default when key missing", map[string]string{}, "key", "def", "def"},
		{"returns default when value empty", map[string]string{"key": ""}, "key", "def", "def"},
		{"returns default for nil map", nil, "key", "def", "def"},
		{"returns empty default", map[string]string{}, "key", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := metaOrDefault(tt.meta, tt.key, tt.defaultVal)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// --- handleSubscriptionCheckout ---

func newMockStripeSub(subID string) *stripe.Subscription {
	now := time.Now().Unix()
	return &stripe.Subscription{
		ID:     subID,
		Status: stripe.SubscriptionStatusActive,
		Customer: &stripe.Customer{
			ID: "cus_test",
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
	}
}

func TestHandleSubscriptionCheckout(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:wh_sub_checkout?mode=memory&cache=shared&_fk=1")
	defer client.Close()
	ctx := context.Background()

	t.Run("new subscription creates record and deposits", func(t *testing.T) {
		mock := &mockStripeAPI{
			getSubscriptionFn: func(id string) (*stripe.Subscription, error) {
				return newMockStripeSub(id), nil
			},
		}

		session := &stripe.CheckoutSession{
			Subscription: &stripe.Subscription{ID: "sub_new_001"},
		}

		err := handleSubscriptionCheckout(ctx, client, mock, "org-new-sub", session)
		require.NoError(t, err)

		// Verify subscription record created
		sub, err := client.StripeSubscription.Query().
			Where(stripesubscription.OwnerID("org-new-sub")).
			Only(ctx)
		require.NoError(t, err)
		assert.Equal(t, "sub_new_001", sub.StripeSubscriptionID)
		assert.Equal(t, "Pro", sub.PlanName)
		assert.Equal(t, 60.0, sub.MonthlyDeposit)
		assert.Equal(t, enum.StripeSubActive, sub.Status)

		// Verify initial deposit
		bal, err := GetBalance(ctx, client, "org-new-sub")
		require.NoError(t, err)
		assert.Equal(t, 60.0, bal.Balance)
	})

	t.Run("existing subscription for same org updates record and cancels old", func(t *testing.T) {
		canceledSubID := ""
		mock := &mockStripeAPI{
			getSubscriptionFn: func(id string) (*stripe.Subscription, error) {
				return newMockStripeSub(id), nil
			},
			cancelSubscriptionFn: func(id string) (*stripe.Subscription, error) {
				canceledSubID = id
				return &stripe.Subscription{ID: id}, nil
			},
		}

		session := &stripe.CheckoutSession{
			Subscription: &stripe.Subscription{ID: "sub_new_002"},
		}

		err := handleSubscriptionCheckout(ctx, client, mock, "org-new-sub", session)
		require.NoError(t, err)

		// Old sub should have been canceled
		assert.Equal(t, "sub_new_001", canceledSubID)

		// Record should be updated to new sub
		sub, err := client.StripeSubscription.Query().
			Where(stripesubscription.OwnerID("org-new-sub")).
			Only(ctx)
		require.NoError(t, err)
		assert.Equal(t, "sub_new_002", sub.StripeSubscriptionID)
	})

	t.Run("existing subscription with same Stripe sub ID updates without canceling", func(t *testing.T) {
		cancelCalled := false
		mock := &mockStripeAPI{
			getSubscriptionFn: func(id string) (*stripe.Subscription, error) {
				return newMockStripeSub(id), nil
			},
			cancelSubscriptionFn: func(id string) (*stripe.Subscription, error) {
				cancelCalled = true
				return &stripe.Subscription{ID: id}, nil
			},
		}

		// Re-checkout with same sub ID
		session := &stripe.CheckoutSession{
			Subscription: &stripe.Subscription{ID: "sub_new_002"},
		}

		err := handleSubscriptionCheckout(ctx, client, mock, "org-new-sub", session)
		require.NoError(t, err)
		assert.False(t, cancelCalled)
	})

	t.Run("cancel old subscription failure is logged but doesnt fail", func(t *testing.T) {
		// Create a fresh org with a different sub
		client2 := enttest.Open(t, "sqlite3", "file:wh_sub_cancel_fail?mode=memory&cache=shared&_fk=1")
		defer client2.Close()

		// Pre-create an existing subscription
		_, err := client2.StripeSubscription.Create().
			SetOwnerID("org-cancel-fail").
			SetStripeCustomerID("cus_old").
			SetStripeSubscriptionID("sub_old").
			SetStripePriceID("price_old").
			SetPlanName("starter").
			SetMonthlyDeposit(5).
			SetStatus(enum.StripeSubActive).
			SetFeatures([]string{"live_trading"}).
			SetCurrentPeriodStart(time.Now()).
			SetCurrentPeriodEnd(time.Now().Add(30 * 24 * time.Hour)).
			Save(ctx)
		require.NoError(t, err)

		mock := &mockStripeAPI{
			getSubscriptionFn: func(id string) (*stripe.Subscription, error) {
				return newMockStripeSub(id), nil
			},
			cancelSubscriptionFn: func(id string) (*stripe.Subscription, error) {
				return nil, fmt.Errorf("stripe cancel error")
			},
		}

		session := &stripe.CheckoutSession{
			Subscription: &stripe.Subscription{ID: "sub_new_003"},
		}

		// Should succeed despite cancel failure (logged only)
		err = handleSubscriptionCheckout(ctx, client2, mock, "org-cancel-fail", session)
		require.NoError(t, err)

		sub, err := client2.StripeSubscription.Query().
			Where(stripesubscription.OwnerID("org-cancel-fail")).
			Only(ctx)
		require.NoError(t, err)
		assert.Equal(t, "sub_new_003", sub.StripeSubscriptionID)
	})

	t.Run("nil subscription in session returns error", func(t *testing.T) {
		mock := &mockStripeAPI{}
		session := &stripe.CheckoutSession{}

		err := handleSubscriptionCheckout(ctx, client, mock, "org-nil-sub", session)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "no subscription")
	})

	t.Run("no latest invoice skips initial deposit", func(t *testing.T) {
		client3 := enttest.Open(t, "sqlite3", "file:wh_sub_no_inv?mode=memory&cache=shared&_fk=1")
		defer client3.Close()

		subNoInvoice := newMockStripeSub("sub_no_inv")
		subNoInvoice.LatestInvoice = nil

		mock := &mockStripeAPI{
			getSubscriptionFn: func(id string) (*stripe.Subscription, error) {
				return subNoInvoice, nil
			},
		}

		session := &stripe.CheckoutSession{
			Subscription: &stripe.Subscription{ID: "sub_no_inv"},
		}

		err := handleSubscriptionCheckout(ctx, client3, mock, "org-no-inv", session)
		require.NoError(t, err)

		bal, err := GetBalance(ctx, client3, "org-no-inv")
		require.NoError(t, err)
		assert.Equal(t, 0.0, bal.Balance) // No deposit
	})

	t.Run("GetSubscription fails returns error", func(t *testing.T) {
		mock := &mockStripeAPI{
			getSubscriptionFn: func(id string) (*stripe.Subscription, error) {
				return nil, fmt.Errorf("stripe api error")
			},
		}

		session := &stripe.CheckoutSession{
			Subscription: &stripe.Subscription{ID: "sub_fail"},
		}

		err := handleSubscriptionCheckout(ctx, client, mock, "org-fail", session)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to get subscription")
	})
}

// --- handleCheckoutCompleted with subscription_checkout ---

func TestHandleCheckoutCompleted_SubscriptionCheckout(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:wh_checkout_sub?mode=memory&cache=shared&_fk=1")
	defer client.Close()
	ctx := context.Background()

	t.Run("valid subscription checkout delegates to handleSubscriptionCheckout", func(t *testing.T) {
		mock := &mockStripeAPI{
			getSubscriptionFn: func(id string) (*stripe.Subscription, error) {
				return newMockStripeSub(id), nil
			},
		}

		session := map[string]interface{}{
			"id": "cs_sub_001",
			"metadata": map[string]interface{}{
				"owner_id": "org-sub-checkout",
				"type":     "subscription_checkout",
			},
			"subscription": map[string]interface{}{
				"id": "sub_checkout_001",
			},
		}

		event := makeEvent("checkout.session.completed", session)
		err := handleCheckoutCompleted(ctx, client, mock, event)
		require.NoError(t, err)

		// Verify subscription was created
		sub, err := client.StripeSubscription.Query().
			Where(stripesubscription.OwnerID("org-sub-checkout")).
			Only(ctx)
		require.NoError(t, err)
		assert.Equal(t, "sub_checkout_001", sub.StripeSubscriptionID)
	})

	t.Run("subscription checkout with missing subscription errors", func(t *testing.T) {
		mock := &mockStripeAPI{}

		session := map[string]interface{}{
			"id": "cs_sub_002",
			"metadata": map[string]interface{}{
				"owner_id": "org-sub-nosub",
				"type":     "subscription_checkout",
			},
		}

		event := makeEvent("checkout.session.completed", session)
		err := handleCheckoutCompleted(ctx, client, mock, event)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "no subscription")
	})
}
