package codegen

import (
	"fmt"
	"strings"
)

// Generator handles the conversion of UI builder config to Python strategy code
type Generator struct {
	indicators map[string]IndicatorDefinition // ID -> Definition
	imports    map[string]bool                // Track required imports
}

// NewGenerator creates a new code generator
func NewGenerator() *Generator {
	return &Generator{
		indicators: make(map[string]IndicatorDefinition),
		imports:    make(map[string]bool),
	}
}

// SetIndicators sets the indicator definitions for reference
func (g *Generator) SetIndicators(indicators []IndicatorDefinition) {
	g.indicators = make(map[string]IndicatorDefinition)
	for _, ind := range indicators {
		g.indicators[ind.ID] = ind
	}
}

// GenerateCondition generates Python code for a condition node
// Returns a string that evaluates to a pandas boolean Series
func (g *Generator) GenerateCondition(node *ConditionNode) (string, error) {
	nodeType, err := node.GetNodeType()
	if err != nil {
		return "", fmt.Errorf("failed to get node type: %w", err)
	}

	switch nodeType {
	case NodeTypeAND:
		return g.generateAnd(node)
	case NodeTypeOR:
		return g.generateOr(node)
	case NodeTypeNOT:
		return g.generateNot(node)
	case NodeTypeIfThenElse:
		return g.generateIfThenElse(node)
	case NodeTypeCOMPARE:
		return g.generateCompare(node)
	case NodeTypeCROSSOVER:
		return g.generateCrossover(node)
	case NodeTypeCROSSUNDER:
		return g.generateCrossunder(node)
	case NodeTypeIN_RANGE:
		return g.generateInRange(node)
	default:
		return "", fmt.Errorf("unknown node type: %s", nodeType)
	}
}

// generateAnd generates Python code for AND nodes
func (g *Generator) generateAnd(node *ConditionNode) (string, error) {
	andNode, err := node.AsAndNode()
	if err != nil {
		return "", err
	}

	if len(andNode.Children) == 0 {
		return "True", nil // Empty AND is always true
	}

	parts := make([]string, 0, len(andNode.Children))
	for _, child := range andNode.Children {
		code, err := g.GenerateCondition(&child)
		if err != nil {
			return "", err
		}
		parts = append(parts, fmt.Sprintf("(%s)", code))
	}

	return strings.Join(parts, " & "), nil
}

// generateOr generates Python code for OR nodes
func (g *Generator) generateOr(node *ConditionNode) (string, error) {
	orNode, err := node.AsOrNode()
	if err != nil {
		return "", err
	}

	if len(orNode.Children) == 0 {
		return "False", nil // Empty OR is always false
	}

	parts := make([]string, 0, len(orNode.Children))
	for _, child := range orNode.Children {
		code, err := g.GenerateCondition(&child)
		if err != nil {
			return "", err
		}
		parts = append(parts, fmt.Sprintf("(%s)", code))
	}

	return strings.Join(parts, " | "), nil
}

// generateNot generates Python code for NOT nodes
func (g *Generator) generateNot(node *ConditionNode) (string, error) {
	notNode, err := node.AsNotNode()
	if err != nil {
		return "", err
	}

	childCode, err := g.GenerateCondition(&notNode.Child)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("~(%s)", childCode), nil
}

// generateIfThenElse generates Python code for IF-THEN-ELSE nodes
func (g *Generator) generateIfThenElse(node *ConditionNode) (string, error) {
	ifNode, err := node.AsIfThenElseNode()
	if err != nil {
		return "", err
	}

	g.imports["numpy"] = true

	condCode, err := g.GenerateCondition(&ifNode.Condition)
	if err != nil {
		return "", err
	}

	thenCode, err := g.GenerateCondition(&ifNode.Then)
	if err != nil {
		return "", err
	}

	var elseCode string
	if ifNode.Else != nil {
		elseCode, err = g.GenerateCondition(ifNode.Else)
		if err != nil {
			return "", err
		}
	} else {
		elseCode = "False"
	}

	// Use np.where for conditional vectorized operations
	return fmt.Sprintf("np.where(%s, %s, %s)", condCode, thenCode, elseCode), nil
}

// generateCompare generates Python code for COMPARE nodes
func (g *Generator) generateCompare(node *ConditionNode) (string, error) {
	cmpNode, err := node.AsCompareNode()
	if err != nil {
		return "", err
	}

	leftCode, err := g.GenerateOperand(&cmpNode.Left)
	if err != nil {
		return "", err
	}

	rightCode, err := g.GenerateOperand(&cmpNode.Right)
	if err != nil {
		return "", err
	}

	var op string
	switch cmpNode.Operator {
	case OperatorEq:
		op = "=="
	case OperatorNeq:
		op = "!="
	case OperatorGt:
		op = ">"
	case OperatorGte:
		op = ">="
	case OperatorLt:
		op = "<"
	case OperatorLte:
		op = "<="
	case OperatorBetween:
		// For between, rightCode should contain the max value
		// This is a simplified version; full implementation would need min and max
		return fmt.Sprintf("(%s >= %s) & (%s <= %s)", leftCode, rightCode, leftCode, rightCode), nil
	case OperatorIn:
		return fmt.Sprintf("%s.isin(%s)", leftCode, rightCode), nil
	case OperatorNotIn:
		return fmt.Sprintf("~%s.isin(%s)", leftCode, rightCode), nil
	default:
		return "", fmt.Errorf("unknown operator: %s", cmpNode.Operator)
	}

	return fmt.Sprintf("%s %s %s", leftCode, op, rightCode), nil
}

// generateCrossover generates Python code for CROSSOVER nodes
func (g *Generator) generateCrossover(node *ConditionNode) (string, error) {
	crossNode, err := node.AsCrossoverNode()
	if err != nil {
		return "", err
	}

	g.imports["qtpylib"] = true

	series1, err := g.GenerateOperand(&crossNode.Series1)
	if err != nil {
		return "", err
	}

	series2, err := g.GenerateOperand(&crossNode.Series2)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("qtpylib.crossed_above(%s, %s)", series1, series2), nil
}

// generateCrossunder generates Python code for CROSSUNDER nodes
func (g *Generator) generateCrossunder(node *ConditionNode) (string, error) {
	crossNode, err := node.AsCrossunderNode()
	if err != nil {
		return "", err
	}

	g.imports["qtpylib"] = true

	series1, err := g.GenerateOperand(&crossNode.Series1)
	if err != nil {
		return "", err
	}

	series2, err := g.GenerateOperand(&crossNode.Series2)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("qtpylib.crossed_below(%s, %s)", series1, series2), nil
}

// generateInRange generates Python code for IN_RANGE nodes
func (g *Generator) generateInRange(node *ConditionNode) (string, error) {
	rangeNode, err := node.AsInRangeNode()
	if err != nil {
		return "", err
	}

	valueCode, err := g.GenerateOperand(&rangeNode.Value)
	if err != nil {
		return "", err
	}

	minCode, err := g.GenerateOperand(&rangeNode.Min)
	if err != nil {
		return "", err
	}

	maxCode, err := g.GenerateOperand(&rangeNode.Max)
	if err != nil {
		return "", err
	}

	if rangeNode.Inclusive {
		return fmt.Sprintf("(%s >= %s) & (%s <= %s)", valueCode, minCode, valueCode, maxCode), nil
	}
	return fmt.Sprintf("(%s > %s) & (%s < %s)", valueCode, minCode, valueCode, maxCode), nil
}

// GenerateOperand generates Python code for an operand
func (g *Generator) GenerateOperand(op *Operand) (string, error) {
	opType, err := op.GetOperandType()
	if err != nil {
		return "", fmt.Errorf("failed to get operand type: %w", err)
	}

	switch opType {
	case OperandTypeCONSTANT:
		return g.generateConstantOperand(op)
	case OperandTypeINDICATOR:
		return g.generateIndicatorOperand(op)
	case OperandTypePRICE:
		return g.generatePriceOperand(op)
	case OperandTypeTRADE_CONTEXT:
		return g.generateTradeContextOperand(op)
	case OperandTypeTIME:
		return g.generateTimeOperand(op)
	case OperandTypeMARKET:
		return g.generateMarketOperand(op)
	case OperandTypeCOMPUTED:
		return g.generateComputedOperand(op)
	default:
		return "", fmt.Errorf("unsupported operand type: %s", opType)
	}
}

// generateConstantOperand generates Python code for CONSTANT operands
func (g *Generator) generateConstantOperand(op *Operand) (string, error) {
	constOp, err := op.AsConstantOperand()
	if err != nil {
		return "", err
	}

	switch v := constOp.Value.(type) {
	case float64:
		return fmt.Sprintf("%v", v), nil
	case int:
		return fmt.Sprintf("%d", v), nil
	case string:
		return fmt.Sprintf("%q", v), nil
	case bool:
		if v {
			return "True", nil
		}
		return "False", nil
	case nil:
		return "None", nil
	default:
		return fmt.Sprintf("%v", v), nil
	}
}

// generateIndicatorOperand generates Python code for INDICATOR operands
func (g *Generator) generateIndicatorOperand(op *Operand) (string, error) {
	indOp, err := op.AsIndicatorOperand()
	if err != nil {
		return "", err
	}

	// Build the column name
	colName := indOp.IndicatorID
	if indOp.Field != "" {
		colName = fmt.Sprintf("%s_%s", indOp.IndicatorID, indOp.Field)
	}

	// Handle offset (bars back)
	if indOp.Offset > 0 {
		return fmt.Sprintf("dataframe['%s'].shift(%d)", colName, indOp.Offset), nil
	}

	return fmt.Sprintf("dataframe['%s']", colName), nil
}

// generatePriceOperand generates Python code for PRICE operands
func (g *Generator) generatePriceOperand(op *Operand) (string, error) {
	priceOp, err := op.AsPriceOperand()
	if err != nil {
		return "", err
	}

	var colName string
	switch priceOp.Field {
	case "open", "high", "low", "close", "volume":
		colName = priceOp.Field
	case "ohlc4":
		return "(dataframe['open'] + dataframe['high'] + dataframe['low'] + dataframe['close']) / 4", nil
	case "hlc3":
		return "(dataframe['high'] + dataframe['low'] + dataframe['close']) / 3", nil
	case "hl2":
		return "(dataframe['high'] + dataframe['low']) / 2", nil
	default:
		colName = priceOp.Field
	}

	// Handle offset (bars back)
	if priceOp.Offset > 0 {
		return fmt.Sprintf("dataframe['%s'].shift(%d)", colName, priceOp.Offset), nil
	}

	return fmt.Sprintf("dataframe['%s']", colName), nil
}

// generateTradeContextOperand generates Python code for TRADE_CONTEXT operands
// Note: This is used in callbacks, not in dataframe conditions
func (g *Generator) generateTradeContextOperand(op *Operand) (string, error) {
	tradeOp, err := op.AsTradeContextOperand()
	if err != nil {
		return "", err
	}

	// Map field names to Python variables available in callbacks
	switch tradeOp.Field {
	case "current_profit":
		return "current_profit", nil
	case "current_profit_pct":
		return "(current_profit * 100)", nil
	case "entry_rate":
		return "trade.open_rate", nil
	case "current_rate":
		return "current_rate", nil
	case "trade_duration":
		return "((current_time - trade.open_date_utc).total_seconds() / 60)", nil
	case "nr_of_entries":
		return "trade.nr_of_successful_entries", nil
	case "stake_amount":
		return "trade.stake_amount", nil
	case "volume_ratio":
		// This would need to be calculated from dataframe
		return "1.0", nil // Placeholder
	case "spread_pct":
		// This would need to be calculated from orderbook
		return "0.0", nil // Placeholder
	case "pair":
		return "pair", nil
	case "is_short":
		return "trade.is_short", nil
	default:
		return "", fmt.Errorf("unknown trade context field: %s", tradeOp.Field)
	}
}

// generateTimeOperand generates Python code for TIME operands
func (g *Generator) generateTimeOperand(op *Operand) (string, error) {
	timeOp, err := op.AsTimeOperand()
	if err != nil {
		return "", err
	}

	g.imports["pandas"] = true

	// Map field names to pandas datetime operations
	switch timeOp.Field {
	case "hour":
		return "dataframe['date'].dt.hour", nil
	case "minute":
		return "dataframe['date'].dt.minute", nil
	case "day_of_week":
		return "dataframe['date'].dt.dayofweek", nil
	case "day_of_month":
		return "dataframe['date'].dt.day", nil
	case "month":
		return "dataframe['date'].dt.month", nil
	case "is_weekend":
		return "(dataframe['date'].dt.dayofweek >= 5)", nil
	case "trading_session":
		// This would need custom logic for session detection
		return "'unknown'", nil // Placeholder
	default:
		return "", fmt.Errorf("unknown time field: %s", timeOp.Field)
	}
}

// generateMarketOperand generates Python code for MARKET operands
func (g *Generator) generateMarketOperand(op *Operand) (string, error) {
	marketOp, err := op.AsMarketOperand()
	if err != nil {
		return "", err
	}

	// Market data would need to be fetched externally
	// For now, return placeholder values
	switch marketOp.Field {
	case "btc_dominance", "total_market_cap", "fear_greed_index":
		return fmt.Sprintf("self.dp.get_analyzed_dataframe('%s', self.timeframe)[0]['%s']",
			marketOp.Field, marketOp.Field), nil
	default:
		return "0", nil // Placeholder
	}
}

// generateComputedOperand generates Python code for COMPUTED operands
func (g *Generator) generateComputedOperand(op *Operand) (string, error) {
	compOp, err := op.AsComputedOperand()
	if err != nil {
		return "", err
	}

	if len(compOp.Operands) == 0 {
		return "0", nil
	}

	// Generate code for all operands
	operandCodes := make([]string, len(compOp.Operands))
	for i, operand := range compOp.Operands {
		code, err := g.GenerateOperand(&operand)
		if err != nil {
			return "", err
		}
		operandCodes[i] = code
	}

	switch compOp.Operation {
	case ComputedAdd:
		return fmt.Sprintf("(%s)", strings.Join(operandCodes, " + ")), nil
	case ComputedSubtract:
		return fmt.Sprintf("(%s)", strings.Join(operandCodes, " - ")), nil
	case ComputedMultiply:
		return fmt.Sprintf("(%s)", strings.Join(operandCodes, " * ")), nil
	case ComputedDivide:
		return fmt.Sprintf("(%s)", strings.Join(operandCodes, " / ")), nil
	case ComputedMin:
		g.imports["numpy"] = true
		return fmt.Sprintf("np.minimum(%s)", strings.Join(operandCodes, ", ")), nil
	case ComputedMax:
		g.imports["numpy"] = true
		return fmt.Sprintf("np.maximum(%s)", strings.Join(operandCodes, ", ")), nil
	case ComputedAbs:
		if len(operandCodes) > 0 {
			return fmt.Sprintf("abs(%s)", operandCodes[0]), nil
		}
		return "0", nil
	case ComputedPercentChange:
		if len(operandCodes) >= 2 {
			return fmt.Sprintf("((%s - %s) / %s * 100)", operandCodes[0], operandCodes[1], operandCodes[1]), nil
		}
		return "0", nil
	case ComputedAverage:
		g.imports["numpy"] = true
		return fmt.Sprintf("np.mean([%s])", strings.Join(operandCodes, ", ")), nil
	case ComputedSum:
		return fmt.Sprintf("(%s)", strings.Join(operandCodes, " + ")), nil
	default:
		return "", fmt.Errorf("unknown computed operation: %s", compOp.Operation)
	}
}

// GetRequiredImports returns the list of imports needed for the generated code
func (g *Generator) GetRequiredImports() []string {
	imports := make([]string, 0, len(g.imports))
	for imp := range g.imports {
		imports = append(imports, imp)
	}
	return imports
}

// ResetImports clears the tracked imports
func (g *Generator) ResetImports() {
	g.imports = make(map[string]bool)
}
