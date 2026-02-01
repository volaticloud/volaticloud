package billing

import (
	"context"
	"fmt"
	"log"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/stripesubscription"
	"volaticloud/internal/enum"
)

// SubscriptionResult holds the updated subscription info after a plan change or cancellation.
type SubscriptionResult struct {
	PlanName         string
	MonthlyDeposit   float64
	Status           enum.StripeSubStatus
	CurrentPeriodEnd interface{} // time.Time from ENT
	Features         []string
}

// ChangeSubscriptionPlan changes the price on an existing active/canceling subscription.
// It updates Stripe, extracts new plan metadata, and updates the local DB record.
func ChangeSubscriptionPlan(ctx context.Context, client *ent.Client, stripeClient *StripeClient, ownerID string, newPriceID string) (*ent.StripeSubscription, error) {
	sub, err := client.StripeSubscription.Query().
		Where(
			stripesubscription.OwnerID(ownerID),
			stripesubscription.StatusIn(enum.StripeSubActive, enum.StripeSubCanceling),
		).
		Only(ctx)
	if err != nil {
		return nil, fmt.Errorf("no active subscription found: %w", err)
	}

	updatedStripeSub, err := stripeClient.UpdateSubscriptionPrice(sub.StripeSubscriptionID, newPriceID)
	if err != nil {
		return nil, err
	}

	planName, monthlyDeposit, features := ExtractPlanMetadata(updatedStripeSub)

	updated, err := client.StripeSubscription.UpdateOneID(sub.ID).
		SetStripePriceID(newPriceID).
		SetPlanName(planName).
		SetMonthlyDeposit(monthlyDeposit).
		SetFeatures(features).
		SetStatus(enum.StripeSubActive).
		Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to update subscription record: %w", err)
	}

	log.Printf("[BILLING] action=plan_change owner=%s plan=%s deposit=%.2f", ownerID, planName, monthlyDeposit)
	return updated, nil
}

// CancelSubscriptionAtEnd cancels a subscription at the end of the current billing period.
// It updates Stripe and sets the local DB status to "canceling".
func CancelSubscriptionAtEnd(ctx context.Context, client *ent.Client, stripeClient *StripeClient, ownerID string) (*ent.StripeSubscription, error) {
	sub, err := client.StripeSubscription.Query().
		Where(
			stripesubscription.OwnerID(ownerID),
			stripesubscription.StatusEQ(enum.StripeSubActive),
		).
		Only(ctx)
	if err != nil {
		return nil, fmt.Errorf("no active subscription found: %w", err)
	}

	if _, err := stripeClient.CancelSubscriptionAtPeriodEnd(sub.StripeSubscriptionID); err != nil {
		return nil, err
	}

	updated, err := client.StripeSubscription.UpdateOneID(sub.ID).
		SetStatus(enum.StripeSubCanceling).
		Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to update subscription status: %w", err)
	}

	log.Printf("[BILLING] action=cancellation_request owner=%s sub=%s", ownerID, sub.StripeSubscriptionID)
	return updated, nil
}
