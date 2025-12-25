package monitor

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"volaticloud/internal/freqtrade"
)

func TestFormatTimeframe(t *testing.T) {
	tests := []struct {
		name     string
		minutes  int64
		expected string
	}{
		{"1 minute", 1, "1m"},
		{"5 minutes", 5, "5m"},
		{"15 minutes", 15, "15m"},
		{"30 minutes", 30, "30m"},
		{"1 hour", 60, "1h"},
		{"4 hours", 240, "4h"},
		{"1 day", 1440, "1d"},
		{"1 week", 10080, "1w"},
		{"zero", 0, ""},
		{"2 minutes (rounds to 1m)", 2, "1m"},
		{"10 minutes (rounds to 5m)", 10, "5m"},
		{"45 minutes (rounds to 30m)", 45, "30m"},
		{"90 minutes (rounds to 1h)", 90, "1h"},
		{"120 minutes (rounds to 1h)", 120, "1h"},
		{"360 minutes (rounds to 4h)", 360, "4h"},
		{"720 minutes (rounds to 4h)", 720, "4h"},
		{"2880 minutes (rounds to 1d)", 2880, "1d"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := formatTimeframe(tt.minutes)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestTradeToRawData(t *testing.T) {
	// Create a mock trade with some fields set
	trade := freqtrade.TradeSchema{
		TradeId:       123,
		Pair:          "BTC/USDT",
		IsOpen:        true,
		OpenRate:      50000.0,
		Amount:        0.1,
		StakeAmount:   5000.0,
		Strategy:      "TestStrategy",
		OpenTimestamp: time.Now().UnixMilli(),
	}

	rawData, err := tradeToRawData(trade)
	require.NoError(t, err)
	assert.NotNil(t, rawData)

	// Verify key fields are preserved
	assert.Equal(t, float64(123), rawData["trade_id"])
	assert.Equal(t, "BTC/USDT", rawData["pair"])
	assert.Equal(t, true, rawData["is_open"])
	assert.Equal(t, 50000.0, rawData["open_rate"])
	assert.Equal(t, 0.1, rawData["amount"])
	assert.Equal(t, 5000.0, rawData["stake_amount"])
	assert.Equal(t, "TestStrategy", rawData["strategy"])
}

func TestTradeToRawDataPreservesAllFields(t *testing.T) {
	// Create a trade and convert it
	trade := freqtrade.TradeSchema{
		TradeId:       456,
		Pair:          "ETH/USDT",
		IsOpen:        false,
		OpenRate:      3000.0,
		Amount:        1.5,
		StakeAmount:   4500.0,
		Strategy:      "EthStrategy",
		OpenTimestamp: 1703520000000, // Fixed timestamp for testing
	}

	rawData, err := tradeToRawData(trade)
	require.NoError(t, err)

	// Convert back to JSON to verify it's valid
	jsonBytes, err := json.Marshal(rawData)
	require.NoError(t, err)
	assert.NotEmpty(t, jsonBytes)

	// Parse back to verify structure
	var parsed map[string]interface{}
	err = json.Unmarshal(jsonBytes, &parsed)
	require.NoError(t, err)
	assert.Equal(t, "ETH/USDT", parsed["pair"])
}

func TestDefaultTradeSyncInterval(t *testing.T) {
	assert.Equal(t, 2*time.Minute, DefaultTradeSyncInterval)
}

func TestTradeFetchBatchSize(t *testing.T) {
	assert.Equal(t, int64(500), TradeFetchBatchSize)
}

func TestTradeChangeTypes(t *testing.T) {
	// Verify trade change type constants
	assert.Equal(t, TradeChangeType("new_trade"), TradeChangeNewTrade)
	assert.Equal(t, TradeChangeType("trade_closed"), TradeChangeTradeClosed)
	assert.Equal(t, TradeChangeType("trade_updated"), TradeChangeTradeUpdated)
}
