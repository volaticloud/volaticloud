package billing

import (
	"context"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"volaticloud/internal/ent/enttest"
	"volaticloud/internal/enum"
)

func TestHasFeature(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:billing_features?mode=memory&cache=shared&_fk=1")
	defer client.Close()
	ctx := context.Background()

	// Create a subscription with features
	_, err := client.StripeSubscription.Create().
		SetOwnerID("org-feat").
		SetStripeCustomerID("cus_test").
		SetStripeSubscriptionID("sub_test").
		SetStripePriceID("price_test").
		SetPlanName("pro").
		SetMonthlyDeposit(60).
		SetStatus(enum.StripeSubActive).
		SetFeatures([]string{"live_trading", "backtesting", "code_mode", "alerting"}).
		SetCurrentPeriodStart(time.Now()).
		SetCurrentPeriodEnd(time.Now().Add(30 * 24 * time.Hour)).
		Save(ctx)
	require.NoError(t, err)

	t.Run("allows available feature", func(t *testing.T) {
		err := HasFeature(ctx, client, "org-feat", "live_trading")
		assert.NoError(t, err)
	})

	t.Run("allows another available feature", func(t *testing.T) {
		err := HasFeature(ctx, client, "org-feat", "code_mode")
		assert.NoError(t, err)
	})

	t.Run("rejects unavailable feature", func(t *testing.T) {
		err := HasFeature(ctx, client, "org-feat", "team_management")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not available")
	})

	t.Run("rejects org with no subscription", func(t *testing.T) {
		err := HasFeature(ctx, client, "org-no-sub", "live_trading")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "no active subscription")
	})

	t.Run("allows features for canceling subscription (active until period end)", func(t *testing.T) {
		_, err := client.StripeSubscription.Create().
			SetOwnerID("org-canceling").
			SetStripeCustomerID("cus_cancel").
			SetStripeSubscriptionID("sub_cancel").
			SetStripePriceID("price_test").
			SetPlanName("pro").
			SetMonthlyDeposit(60).
			SetStatus(enum.StripeSubCanceling).
			SetFeatures([]string{"live_trading", "backtesting"}).
			SetCurrentPeriodStart(time.Now()).
			SetCurrentPeriodEnd(time.Now().Add(30 * 24 * time.Hour)).
			Save(ctx)
		require.NoError(t, err)

		err = HasFeature(ctx, client, "org-canceling", "live_trading")
		assert.NoError(t, err)
	})

	t.Run("rejects features for canceled subscription", func(t *testing.T) {
		_, err := client.StripeSubscription.Create().
			SetOwnerID("org-canceled").
			SetStripeCustomerID("cus_off").
			SetStripeSubscriptionID("sub_off").
			SetStripePriceID("price_test").
			SetPlanName("pro").
			SetMonthlyDeposit(60).
			SetStatus(enum.StripeSubCanceled).
			SetFeatures([]string{"live_trading", "backtesting"}).
			SetCurrentPeriodStart(time.Now()).
			SetCurrentPeriodEnd(time.Now().Add(30 * 24 * time.Hour)).
			Save(ctx)
		require.NoError(t, err)

		err = HasFeature(ctx, client, "org-canceled", "live_trading")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "canceled")
	})

	t.Run("rejects features for past_due subscription", func(t *testing.T) {
		_, err := client.StripeSubscription.Create().
			SetOwnerID("org-pastdue").
			SetStripeCustomerID("cus_pd").
			SetStripeSubscriptionID("sub_pd").
			SetStripePriceID("price_test").
			SetPlanName("pro").
			SetMonthlyDeposit(60).
			SetStatus(enum.StripeSubPastDue).
			SetFeatures([]string{"live_trading"}).
			SetCurrentPeriodStart(time.Now()).
			SetCurrentPeriodEnd(time.Now().Add(30 * 24 * time.Hour)).
			Save(ctx)
		require.NoError(t, err)

		err = HasFeature(ctx, client, "org-pastdue", "live_trading")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "past due")
	})

	t.Run("error message includes plan name", func(t *testing.T) {
		err := HasFeature(ctx, client, "org-feat", "custom_infrastructure")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "pro")
		assert.Contains(t, err.Error(), "upgrade required")
	})
}

func TestParseFeatures(t *testing.T) {
	tests := []struct {
		input    string
		expected []string
	}{
		{"", nil},
		{"live_trading", []string{"live_trading"}},
		{"live_trading,backtesting", []string{"live_trading", "backtesting"}},
		{"live_trading, backtesting , code_mode", []string{"live_trading", "backtesting", "code_mode"}},
		{",,,", []string{}},
	}

	for _, tt := range tests {
		result := parseFeatures(tt.input)
		assert.Equal(t, tt.expected, result, "input: %q", tt.input)
	}
}
