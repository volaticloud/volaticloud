package billing

import (
	"context"
	"fmt"
	"strings"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/stripesubscription"
	"volaticloud/internal/enum"
)

// HasFeature checks if an organization's subscription includes a specific feature.
func HasFeature(ctx context.Context, client *ent.Client, ownerID string, feature string) error {
	// Query any subscription record for this org (regardless of status)
	sub, err := client.StripeSubscription.Query().
		Where(stripesubscription.OwnerID(ownerID)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			// No subscription record at all — org was created before billing system.
			// Allow access; actual credit enforcement is handled by EnsureSufficientCredits.
			return nil
		}
		return fmt.Errorf("failed to check subscription: %w", err)
	}

	// Only active and canceling subscriptions grant feature access
	switch sub.Status {
	case enum.StripeSubActive, enum.StripeSubCanceling:
		// OK — check features below
	case enum.StripeSubCanceled:
		return fmt.Errorf("subscription canceled — please resubscribe to access %q", feature)
	case enum.StripeSubPastDue:
		return fmt.Errorf("subscription past due — please update payment method to access %q", feature)
	default:
		return fmt.Errorf("subscription inactive (status: %s)", sub.Status)
	}

	for _, f := range sub.Features {
		if f == feature {
			return nil
		}
	}

	return fmt.Errorf("feature %q not available on %s plan — upgrade required", feature, sub.PlanName)
}

// parseFeatures parses a comma-separated features string into a slice.
func parseFeatures(featuresStr string) []string {
	if featuresStr == "" {
		return nil
	}
	parts := strings.Split(featuresStr, ",")
	features := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			features = append(features, trimmed)
		}
	}
	return features
}
