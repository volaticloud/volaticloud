package billing

import (
	"fmt"
	"sort"
	"strconv"

	"github.com/stripe/stripe-go/v82"
	"github.com/stripe/stripe-go/v82/price"
	"github.com/stripe/stripe-go/v82/product"
)

// PlanInfo represents a subscription plan available for organizations.
type PlanInfo struct {
	PriceID        string   `json:"priceId"`
	ProductID      string   `json:"productId"`
	DisplayName    string   `json:"displayName"`
	Description    string   `json:"description"`
	PriceAmount    float64  `json:"priceAmount"`
	MonthlyDeposit float64  `json:"monthlyDeposit"`
	Features       []string `json:"features"`
	DisplayOrder   int      `json:"displayOrder"`
}

// ListAvailablePlans queries Stripe for all active products tagged with
// metadata app=volaticloud, retrieves their prices, and returns them sorted
// by display_order.
func (s *StripeClient) ListAvailablePlans() ([]PlanInfo, error) {
	// List active products — Stripe API does not support filtering by metadata
	// directly, so we fetch all active products and filter client-side.
	params := &stripe.ProductListParams{
		Active: stripe.Bool(true),
	}
	params.Limit = stripe.Int64(100)

	var plans []PlanInfo
	iter := product.List(params)
	for iter.Next() {
		p := iter.Product()
		if p.Metadata["app"] != "volaticloud" {
			continue
		}

		plan := PlanInfo{
			ProductID:   p.ID,
			DisplayName: metaOrDefault(p.Metadata, "display_name", p.Name),
			Description: metaOrDefault(p.Metadata, "description", ""),
			Features:    parseFeatures(p.Metadata["features"]),
		}

		if v, err := strconv.Atoi(p.Metadata["display_order"]); err == nil {
			plan.DisplayOrder = v
		}
		if v, err := strconv.ParseFloat(p.Metadata["monthly_deposit"], 64); err == nil {
			plan.MonthlyDeposit = v
		}

		// Find the default recurring price for this product
		priceParams := &stripe.PriceListParams{
			Product: stripe.String(p.ID),
			Active:  stripe.Bool(true),
		}
		priceParams.Limit = stripe.Int64(10)
		priceIter := price.List(priceParams)
		for priceIter.Next() {
			pr := priceIter.Price()
			if pr.Recurring != nil {
				plan.PriceID = pr.ID
				plan.PriceAmount = float64(pr.UnitAmount) / 100.0
				break
			}
		}
		if err := priceIter.Err(); err != nil {
			return nil, fmt.Errorf("failed to list prices for product %s: %w", p.ID, err)
		}

		if plan.PriceID == "" {
			continue // skip products with no recurring price
		}

		plans = append(plans, plan)
	}
	if err := iter.Err(); err != nil {
		return nil, fmt.Errorf("failed to list Stripe products: %w", err)
	}

	sort.Slice(plans, func(i, j int) bool {
		return plans[i].DisplayOrder < plans[j].DisplayOrder
	})

	return plans, nil
}

// GetProductMetadata fetches a Stripe product and returns its full metadata.
func (s *StripeClient) GetProductMetadata(productID string) (map[string]string, error) {
	p, err := product.Get(productID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get Stripe product %s: %w", productID, err)
	}
	return p.Metadata, nil
}

// GetStarterPlan returns the plan with the lowest display_order (the default/free plan).
func (s *StripeClient) GetStarterPlan() (*PlanInfo, error) {
	plans, err := s.ListAvailablePlans()
	if err != nil {
		return nil, err
	}
	if len(plans) == 0 {
		return nil, fmt.Errorf("no plans configured in Stripe")
	}
	return &plans[0], nil // Already sorted by display_order
}

func metaOrDefault(meta map[string]string, key string, defaultVal string) string {
	if v, ok := meta[key]; ok && v != "" {
		return v
	}
	return defaultVal
}
