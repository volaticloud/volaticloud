package billing

import (
	"strconv"

	"github.com/stripe/stripe-go/v82"
)

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
