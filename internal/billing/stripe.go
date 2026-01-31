package billing

import (
	"fmt"

	"github.com/stripe/stripe-go/v82"
	"github.com/stripe/stripe-go/v82/checkout/session"
	"github.com/stripe/stripe-go/v82/customer"
	"github.com/stripe/stripe-go/v82/invoice"
	"github.com/stripe/stripe-go/v82/product"
	"github.com/stripe/stripe-go/v82/subscription"
)

// StripeAPI defines the subset of Stripe operations used by webhook handlers.
type StripeAPI interface {
	GetSubscription(subscriptionID string) (*stripe.Subscription, error)
	CancelSubscription(subscriptionID string) (*stripe.Subscription, error)
}

// StripeClient wraps the Stripe API for billing operations.
type StripeClient struct {
	apiKey string
}

// Ensure StripeClient satisfies StripeAPI at compile time.
var _ StripeAPI = (*StripeClient)(nil)

// NewStripeClient creates a new Stripe client wrapper.
func NewStripeClient(apiKey string) *StripeClient {
	stripe.Key = apiKey
	return &StripeClient{apiKey: apiKey}
}

// CreateCustomer creates a Stripe customer for an organization.
func (s *StripeClient) CreateCustomer(ownerID string, email string) (*stripe.Customer, error) {
	params := &stripe.CustomerParams{
		Email: stripe.String(email),
		Metadata: map[string]string{
			"owner_id": ownerID,
		},
	}
	c, err := customer.New(params)
	if err != nil {
		return nil, fmt.Errorf("failed to create Stripe customer: %w", err)
	}
	return c, nil
}

// CreateSubscription creates a Stripe subscription for a customer.
func (s *StripeClient) CreateSubscription(customerID string, priceID string) (*stripe.Subscription, error) {
	params := &stripe.SubscriptionParams{
		Customer: stripe.String(customerID),
		Items: []*stripe.SubscriptionItemsParams{
			{Price: stripe.String(priceID)},
		},
	}
	sub, err := subscription.New(params)
	if err != nil {
		return nil, fmt.Errorf("failed to create Stripe subscription: %w", err)
	}
	return sub, nil
}

// CreateSubscriptionWithExpand creates a Stripe subscription with expanded product metadata.
func (s *StripeClient) CreateSubscriptionWithExpand(customerID string, priceID string) (*stripe.Subscription, error) {
	params := &stripe.SubscriptionParams{
		Customer: stripe.String(customerID),
		Items: []*stripe.SubscriptionItemsParams{
			{Price: stripe.String(priceID)},
		},
	}
	params.AddExpand("items.data.price.product")
	sub, err := subscription.New(params)
	if err != nil {
		return nil, fmt.Errorf("failed to create Stripe subscription: %w", err)
	}
	return sub, nil
}

// CancelSubscription cancels a Stripe subscription.
func (s *StripeClient) CancelSubscription(subscriptionID string) (*stripe.Subscription, error) {
	sub, err := subscription.Cancel(subscriptionID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to cancel Stripe subscription: %w", err)
	}
	return sub, nil
}

// GetProductFeatures retrieves features from a Stripe product's metadata.
func (s *StripeClient) GetProductFeatures(productID string) ([]string, error) {
	p, err := product.Get(productID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get Stripe product: %w", err)
	}

	featuresStr, ok := p.Metadata["features"]
	if !ok || featuresStr == "" {
		return nil, nil
	}

	return parseFeatures(featuresStr), nil
}

// CreateCheckoutSession creates a Stripe Checkout session for manual deposits.
func (s *StripeClient) CreateCheckoutSession(customerID string, ownerID string, amountCents int64, successURL string, cancelURL string) (*stripe.CheckoutSession, error) {
	params := &stripe.CheckoutSessionParams{
		Customer: stripe.String(customerID),
		Mode:     stripe.String(string(stripe.CheckoutSessionModePayment)),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
					Currency:   stripe.String("usd"),
					UnitAmount: stripe.Int64(amountCents),
					ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
						Name: stripe.String("Credit Deposit"),
					},
				},
				Quantity: stripe.Int64(1),
			},
		},
		SuccessURL: stripe.String(successURL),
		CancelURL:  stripe.String(cancelURL),
		Metadata: map[string]string{
			"owner_id": ownerID,
			"type":     "manual_deposit",
		},
	}
	sess, err := session.New(params)
	if err != nil {
		return nil, fmt.Errorf("failed to create checkout session: %w", err)
	}
	return sess, nil
}

// CreateSubscriptionCheckoutSession creates a Stripe Checkout session for subscribing to a plan.
func (s *StripeClient) CreateSubscriptionCheckoutSession(customerID, priceID, ownerID, successURL, cancelURL string) (*stripe.CheckoutSession, error) {
	params := &stripe.CheckoutSessionParams{
		Customer: stripe.String(customerID),
		Mode:     stripe.String(string(stripe.CheckoutSessionModeSubscription)),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(priceID),
				Quantity: stripe.Int64(1),
			},
		},
		SuccessURL: stripe.String(successURL),
		CancelURL:  stripe.String(cancelURL),
		Metadata: map[string]string{
			"type":     "subscription_checkout",
			"owner_id": ownerID,
		},
	}
	sess, err := session.New(params)
	if err != nil {
		return nil, fmt.Errorf("failed to create subscription checkout session: %w", err)
	}
	return sess, nil
}

// UpdateSubscriptionPrice changes the price on an existing subscription (plan change).
func (s *StripeClient) UpdateSubscriptionPrice(subscriptionID, newPriceID string) (*stripe.Subscription, error) {
	// Get current subscription to find item ID
	current, err := subscription.Get(subscriptionID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription for update: %w", err)
	}
	if len(current.Items.Data) == 0 {
		return nil, fmt.Errorf("subscription has no items")
	}

	params := &stripe.SubscriptionParams{
		Items: []*stripe.SubscriptionItemsParams{
			{
				ID:    stripe.String(current.Items.Data[0].ID),
				Price: stripe.String(newPriceID),
			},
		},
		ProrationBehavior: stripe.String("create_prorations"),
		CancelAtPeriodEnd: stripe.Bool(false),
	}
	params.AddExpand("items.data.price.product")
	sub, err := subscription.Update(subscriptionID, params)
	if err != nil {
		return nil, fmt.Errorf("failed to update subscription price: %w", err)
	}
	return sub, nil
}

// CancelSubscriptionAtPeriodEnd marks a subscription to cancel at the end of the current period.
func (s *StripeClient) CancelSubscriptionAtPeriodEnd(subscriptionID string) (*stripe.Subscription, error) {
	params := &stripe.SubscriptionParams{
		CancelAtPeriodEnd: stripe.Bool(true),
	}
	sub, err := subscription.Update(subscriptionID, params)
	if err != nil {
		return nil, fmt.Errorf("failed to set cancel at period end: %w", err)
	}
	return sub, nil
}

// GetSubscription retrieves a Stripe subscription by ID.
func (s *StripeClient) GetSubscription(subscriptionID string) (*stripe.Subscription, error) {
	params := &stripe.SubscriptionParams{}
	params.AddExpand("items.data.price.product")
	sub, err := subscription.Get(subscriptionID, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get Stripe subscription: %w", err)
	}
	return sub, nil
}

// ListInvoices retrieves recent invoices for a Stripe customer.
func (s *StripeClient) ListInvoices(customerID string, limit int64) ([]*stripe.Invoice, error) {
	params := &stripe.InvoiceListParams{
		Customer: stripe.String(customerID),
	}
	params.Filters.AddFilter("limit", "", fmt.Sprintf("%d", limit))

	var invoices []*stripe.Invoice
	iter := invoice.List(params)
	for iter.Next() {
		invoices = append(invoices, iter.Invoice())
	}
	if err := iter.Err(); err != nil {
		return nil, fmt.Errorf("failed to list invoices: %w", err)
	}
	return invoices, nil
}
