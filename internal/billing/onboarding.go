package billing

import (
	"context"
	"fmt"
	"log"
	"strconv"

	"github.com/stripe/stripe-go/v82"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/stripesubscription"
	"volaticloud/internal/enum"
)

// AssignStarterPlanIfFirstOrg assigns the starter plan (lowest display_order in Stripe)
// to a new organization if it doesn't already have a subscription.
// All plan details are read from Stripe product metadata.
//
// NOTE: Anti-abuse for multi-org users (creating multiple orgs for multiple starter plans)
// is a known limitation documented in ADR-0022 Risks. Each new org gets a starter plan with
// a small credit deposit ($5). User→org mappings are in Keycloak, not the billing DB, so
// cross-org checks would require a Keycloak lookup at the resolver layer. Accepted risk:
// abuse is bounded by Keycloak rate limits on org creation and the small deposit amount.
func AssignStarterPlanIfFirstOrg(ctx context.Context, client *ent.Client, stripeClient *StripeClient, userID string, ownerID string, email string) error {
	// Check if this org already has a subscription
	existingSub, _ := client.StripeSubscription.Query().
		Where(stripesubscription.OwnerID(ownerID)).
		Only(ctx)
	if existingSub != nil {
		log.Printf("[BILLING] action=starter_skip owner=%s reason=existing_subscription", ownerID)
		return nil
	}

	// Resolve starter plan from Stripe (lowest display_order)
	starterPlan, err := stripeClient.GetStarterPlan()
	if err != nil {
		return fmt.Errorf("failed to resolve starter plan from Stripe: %w", err)
	}

	// Create Stripe customer
	cust, err := stripeClient.CreateCustomer(ownerID, email)
	if err != nil {
		return fmt.Errorf("failed to create Stripe customer: %w", err)
	}

	// Create Stripe subscription (with expanded product for metadata)
	sub, err := stripeClient.CreateSubscriptionWithExpand(cust.ID, starterPlan.PriceID)
	if err != nil {
		return fmt.Errorf("failed to create Stripe subscription: %w", err)
	}

	// Read plan details from Stripe product metadata (single source of truth)
	planName, monthlyDeposit, features := ExtractPlanMetadata(sub)

	// Store subscription record
	_, err = client.StripeSubscription.Create().
		SetOwnerID(ownerID).
		SetStripeCustomerID(cust.ID).
		SetStripeSubscriptionID(sub.ID).
		SetStripePriceID(starterPlan.PriceID).
		SetPlanName(planName).
		SetMonthlyDeposit(monthlyDeposit).
		SetStatus(enum.StripeSubActive).
		SetFeatures(features).
		SetCurrentPeriodStart(subscriptionPeriodStart(sub)).
		SetCurrentPeriodEnd(subscriptionPeriodEnd(sub)).
		Save(ctx)
	if err != nil {
		return fmt.Errorf("failed to save subscription record: %w", err)
	}

	// NOTE: No credit deposit here. Stripe fires invoice.payment_succeeded with
	// billing_reason=subscription_create after subscription creation, which triggers
	// ProcessSubscriptionDeposit via the webhook handler (see ADR-0024).
	log.Printf("[BILLING] action=starter_plan_assigned owner=%s plan=%s deposit_via=webhook", ownerID, planName)
	return nil
}

// ExtractPlanMetadata reads plan name, monthly deposit, and features from the
// Stripe product metadata embedded in a subscription (requires items.data.price.product expansion).
func ExtractPlanMetadata(sub *stripe.Subscription) (planName string, monthlyDeposit float64, features []string) {
	planName = "unknown"
	monthlyDeposit = 0
	features = nil

	if sub == nil || len(sub.Items.Data) == 0 {
		return
	}
	item := sub.Items.Data[0]
	if item.Price == nil || item.Price.Product == nil {
		return
	}

	meta := item.Price.Product.Metadata
	planName = metaOrDefault(meta, "display_name", item.Price.Product.Name)
	if v, err := strconv.ParseFloat(meta["monthly_deposit"], 64); err == nil {
		monthlyDeposit = v
	}
	features = parseFeatures(meta["features"])
	return
}
