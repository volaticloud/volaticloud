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

func TestEnsureBalanceExists(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:billing_balance?mode=memory&cache=shared&_fk=1")
	defer client.Close()
	ctx := context.Background()

	t.Run("creates balance if not exists", func(t *testing.T) {
		err := EnsureBalanceExists(ctx, client, "org-1")
		require.NoError(t, err)

		bal, err := GetBalance(ctx, client, "org-1")
		require.NoError(t, err)
		assert.Equal(t, 0.0, bal.Balance)
		assert.False(t, bal.Suspended)
	})

	t.Run("idempotent if already exists", func(t *testing.T) {
		err := EnsureBalanceExists(ctx, client, "org-1")
		require.NoError(t, err)
	})
}

func TestAddCredits(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:billing_add?mode=memory&cache=shared&_fk=1")
	defer client.Close()
	ctx := context.Background()

	require.NoError(t, EnsureBalanceExists(ctx, client, "org-add"))

	t.Run("adds credits and records transaction", func(t *testing.T) {
		bal, err := AddCredits(ctx, client, "org-add", 10.0, enum.CreditTxManualDeposit, "test deposit", "ref-1")
		require.NoError(t, err)
		assert.Equal(t, 10.0, bal.Balance)
		assert.False(t, bal.Suspended)
	})

	t.Run("rejects zero amount", func(t *testing.T) {
		_, err := AddCredits(ctx, client, "org-add", 0, enum.CreditTxManualDeposit, "bad", "")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "positive")
	})

	t.Run("rejects negative amount", func(t *testing.T) {
		_, err := AddCredits(ctx, client, "org-add", -5.0, enum.CreditTxManualDeposit, "bad", "")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "positive")
	})

	t.Run("idempotent with same reference_id", func(t *testing.T) {
		bal, err := AddCredits(ctx, client, "org-add", 100.0, enum.CreditTxManualDeposit, "dup", "ref-1")
		require.NoError(t, err)
		assert.Equal(t, 10.0, bal.Balance) // Not changed
	})

	t.Run("unsuspends on credit add", func(t *testing.T) {
		// Create a suspended org
		require.NoError(t, EnsureBalanceExists(ctx, client, "org-suspended"))
		_, err := DeductCredits(ctx, client, "org-suspended", 1.0, "test", "deduct-1")
		require.NoError(t, err) // balance goes to 0, suspended

		bal, err := GetBalance(ctx, client, "org-suspended")
		require.NoError(t, err)
		assert.True(t, bal.Suspended)

		// Add credits should unsuspend
		bal, err = AddCredits(ctx, client, "org-suspended", 5.0, enum.CreditTxManualDeposit, "rescue", "")
		require.NoError(t, err)
		assert.False(t, bal.Suspended)
		assert.Equal(t, 5.0, bal.Balance)
	})
}

func TestDeductCredits(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:billing_deduct?mode=memory&cache=shared&_fk=1")
	defer client.Close()
	ctx := context.Background()

	require.NoError(t, EnsureBalanceExists(ctx, client, "org-deduct"))
	_, err := AddCredits(ctx, client, "org-deduct", 10.0, enum.CreditTxManualDeposit, "initial", "init-1")
	require.NoError(t, err)

	t.Run("deducts credits", func(t *testing.T) {
		bal, err := DeductCredits(ctx, client, "org-deduct", 3.0, "usage", "usage-1")
		require.NoError(t, err)
		assert.Equal(t, 7.0, bal.Balance)
		assert.False(t, bal.Suspended)
	})

	t.Run("suspends at zero balance", func(t *testing.T) {
		bal, err := DeductCredits(ctx, client, "org-deduct", 10.0, "big usage", "usage-2")
		require.NoError(t, err)
		assert.Equal(t, 0.0, bal.Balance)
		assert.True(t, bal.Suspended)
	})

	t.Run("idempotent with same reference_id", func(t *testing.T) {
		bal, err := DeductCredits(ctx, client, "org-deduct", 5.0, "dup", "usage-1")
		require.NoError(t, err)
		assert.Equal(t, 0.0, bal.Balance) // Not changed
	})

	t.Run("rejects zero amount", func(t *testing.T) {
		_, err := DeductCredits(ctx, client, "org-deduct", 0, "bad", "")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "positive")
	})

	t.Run("rejects negative amount", func(t *testing.T) {
		_, err := DeductCredits(ctx, client, "org-deduct", -1.0, "bad", "")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "positive")
	})
}

func TestAddCredits_AutoCreatesBalance(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:billing_add_auto?mode=memory&cache=shared&_fk=1")
	defer client.Close()
	ctx := context.Background()

	// Don't call EnsureBalanceExists first — AddCredits should auto-create
	bal, err := AddCredits(ctx, client, "org-auto", 15.0, enum.CreditTxManualDeposit, "auto-create", "")
	require.NoError(t, err)
	assert.Equal(t, 15.0, bal.Balance)
}

func TestAddCredits_MultipleDepositsAccumulate(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:billing_add_multi?mode=memory&cache=shared&_fk=1")
	defer client.Close()
	ctx := context.Background()

	require.NoError(t, EnsureBalanceExists(ctx, client, "org-multi"))

	_, err := AddCredits(ctx, client, "org-multi", 10.0, enum.CreditTxManualDeposit, "dep1", "ref-a")
	require.NoError(t, err)
	_, err = AddCredits(ctx, client, "org-multi", 20.0, enum.CreditTxManualDeposit, "dep2", "ref-b")
	require.NoError(t, err)
	_, err = AddCredits(ctx, client, "org-multi", 5.0, enum.CreditTxManualDeposit, "dep3", "ref-c")
	require.NoError(t, err)

	bal, err := GetBalance(ctx, client, "org-multi")
	require.NoError(t, err)
	assert.Equal(t, 35.0, bal.Balance)
}

func TestGetBalance_UnknownOrg(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:billing_get_unknown?mode=memory&cache=shared&_fk=1")
	defer client.Close()
	ctx := context.Background()

	_, err := GetBalance(ctx, client, "org-nonexistent")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get credit balance")
}
