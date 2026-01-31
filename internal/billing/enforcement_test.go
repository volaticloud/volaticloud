package billing

import (
	"context"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"volaticloud/internal/ent/enttest"
	"volaticloud/internal/enum"
)

func TestEnsureSufficientCredits(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:billing_enforce?mode=memory&cache=shared&_fk=1")
	defer client.Close()
	ctx := context.Background()

	t.Run("allows when no balance record (pre-billing org)", func(t *testing.T) {
		err := EnsureSufficientCredits(ctx, client, "org-no-record")
		assert.NoError(t, err)
	})

	t.Run("allows when balance is positive and not suspended", func(t *testing.T) {
		require.NoError(t, EnsureBalanceExists(ctx, client, "org-ok"))
		_, err := AddCredits(ctx, client, "org-ok", 5.0, enum.CreditTxManualDeposit, "test", "")
		require.NoError(t, err)

		err = EnsureSufficientCredits(ctx, client, "org-ok")
		assert.NoError(t, err)
	})

	t.Run("blocks when suspended", func(t *testing.T) {
		require.NoError(t, EnsureBalanceExists(ctx, client, "org-broke"))
		_, err := DeductCredits(ctx, client, "org-broke", 1.0, "test", "")
		require.NoError(t, err)

		err = EnsureSufficientCredits(ctx, client, "org-broke")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "suspended")
	})

	t.Run("blocks when balance is zero but not suspended", func(t *testing.T) {
		// This covers the case where a balance record exists with 0 credits
		// but the suspended flag hasn't been set (e.g. freshly created balance)
		require.NoError(t, EnsureBalanceExists(ctx, client, "org-zero"))

		err := EnsureSufficientCredits(ctx, client, "org-zero")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "no credits")
	})

	t.Run("blocks when balance is negative", func(t *testing.T) {
		// Edge case: balance could theoretically go negative in race conditions
		require.NoError(t, EnsureBalanceExists(ctx, client, "org-negative"))
		// Manually set a negative balance via the update API
		bal, err := GetBalance(ctx, client, "org-negative")
		require.NoError(t, err)
		_, err = client.CreditBalance.UpdateOneID(bal.ID).
			SetBalance(-1.0).
			Save(ctx)
		require.NoError(t, err)

		err = EnsureSufficientCredits(ctx, client, "org-negative")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "no credits")
	})
}
