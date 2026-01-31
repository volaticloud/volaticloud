package billing

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stripe/stripe-go/v82"
)

func TestExtractPlanMetadata(t *testing.T) {
	t.Run("extracts all fields from product metadata", func(t *testing.T) {
		sub := &stripe.Subscription{
			Items: &stripe.SubscriptionItemList{
				Data: []*stripe.SubscriptionItem{
					{
						Price: &stripe.Price{
							Product: &stripe.Product{
								Name: "Pro Plan",
								Metadata: map[string]string{
									"display_name":   "Pro",
									"monthly_deposit": "60",
									"features":       "live_trading,backtesting,code_mode",
								},
							},
						},
					},
				},
			},
		}

		planName, deposit, features := ExtractPlanMetadata(sub)
		assert.Equal(t, "Pro", planName)
		assert.Equal(t, 60.0, deposit)
		assert.Equal(t, []string{"live_trading", "backtesting", "code_mode"}, features)
	})

	t.Run("falls back to product name when display_name missing", func(t *testing.T) {
		sub := &stripe.Subscription{
			Items: &stripe.SubscriptionItemList{
				Data: []*stripe.SubscriptionItem{
					{
						Price: &stripe.Price{
							Product: &stripe.Product{
								Name:     "Enterprise Plan",
								Metadata: map[string]string{},
							},
						},
					},
				},
			},
		}

		planName, deposit, features := ExtractPlanMetadata(sub)
		assert.Equal(t, "Enterprise Plan", planName)
		assert.Equal(t, 0.0, deposit)
		assert.Nil(t, features)
	})

	t.Run("returns unknown for nil subscription", func(t *testing.T) {
		planName, deposit, features := ExtractPlanMetadata(nil)
		assert.Equal(t, "unknown", planName)
		assert.Equal(t, 0.0, deposit)
		assert.Nil(t, features)
	})

	t.Run("returns unknown for empty items", func(t *testing.T) {
		sub := &stripe.Subscription{
			Items: &stripe.SubscriptionItemList{
				Data: []*stripe.SubscriptionItem{},
			},
		}

		planName, deposit, features := ExtractPlanMetadata(sub)
		assert.Equal(t, "unknown", planName)
		assert.Equal(t, 0.0, deposit)
		assert.Nil(t, features)
	})

	t.Run("returns unknown when price is nil", func(t *testing.T) {
		sub := &stripe.Subscription{
			Items: &stripe.SubscriptionItemList{
				Data: []*stripe.SubscriptionItem{
					{Price: nil},
				},
			},
		}

		planName, deposit, features := ExtractPlanMetadata(sub)
		assert.Equal(t, "unknown", planName)
		assert.Equal(t, 0.0, deposit)
		assert.Nil(t, features)
	})

	t.Run("returns unknown when product is nil", func(t *testing.T) {
		sub := &stripe.Subscription{
			Items: &stripe.SubscriptionItemList{
				Data: []*stripe.SubscriptionItem{
					{Price: &stripe.Price{Product: nil}},
				},
			},
		}

		planName, deposit, features := ExtractPlanMetadata(sub)
		assert.Equal(t, "unknown", planName)
		assert.Equal(t, 0.0, deposit)
		assert.Nil(t, features)
	})

	t.Run("handles invalid monthly_deposit value", func(t *testing.T) {
		sub := &stripe.Subscription{
			Items: &stripe.SubscriptionItemList{
				Data: []*stripe.SubscriptionItem{
					{
						Price: &stripe.Price{
							Product: &stripe.Product{
								Name: "Bad Plan",
								Metadata: map[string]string{
									"monthly_deposit": "not_a_number",
								},
							},
						},
					},
				},
			},
		}

		planName, deposit, _ := ExtractPlanMetadata(sub)
		assert.Equal(t, "Bad Plan", planName)
		assert.Equal(t, 0.0, deposit) // Falls back to 0
	})

	t.Run("handles empty product name and no display_name", func(t *testing.T) {
		sub := &stripe.Subscription{
			Items: &stripe.SubscriptionItemList{
				Data: []*stripe.SubscriptionItem{
					{
						Price: &stripe.Price{
							Product: &stripe.Product{
								Name:     "",
								Metadata: map[string]string{},
							},
						},
					},
				},
			},
		}

		planName, _, _ := ExtractPlanMetadata(sub)
		// Both display_name and Name are empty — metaOrDefault returns ""
		assert.Equal(t, "", planName)
	})
}