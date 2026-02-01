package billing

import (
	"context"
	"fmt"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/stripesubscription"
	"volaticloud/internal/enum"
)

// CreateDepositCheckoutSession creates a Stripe Checkout session for a manual credit deposit.
// It validates the amount, resolves or creates a Stripe customer, and returns the checkout URL.
func CreateDepositCheckoutSession(ctx context.Context, client *ent.Client, stripeClient *StripeClient, ownerID string, amount float64, frontendURL string, email string) (string, error) {
	if amount < 5 {
		return "", fmt.Errorf("minimum deposit amount is $5")
	}
	if amount > 10000 {
		return "", fmt.Errorf("maximum deposit amount is $10,000")
	}

	// Get Stripe customer ID from subscription, or create a new customer
	customerID, err := resolveOrCreateCustomer(ctx, client, stripeClient, ownerID, email)
	if err != nil {
		return "", err
	}

	amountCents := int64(amount * 100)
	session, err := stripeClient.CreateCheckoutSession(
		customerID, ownerID, amountCents,
		fmt.Sprintf("%s/organization/billing?orgId=%s&deposit=success", frontendURL, ownerID),
		fmt.Sprintf("%s/organization/billing?orgId=%s&deposit=cancel", frontendURL, ownerID),
	)
	if err != nil {
		return "", fmt.Errorf("failed to create checkout session: %w", err)
	}

	return session.URL, nil
}

// CreateSubscriptionCheckoutSession creates a Stripe Checkout session for subscribing to a plan.
// It validates no active subscription exists, resolves or creates a customer, and returns the checkout URL.
func CreateSubscriptionCheckout(ctx context.Context, client *ent.Client, stripeClient *StripeClient, ownerID string, priceID string, frontendURL string, email string) (string, error) {
	// Check no active/canceling subscription exists
	existingSub, err := client.StripeSubscription.Query().
		Where(
			stripesubscription.OwnerID(ownerID),
			stripesubscription.StatusIn(enum.StripeSubActive, enum.StripeSubCanceling),
		).
		Only(ctx)
	if err == nil && existingSub != nil {
		return "", fmt.Errorf("organization already has an active subscription")
	}

	// Look for existing customer ID from a canceled subscription record
	var customerID string
	canceledSub, err := client.StripeSubscription.Query().
		Where(stripesubscription.OwnerID(ownerID)).
		Only(ctx)
	if err == nil && canceledSub != nil {
		customerID = canceledSub.StripeCustomerID
	} else {
		// Create new Stripe customer
		cust, err := stripeClient.CreateCustomer(ownerID, email)
		if err != nil {
			return "", fmt.Errorf("failed to create Stripe customer: %w", err)
		}
		customerID = cust.ID
	}

	sess, err := stripeClient.CreateSubscriptionCheckoutSession(
		customerID, priceID, ownerID,
		fmt.Sprintf("%s/organization/billing?orgId=%s&subscription=success", frontendURL, ownerID),
		fmt.Sprintf("%s/organization/billing?orgId=%s&subscription=cancel", frontendURL, ownerID),
	)
	if err != nil {
		return "", err
	}
	return sess.URL, nil
}

// resolveOrCreateCustomer finds an existing Stripe customer ID from subscription records,
// or creates a new Stripe customer.
func resolveOrCreateCustomer(ctx context.Context, client *ent.Client, stripeClient *StripeClient, ownerID string, email string) (string, error) {
	sub, err := client.StripeSubscription.Query().
		Where(stripesubscription.OwnerID(ownerID)).
		Only(ctx)
	if err != nil {
		if !ent.IsNotFound(err) {
			return "", fmt.Errorf("failed to query subscription: %w", err)
		}
		// No subscription — create a Stripe customer for this org
		cust, err := stripeClient.CreateCustomer(ownerID, email)
		if err != nil {
			return "", fmt.Errorf("failed to create Stripe customer: %w", err)
		}
		return cust.ID, nil
	}
	return sub.StripeCustomerID, nil
}
