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
	sub, err := client.StripeSubscription.Query().
		Where(
			stripesubscription.OwnerID(ownerID),
			stripesubscription.StatusIn(enum.StripeSubActive, enum.StripeSubCanceling),
		).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			// No subscription means billing is not configured for this org — allow access.
			// Actual credit enforcement is handled separately by EnsureSufficientCredits.
			return nil
		}
		return fmt.Errorf("failed to check subscription: %w", err)
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
