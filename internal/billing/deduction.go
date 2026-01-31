package billing

import (
	"context"
	"fmt"
	"log"
	"time"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/resourceusageaggregation"
	"volaticloud/internal/enum"
	"volaticloud/internal/usage"
)

// BillingService handles billing operations that integrate with the usage system.
type BillingService struct {
	client     *ent.Client
	calculator usage.Calculator
}

// NewBillingService creates a new billing service.
func NewBillingService(client *ent.Client, calculator usage.Calculator) *BillingService {
	return &BillingService{
		client:     client,
		calculator: calculator,
	}
}

// DeductHourlyCosts queries all hourly aggregations for a given hour,
// groups by owner_id, calculates cost, and deducts from each org's balance.
func (s *BillingService) DeductHourlyCosts(ctx context.Context, bucketStart time.Time) error {
	// Query all hourly aggregations for this bucket
	aggregations, err := s.client.ResourceUsageAggregation.Query().
		Where(
			resourceusageaggregation.GranularityEQ(enum.AggregationGranularityHourly),
			resourceusageaggregation.BucketStart(bucketStart),
		).
		All(ctx)
	if err != nil {
		return fmt.Errorf("failed to query hourly aggregations: %w", err)
	}

	if len(aggregations) == 0 {
		return nil
	}

	// Group aggregations by owner_id and calculate total cost per org
	ownerCosts := make(map[string]float64)
	for _, agg := range aggregations {
		// Get runner rates for this aggregation
		rates, err := s.calculator.GetRunnerRates(ctx, agg.RunnerID)
		if err != nil {
			log.Printf("[BILLING] action=get_runner_rates_fail runner=%s error=%v", agg.RunnerID, err)
			continue
		}

		summary := &usage.UsageSummary{
			CPUCoreSeconds:  agg.CPUCoreSeconds,
			MemoryGBSeconds: agg.MemoryGBSeconds,
			NetworkRxBytes:  agg.NetworkRxBytes,
			NetworkTxBytes:  agg.NetworkTxBytes,
			BlockReadBytes:  agg.BlockReadBytes,
			BlockWriteBytes: agg.BlockWriteBytes,
		}

		cost := s.calculator.CalculateCost(summary, rates)
		if cost != nil && cost.TotalCost > 0 {
			ownerCosts[agg.OwnerID] += cost.TotalCost
		}
	}

	// Deduct from each org's balance
	for ownerID, totalCost := range ownerCosts {
		if totalCost <= 0 {
			continue
		}

		referenceID := fmt.Sprintf("hourly:%s:%s", ownerID, bucketStart.Format(time.RFC3339))
		description := fmt.Sprintf("Hourly usage for %s", bucketStart.Format("2006-01-02 15:04"))

		bal, err := DeductCredits(ctx, s.client, ownerID, totalCost, description, referenceID)
		if err != nil {
			log.Printf("[BILLING] action=deduction_fail owner=%s amount=%.4f error=%v", ownerID, totalCost, err)
			continue
		}

		log.Printf("[BILLING] action=deduction owner=%s amount=%.4f balance=%.2f", ownerID, totalCost, bal.Balance)

		// If org just got suspended, stop their bots
		if bal.Suspended {
			StopOrgBots(ctx, s.client, ownerID)
		}
	}

	return nil
}
