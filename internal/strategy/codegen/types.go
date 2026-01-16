// Package codegen provides strategy code generation from UI builder configurations.
//
// This package converts JSON-based UI builder configurations into valid Python
// Freqtrade strategy code. It supports:
// - Condition trees (AND, OR, NOT, IF-THEN-ELSE, COMPARE, CROSSOVER, CROSSUNDER)
// - Multiple operand types (CONSTANT, INDICATOR, PRICE, TRADE_CONTEXT, TIME, MARKET, COMPUTED)
// - Technical indicators (RSI, SMA, EMA, MACD, Bollinger Bands, etc.)
// - Strategy callbacks (custom_stoploss, confirm_entry, DCA, custom_exit)
package codegen

import "encoding/json"

// OperandCategory represents the category of an operand for UI organization
type OperandCategory string

const (
	OperandCategoryConstant  OperandCategory = "constant"
	OperandCategoryIndicator OperandCategory = "indicator"
	OperandCategoryPrice     OperandCategory = "price"
	OperandCategoryTrade     OperandCategory = "trade"
	OperandCategoryTime      OperandCategory = "time"
	OperandCategoryMarket    OperandCategory = "market"
	OperandCategoryExternal  OperandCategory = "external"
	OperandCategoryComputed  OperandCategory = "computed"
	OperandCategoryCustom    OperandCategory = "custom"
)

// ComparisonOperator represents comparison operators for COMPARE nodes
type ComparisonOperator string

const (
	OperatorEq      ComparisonOperator = "eq"
	OperatorNeq     ComparisonOperator = "neq"
	OperatorGt      ComparisonOperator = "gt"
	OperatorGte     ComparisonOperator = "gte"
	OperatorLt      ComparisonOperator = "lt"
	OperatorLte     ComparisonOperator = "lte"
	OperatorBetween ComparisonOperator = "between"
	OperatorIn      ComparisonOperator = "in"
	OperatorNotIn   ComparisonOperator = "not_in"
)

// ComputedOperation represents arithmetic operations for COMPUTED operands
type ComputedOperation string

const (
	ComputedAdd           ComputedOperation = "add"
	ComputedSubtract      ComputedOperation = "subtract"
	ComputedMultiply      ComputedOperation = "multiply"
	ComputedDivide        ComputedOperation = "divide"
	ComputedMin           ComputedOperation = "min"
	ComputedMax           ComputedOperation = "max"
	ComputedAbs           ComputedOperation = "abs"
	ComputedRound         ComputedOperation = "round"
	ComputedFloor         ComputedOperation = "floor"
	ComputedCeil          ComputedOperation = "ceil"
	ComputedPercentChange ComputedOperation = "percent_change"
	ComputedAverage       ComputedOperation = "average"
	ComputedSum           ComputedOperation = "sum"
)

// IndicatorType represents built-in indicator types
type IndicatorType string

const (
	IndicatorRSI        IndicatorType = "RSI"
	IndicatorSMA        IndicatorType = "SMA"
	IndicatorEMA        IndicatorType = "EMA"
	IndicatorWMA        IndicatorType = "WMA"
	IndicatorDEMA       IndicatorType = "DEMA"
	IndicatorTEMA       IndicatorType = "TEMA"
	IndicatorKAMA       IndicatorType = "KAMA"
	IndicatorMACD       IndicatorType = "MACD"
	IndicatorBB         IndicatorType = "BB"
	IndicatorKC         IndicatorType = "KC"
	IndicatorSTOCH      IndicatorType = "STOCH"
	IndicatorSTOCHRSI   IndicatorType = "STOCH_RSI"
	IndicatorATR        IndicatorType = "ATR"
	IndicatorADX        IndicatorType = "ADX"
	IndicatorCCI        IndicatorType = "CCI"
	IndicatorWILLR      IndicatorType = "WILLR"
	IndicatorMOM        IndicatorType = "MOM"
	IndicatorROC        IndicatorType = "ROC"
	IndicatorOBV        IndicatorType = "OBV"
	IndicatorMFI        IndicatorType = "MFI"
	IndicatorVWAP       IndicatorType = "VWAP"
	IndicatorCMF        IndicatorType = "CMF"
	IndicatorAD         IndicatorType = "AD"
	IndicatorICHIMOKU   IndicatorType = "ICHIMOKU"
	IndicatorSAR        IndicatorType = "SAR"
	IndicatorPIVOT      IndicatorType = "PIVOT"
	IndicatorSUPERTREND IndicatorType = "SUPERTREND"
	IndicatorCUSTOM     IndicatorType = "CUSTOM"
)

// NodeType represents the type of a condition node
type NodeType string

const (
	NodeTypeAND        NodeType = "AND"
	NodeTypeOR         NodeType = "OR"
	NodeTypeNOT        NodeType = "NOT"
	NodeTypeIfThenElse NodeType = "IF_THEN_ELSE"
	NodeTypeCOMPARE    NodeType = "COMPARE"
	NodeTypeCROSSOVER  NodeType = "CROSSOVER"
	NodeTypeCROSSUNDER NodeType = "CROSSUNDER"
	NodeTypeIN_RANGE   NodeType = "IN_RANGE"
)

// OperandType represents the type of an operand
type OperandType string

const (
	OperandTypeCONSTANT      OperandType = "CONSTANT"
	OperandTypeINDICATOR     OperandType = "INDICATOR"
	OperandTypePRICE         OperandType = "PRICE"
	OperandTypeTRADE_CONTEXT OperandType = "TRADE_CONTEXT"
	OperandTypeTIME          OperandType = "TIME"
	OperandTypeMARKET        OperandType = "MARKET"
	OperandTypeEXTERNAL      OperandType = "EXTERNAL"
	OperandTypeCOMPUTED      OperandType = "COMPUTED"
	OperandTypeCUSTOM        OperandType = "CUSTOM"
)

// ConditionNode represents any node in the condition tree
// Use GetNodeType() to determine the actual type, then type-cast accordingly
type ConditionNode struct {
	raw json.RawMessage
}

// UnmarshalJSON implements json.Unmarshaler
func (n *ConditionNode) UnmarshalJSON(data []byte) error {
	n.raw = data
	return nil
}

// MarshalJSON implements json.Marshaler
func (n ConditionNode) MarshalJSON() ([]byte, error) {
	return n.raw, nil
}

// GetNodeType returns the type of this node
func (n *ConditionNode) GetNodeType() (NodeType, error) {
	var base struct {
		Type NodeType `json:"type"`
	}
	if err := json.Unmarshal(n.raw, &base); err != nil {
		return "", err
	}
	return base.Type, nil
}

// AsAndNode parses the node as an AND node
func (n *ConditionNode) AsAndNode() (*AndNode, error) {
	var node AndNode
	if err := json.Unmarshal(n.raw, &node); err != nil {
		return nil, err
	}
	return &node, nil
}

// AsOrNode parses the node as an OR node
func (n *ConditionNode) AsOrNode() (*OrNode, error) {
	var node OrNode
	if err := json.Unmarshal(n.raw, &node); err != nil {
		return nil, err
	}
	return &node, nil
}

// AsNotNode parses the node as a NOT node
func (n *ConditionNode) AsNotNode() (*NotNode, error) {
	var node NotNode
	if err := json.Unmarshal(n.raw, &node); err != nil {
		return nil, err
	}
	return &node, nil
}

// AsIfThenElseNode parses the node as an IF-THEN-ELSE node
func (n *ConditionNode) AsIfThenElseNode() (*IfThenElseNode, error) {
	var node IfThenElseNode
	if err := json.Unmarshal(n.raw, &node); err != nil {
		return nil, err
	}
	return &node, nil
}

// AsCompareNode parses the node as a COMPARE node
func (n *ConditionNode) AsCompareNode() (*CompareNode, error) {
	var node CompareNode
	if err := json.Unmarshal(n.raw, &node); err != nil {
		return nil, err
	}
	return &node, nil
}

// AsCrossoverNode parses the node as a CROSSOVER node
func (n *ConditionNode) AsCrossoverNode() (*CrossoverNode, error) {
	var node CrossoverNode
	if err := json.Unmarshal(n.raw, &node); err != nil {
		return nil, err
	}
	return &node, nil
}

// AsCrossunderNode parses the node as a CROSSUNDER node
func (n *ConditionNode) AsCrossunderNode() (*CrossunderNode, error) {
	var node CrossunderNode
	if err := json.Unmarshal(n.raw, &node); err != nil {
		return nil, err
	}
	return &node, nil
}

// AsInRangeNode parses the node as an IN_RANGE node
func (n *ConditionNode) AsInRangeNode() (*InRangeNode, error) {
	var node InRangeNode
	if err := json.Unmarshal(n.raw, &node); err != nil {
		return nil, err
	}
	return &node, nil
}

// BaseNode contains fields common to all condition nodes
type BaseNode struct {
	ID       string `json:"id"`
	Label    string `json:"label,omitempty"`
	Disabled bool   `json:"disabled,omitempty"`
}

// AndNode represents a logical AND of multiple conditions
type AndNode struct {
	BaseNode
	Type     NodeType        `json:"type"` // Always "AND"
	Children []ConditionNode `json:"children"`
}

// OrNode represents a logical OR of multiple conditions
type OrNode struct {
	BaseNode
	Type     NodeType        `json:"type"` // Always "OR"
	Children []ConditionNode `json:"children"`
}

// NotNode represents logical negation
type NotNode struct {
	BaseNode
	Type  NodeType      `json:"type"` // Always "NOT"
	Child ConditionNode `json:"child"`
}

// IfThenElseNode represents conditional branching
type IfThenElseNode struct {
	BaseNode
	Type      NodeType       `json:"type"` // Always "IF_THEN_ELSE"
	Condition ConditionNode  `json:"condition"`
	Then      ConditionNode  `json:"then"`
	Else      *ConditionNode `json:"else,omitempty"`
}

// CompareNode represents a comparison between two operands
type CompareNode struct {
	BaseNode
	Type     NodeType           `json:"type"` // Always "COMPARE"
	Left     Operand            `json:"left"`
	Operator ComparisonOperator `json:"operator"`
	Right    Operand            `json:"right"`
}

// CrossoverNode represents series1 crossing above series2
type CrossoverNode struct {
	BaseNode
	Type    NodeType `json:"type"` // Always "CROSSOVER"
	Series1 Operand  `json:"series1"`
	Series2 Operand  `json:"series2"`
}

// CrossunderNode represents series1 crossing below series2
type CrossunderNode struct {
	BaseNode
	Type    NodeType `json:"type"` // Always "CROSSUNDER"
	Series1 Operand  `json:"series1"`
	Series2 Operand  `json:"series2"`
}

// InRangeNode represents a value being within a range
type InRangeNode struct {
	BaseNode
	Type      NodeType `json:"type"` // Always "IN_RANGE"
	Value     Operand  `json:"value"`
	Min       Operand  `json:"min"`
	Max       Operand  `json:"max"`
	Inclusive bool     `json:"inclusive,omitempty"`
}

// Operand represents any operand in a condition
// Use GetOperandType() to determine the actual type, then type-cast accordingly
type Operand struct {
	raw json.RawMessage
}

// UnmarshalJSON implements json.Unmarshaler
func (o *Operand) UnmarshalJSON(data []byte) error {
	o.raw = data
	return nil
}

// MarshalJSON implements json.Marshaler
func (o Operand) MarshalJSON() ([]byte, error) {
	return o.raw, nil
}

// GetOperandType returns the type of this operand
func (o *Operand) GetOperandType() (OperandType, error) {
	var base struct {
		Type OperandType `json:"type"`
	}
	if err := json.Unmarshal(o.raw, &base); err != nil {
		return "", err
	}
	return base.Type, nil
}

// AsConstantOperand parses the operand as a CONSTANT
func (o *Operand) AsConstantOperand() (*ConstantOperand, error) {
	var op ConstantOperand
	if err := json.Unmarshal(o.raw, &op); err != nil {
		return nil, err
	}
	return &op, nil
}

// AsIndicatorOperand parses the operand as an INDICATOR
func (o *Operand) AsIndicatorOperand() (*IndicatorOperand, error) {
	var op IndicatorOperand
	if err := json.Unmarshal(o.raw, &op); err != nil {
		return nil, err
	}
	return &op, nil
}

// AsPriceOperand parses the operand as a PRICE
func (o *Operand) AsPriceOperand() (*PriceOperand, error) {
	var op PriceOperand
	if err := json.Unmarshal(o.raw, &op); err != nil {
		return nil, err
	}
	return &op, nil
}

// AsTradeContextOperand parses the operand as a TRADE_CONTEXT
func (o *Operand) AsTradeContextOperand() (*TradeContextOperand, error) {
	var op TradeContextOperand
	if err := json.Unmarshal(o.raw, &op); err != nil {
		return nil, err
	}
	return &op, nil
}

// AsTimeOperand parses the operand as a TIME
func (o *Operand) AsTimeOperand() (*TimeOperand, error) {
	var op TimeOperand
	if err := json.Unmarshal(o.raw, &op); err != nil {
		return nil, err
	}
	return &op, nil
}

// AsMarketOperand parses the operand as a MARKET
func (o *Operand) AsMarketOperand() (*MarketOperand, error) {
	var op MarketOperand
	if err := json.Unmarshal(o.raw, &op); err != nil {
		return nil, err
	}
	return &op, nil
}

// AsExternalOperand parses the operand as an EXTERNAL
func (o *Operand) AsExternalOperand() (*ExternalOperand, error) {
	var op ExternalOperand
	if err := json.Unmarshal(o.raw, &op); err != nil {
		return nil, err
	}
	return &op, nil
}

// AsComputedOperand parses the operand as a COMPUTED
func (o *Operand) AsComputedOperand() (*ComputedOperand, error) {
	var op ComputedOperand
	if err := json.Unmarshal(o.raw, &op); err != nil {
		return nil, err
	}
	return &op, nil
}

// AsCustomOperand parses the operand as a CUSTOM
func (o *Operand) AsCustomOperand() (*CustomOperand, error) {
	var op CustomOperand
	if err := json.Unmarshal(o.raw, &op); err != nil {
		return nil, err
	}
	return &op, nil
}

// BaseOperand contains fields common to all operands
type BaseOperand struct {
	Type     OperandType     `json:"type"`
	Category OperandCategory `json:"category,omitempty"`
	Label    string          `json:"label,omitempty"`
}

// ConstantOperand represents a literal value
type ConstantOperand struct {
	BaseOperand
	Value     interface{} `json:"value"`               // number, string, or boolean
	ValueType string      `json:"valueType,omitempty"` // number, percent, string, boolean, duration, currency
}

// IndicatorOperand references a configured technical indicator
type IndicatorOperand struct {
	BaseOperand
	IndicatorID string `json:"indicatorId"`      // Reference to indicator in indicators array
	Field       string `json:"field,omitempty"`  // e.g., 'histogram' for MACD
	Offset      int    `json:"offset,omitempty"` // Bars back (0 = current)
}

// PriceOperand references OHLCV price data
type PriceOperand struct {
	BaseOperand
	Field     string `json:"field"`               // open, high, low, close, volume, ohlc4, hlc3, hl2
	Offset    int    `json:"offset,omitempty"`    // Bars back
	Timeframe string `json:"timeframe,omitempty"` // Optional different timeframe
}

// TradeContextOperand references trade/position data (for callbacks)
type TradeContextOperand struct {
	BaseOperand
	Field string `json:"field"` // current_profit, entry_rate, trade_duration, etc.
}

// TimeOperand references time-based data
type TimeOperand struct {
	BaseOperand
	Field    string `json:"field"`              // hour, day_of_week, trading_session, etc.
	Timezone string `json:"timezone,omitempty"` // IANA timezone (default: UTC)
}

// MarketOperand references market-wide data
type MarketOperand struct {
	BaseOperand
	Field string `json:"field"`           // btc_dominance, fear_greed_index, etc.
	Asset string `json:"asset,omitempty"` // For asset-specific market data
}

// ExternalOperand references external data sources
type ExternalOperand struct {
	BaseOperand
	SourceID string `json:"sourceId"`            // Reference to external data source config
	Field    string `json:"field"`               // Path in external data
	CacheTTL int    `json:"cache_ttl,omitempty"` // Cache duration in seconds
}

// ComputedOperand represents arithmetic on other operands
type ComputedOperand struct {
	BaseOperand
	Operation ComputedOperation `json:"operation"`
	Operands  []Operand         `json:"operands"`
	Precision int               `json:"precision,omitempty"` // Decimal places for result
}

// CustomOperand represents user-defined extensions
type CustomOperand struct {
	BaseOperand
	PluginID string                 `json:"pluginId"`
	Config   map[string]interface{} `json:"config"`
}

// IndicatorDefinition defines a technical indicator instance
type IndicatorDefinition struct {
	ID     string                 `json:"id"`     // Unique ID for reference
	Type   IndicatorType          `json:"type"`   // RSI, SMA, MACD, etc.
	Params map[string]interface{} `json:"params"` // period, source, etc.
	Label  string                 `json:"label,omitempty"`

	// Plugin metadata for custom indicators
	Plugin *IndicatorPlugin `json:"plugin,omitempty"`
}

// IndicatorPlugin contains metadata for custom indicators
type IndicatorPlugin struct {
	Source          string   `json:"source"` // builtin, community, custom
	Version         string   `json:"version,omitempty"`
	PythonCode      string   `json:"pythonCode,omitempty"` // Custom indicator code
	RequiredImports []string `json:"requiredImports,omitempty"`
}

// UIBuilderConfig represents the full UI builder configuration
type UIBuilderConfig struct {
	Version         int                   `json:"version"`
	SchemaVersion   string                `json:"schema_version,omitempty"`
	Indicators      []IndicatorDefinition `json:"indicators"`
	EntryConditions ConditionNode         `json:"entry_conditions"`
	ExitConditions  ConditionNode         `json:"exit_conditions"`
	Parameters      StrategyParameters    `json:"parameters"`
	Callbacks       CallbacksConfig       `json:"callbacks"`
}

// StrategyParameters contains strategy trading parameters
type StrategyParameters struct {
	Stoploss                   float64            `json:"stoploss"`
	MinimalROI                 map[string]float64 `json:"minimal_roi"`
	TrailingStop               bool               `json:"trailing_stop"`
	TrailingStopPositive       *float64           `json:"trailing_stop_positive,omitempty"`
	TrailingStopPositiveOffset *float64           `json:"trailing_stop_positive_offset,omitempty"`
	UseExitSignal              bool               `json:"use_exit_signal"`
}

// CallbacksConfig contains callback configurations
type CallbacksConfig struct {
	CustomStoploss *CustomStoplossConfig `json:"custom_stoploss,omitempty"`
	ConfirmEntry   *ConfirmEntryConfig   `json:"confirm_entry,omitempty"`
	DCA            *DCAConfig            `json:"dca,omitempty"`
	CustomExit     *CustomExitConfig     `json:"custom_exit,omitempty"`
}

// CustomStoplossConfig defines dynamic stoploss rules
type CustomStoplossConfig struct {
	Enabled         bool            `json:"enabled"`
	Rules           []StoplossRule  `json:"rules"`
	DefaultStoploss float64         `json:"default_stoploss"`
	Trailing        *TrailingConfig `json:"trailing,omitempty"`
}

// StoplossRule defines a single stoploss rule
type StoplossRule struct {
	ID        string        `json:"id"`
	Condition ConditionNode `json:"condition"`
	Stoploss  float64       `json:"stoploss"`
}

// TrailingConfig defines trailing stop parameters
type TrailingConfig struct {
	Enabled        bool    `json:"enabled"`
	Positive       float64 `json:"positive"`
	PositiveOffset float64 `json:"positive_offset"`
}

// ConfirmEntryConfig defines entry confirmation rules
type ConfirmEntryConfig struct {
	Enabled bool          `json:"enabled"`
	Rules   ConditionNode `json:"rules"`
}

// DCAConfig defines dollar-cost averaging rules
type DCAConfig struct {
	Enabled         bool      `json:"enabled"`
	MaxEntries      int       `json:"max_entries"`
	Rules           []DCARule `json:"rules"`
	CooldownMinutes int       `json:"cooldown_minutes,omitempty"`
}

// DCARule defines a single DCA rule
type DCARule struct {
	PriceDropPercent float64 `json:"price_drop_percent"`
	StakeMultiplier  float64 `json:"stake_multiplier"`
}

// CustomExitConfig defines custom exit strategies
type CustomExitConfig struct {
	Enabled        bool           `json:"enabled"`
	ExitStrategies []ExitStrategy `json:"exit_strategies"`
}

// ExitStrategy defines a single exit strategy
type ExitStrategy struct {
	ID            string        `json:"id"`
	EntryTag      string        `json:"entry_tag"`
	ExitCondition ConditionNode `json:"exit_condition"`
	ExitTag       string        `json:"exit_tag"`
}

// StrategyConfig represents the full strategy configuration including UI builder
type StrategyConfig struct {
	StakeCurrency string           `json:"stake_currency"`
	StakeAmount   float64          `json:"stake_amount"`
	Timeframe     string           `json:"timeframe"`
	UIBuilder     *UIBuilderConfig `json:"ui_builder,omitempty"`
}

// ParseUIBuilderConfig parses a JSON map into UIBuilderConfig
func ParseUIBuilderConfig(data map[string]interface{}) (*UIBuilderConfig, error) {
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	// First parse the full config to get ui_builder section
	var fullConfig StrategyConfig
	if err := json.Unmarshal(jsonBytes, &fullConfig); err != nil {
		return nil, err
	}

	return fullConfig.UIBuilder, nil
}
