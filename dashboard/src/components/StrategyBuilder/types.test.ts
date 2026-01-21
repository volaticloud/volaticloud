import { describe, it, expect } from 'vitest';
import {
  // Helper functions
  createId,
  createCompareNode,
  createAndNode,
  createOrNode,
  createNotNode,
  createConstantOperand,
  createIndicatorOperand,
  createPriceOperand,
  createCrossoverNode,
  createCrossunderNode,
  createDefaultUIBuilderConfig,
  // Type guards
  isAndNode,
  isOrNode,
  isNotNode,
  isIfThenElseNode,
  isCompareNode,
  isCrossoverNode,
  isCrossunderNode,
  isInRangeNode,
  isLogicalNode,
  hasChildren,
  // Types for testing
  type AndNode,
  type OrNode,
  type NotNode,
  type CompareNode,
  type CrossoverNode,
  type CrossunderNode,
  type InRangeNode,
  type IfThenElseNode,
  type ConstantOperand,
  type IndicatorOperand,
} from './types';

describe('Strategy Builder Types', () => {
  describe('createId', () => {
    it('generates unique IDs', () => {
      const id1 = createId();
      const id2 = createId();
      expect(id1).not.toBe(id2);
    });

    it('generates IDs with correct prefix', () => {
      const id = createId();
      expect(id).toMatch(/^node_\d+_[a-z0-9]+$/);
    });

    it('generates IDs that include timestamp', () => {
      const before = Date.now();
      const id = createId();
      const after = Date.now();

      // Extract timestamp from ID (format: node_{timestamp}_{random})
      const parts = id.split('_');
      const timestamp = parseInt(parts[1], 10);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('createCompareNode', () => {
    it('creates a compare node with correct structure', () => {
      const left: ConstantOperand = { type: 'CONSTANT', value: 30 };
      const right: ConstantOperand = { type: 'CONSTANT', value: 70 };

      const node = createCompareNode(left, 'lt', right);

      expect(node.type).toBe('COMPARE');
      expect(node.left).toEqual(left);
      expect(node.operator).toBe('lt');
      expect(node.right).toEqual(right);
      expect(node.id).toBeDefined();
    });

    it('supports all comparison operators', () => {
      const left: ConstantOperand = { type: 'CONSTANT', value: 10 };
      const right: ConstantOperand = { type: 'CONSTANT', value: 20 };

      const operators = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in'] as const;

      operators.forEach((op) => {
        const node = createCompareNode(left, op, right);
        expect(node.operator).toBe(op);
      });
    });

    it('supports indicator operands', () => {
      const left: IndicatorOperand = { type: 'INDICATOR', indicatorId: 'rsi_1' };
      const right: ConstantOperand = { type: 'CONSTANT', value: 30 };

      const node = createCompareNode(left, 'lt', right);

      expect(node.left.type).toBe('INDICATOR');
      expect((node.left as IndicatorOperand).indicatorId).toBe('rsi_1');
    });
  });

  describe('createAndNode', () => {
    it('creates an AND node with empty children by default', () => {
      const node = createAndNode();

      expect(node.type).toBe('AND');
      expect(node.children).toEqual([]);
      expect(node.id).toBeDefined();
    });

    it('creates an AND node with provided children', () => {
      const child1 = createCompareNode(
        { type: 'CONSTANT', value: 1 },
        'eq',
        { type: 'CONSTANT', value: 1 }
      );
      const child2 = createCompareNode(
        { type: 'CONSTANT', value: 2 },
        'eq',
        { type: 'CONSTANT', value: 2 }
      );

      const node = createAndNode([child1, child2]);

      expect(node.children).toHaveLength(2);
      expect(node.children[0]).toEqual(child1);
      expect(node.children[1]).toEqual(child2);
    });
  });

  describe('createOrNode', () => {
    it('creates an OR node with empty children by default', () => {
      const node = createOrNode();

      expect(node.type).toBe('OR');
      expect(node.children).toEqual([]);
      expect(node.id).toBeDefined();
    });

    it('creates an OR node with provided children', () => {
      const child = createCompareNode(
        { type: 'CONSTANT', value: 1 },
        'eq',
        { type: 'CONSTANT', value: 1 }
      );

      const node = createOrNode([child]);

      expect(node.children).toHaveLength(1);
    });
  });

  describe('createNotNode', () => {
    it('creates a NOT node wrapping a child condition', () => {
      const child = createCompareNode(
        { type: 'INDICATOR', indicatorId: 'rsi_1' },
        'gt',
        { type: 'CONSTANT', value: 70 }
      );

      const node = createNotNode(child);

      expect(node.type).toBe('NOT');
      expect(node.child).toEqual(child);
      expect(node.id).toBeDefined();
    });
  });

  describe('createConstantOperand', () => {
    it('creates a constant operand with number value', () => {
      const operand = createConstantOperand(42);

      expect(operand.type).toBe('CONSTANT');
      expect(operand.value).toBe(42);
    });

    it('creates a constant operand with string value', () => {
      const operand = createConstantOperand('test');

      expect(operand.type).toBe('CONSTANT');
      expect(operand.value).toBe('test');
    });

    it('creates a constant operand with boolean value', () => {
      const operand = createConstantOperand(true);

      expect(operand.type).toBe('CONSTANT');
      expect(operand.value).toBe(true);
    });

    it('creates a constant operand with null value', () => {
      const operand = createConstantOperand(null);

      expect(operand.type).toBe('CONSTANT');
      expect(operand.value).toBeNull();
    });
  });

  describe('createIndicatorOperand', () => {
    it('creates an indicator operand with required fields', () => {
      const operand = createIndicatorOperand('macd_1');

      expect(operand.type).toBe('INDICATOR');
      expect(operand.indicatorId).toBe('macd_1');
      expect(operand.field).toBeUndefined();
      expect(operand.offset).toBeUndefined();
    });

    it('creates an indicator operand with field', () => {
      const operand = createIndicatorOperand('macd_1', 'histogram');

      expect(operand.indicatorId).toBe('macd_1');
      expect(operand.field).toBe('histogram');
    });

    it('creates an indicator operand with offset', () => {
      const operand = createIndicatorOperand('rsi_1', undefined, 1);

      expect(operand.indicatorId).toBe('rsi_1');
      expect(operand.offset).toBe(1);
    });

    it('creates an indicator operand with all optional fields', () => {
      const operand = createIndicatorOperand('bb_1', 'upper', 2);

      expect(operand.indicatorId).toBe('bb_1');
      expect(operand.field).toBe('upper');
      expect(operand.offset).toBe(2);
    });
  });

  describe('createPriceOperand', () => {
    it('creates a price operand with field', () => {
      const operand = createPriceOperand('close');

      expect(operand.type).toBe('PRICE');
      expect(operand.field).toBe('close');
      expect(operand.offset).toBeUndefined();
    });

    it('creates a price operand with offset', () => {
      const operand = createPriceOperand('high', 1);

      expect(operand.field).toBe('high');
      expect(operand.offset).toBe(1);
    });

    it('supports all price fields', () => {
      const fields = ['open', 'high', 'low', 'close', 'volume', 'ohlc4', 'hlc3', 'hl2'] as const;

      fields.forEach((field) => {
        const operand = createPriceOperand(field);
        expect(operand.field).toBe(field);
      });
    });
  });

  describe('createCrossoverNode', () => {
    it('creates a crossover node with two series', () => {
      const series1: IndicatorOperand = { type: 'INDICATOR', indicatorId: 'ema_fast' };
      const series2: IndicatorOperand = { type: 'INDICATOR', indicatorId: 'ema_slow' };

      const node = createCrossoverNode(series1, series2);

      expect(node.type).toBe('CROSSOVER');
      expect(node.series1).toEqual(series1);
      expect(node.series2).toEqual(series2);
      expect(node.id).toBeDefined();
    });
  });

  describe('createCrossunderNode', () => {
    it('creates a crossunder node with two series', () => {
      const series1: IndicatorOperand = { type: 'INDICATOR', indicatorId: 'ema_fast' };
      const series2: IndicatorOperand = { type: 'INDICATOR', indicatorId: 'ema_slow' };

      const node = createCrossunderNode(series1, series2);

      expect(node.type).toBe('CROSSUNDER');
      expect(node.series1).toEqual(series1);
      expect(node.series2).toEqual(series2);
      expect(node.id).toBeDefined();
    });
  });

  describe('createDefaultUIBuilderConfig', () => {
    it('creates a valid default config', () => {
      const config = createDefaultUIBuilderConfig();

      expect(config.version).toBe(2);
      expect(config.schema_version).toBe('2.0.0');
      expect(config.indicators).toEqual([]);
      expect(config.position_mode).toBe('LONG_ONLY');
      expect(config.long?.entry_conditions.type).toBe('AND');
      expect(config.long?.exit_conditions.type).toBe('AND');
    });

    it('creates config with correct default parameters', () => {
      const config = createDefaultUIBuilderConfig();

      expect(config.parameters.stoploss).toBe(-0.10);
      expect(config.parameters.trailing_stop).toBe(false);
      expect(config.parameters.use_exit_signal).toBe(true);
      expect(config.parameters.minimal_roi).toEqual({
        '0': 0.10,
        '30': 0.05,
        '60': 0.02,
      });
    });

    it('creates config with empty callbacks', () => {
      const config = createDefaultUIBuilderConfig();

      expect(config.callbacks).toEqual({});
    });

    it('creates unique IDs for each call', () => {
      const config1 = createDefaultUIBuilderConfig();
      const config2 = createDefaultUIBuilderConfig();

      expect(config1.long?.entry_conditions.id).not.toBe(config2.long?.entry_conditions.id);
      expect(config1.long?.exit_conditions.id).not.toBe(config2.long?.exit_conditions.id);
    });
  });

  describe('Type Guards', () => {
    // Create sample nodes for testing
    const andNode: AndNode = { id: '1', type: 'AND', children: [] };
    const orNode: OrNode = { id: '2', type: 'OR', children: [] };
    const notNode: NotNode = {
      id: '3',
      type: 'NOT',
      child: { id: '3a', type: 'AND', children: [] },
    };
    const compareNode: CompareNode = {
      id: '4',
      type: 'COMPARE',
      left: { type: 'CONSTANT', value: 1 },
      operator: 'eq',
      right: { type: 'CONSTANT', value: 1 },
    };
    const crossoverNode: CrossoverNode = {
      id: '5',
      type: 'CROSSOVER',
      series1: { type: 'INDICATOR', indicatorId: 'a' },
      series2: { type: 'INDICATOR', indicatorId: 'b' },
    };
    const crossunderNode: CrossunderNode = {
      id: '6',
      type: 'CROSSUNDER',
      series1: { type: 'INDICATOR', indicatorId: 'a' },
      series2: { type: 'INDICATOR', indicatorId: 'b' },
    };
    const inRangeNode: InRangeNode = {
      id: '7',
      type: 'IN_RANGE',
      value: { type: 'INDICATOR', indicatorId: 'rsi' },
      min: { type: 'CONSTANT', value: 30 },
      max: { type: 'CONSTANT', value: 70 },
    };
    const ifThenElseNode: IfThenElseNode = {
      id: '8',
      type: 'IF_THEN_ELSE',
      condition: compareNode,
      then: andNode,
    };

    describe('isAndNode', () => {
      it('returns true for AND nodes', () => {
        expect(isAndNode(andNode)).toBe(true);
      });

      it('returns false for other node types', () => {
        expect(isAndNode(orNode)).toBe(false);
        expect(isAndNode(notNode)).toBe(false);
        expect(isAndNode(compareNode)).toBe(false);
      });
    });

    describe('isOrNode', () => {
      it('returns true for OR nodes', () => {
        expect(isOrNode(orNode)).toBe(true);
      });

      it('returns false for other node types', () => {
        expect(isOrNode(andNode)).toBe(false);
        expect(isOrNode(compareNode)).toBe(false);
      });
    });

    describe('isNotNode', () => {
      it('returns true for NOT nodes', () => {
        expect(isNotNode(notNode)).toBe(true);
      });

      it('returns false for other node types', () => {
        expect(isNotNode(andNode)).toBe(false);
        expect(isNotNode(orNode)).toBe(false);
      });
    });

    describe('isIfThenElseNode', () => {
      it('returns true for IF_THEN_ELSE nodes', () => {
        expect(isIfThenElseNode(ifThenElseNode)).toBe(true);
      });

      it('returns false for other node types', () => {
        expect(isIfThenElseNode(andNode)).toBe(false);
        expect(isIfThenElseNode(compareNode)).toBe(false);
      });
    });

    describe('isCompareNode', () => {
      it('returns true for COMPARE nodes', () => {
        expect(isCompareNode(compareNode)).toBe(true);
      });

      it('returns false for other node types', () => {
        expect(isCompareNode(andNode)).toBe(false);
        expect(isCompareNode(crossoverNode)).toBe(false);
      });
    });

    describe('isCrossoverNode', () => {
      it('returns true for CROSSOVER nodes', () => {
        expect(isCrossoverNode(crossoverNode)).toBe(true);
      });

      it('returns false for other node types', () => {
        expect(isCrossoverNode(crossunderNode)).toBe(false);
        expect(isCrossoverNode(compareNode)).toBe(false);
      });
    });

    describe('isCrossunderNode', () => {
      it('returns true for CROSSUNDER nodes', () => {
        expect(isCrossunderNode(crossunderNode)).toBe(true);
      });

      it('returns false for other node types', () => {
        expect(isCrossunderNode(crossoverNode)).toBe(false);
        expect(isCrossunderNode(compareNode)).toBe(false);
      });
    });

    describe('isInRangeNode', () => {
      it('returns true for IN_RANGE nodes', () => {
        expect(isInRangeNode(inRangeNode)).toBe(true);
      });

      it('returns false for other node types', () => {
        expect(isInRangeNode(compareNode)).toBe(false);
        expect(isInRangeNode(andNode)).toBe(false);
      });
    });

    describe('isLogicalNode', () => {
      it('returns true for AND nodes', () => {
        expect(isLogicalNode(andNode)).toBe(true);
      });

      it('returns true for OR nodes', () => {
        expect(isLogicalNode(orNode)).toBe(true);
      });

      it('returns false for non-logical nodes', () => {
        expect(isLogicalNode(notNode)).toBe(false);
        expect(isLogicalNode(compareNode)).toBe(false);
        expect(isLogicalNode(crossoverNode)).toBe(false);
      });
    });

    describe('hasChildren', () => {
      it('returns true for AND nodes', () => {
        expect(hasChildren(andNode)).toBe(true);
      });

      it('returns true for OR nodes', () => {
        expect(hasChildren(orNode)).toBe(true);
      });

      it('returns false for nodes without children array', () => {
        expect(hasChildren(notNode)).toBe(false);
        expect(hasChildren(compareNode)).toBe(false);
        expect(hasChildren(ifThenElseNode)).toBe(false);
      });
    });
  });

  describe('OPERATOR_LABELS and OPERATOR_SYMBOLS', () => {
    it('should have labels for all operators', async () => {
      const { OPERATOR_LABELS } = await import('./types');

      expect(OPERATOR_LABELS.eq).toBe('equals');
      expect(OPERATOR_LABELS.neq).toBe('not equals');
      expect(OPERATOR_LABELS.gt).toBe('greater than');
      expect(OPERATOR_LABELS.gte).toBe('greater than or equal');
      expect(OPERATOR_LABELS.lt).toBe('less than');
      expect(OPERATOR_LABELS.lte).toBe('less than or equal');
      expect(OPERATOR_LABELS.in).toBe('in');
      expect(OPERATOR_LABELS.not_in).toBe('not in');
    });

    it('should have symbols for all operators', async () => {
      const { OPERATOR_SYMBOLS } = await import('./types');

      expect(OPERATOR_SYMBOLS.eq).toBe('=');
      expect(OPERATOR_SYMBOLS.neq).toBe('!=');
      expect(OPERATOR_SYMBOLS.gt).toBe('>');
      expect(OPERATOR_SYMBOLS.gte).toBe('>=');
      expect(OPERATOR_SYMBOLS.lt).toBe('<');
      expect(OPERATOR_SYMBOLS.lte).toBe('<=');
      expect(OPERATOR_SYMBOLS.in).toBe('in');
      expect(OPERATOR_SYMBOLS.not_in).toBe('not in');
    });
  });
});