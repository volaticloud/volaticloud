package enum

import (
	"fmt"
	"io"
	"strconv"
)

// CreditTransactionType represents the type of credit transaction
type CreditTransactionType string

const (
	CreditTxSubscriptionDeposit CreditTransactionType = "subscription_deposit"
	CreditTxManualDeposit       CreditTransactionType = "manual_deposit"
	CreditTxUsageDeduction      CreditTransactionType = "usage_deduction"
	CreditTxAdminAdjustment     CreditTransactionType = "admin_adjustment"
)

// Values returns all possible credit transaction type values
func (CreditTransactionType) Values() []string {
	return []string{
		string(CreditTxSubscriptionDeposit),
		string(CreditTxManualDeposit),
		string(CreditTxUsageDeduction),
		string(CreditTxAdminAdjustment),
	}
}

// MarshalGQL implements graphql.Marshaler for CreditTransactionType
func (t CreditTransactionType) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(string(t)))
}

// UnmarshalGQL implements graphql.Unmarshaler for CreditTransactionType
func (t *CreditTransactionType) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("credit transaction type must be a string")
	}
	val := CreditTransactionType(str)
	for _, valid := range val.Values() {
		if str == valid {
			*t = val
			return nil
		}
	}
	return fmt.Errorf("invalid credit transaction type: %q", str)
}

// StripeSubStatus represents the status of a Stripe subscription
type StripeSubStatus string

const (
	StripeSubActive    StripeSubStatus = "active"
	StripeSubPastDue   StripeSubStatus = "past_due"
	StripeSubCanceling StripeSubStatus = "canceling"
	StripeSubCanceled  StripeSubStatus = "canceled"
)

// Values returns all possible Stripe subscription status values
func (StripeSubStatus) Values() []string {
	return []string{
		string(StripeSubActive),
		string(StripeSubPastDue),
		string(StripeSubCanceling),
		string(StripeSubCanceled),
	}
}

// MarshalGQL implements graphql.Marshaler for StripeSubStatus
func (s StripeSubStatus) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(string(s)))
}

// UnmarshalGQL implements graphql.Unmarshaler for StripeSubStatus
func (s *StripeSubStatus) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("stripe subscription status must be a string")
	}
	val := StripeSubStatus(str)
	for _, valid := range val.Values() {
		if str == valid {
			*s = val
			return nil
		}
	}
	return fmt.Errorf("invalid stripe subscription status: %q", str)
}
