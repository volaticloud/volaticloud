package billing

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"volaticloud/internal/ent/enttest"
	"volaticloud/internal/enum"
	"volaticloud/internal/usage"
)

// mockCalculator implements usage.Calculator for testing.
type mockCalculator struct {
	getRunnerRatesFn func(ctx context.Context, runnerID uuid.UUID) (*usage.RunnerRates, error)
	calculateCostFn  func(summary *usage.UsageSummary, rates *usage.RunnerRates) *usage.UsageCost
}

func (m *mockCalculator) GetResourceUsage(ctx context.Context, resourceType enum.ResourceType, resourceID uuid.UUID, start, end time.Time) (*usage.UsageSummary, error) {
	return nil, nil
}

func (m *mockCalculator) GetOrganizationUsage(ctx context.Context, ownerID string, start, end time.Time) (*usage.UsageSummary, error) {
	return nil, nil
}

func (m *mockCalculator) GetUsageBreakdown(ctx context.Context, ownerID string, start, end time.Time) ([]usage.UsageSummary, error) {
	return nil, nil
}

func (m *mockCalculator) CalculateCost(summary *usage.UsageSummary, rates *usage.RunnerRates) *usage.UsageCost {
	if m.calculateCostFn != nil {
		return m.calculateCostFn(summary, rates)
	}
	return &usage.UsageCost{TotalCost: 0}
}

func (m *mockCalculator) GetRunnerRates(ctx context.Context, runnerID uuid.UUID) (*usage.RunnerRates, error) {
	if m.getRunnerRatesFn != nil {
		return m.getRunnerRatesFn(ctx, runnerID)
	}
	return &usage.RunnerRates{}, nil
}

func TestDeductHourlyCosts(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:billing_deduct_hourly?mode=memory&cache=shared&_fk=1")
	defer client.Close()
	ctx := context.Background()

	bucketStart := time.Date(2025, 1, 1, 10, 0, 0, 0, time.UTC)
	bucketEnd := bucketStart.Add(time.Hour)

	// Create a runner (required edge for aggregation)
	runnerID := uuid.New()
	_, err := client.BotRunner.Create().
		SetID(runnerID).
		SetName("test-runner").
		SetOwnerID("org-hourly").
		SetType(enum.RunnerDocker).
		Save(ctx)
	require.NoError(t, err)

	t.Run("no aggregations does nothing", func(t *testing.T) {
		calc := &mockCalculator{}
		svc := NewBillingService(client, calc)

		err := svc.DeductHourlyCosts(ctx, bucketStart)
		require.NoError(t, err)
	})

	t.Run("single aggregation deducts correct amount", func(t *testing.T) {
		require.NoError(t, EnsureBalanceExists(ctx, client, "org-hourly"))
		_, err := AddCredits(ctx, client, "org-hourly", 100.0, enum.CreditTxManualDeposit, "fund", "fund-hourly")
		require.NoError(t, err)

		// Create aggregation record
		_, err = client.ResourceUsageAggregation.Create().
			SetResourceType(enum.ResourceTypeBot).
			SetResourceID(uuid.New()).
			SetOwnerID("org-hourly").
			SetRunnerID(runnerID).
			SetGranularity(enum.AggregationGranularityHourly).
			SetBucketStart(bucketStart).
			SetBucketEnd(bucketEnd).
			SetCPUCoreSeconds(3600).
			SetMemoryGBSeconds(1800).
			SetSampleCount(60).
			Save(ctx)
		require.NoError(t, err)

		calc := &mockCalculator{
			getRunnerRatesFn: func(ctx context.Context, id uuid.UUID) (*usage.RunnerRates, error) {
				return &usage.RunnerRates{
					CPUPricePerCoreHour:  0.05,
					MemoryPricePerGBHour: 0.01,
				}, nil
			},
			calculateCostFn: func(summary *usage.UsageSummary, rates *usage.RunnerRates) *usage.UsageCost {
				return &usage.UsageCost{TotalCost: 0.10}
			},
		}

		svc := NewBillingService(client, calc)
		err = svc.DeductHourlyCosts(ctx, bucketStart)
		require.NoError(t, err)

		bal, err := GetBalance(ctx, client, "org-hourly")
		require.NoError(t, err)
		assert.InDelta(t, 99.90, bal.Balance, 0.001)
	})

	t.Run("GetRunnerRates error skips aggregation", func(t *testing.T) {
		bucket2 := time.Date(2025, 1, 1, 11, 0, 0, 0, time.UTC)

		// Create aggregation for a different hour
		_, err := client.ResourceUsageAggregation.Create().
			SetResourceType(enum.ResourceTypeBot).
			SetResourceID(uuid.New()).
			SetOwnerID("org-hourly").
			SetRunnerID(runnerID).
			SetGranularity(enum.AggregationGranularityHourly).
			SetBucketStart(bucket2).
			SetBucketEnd(bucket2.Add(time.Hour)).
			SetCPUCoreSeconds(3600).
			SetSampleCount(60).
			Save(ctx)
		require.NoError(t, err)

		balBefore, err := GetBalance(ctx, client, "org-hourly")
		require.NoError(t, err)

		calc := &mockCalculator{
			getRunnerRatesFn: func(ctx context.Context, id uuid.UUID) (*usage.RunnerRates, error) {
				return nil, fmt.Errorf("runner not found")
			},
		}

		svc := NewBillingService(client, calc)
		err = svc.DeductHourlyCosts(ctx, bucket2)
		require.NoError(t, err)

		balAfter, err := GetBalance(ctx, client, "org-hourly")
		require.NoError(t, err)
		assert.Equal(t, balBefore.Balance, balAfter.Balance) // No deduction
	})

	t.Run("multiple aggregations same owner are summed", func(t *testing.T) {
		bucket4 := time.Date(2025, 1, 1, 13, 0, 0, 0, time.UTC)

		// Create two aggregations for the same owner in the same bucket
		for i := 0; i < 2; i++ {
			_, err := client.ResourceUsageAggregation.Create().
				SetResourceType(enum.ResourceTypeBot).
				SetResourceID(uuid.New()).
				SetOwnerID("org-hourly").
				SetRunnerID(runnerID).
				SetGranularity(enum.AggregationGranularityHourly).
				SetBucketStart(bucket4).
				SetBucketEnd(bucket4.Add(time.Hour)).
				SetCPUCoreSeconds(1800).
				SetSampleCount(30).
				Save(ctx)
			require.NoError(t, err)
		}

		balBefore, err := GetBalance(ctx, client, "org-hourly")
		require.NoError(t, err)

		calc := &mockCalculator{
			getRunnerRatesFn: func(ctx context.Context, id uuid.UUID) (*usage.RunnerRates, error) {
				return &usage.RunnerRates{CPUPricePerCoreHour: 0.05}, nil
			},
			calculateCostFn: func(summary *usage.UsageSummary, rates *usage.RunnerRates) *usage.UsageCost {
				return &usage.UsageCost{TotalCost: 0.05}
			},
		}

		svc := NewBillingService(client, calc)
		err = svc.DeductHourlyCosts(ctx, bucket4)
		require.NoError(t, err)

		balAfter, err := GetBalance(ctx, client, "org-hourly")
		require.NoError(t, err)
		// Two aggregations at 0.05 each = 0.10 total deduction
		assert.InDelta(t, balBefore.Balance-0.10, balAfter.Balance, 0.001)
	})

	t.Run("deduction triggers suspension when balance depleted", func(t *testing.T) {
		bucketSusp := time.Date(2025, 1, 1, 14, 0, 0, 0, time.UTC)

		// Create a new org with just enough credits to be depleted
		require.NoError(t, EnsureBalanceExists(ctx, client, "org-suspend-test"))
		_, err := AddCredits(ctx, client, "org-suspend-test", 0.01, enum.CreditTxManualDeposit, "tiny", "fund-suspend")
		require.NoError(t, err)

		_, err = client.ResourceUsageAggregation.Create().
			SetResourceType(enum.ResourceTypeBot).
			SetResourceID(uuid.New()).
			SetOwnerID("org-suspend-test").
			SetRunnerID(runnerID).
			SetGranularity(enum.AggregationGranularityHourly).
			SetBucketStart(bucketSusp).
			SetBucketEnd(bucketSusp.Add(time.Hour)).
			SetCPUCoreSeconds(3600).
			SetSampleCount(60).
			Save(ctx)
		require.NoError(t, err)

		calc := &mockCalculator{
			getRunnerRatesFn: func(ctx context.Context, id uuid.UUID) (*usage.RunnerRates, error) {
				return &usage.RunnerRates{CPUPricePerCoreHour: 0.05}, nil
			},
			calculateCostFn: func(summary *usage.UsageSummary, rates *usage.RunnerRates) *usage.UsageCost {
				return &usage.UsageCost{TotalCost: 1.00} // More than balance
			},
		}

		svc := NewBillingService(client, calc)
		err = svc.DeductHourlyCosts(ctx, bucketSusp)
		require.NoError(t, err)

		bal, err := GetBalance(ctx, client, "org-suspend-test")
		require.NoError(t, err)
		assert.Equal(t, 0.0, bal.Balance)
		assert.True(t, bal.Suspended)
	})

	t.Run("zero cost means no deduction", func(t *testing.T) {
		bucket3 := time.Date(2025, 1, 1, 12, 0, 0, 0, time.UTC)

		_, err := client.ResourceUsageAggregation.Create().
			SetResourceType(enum.ResourceTypeBot).
			SetResourceID(uuid.New()).
			SetOwnerID("org-hourly").
			SetRunnerID(runnerID).
			SetGranularity(enum.AggregationGranularityHourly).
			SetBucketStart(bucket3).
			SetBucketEnd(bucket3.Add(time.Hour)).
			SetCPUCoreSeconds(0).
			SetSampleCount(60).
			Save(ctx)
		require.NoError(t, err)

		balBefore, err := GetBalance(ctx, client, "org-hourly")
		require.NoError(t, err)

		calc := &mockCalculator{
			calculateCostFn: func(summary *usage.UsageSummary, rates *usage.RunnerRates) *usage.UsageCost {
				return &usage.UsageCost{TotalCost: 0}
			},
		}

		svc := NewBillingService(client, calc)
		err = svc.DeductHourlyCosts(ctx, bucket3)
		require.NoError(t, err)

		balAfter, err := GetBalance(ctx, client, "org-hourly")
		require.NoError(t, err)
		assert.Equal(t, balBefore.Balance, balAfter.Balance)
	})
}
