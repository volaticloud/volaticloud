package billing

import (
	"context"
	"fmt"
	"log"
	"time"

	"volaticloud/internal/db"
	"volaticloud/internal/ent"
	"volaticloud/internal/ent/creditbalance"
	"volaticloud/internal/ent/credittransaction"
	"volaticloud/internal/enum"
)

// EnsureBalanceExists creates a zero-balance record for an organization if it doesn't exist.
func EnsureBalanceExists(ctx context.Context, client *ent.Client, ownerID string) error {
	exists, err := client.CreditBalance.Query().
		Where(creditbalance.OwnerID(ownerID)).
		Exist(ctx)
	if err != nil {
		return fmt.Errorf("failed to check balance existence: %w", err)
	}
	if exists {
		return nil
	}

	_, err = client.CreditBalance.Create().
		SetOwnerID(ownerID).
		SetBalance(0).
		SetSuspended(false).
		Save(ctx)
	if err != nil {
		return fmt.Errorf("failed to create credit balance: %w", err)
	}
	return nil
}

// GetBalance returns the current credit balance for an organization.
func GetBalance(ctx context.Context, client *ent.Client, ownerID string) (*ent.CreditBalance, error) {
	bal, err := client.CreditBalance.Query().
		Where(creditbalance.OwnerID(ownerID)).
		Only(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get credit balance for %s: %w", ownerID, err)
	}
	return bal, nil
}

// AddCredits adds credits to an organization's balance and records the transaction.
// If the organization was suspended, it will be unsuspended.
// The entire operation is wrapped in a database transaction to prevent race conditions.
func AddCredits(ctx context.Context, client *ent.Client, ownerID string, amount float64, txType enum.CreditTransactionType, description string, referenceID string) (*ent.CreditBalance, error) {
	if amount <= 0 {
		return nil, fmt.Errorf("credit amount must be positive, got %f", amount)
	}

	// Check idempotency if reference_id is provided (outside tx for fast path)
	if referenceID != "" {
		exists, err := client.CreditTransaction.Query().
			Where(credittransaction.ReferenceID(referenceID)).
			Exist(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to check idempotency: %w", err)
		}
		if exists {
			log.Printf("[BILLING] action=add_credits_skip owner=%s ref=%s reason=duplicate", ownerID, referenceID)
			return GetBalance(ctx, client, ownerID)
		}
	}

	// Ensure balance record exists (auto-create if first deposit)
	if err := EnsureBalanceExists(ctx, client, ownerID); err != nil {
		return nil, err
	}

	var updatedBal *ent.CreditBalance

	err := db.WithTx(ctx, client, func(tx *ent.Tx) error {
		return addCreditsInTx(ctx, tx, ownerID, amount, txType, description, referenceID, &updatedBal)
	})
	if err != nil {
		return nil, err
	}

	return updatedBal, nil
}

func addCreditsInTx(ctx context.Context, tx *ent.Tx, ownerID string, amount float64, txType enum.CreditTransactionType, description string, referenceID string, result **ent.CreditBalance) error {
	// Re-check idempotency inside tx
	if referenceID != "" {
		exists, err := tx.CreditTransaction.Query().
			Where(credittransaction.ReferenceID(referenceID)).
			Exist(ctx)
		if err != nil {
			return fmt.Errorf("failed to check idempotency: %w", err)
		}
		if exists {
			bal, err := tx.CreditBalance.Query().
				Where(creditbalance.OwnerID(ownerID)).
				Only(ctx)
			if err != nil {
				return fmt.Errorf("failed to get balance: %w", err)
			}
			*result = bal
			return nil
		}
	}

	// Read balance inside transaction
	bal, err := tx.CreditBalance.Query().
		Where(creditbalance.OwnerID(ownerID)).
		Only(ctx)
	if err != nil {
		return fmt.Errorf("failed to get credit balance: %w", err)
	}

	newBalance := bal.Balance + amount

	// Update balance and clear suspension if needed
	update := tx.CreditBalance.UpdateOneID(bal.ID).
		SetBalance(newBalance)
	if bal.Suspended && newBalance > 0 {
		update = update.
			SetSuspended(false).
			ClearSuspendedAt()
		log.Printf("[BILLING] action=unsuspend owner=%s balance=%.2f", ownerID, newBalance)
	}

	updatedBal, err := update.Save(ctx)
	if err != nil {
		return fmt.Errorf("failed to update balance: %w", err)
	}

	// Record transaction
	txCreate := tx.CreditTransaction.Create().
		SetOwnerID(ownerID).
		SetAmount(amount).
		SetBalanceAfter(newBalance).
		SetType(txType).
		SetDescription(description)
	if referenceID != "" {
		txCreate = txCreate.SetReferenceID(referenceID)
	}
	if _, err := txCreate.Save(ctx); err != nil {
		return fmt.Errorf("failed to record credit transaction: %w", err)
	}

	*result = updatedBal
	return nil
}

// DeductCredits deducts credits from an organization's balance.
// If the balance reaches zero, the organization is suspended.
// The entire operation is wrapped in a database transaction to prevent race conditions.
func DeductCredits(ctx context.Context, client *ent.Client, ownerID string, amount float64, description string, referenceID string) (*ent.CreditBalance, error) {
	if amount <= 0 {
		return nil, fmt.Errorf("deduction amount must be positive, got %f", amount)
	}

	// Check idempotency (outside tx for fast path)
	if referenceID != "" {
		exists, err := client.CreditTransaction.Query().
			Where(credittransaction.ReferenceID(referenceID)).
			Exist(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to check idempotency: %w", err)
		}
		if exists {
			log.Printf("[BILLING] action=deduct_credits_skip owner=%s ref=%s reason=duplicate", ownerID, referenceID)
			return GetBalance(ctx, client, ownerID)
		}
	}

	var updatedBal *ent.CreditBalance

	err := db.WithTx(ctx, client, func(tx *ent.Tx) error {
		return deductCreditsInTx(ctx, tx, ownerID, amount, description, referenceID, &updatedBal)
	})
	if err != nil {
		return nil, err
	}

	return updatedBal, nil
}

func deductCreditsInTx(ctx context.Context, tx *ent.Tx, ownerID string, amount float64, description string, referenceID string, result **ent.CreditBalance) error {
	// Re-check idempotency inside tx
	if referenceID != "" {
		exists, err := tx.CreditTransaction.Query().
			Where(credittransaction.ReferenceID(referenceID)).
			Exist(ctx)
		if err != nil {
			return fmt.Errorf("failed to check idempotency: %w", err)
		}
		if exists {
			bal, err := tx.CreditBalance.Query().
				Where(creditbalance.OwnerID(ownerID)).
				Only(ctx)
			if err != nil {
				return fmt.Errorf("failed to get balance: %w", err)
			}
			*result = bal
			return nil
		}
	}

	// Read balance inside transaction
	bal, err := tx.CreditBalance.Query().
		Where(creditbalance.OwnerID(ownerID)).
		Only(ctx)
	if err != nil {
		return fmt.Errorf("failed to get credit balance: %w", err)
	}

	newBalance := bal.Balance - amount
	if newBalance < 0 {
		newBalance = 0
	}

	update := tx.CreditBalance.UpdateOneID(bal.ID).
		SetBalance(newBalance)

	// Suspend if balance reaches zero
	if newBalance <= 0 && !bal.Suspended {
		now := time.Now()
		update = update.
			SetSuspended(true).
			SetSuspendedAt(now)
		log.Printf("[BILLING] action=suspend owner=%s reason=balance_depleted", ownerID)
	}

	updatedBal, err := update.Save(ctx)
	if err != nil {
		return fmt.Errorf("failed to update balance: %w", err)
	}

	// Record transaction
	txCreate := tx.CreditTransaction.Create().
		SetOwnerID(ownerID).
		SetAmount(-amount).
		SetBalanceAfter(newBalance).
		SetType(enum.CreditTxUsageDeduction).
		SetDescription(description)
	if referenceID != "" {
		txCreate = txCreate.SetReferenceID(referenceID)
	}
	if _, err := txCreate.Save(ctx); err != nil {
		return fmt.Errorf("failed to record deduction transaction: %w", err)
	}

	*result = updatedBal
	return nil
}
