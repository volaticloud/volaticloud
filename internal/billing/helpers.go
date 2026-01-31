package billing

import (
	"time"

	"github.com/stripe/stripe-go/v82"
)

// subscriptionPeriodStart extracts the current period start from a Stripe subscription.
// In stripe-go v82, period fields are on subscription items.
func subscriptionPeriodStart(sub *stripe.Subscription) time.Time {
	if sub.Items != nil && len(sub.Items.Data) > 0 {
		return time.Unix(sub.Items.Data[0].CurrentPeriodStart, 0)
	}
	return time.Unix(sub.StartDate, 0)
}

// subscriptionPeriodEnd extracts the current period end from a Stripe subscription.
func subscriptionPeriodEnd(sub *stripe.Subscription) time.Time {
	if sub.Items != nil && len(sub.Items.Data) > 0 {
		return time.Unix(sub.Items.Data[0].CurrentPeriodEnd, 0)
	}
	// Fallback: 30 days from start
	return time.Unix(sub.StartDate, 0).Add(30 * 24 * time.Hour)
}
