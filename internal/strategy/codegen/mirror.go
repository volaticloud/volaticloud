package codegen

import (
	"encoding/json"
	"fmt"
)

// ApplyMirrorConfig generates target direction signals from source direction
// by inverting conditions according to the mirror configuration.
//
// If mirroring is enabled and source is LONG, it generates SHORT signals from LONG.
// If mirroring is enabled and source is SHORT, it generates LONG signals from SHORT.
//
// Returns the config unchanged if the source direction has no conditions defined.
func ApplyMirrorConfig(config *UIBuilderConfig) (*UIBuilderConfig, error) {
	if config == nil || config.MirrorConfig == nil || !config.MirrorConfig.Enabled {
		return config, nil
	}

	mc := config.MirrorConfig

	switch mc.Source {
	case SignalDirectionLong:
		// Validate source has conditions
		if config.Long == nil {
			return config, fmt.Errorf("mirror source LONG has no conditions defined")
		}
		// Mirror LONG → SHORT
		config.Short = &SignalConfig{
			EntryConditions: invertConditionNode(config.Long.EntryConditions, mc),
			ExitConditions:  invertConditionNode(config.Long.ExitConditions, mc),
		}
	case SignalDirectionShort:
		// Validate source has conditions
		if config.Short == nil {
			return config, fmt.Errorf("mirror source SHORT has no conditions defined")
		}
		// Mirror SHORT → LONG
		config.Long = &SignalConfig{
			EntryConditions: invertConditionNode(config.Short.EntryConditions, mc),
			ExitConditions:  invertConditionNode(config.Short.ExitConditions, mc),
		}
	}

	return config, nil
}

// invertConditionNode recursively inverts a condition tree according to mirror config
func invertConditionNode(node ConditionNode, mc *MirrorConfig) ConditionNode {
	if node.raw == nil {
		return node
	}

	nodeType, err := node.GetNodeType()
	if err != nil {
		return node
	}

	switch nodeType {
	case NodeTypeAND:
		return invertAndNode(node, mc)
	case NodeTypeOR:
		return invertOrNode(node, mc)
	case NodeTypeNOT:
		return invertNotNode(node, mc)
	case NodeTypeIfThenElse:
		return invertIfThenElseNode(node, mc)
	case NodeTypeCOMPARE:
		if mc.InvertComparisons {
			return invertCompareNode(node)
		}
		return node
	case NodeTypeCROSSOVER:
		if mc.InvertCrossovers {
			return convertToCrossunder(node)
		}
		return node
	case NodeTypeCROSSUNDER:
		if mc.InvertCrossovers {
			return convertToCrossover(node)
		}
		return node
	case NodeTypeInRange:
		// IN_RANGE doesn't need inversion
		return node
	default:
		return node
	}
}

// invertAndNode inverts children of an AND node
func invertAndNode(node ConditionNode, mc *MirrorConfig) ConditionNode {
	andNode, err := node.AsAndNode()
	if err != nil {
		return node
	}

	invertedChildren := make([]ConditionNode, len(andNode.Children))
	for i, child := range andNode.Children {
		invertedChildren[i] = invertConditionNode(child, mc)
	}

	result := AndNode{
		BaseNode: andNode.BaseNode,
		Type:     NodeTypeAND,
		Children: invertedChildren,
	}

	return marshalToConditionNode(result)
}

// invertOrNode inverts children of an OR node
func invertOrNode(node ConditionNode, mc *MirrorConfig) ConditionNode {
	orNode, err := node.AsOrNode()
	if err != nil {
		return node
	}

	invertedChildren := make([]ConditionNode, len(orNode.Children))
	for i, child := range orNode.Children {
		invertedChildren[i] = invertConditionNode(child, mc)
	}

	result := OrNode{
		BaseNode: orNode.BaseNode,
		Type:     NodeTypeOR,
		Children: invertedChildren,
	}

	return marshalToConditionNode(result)
}

// invertNotNode inverts the child of a NOT node
func invertNotNode(node ConditionNode, mc *MirrorConfig) ConditionNode {
	notNode, err := node.AsNotNode()
	if err != nil {
		return node
	}

	result := NotNode{
		BaseNode: notNode.BaseNode,
		Type:     NodeTypeNOT,
		Child:    invertConditionNode(notNode.Child, mc),
	}

	return marshalToConditionNode(result)
}

// invertIfThenElseNode inverts condition, then, and else branches
func invertIfThenElseNode(node ConditionNode, mc *MirrorConfig) ConditionNode {
	ifNode, err := node.AsIfThenElseNode()
	if err != nil {
		return node
	}

	result := IfThenElseNode{
		BaseNode:  ifNode.BaseNode,
		Type:      NodeTypeIfThenElse,
		Condition: invertConditionNode(ifNode.Condition, mc),
		Then:      invertConditionNode(ifNode.Then, mc),
	}

	if ifNode.Else != nil {
		invertedElse := invertConditionNode(*ifNode.Else, mc)
		result.Else = &invertedElse
	}

	return marshalToConditionNode(result)
}

// invertCompareNode inverts the comparison operator in a COMPARE node
func invertCompareNode(node ConditionNode) ConditionNode {
	compareNode, err := node.AsCompareNode()
	if err != nil {
		return node
	}

	result := CompareNode{
		BaseNode: compareNode.BaseNode,
		Type:     NodeTypeCOMPARE,
		Left:     compareNode.Left,
		Operator: invertOperator(compareNode.Operator),
		Right:    compareNode.Right,
	}

	return marshalToConditionNode(result)
}

// invertOperator inverts a comparison operator
// gt <-> lt, gte <-> lte, eq and neq stay the same
func invertOperator(op ComparisonOperator) ComparisonOperator {
	switch op {
	case OperatorGt:
		return OperatorLt
	case OperatorGte:
		return OperatorLte
	case OperatorLt:
		return OperatorGt
	case OperatorLte:
		return OperatorGte
	default:
		// eq, neq, in, not_in don't change
		return op
	}
}

// convertToCrossunder converts a CROSSOVER node to CROSSUNDER
func convertToCrossunder(node ConditionNode) ConditionNode {
	crossoverNode, err := node.AsCrossoverNode()
	if err != nil {
		return node
	}

	result := CrossunderNode{
		BaseNode: crossoverNode.BaseNode,
		Type:     NodeTypeCROSSUNDER,
		Series1:  crossoverNode.Series1,
		Series2:  crossoverNode.Series2,
	}

	return marshalToConditionNode(result)
}

// convertToCrossover converts a CROSSUNDER node to CROSSOVER
func convertToCrossover(node ConditionNode) ConditionNode {
	crossunderNode, err := node.AsCrossunderNode()
	if err != nil {
		return node
	}

	result := CrossoverNode{
		BaseNode: crossunderNode.BaseNode,
		Type:     NodeTypeCROSSOVER,
		Series1:  crossunderNode.Series1,
		Series2:  crossunderNode.Series2,
	}

	return marshalToConditionNode(result)
}

// marshalToConditionNode marshals any struct to a ConditionNode
func marshalToConditionNode(v interface{}) ConditionNode {
	data, err := json.Marshal(v)
	if err != nil {
		return ConditionNode{}
	}

	var node ConditionNode
	if err := json.Unmarshal(data, &node); err != nil {
		return ConditionNode{}
	}

	return node
}
