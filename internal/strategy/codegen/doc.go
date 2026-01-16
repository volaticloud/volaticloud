/*
Package codegen provides strategy code generation from UI builder configurations.

# Overview

The codegen package converts JSON-based UI builder configurations into valid Python
Freqtrade strategy code. It enables users to build trading strategies visually
without writing Python code.

# Architecture

The package uses a tree-based condition structure that maps directly to Python expressions:

	UI Builder Config (JSON) → Condition Tree → Python Strategy Code

Key components:

 1. Condition Nodes: AND, OR, NOT, IF-THEN-ELSE, COMPARE, CROSSOVER, CROSSUNDER, IN_RANGE
 2. Operand Types: CONSTANT, INDICATOR, PRICE, TRADE_CONTEXT, TIME, COMPUTED
 3. Indicator Templates: RSI, SMA, EMA, MACD, BB, ATR, ADX, STOCH, and more
 4. Python Code Generation: Type-safe generation of pandas/numpy expressions

# Condition Tree Structure

The condition tree uses explicit type fields for discriminated unions:

	{
	  "type": "AND",
	  "children": [
	    {
	      "type": "COMPARE",
	      "left": {"type": "INDICATOR", "indicatorId": "rsi_1"},
	      "operator": "lt",
	      "right": {"type": "CONSTANT", "value": 30}
	    }
	  ]
	}

## Node Types

	AND       - Logical conjunction: (a) & (b) & (c)
	OR        - Logical disjunction: (a) | (b) | (c)
	NOT       - Logical negation: ~(a)
	IF_THEN_ELSE - Conditional: np.where(cond, then, else)
	COMPARE   - Comparison: left op right
	CROSSOVER - Series crosses above: qtpylib.crossed_above(a, b)
	CROSSUNDER - Series crosses below: qtpylib.crossed_below(a, b)
	IN_RANGE  - Range check: (v >= min) & (v <= max)

## Operand Types

	CONSTANT      - Literal values (numbers, strings, booleans)
	INDICATOR     - Technical indicator reference (dataframe['rsi_1'])
	PRICE         - OHLCV data (dataframe['close'])
	TRADE_CONTEXT - Trade state for callbacks (current_profit, trade.open_rate)
	TIME          - Time-based values (dataframe['date'].dt.hour)
	COMPUTED      - Arithmetic operations ((a + b) / c)
	EXTERNAL      - External data sources (future)
	CUSTOM        - Plugin operands (future)

# Code Generation

The Generator struct handles conversion:

	gen := codegen.NewGenerator()
	gen.SetIndicators(indicators)

	// Generate condition
	code, err := gen.GenerateCondition(conditionNode)
	// Returns: "(dataframe['rsi_1'] < 30) & (qtpylib.crossed_above(...))"

	// Get required imports
	imports := gen.GetRequiredImports()
	// Returns: ["qtpylib", "numpy"]

## Generated Python Patterns

	CONSTANT → 30, "buy", True, None
	INDICATOR → dataframe['rsi_1']
	INDICATOR with field → dataframe['macd_1_histogram']
	INDICATOR with offset → dataframe['rsi_1'].shift(1)
	PRICE → dataframe['close']
	PRICE ohlc4 → (dataframe['open'] + dataframe['high'] + dataframe['low'] + dataframe['close']) / 4

	AND → (cond1) & (cond2)
	OR → (cond1) | (cond2)
	NOT → ~(cond)
	IF_THEN_ELSE → np.where(cond, then, else)

	CROSSOVER → qtpylib.crossed_above(series1, series2)
	CROSSUNDER → qtpylib.crossed_below(series1, series2)
	IN_RANGE (inclusive) → (value >= min) & (value <= max)

# Indicator Templates

The package includes templates for 20+ indicators:

	Trend: SMA, EMA, WMA, DEMA, TEMA, KAMA
	Momentum: RSI, MACD, STOCH, STOCH_RSI, CCI, WILLR, MOM, ROC
	Volatility: BB (Bollinger Bands), KC (Keltner Channel), ATR
	Volume: OBV, MFI, CMF, AD, VWAP
	Other: ADX, ICHIMOKU, SAR, PIVOT, SUPERTREND

Each indicator has:
  - Default parameter values
  - Python code template using TA-Lib
  - Output column naming conventions

Example:

	ind := IndicatorDefinition{
	    ID:     "rsi_1",
	    Type:   "RSI",
	    Params: map[string]interface{}{"period": 14, "source": "close"},
	}
	code, err := GenerateIndicator(ind)
	// Returns: dataframe['rsi_1'] = ta.RSI(dataframe['close'], timeperiod=14)

# Type Safety

Go structs match TypeScript types in dashboard/src/components/StrategyBuilder/types.ts:

	Go (types.go)                    TypeScript (types.ts)
	────────────────────────────────────────────────────────
	OperandType constants      ↔    OperandType union
	NodeType constants         ↔    NodeType union
	ConditionNode (interface)  ↔    ConditionNode union
	Operand (interface)        ↔    Operand union

Type synchronization must be maintained manually when adding new types.

# Design Principles

1. Only implemented types: Don't add placeholder types that return fake values
2. Composability: Provide building blocks instead of high-level abstractions
3. Flexibility via COMPUTED: Users compose arithmetic for calculated values
4. Server-side generation: Backend generates Python for security and validation

# Usage Example

	// Parse UI builder config
	var config UIBuilderConfig
	json.Unmarshal(jsonData, &config)

	// Generate indicators
	indicatorCode := ""
	for _, ind := range config.Indicators {
	    code, err := GenerateIndicator(ind)
	    indicatorCode += code + "\n"
	}

	// Generate entry conditions
	gen := NewGenerator()
	gen.SetIndicators(config.Indicators)
	entryCode, err := gen.GenerateCondition(&config.EntryConditions)

	// Build final strategy
	strategy := fmt.Sprintf(`
	def populate_indicators(self, dataframe, metadata):
	    %s
	    return dataframe

	def populate_entry_trend(self, dataframe, metadata):
	    dataframe['enter_long'] = (%s).astype(int)
	    return dataframe
	`, indicatorCode, entryCode)

# Testing

Comprehensive test coverage for all node and operand types:

	go test -v ./internal/strategy/codegen
	go test -v ./internal/strategy/codegen -cover

Test categories:
  - All node type generators (AND, OR, NOT, COMPARE, etc.)
  - All operand type generators (CONSTANT, INDICATOR, PRICE, etc.)
  - All indicator templates
  - Edge cases (empty conditions, nil values)

# Files

	types.go        - Go structs for condition tree (ConditionNode, Operand)
	generator.go    - Main code generator (GenerateCondition, GenerateOperand)
	indicators.go   - Indicator code templates (GenerateIndicator)
	doc.go          - Package documentation

# Related

	internal/graph/schema.resolvers.go - previewStrategyCode mutation
	dashboard/src/components/StrategyBuilder/types.ts - TypeScript types (must match)
	dashboard/src/components/StrategyBuilder/CodePreview.tsx - Code preview UI
	docs/adr/0011-strategy-ui-builder.md - Architecture decision record
*/
package codegen