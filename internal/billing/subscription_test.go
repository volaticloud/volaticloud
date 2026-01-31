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

func TestProcessSubscriptionDeposit(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:billing_sub_deposit?mode=memory&cache=shared&_fk=1")
	defer client.Close()
	ctx := context.Background()

	// Helper to create a subscription with given params
	createSub := func(t *testing.T, ownerID string, status enum.StripeSubStatus, deposit float64) {
		t.Helper()
		_, err := client.StripeSubscription.Create().
			SetOwnerID(ownerID).
			SetStripeCustomerID("cus_test").
			SetStripeSubscriptionID("sub_" + ownerID).
			SetStripePriceID("price_test").
			SetPlanName("pro").
			SetMonthlyDeposit(deposit).
			SetStatus(status).
			SetFeatures([]string{"live_trading"}).
			SetCurrentPeriodStart(time.Now()).
			SetCurrentPeriodEnd(time.Now().Add(30 * 24 * time.Hour)).
			Save(ctx)
		require.NoError(t, err)
		require.NoError(t, EnsureBalanceExists(ctx, client, ownerID))
	}

	t.Run("deposits monthly amount for active subscription", func(t *testing.T) {
		createSub(t, "org-active", enum.StripeSubActive, 60.0)

		err := ProcessSubscriptionDeposit(ctx, client, "org-active", "inv_001")
		require.NoError(t, err)

		bal, err := GetBalance(ctx, client, "org-active")
		require.NoError(t, err)
		assert.Equal(t, 60.0, bal.Balance)
	})

	t.Run("skips deposit for canceled subscription", func(t *testing.T) {
		createSub(t, "org-canceled", enum.StripeSubCanceled, 60.0)

		err := ProcessSubscriptionDeposit(ctx, client, "org-canceled", "inv_002")
		require.NoError(t, err)

		bal, err := GetBalance(ctx, client, "org-canceled")
		require.NoError(t, err)
		assert.Equal(t, 0.0, bal.Balance)
	})

	t.Run("skips deposit for canceling subscription", func(t *testing.T) {
		createSub(t, "org-canceling", enum.StripeSubCanceling, 60.0)

		err := ProcessSubscriptionDeposit(ctx, client, "org-canceling", "inv_003")
		require.NoError(t, err)

		bal, err := GetBalance(ctx, client, "org-canceling")
		require.NoError(t, err)
		assert.Equal(t, 0.0, bal.Balance)
	})

	t.Run("skips deposit for past_due subscription", func(t *testing.T) {
		createSub(t, "org-pastdue", enum.StripeSubPastDue, 60.0)

		err := ProcessSubscriptionDeposit(ctx, client, "org-pastdue", "inv_004")
		require.NoError(t, err)

		bal, err := GetBalance(ctx, client, "org-pastdue")
		require.NoError(t, err)
		assert.Equal(t, 0.0, bal.Balance)
	})

	t.Run("skips deposit when monthly_deposit is zero", func(t *testing.T) {
		createSub(t, "org-zero-deposit", enum.StripeSubActive, 0)

		err := ProcessSubscriptionDeposit(ctx, client, "org-zero-deposit", "inv_005")
		require.NoError(t, err)

		bal, err := GetBalance(ctx, client, "org-zero-deposit")
		require.NoError(t, err)
		assert.Equal(t, 0.0, bal.Balance)
	})

	t.Run("fails for unknown org (no subscription)", func(t *testing.T) {
		err := ProcessSubscriptionDeposit(ctx, client, "org-nonexistent", "inv_006")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to get subscription")
	})

	t.Run("idempotent with same invoice ID", func(t *testing.T) {
		createSub(t, "org-idemp", enum.StripeSubActive, 50.0)

		err := ProcessSubscriptionDeposit(ctx, client, "org-idemp", "inv_dup")
		require.NoError(t, err)

		// Second call with same invoice ID should be idempotent
		err = ProcessSubscriptionDeposit(ctx, client, "org-idemp", "inv_dup")
		require.NoError(t, err)

		bal, err := GetBalance(ctx, client, "org-idemp")
		require.NoError(t, err)
		assert.Equal(t, 50.0, bal.Balance) // Only deposited once
	})

	t.Run("deposits correct amount based on plan", func(t *testing.T) {
		createSub(t, "org-starter", enum.StripeSubActive, 5.0)

		err := ProcessSubscriptionDeposit(ctx, client, "org-starter", "inv_starter")
		require.NoError(t, err)

		bal, err := GetBalance(ctx, client, "org-starter")
		require.NoError(t, err)
		assert.Equal(t, 5.0, bal.Balance)
	})
}