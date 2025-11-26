/*
Package backtest provides result parsing and summary extraction for Freqtrade backtest outputs.

# Overview

The backtest package extracts typed summaries from Freqtrade backtest results, providing
type-safe access to key metrics without requiring frontend code to parse complex nested JSON.

# Architecture

Freqtrade produces comprehensive JSON results (103+ fields) after backtest execution.
This package provides:

  1. Typed summary extraction (20 key metrics)
  2. Type-safe field access via Go structs
  3. GraphQL API integration via gqlgen autobind
  4. Optional field handling (nil vs zero values)

Flow:

	Freqtrade Backtest → backtest-result.json (103+ fields)
	                          ↓
	        ExtractSummaryFromResult()
	                          ↓
	           BacktestSummary (20 fields)
	                          ↓
	                GraphQL API → Dashboard

# Backtest Summary

BacktestSummary contains commonly accessed metrics:

	type BacktestSummary struct {
		StrategyName   string     // Strategy that was backtested
		TotalTrades    int        // Total number of trades
		Wins           int        // Winning trades
		Losses         int        // Losing trades
		ProfitTotalAbs float64    // Absolute profit in stake currency
		ProfitTotal    float64    // Total profit percentage
		ProfitMean     *float64   // Average profit per trade
		WinRate        *float64   // Win rate (0.0-1.0)
		MaxDrawdown    *float64   // Maximum drawdown
		ProfitFactor   *float64   // Profit factor (wins/losses ratio)
		Expectancy     *float64   // Expected profit per trade
		Sharpe         *float64   // Sharpe ratio
		Sortino        *float64   // Sortino ratio
		Calmar         *float64   // Calmar ratio
		AvgStakeAmount *float64   // Average stake amount
		StakeCurrency  string     // Currency used for staking
		BacktestStart  *time.Time // Backtest start timestamp
		BacktestEnd    *time.Time // Backtest end timestamp
		BacktestDays   *int       // Number of days covered
	}

## Optional vs Required Fields

  Required Fields (zero values if missing):
    - StrategyName
    - TotalTrades
    - Wins
    - Losses
    - ProfitTotalAbs
    - ProfitTotal
    - StakeCurrency

  Optional Fields (nil if missing):
    - All pointer fields (ProfitMean, WinRate, etc.)

This distinction allows:
  - Proper GraphQL null handling
  - Differentiating between 0 (zero trades) and nil (not calculated)

# Extraction Process

ExtractSummaryFromResult navigates Freqtrade's nested structure:

	{
	  "strategy": {
	    "MyStrategy": {
	      "total_trades": 150,
	      "wins": 90,
	      "losses": 60,
	      "profit_total_abs": 1234.56,
	      "winrate": 0.6,
	      ...
	    }
	  }
	}

Steps:

  1. Navigate to strategy map
  2. Extract first (and usually only) strategy
  3. Parse required fields with type conversion
  4. Parse optional fields (return nil if missing)
  5. Parse timestamps with time.Parse
  6. Return typed summary

## Type Conversion Helpers

Safe extraction with type coercion:

	getInt(map, key):
	  - Handles int, int64, float64
	  - Returns 0 if missing

	getFloat(map, key):
	  - Handles float64, int, int64
	  - Returns 0.0 if missing

	getFloatPtr(map, key):
	  - Handles float64, int, int64
	  - Returns nil if missing (not zero!)

	getString(map, key):
	  - Returns empty string if missing

# GraphQL Integration

GraphQL type defined in internal/graph/schema.graphqls:

	type BacktestSummary {
	  strategyName: String!
	  totalTrades: Int!
	  wins: Int!
	  losses: Int!
	  profitTotalAbs: Float!
	  profitTotal: Float!
	  profitMean: Float
	  winRate: Float
	  maxDrawdown: Float
	  profitFactor: Float
	  expectancy: Float
	  sharpe: Float
	  sortino: Float
	  calmar: Float
	  avgStakeAmount: Float
	  stakeCurrency: String!
	  backtestStart: Time
	  backtestEnd: Time
	  backtestDays: Int
	}

gqlgen autobind automatically maps Go struct to GraphQL type using JSON tags.

## Usage in GraphQL

	extend type Backtest {
	  summary: BacktestSummary
	  result: Map  # Full Freqtrade JSON (103+ fields)
	}

Clients can choose:
  - summary: Type-safe access to key metrics
  - result: Complete data for advanced analysis

# Usage Patterns

## Extracting Summary (Backend):

	// In backtest monitor when results are fetched
	result, err := backtestRunner.GetBacktestResult(ctx, backtestID)
	if err != nil {
		return err
	}

	// Extract typed summary
	summary, err := backtest.ExtractSummaryFromResult(result.RawResult)
	if err != nil {
		log.Printf("Failed to extract summary: %v", err)
		// Continue without summary - it's optional
	}

	// Store both in database
	update := client.Backtest.UpdateOneID(backtestID).
		SetResult(result.RawResult).  // Full JSON
		SetSummary(summaryMap)         // Typed summary

## Querying Summary (Frontend):

	query GetBacktest($id: ID!) {
	  backtest(id: $id) {
	    id
	    summary {
	      strategyName
	      totalTrades
	      wins
	      losses
	      profitTotalAbs
	      winRate
	      maxDrawdown
	    }
	  }
	}

Dashboard displays metrics from typed summary fields.

# Error Handling

ExtractSummaryFromResult returns (nil, nil) if:
  - No strategy data found
  - Invalid JSON structure
  - Empty result

This is not an error - some backtests may not produce summaries.

Caller should:
  1. Check if summary is nil
  2. Store backtest as completed
  3. Store result JSON (even without summary)
  4. Log warning (not error)

# Testing

Test coverage: 96.4%

## Test Categories:

  Valid Summaries:
    - Full result with all fields
    - Minimal result (only required fields)
    - Multiple strategies (uses first)

  Type Conversions:
    - int → int
    - float64 → int
    - int → float64

  Optional Fields:
    - nil vs zero distinction
    - Missing optional fields

  Timestamps:
    - Valid timestamp parsing
    - Invalid format handling

  Edge Cases:
    - Nil/empty result
    - Invalid strategy structure
    - Type mismatches

## Running Tests:

	go test -v ./internal/backtest
	go test -v ./internal/backtest -cover

# Files

  summary.go      - Summary extraction and type conversion
  summary_test.go - Comprehensive test coverage (96.4%)
  spec.go         - Backtest specification types

# Related Packages

  internal/monitor - Calls ExtractSummaryFromResult when backtest completes
  internal/graph   - GraphQL API exposes BacktestSummary
  internal/runner  - BacktestRunner provides result JSON
  dashboard        - Frontend TypeScript types (src/types/freqtrade.ts)

# References

  - Freqtrade Backtest Documentation: https://www.freqtrade.io/en/stable/backtesting/
  - Dashboard Types: dashboard/src/types/freqtrade.ts
  - GraphQL Schema: internal/graph/schema.graphqls
  - Monitor Integration: internal/monitor/backtest_monitor.go:160-179
*/
package backtest
