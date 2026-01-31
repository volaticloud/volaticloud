package billing

import (
	"context"
	"fmt"
	"log"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/stripesubscription"
	"volaticloud/internal/enum"
)

// ProcessSubscriptionDeposit handles credit top-up when a subscription invoice is paid.
// Always deposits the full monthlyDeposit amount. Manual deposits are independent
// and do not reduce the subscription deposit.
func ProcessSubscriptionDeposit(ctx context.Context, client *ent.Client, ownerID string, invoiceID string) error {
	// Get the subscription record
	sub, err := client.StripeSubscription.Query().
		Where(stripesubscription.OwnerID(ownerID)).
		Only(ctx)
	if err != nil {
		return fmt.Errorf("failed to get subscription for %s: %w", ownerID, err)
	}

	if sub.Status != enum.StripeSubActive {
		log.Printf("Skipping deposit for %s: subscription status is %s", ownerID, sub.Status)
		return nil
	}

	if sub.MonthlyDeposit <= 0 {
		log.Printf("Skipping deposit for %s: monthly deposit is $%.2f", ownerID, sub.MonthlyDeposit)
		return nil
	}

	_, err = AddCredits(ctx, client, ownerID, sub.MonthlyDeposit, enum.CreditTxSubscriptionDeposit,
		fmt.Sprintf("%s plan renewal deposit", sub.PlanName), invoiceID)
	if err != nil {
		return fmt.Errorf("failed to add subscription deposit: %w", err)
	}

	log.Printf("Deposited $%.2f for %s (%s plan)", sub.MonthlyDeposit, ownerID, sub.PlanName)
	return nil
}
