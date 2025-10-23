package graph

import (
	"encoding/json"
	"fmt"

	"anytrade/internal/exchange"
)

// convertExchangeConfigToMap converts the typed GraphQL ExchangeConfigInput to a map
// preserving the exchange type key for validation
func convertExchangeConfigToMap(input *exchange.ExchangeConfigInput) (map[string]interface{}, error) {
	if input == nil {
		return nil, nil
	}

	// Only one exchange config should be set
	var exchangeType string
	var configData interface{}
	configCount := 0

	if input.Binance != nil {
		exchangeType = "binance"
		configData = input.Binance
		configCount++
	}
	if input.BinanceUS != nil {
		exchangeType = "binanceus"
		configData = input.BinanceUS
		configCount++
	}
	if input.Coinbase != nil {
		exchangeType = "coinbase"
		configData = input.Coinbase
		configCount++
	}
	if input.Kraken != nil {
		exchangeType = "kraken"
		configData = input.Kraken
		configCount++
	}
	if input.Kucoin != nil {
		exchangeType = "kucoin"
		configData = input.Kucoin
		configCount++
	}
	if input.Bybit != nil {
		exchangeType = "bybit"
		configData = input.Bybit
		configCount++
	}
	if input.OKX != nil {
		exchangeType = "okx"
		configData = input.OKX
		configCount++
	}
	if input.Bitfinex != nil {
		exchangeType = "bitfinex"
		configData = input.Bitfinex
		configCount++
	}

	if configCount == 0 {
		return nil, fmt.Errorf("no exchange configuration provided")
	}
	if configCount > 1 {
		return nil, fmt.Errorf("only one exchange configuration can be provided")
	}

	// Convert the inner config to map
	jsonData, err := json.Marshal(configData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}

	var innerConfig map[string]interface{}
	if err := json.Unmarshal(jsonData, &innerConfig); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Wrap with exchange type key for validation
	result := map[string]interface{}{
		exchangeType: innerConfig,
	}

	return result, nil
}