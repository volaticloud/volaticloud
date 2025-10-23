package exchange

// BinanceConfigInput represents Binance-specific configuration
type BinanceConfigInput struct {
	APIKey    string `json:"api_key" validate:"required"`
	APISecret string `json:"api_secret" validate:"required"`
}

// KrakenConfigInput represents Kraken-specific configuration
type KrakenConfigInput struct {
	APIKey    string `json:"api_key" validate:"required"`
	APISecret string `json:"api_secret" validate:"required"`
}

// PassphraseExchangeConfigInput represents API credentials for exchanges that require a passphrase
// Used by: Coinbase, Kucoin, OKX
type PassphraseExchangeConfigInput struct {
	APIKey     string `json:"api_key" validate:"required"`
	APISecret  string `json:"api_secret" validate:"required"`
	Passphrase string `json:"passphrase" validate:"required"`
}

// BybitConfigInput represents Bybit-specific configuration
type BybitConfigInput struct {
	APIKey    string `json:"api_key" validate:"required"`
	APISecret string `json:"api_secret" validate:"required"`
}

// BitfinexConfigInput represents Bitfinex-specific configuration
type BitfinexConfigInput struct {
	APIKey    string `json:"api_key" validate:"required"`
	APISecret string `json:"api_secret" validate:"required"`
}

// ExchangeConfigInput represents the union-like input for exchange configuration
type ExchangeConfigInput struct {
	Binance   *BinanceConfigInput             `json:"binance,omitempty"`
	BinanceUS *BinanceConfigInput             `json:"binanceus,omitempty"`
	Coinbase  *PassphraseExchangeConfigInput  `json:"coinbase,omitempty"`
	Kraken    *KrakenConfigInput              `json:"kraken,omitempty"`
	Kucoin    *PassphraseExchangeConfigInput  `json:"kucoin,omitempty"`
	Bybit     *BybitConfigInput               `json:"bybit,omitempty"`
	OKX       *PassphraseExchangeConfigInput  `json:"okx,omitempty"`
	Bitfinex  *BitfinexConfigInput            `json:"bitfinex,omitempty"`
}