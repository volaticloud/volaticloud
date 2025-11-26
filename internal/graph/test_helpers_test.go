package graph

import (
	"context"

	"github.com/99designs/gqlgen/client"
)

// AddVariable is a helper to add a variable to a GraphQL query
func AddVariable(name string, value interface{}) client.Option {
	return client.Var(name, value)
}

// WithContext is a helper to add a context to a GraphQL query
// For gqlgen test client, we need to wrap the option to inject context
func WithContext(ctx context.Context) client.Option {
	return func(bd *client.Request) {
		bd.HTTP = bd.HTTP.WithContext(ctx)
	}
}

// MinimalFreqtradeConfig returns a minimal valid Freqtrade configuration for testing
func MinimalFreqtradeConfig() map[string]interface{} {
	return map[string]interface{}{
		"stake_currency": "USDT",
		"stake_amount":   10.0,
		"timeframe":      "5m",
		"exit_pricing": map[string]interface{}{
			"price_side":         "other",
			"use_order_book":     true,
			"order_book_top":     1,
			"price_last_balance": 0.0,
		},
		"entry_pricing": map[string]interface{}{
			"price_side":         "other",
			"use_order_book":     true,
			"order_book_top":     1,
			"price_last_balance": 0.0,
			"check_depth_of_market": map[string]interface{}{
				"enabled":           false,
				"bids_to_ask_delta": 1.0,
			},
		},
	}
}
