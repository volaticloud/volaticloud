package billing

import (
	"context"
	"fmt"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/creditbalance"
)

// EnsureSufficientCredits checks that an organization is not suspended and has credits.
// Call this before operations that consume resources (createBot, startBot, runBacktest, etc.)
//
// NOTE: This is a best-effort guard, not a transactional lock. There is a small race
// window where the balance could change between this check and the actual operation.
// ENT does not support SELECT ... FOR UPDATE. The real protection is that hourly
// deductions (DeductHourlyCosts) atomically suspend the org and stop all bots when
// credits are depleted. Worst case: one extra resource starts and gets stopped at
// the next deduction cycle (~1 hour).
func EnsureSufficientCredits(ctx context.Context, client *ent.Client, ownerID string) error {
	bal, err := client.CreditBalance.Query().
		Where(creditbalance.OwnerID(ownerID)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			// No balance record means org was created before billing system — allow
			return nil
		}
		return fmt.Errorf("failed to check credit balance: %w", err)
	}

	if bal.Suspended {
		return fmt.Errorf("organization suspended: insufficient credits. Please add credits to continue")
	}

	if bal.Balance <= 0 {
		return fmt.Errorf("organization has no credits. Please add credits to continue")
	}

	return nil
}
