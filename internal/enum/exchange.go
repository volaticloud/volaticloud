package enum

import (
	"fmt"
	"io"
	"strconv"
)

// ExchangeType represents supported cryptocurrency exchanges
type ExchangeType string

const (
	ExchangeBinance   ExchangeType = "binance"
	ExchangeBinanceUS ExchangeType = "binanceus"
	ExchangeCoinbase  ExchangeType = "coinbase"
	ExchangeKraken    ExchangeType = "kraken"
	ExchangeKucoin    ExchangeType = "kucoin"
	ExchangeBybit     ExchangeType = "bybit"
	ExchangeOKX       ExchangeType = "okx"
	ExchangeBitfinex  ExchangeType = "bitfinex"
)

// Values returns all possible exchange type values
func (ExchangeType) Values() []string {
	return []string{
		string(ExchangeBinance),
		string(ExchangeBinanceUS),
		string(ExchangeCoinbase),
		string(ExchangeKraken),
		string(ExchangeKucoin),
		string(ExchangeBybit),
		string(ExchangeOKX),
		string(ExchangeBitfinex),
	}
}

// MarshalGQL implements graphql.Marshaler for ExchangeType
func (e ExchangeType) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(string(e)))
}

// UnmarshalGQL implements graphql.Unmarshaler for ExchangeType
func (e *ExchangeType) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("exchange type must be a string")
	}
	*e = ExchangeType(str)
	return nil
}
