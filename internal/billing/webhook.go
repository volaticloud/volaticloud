package billing

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/stripe/stripe-go/v82"
	"github.com/stripe/stripe-go/v82/webhook"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/stripesubscription"
	"volaticloud/internal/enum"
)

// NewWebhookHandler returns an HTTP handler for Stripe webhooks.
func NewWebhookHandler(client *ent.Client, stripeClient StripeAPI, webhookSecret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(io.LimitReader(r.Body, 65536))
		if err != nil {
			http.Error(w, "failed to read body", http.StatusBadRequest)
			return
		}

		event, err := webhook.ConstructEventWithOptions(body, r.Header.Get("Stripe-Signature"), webhookSecret, webhook.ConstructEventOptions{
			IgnoreAPIVersionMismatch: true,
		})
		if err != nil {
			log.Printf("[BILLING] action=webhook_signature_fail error=%v", err)
			http.Error(w, "invalid signature", http.StatusUnauthorized)
			return
		}

		ctx := r.Context()

		switch event.Type {
		case "invoice.payment_succeeded":
			if err := handleInvoicePaymentSucceeded(ctx, client, stripeClient, event); err != nil {
				log.Printf("[BILLING] action=webhook_fail event=invoice.payment_succeeded error=%v", err)
				http.Error(w, "processing failed", http.StatusInternalServerError)
				return
			}

		case "invoice.payment_failed":
			handleInvoicePaymentFailed(event)

		case "customer.subscription.updated":
			if err := handleSubscriptionUpdated(ctx, client, stripeClient, event); err != nil {
				log.Printf("[BILLING] action=webhook_fail event=customer.subscription.updated error=%v", err)
				http.Error(w, "processing failed", http.StatusInternalServerError)
				return
			}

		case "customer.subscription.deleted":
			if err := handleSubscriptionDeleted(ctx, client, event); err != nil {
				log.Printf("[BILLING] action=webhook_fail event=customer.subscription.deleted error=%v", err)
				http.Error(w, "processing failed", http.StatusInternalServerError)
				return
			}

		case "checkout.session.completed":
			if err := handleCheckoutCompleted(ctx, client, stripeClient, event); err != nil {
				log.Printf("[BILLING] action=webhook_fail event=checkout.session.completed error=%v", err)
				http.Error(w, "processing failed", http.StatusInternalServerError)
				return
			}

		default:
			log.Printf("[BILLING] action=webhook_unhandled event=%s", event.Type)
		}

		w.WriteHeader(http.StatusOK)
	}
}

func handleInvoicePaymentFailed(event stripe.Event) {
	var invoice stripe.Invoice
	if err := json.Unmarshal(event.Data.Raw, &invoice); err != nil {
		log.Printf("[BILLING] action=payment_failed_parse_error error=%v", err)
		return
	}

	customerID := ""
	if invoice.Customer != nil {
		customerID = invoice.Customer.ID
	}

	log.Printf("[BILLING] action=payment_failed invoice=%s customer=%s amount=%.2f reason=%s",
		invoice.ID, customerID, float64(invoice.AmountDue)/100.0, invoice.LastFinalizationError)
}

func handleInvoicePaymentSucceeded(ctx context.Context, client *ent.Client, stripeClient StripeAPI, event stripe.Event) error {
	var invoice stripe.Invoice
	if err := json.Unmarshal(event.Data.Raw, &invoice); err != nil {
		return fmt.Errorf("failed to unmarshal invoice: %w", err)
	}

	// In stripe-go v82, subscription is accessed via invoice.Parent.SubscriptionDetails
	if invoice.Parent == nil || invoice.Parent.SubscriptionDetails == nil || invoice.Parent.SubscriptionDetails.Subscription == nil {
		return nil // Not a subscription invoice
	}

	// Deposit credits for subscription invoices.
	//
	// billing_reason values from Stripe:
	//   - subscription_cycle:  Monthly/annual renewal → deposit credits
	//   - subscription_create: Initial subscription invoice → deposit credits
	//   - subscription_update: Proration from plan change → SKIP (prevents
	//     upgrade/downgrade abuse where user gets full deposit from a proration invoice)
	//   - manual:              One-off invoice → SKIP
	//
	// This handler is the SINGLE SOURCE OF TRUTH for all subscription credit deposits.
	// Neither handleSubscriptionCheckout nor AssignStarterPlanIfFirstOrg deposit credits
	// directly — they rely on this webhook to avoid double-deposit bugs.
	//
	// See ADR-0024 for full threat model.
	switch invoice.BillingReason {
	case stripe.InvoiceBillingReasonSubscriptionCycle,
		stripe.InvoiceBillingReasonSubscriptionCreate:
		// OK — process deposit below
	default:
		log.Printf("[BILLING] action=deposit_skip invoice=%s billing_reason=%s", invoice.ID, invoice.BillingReason)
		return nil
	}

	subscriptionID := invoice.Parent.SubscriptionDetails.Subscription.ID

	// Find subscription by Stripe subscription ID
	sub, err := client.StripeSubscription.Query().
		Where(stripesubscription.StripeSubscriptionID(subscriptionID)).
		Only(ctx)
	if err != nil {
		return fmt.Errorf("subscription not found for %s: %w", subscriptionID, err)
	}

	return ProcessSubscriptionDeposit(ctx, client, sub.OwnerID, invoice.ID)
}

func handleSubscriptionUpdated(ctx context.Context, client *ent.Client, stripeClient StripeAPI, event stripe.Event) error {
	var stripeSub stripe.Subscription
	if err := json.Unmarshal(event.Data.Raw, &stripeSub); err != nil {
		return fmt.Errorf("failed to unmarshal subscription: %w", err)
	}

	sub, err := client.StripeSubscription.Query().
		Where(stripesubscription.StripeSubscriptionID(stripeSub.ID)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			log.Printf("[BILLING] action=subscription_update_skip sub=%s reason=not_found", stripeSub.ID)
			return nil
		}
		return fmt.Errorf("failed to query subscription: %w", err)
	}

	// Map Stripe status to our enum
	status := mapStripeStatusWithCancel(string(stripeSub.Status), stripeSub.CancelAtPeriodEnd)

	update := client.StripeSubscription.UpdateOneID(sub.ID).
		SetStatus(status).
		SetCurrentPeriodStart(subscriptionPeriodStart(&stripeSub)).
		SetCurrentPeriodEnd(subscriptionPeriodEnd(&stripeSub))

	// Sync plan metadata from Stripe product (single source of truth)
	if len(stripeSub.Items.Data) > 0 && stripeSub.Items.Data[0].Price != nil && stripeSub.Items.Data[0].Price.Product != nil {
		planName, monthlyDeposit, features := ExtractPlanMetadata(&stripeSub)
		if planName != "unknown" && planName != "" {
			update = update.SetPlanName(planName)
		}
		if monthlyDeposit > 0 {
			update = update.SetMonthlyDeposit(monthlyDeposit)
		}
		if features != nil {
			update = update.SetFeatures(features)
		}
	}

	if _, err := update.Save(ctx); err != nil {
		return fmt.Errorf("failed to update subscription: %w", err)
	}

	log.Printf("[BILLING] action=subscription_update owner=%s sub=%s status=%s", sub.OwnerID, stripeSub.ID, status)
	return nil
}

func handleSubscriptionDeleted(ctx context.Context, client *ent.Client, event stripe.Event) error {
	var stripeSub stripe.Subscription
	if err := json.Unmarshal(event.Data.Raw, &stripeSub); err != nil {
		return fmt.Errorf("failed to unmarshal subscription: %w", err)
	}

	sub, err := client.StripeSubscription.Query().
		Where(stripesubscription.StripeSubscriptionID(stripeSub.ID)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil
		}
		return fmt.Errorf("failed to query subscription: %w", err)
	}

	if _, err := client.StripeSubscription.UpdateOneID(sub.ID).
		SetStatus(enum.StripeSubCanceled).
		Save(ctx); err != nil {
		return fmt.Errorf("failed to mark subscription canceled: %w", err)
	}

	log.Printf("[BILLING] action=cancellation owner=%s sub=%s", sub.OwnerID, stripeSub.ID)
	return nil
}

func handleCheckoutCompleted(ctx context.Context, client *ent.Client, stripeClient StripeAPI, event stripe.Event) error {
	var session stripe.CheckoutSession
	if err := json.Unmarshal(event.Data.Raw, &session); err != nil {
		return fmt.Errorf("failed to unmarshal checkout session: %w", err)
	}

	ownerID := session.Metadata["owner_id"]
	if ownerID == "" {
		return fmt.Errorf("missing owner_id in checkout session metadata")
	}

	switch session.Metadata["type"] {
	case "manual_deposit":
		amount := float64(session.AmountTotal) / 100.0
		_, err := AddCredits(ctx, client, ownerID, amount, enum.CreditTxManualDeposit,
			"Manual credit deposit", session.ID)
		if err != nil {
			return fmt.Errorf("failed to add manual deposit credits: %w", err)
		}
		log.Printf("[BILLING] action=deposit owner=%s amount=%.2f ref=%s", ownerID, amount, session.ID)

	case "subscription_checkout":
		if err := handleSubscriptionCheckout(ctx, client, stripeClient, ownerID, &session); err != nil {
			return fmt.Errorf("failed to handle subscription checkout: %w", err)
		}

	default:
		log.Printf("[BILLING] action=checkout_unknown type=%s", session.Metadata["type"])
	}

	return nil
}

func handleSubscriptionCheckout(ctx context.Context, client *ent.Client, stripeClient StripeAPI, ownerID string, session *stripe.CheckoutSession) error {
	if session.Subscription == nil {
		return fmt.Errorf("no subscription in checkout session")
	}

	subID := session.Subscription.ID

	// Fetch full subscription with expanded product metadata
	stripeSub, err := stripeClient.GetSubscription(subID)
	if err != nil {
		return fmt.Errorf("failed to get subscription: %w", err)
	}

	planName, monthlyDeposit, features := ExtractPlanMetadata(stripeSub)
	customerID := ""
	if stripeSub.Customer != nil {
		customerID = stripeSub.Customer.ID
	}

	priceID := ""
	if len(stripeSub.Items.Data) > 0 && stripeSub.Items.Data[0].Price != nil {
		priceID = stripeSub.Items.Data[0].Price.ID
	}

	// Ensure balance exists
	if err := EnsureBalanceExists(ctx, client, ownerID); err != nil {
		return err
	}

	// Check if a record already exists for this owner (e.g. previously canceled or auto-assigned starter)
	existing, err := client.StripeSubscription.Query().
		Where(stripesubscription.OwnerID(ownerID)).
		Only(ctx)
	if err == nil && existing != nil {
		// Cancel the old Stripe subscription if it differs from the new one,
		// to prevent double deposits from two active subscriptions for the same org.
		if existing.StripeSubscriptionID != "" && existing.StripeSubscriptionID != subID {
			if _, cancelErr := stripeClient.CancelSubscription(existing.StripeSubscriptionID); cancelErr != nil {
				log.Printf("[BILLING] action=cancel_old_sub_fail owner=%s old_sub=%s error=%v", ownerID, existing.StripeSubscriptionID, cancelErr)
			} else {
				log.Printf("[BILLING] action=cancel_old_sub owner=%s old_sub=%s new_sub=%s", ownerID, existing.StripeSubscriptionID, subID)
			}
		}
		_, err = client.StripeSubscription.UpdateOneID(existing.ID).
			SetStripeCustomerID(customerID).
			SetStripeSubscriptionID(subID).
			SetStripePriceID(priceID).
			SetPlanName(planName).
			SetMonthlyDeposit(monthlyDeposit).
			SetFeatures(features).
			SetStatus(enum.StripeSubActive).
			SetCurrentPeriodStart(subscriptionPeriodStart(stripeSub)).
			SetCurrentPeriodEnd(subscriptionPeriodEnd(stripeSub)).
			Save(ctx)
		if err != nil {
			return fmt.Errorf("failed to update subscription record: %w", err)
		}
	} else {
		_, err = client.StripeSubscription.Create().
			SetOwnerID(ownerID).
			SetStripeCustomerID(customerID).
			SetStripeSubscriptionID(subID).
			SetStripePriceID(priceID).
			SetPlanName(planName).
			SetMonthlyDeposit(monthlyDeposit).
			SetFeatures(features).
			SetStatus(enum.StripeSubActive).
			SetCurrentPeriodStart(subscriptionPeriodStart(stripeSub)).
			SetCurrentPeriodEnd(subscriptionPeriodEnd(stripeSub)).
			Save(ctx)
		if err != nil {
			return fmt.Errorf("failed to create subscription record: %w", err)
		}
	}

	// Deposit initial credits from the subscription's latest invoice.
	// Stripe fires invoice.payment_succeeded BEFORE checkout.session.completed,
	// so the subscription record doesn't exist yet when the invoice webhook arrives.
	// We deposit here with the invoice ID as idempotency key — if the invoice webhook
	// eventually retries and succeeds, AddCredits will skip the duplicate via referenceID.
	if stripeSub.LatestInvoice != nil && stripeSub.LatestInvoice.ID != "" {
		if err := ProcessSubscriptionDeposit(ctx, client, ownerID, stripeSub.LatestInvoice.ID); err != nil {
			log.Printf("[BILLING] action=initial_deposit_fail owner=%s error=%v", ownerID, err)
			// Don't fail the checkout — subscription is created, deposit can be retried
		}
	}

	log.Printf("[BILLING] action=subscription_checkout owner=%s plan=%s sub=%s", ownerID, planName, subID)
	return nil
}

func mapStripeStatusWithCancel(status string, cancelAtPeriodEnd bool) enum.StripeSubStatus {
	switch status {
	case "active":
		if cancelAtPeriodEnd {
			return enum.StripeSubCanceling
		}
		return enum.StripeSubActive
	case "past_due":
		return enum.StripeSubPastDue
	default:
		return enum.StripeSubCanceled
	}
}
