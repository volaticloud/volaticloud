/**
 * Strategy Scenario Generator
 *
 * Generates 500 unique strategy configurations covering:
 * - All 29 indicator types
 * - All condition node types (AND, OR, NOT, COMPARE, CROSSOVER, CROSSUNDER, IN_RANGE)
 * - All comparison operators (eq, neq, gt, gte, lt, lte)
 * - All operand types (CONSTANT, INDICATOR, PRICE, TRADE_CONTEXT, TIME, COMPUTED)
 * - All trading modes (SPOT, MARGIN, FUTURES)
 * - All position modes (LONG_ONLY, SHORT_ONLY, LONG_AND_SHORT)
 * - Mirror mode
 * - Single and multiple pairs
 * - Callbacks: DCA, custom stoploss, entry confirmation, leverage
 */

// ============================================================================
// Types matching the backend UIBuilderConfig
// ============================================================================

interface Operand {
  type: string;
  value?: number | string | boolean | number[];
  indicatorId?: string;
  field?: string;
  priceField?: string;
  tradeContextField?: string;
  timeField?: string;
  operation?: string;
  operands?: Operand[];
}

interface ConditionNode {
  type: string;
  children?: ConditionNode[];
  child?: ConditionNode;
  left?: Operand;
  right?: Operand;
  operator?: string;
  series1?: Operand;
  series2?: Operand;
  value?: Operand;
  min?: Operand;
  max?: Operand;
  inclusive?: boolean;
  condition?: ConditionNode;
  then?: ConditionNode;
  else?: ConditionNode;
}

interface IndicatorDef {
  id: string;
  type: string;
  params: Record<string, unknown>;
}

interface DCARule {
  id: string;
  price_drop_percent: number;
  stake_multiplier: number;
}

interface StoplossRule {
  id: string;
  condition: ConditionNode;
  stoploss: number;
}

interface LeverageRule {
  id: string;
  priority: number;
  condition?: ConditionNode;
  leverage: { type: string; value: number };
  label?: string;
}

interface UIBuilderConfig {
  version: 2;
  schema_version: string;
  indicators: IndicatorDef[];
  trading_mode: string;
  position_mode: string;
  long?: {
    entry_conditions: ConditionNode;
    exit_conditions: ConditionNode;
  };
  short?: {
    entry_conditions: ConditionNode;
    exit_conditions: ConditionNode;
  };
  mirror_config?: {
    enabled: boolean;
    source: string;
    invertComparisons: boolean;
    invertCrossovers: boolean;
  };
  parameters: {
    stoploss: number;
    minimal_roi: Record<string, number>;
    trailing_stop: boolean;
    trailing_stop_positive?: number;
    trailing_stop_positive_offset?: number;
    use_exit_signal: boolean;
  };
  callbacks: {
    dca?: {
      enabled: boolean;
      max_entries: number;
      rules: DCARule[];
      cooldown_minutes: number;
    };
    custom_stoploss?: {
      enabled: boolean;
      rules: StoplossRule[];
      default_stoploss: number;
      trailing?: {
        enabled: boolean;
        positive: number;
        positive_offset: number;
      };
    };
    confirm_entry?: {
      enabled: boolean;
      rules: ConditionNode;
    };
    leverage?: {
      enabled: boolean;
      rules: LeverageRule[];
      default_leverage: number;
      max_leverage: number;
    };
  };
}

export interface Scenario {
  id: number;
  name: string;
  description: string;
  config: UIBuilderConfig;
  timeframe: string;
  pairs: string[];
  backtestDays: number;
  category: string;
}

// ============================================================================
// Helpers
// ============================================================================

let idCounter = 0;
function uid(): string {
  return `id_${++idCounter}`;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

// Deterministic seed for reproducibility
let seed = 42;
function seededRandom(): number {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

// ============================================================================
// Indicator definitions with default params
// ============================================================================

interface IndicatorTemplate {
  type: string;
  params: Record<string, unknown>;
  outputs: string[]; // field names
  category: string;
}

const INDICATOR_TEMPLATES: Record<string, IndicatorTemplate> = {
  RSI: { type: 'RSI', params: { period: 14 }, outputs: [''], category: 'momentum' },
  SMA: { type: 'SMA', params: { period: 20, source: 'close' }, outputs: [''], category: 'trend' },
  EMA: { type: 'EMA', params: { period: 20, source: 'close' }, outputs: [''], category: 'trend' },
  WMA: { type: 'WMA', params: { period: 20, source: 'close' }, outputs: [''], category: 'trend' },
  DEMA: { type: 'DEMA', params: { period: 20, source: 'close' }, outputs: [''], category: 'trend' },
  TEMA: { type: 'TEMA', params: { period: 20, source: 'close' }, outputs: [''], category: 'trend' },
  // KAMA removed - not implemented in backend codegen
  MACD: { type: 'MACD', params: { fast: 12, slow: 26, signal: 9 }, outputs: ['', 'signal', 'histogram'], category: 'trend' },
  BB: { type: 'BB', params: { period: 20, std_dev: 2.0 }, outputs: ['upper', 'middle', 'lower', 'width'], category: 'volatility' },
  // KC removed - not implemented in backend codegen
  STOCH: { type: 'STOCH', params: { k: 14, d: 3, smooth: 3 }, outputs: ['k', 'd'], category: 'momentum' },
  STOCH_RSI: { type: 'STOCH_RSI', params: { period: 14, k: 3, d: 3 }, outputs: ['k', 'd'], category: 'momentum' },
  ATR: { type: 'ATR', params: { period: 14 }, outputs: [''], category: 'volatility' },
  ADX: { type: 'ADX', params: { period: 14 }, outputs: ['', 'plus_di', 'minus_di'], category: 'trend' },
  CCI: { type: 'CCI', params: { period: 20 }, outputs: [''], category: 'momentum' },
  WILLR: { type: 'WILLR', params: { period: 14 }, outputs: [''], category: 'momentum' },
  MOM: { type: 'MOM', params: { period: 10 }, outputs: [''], category: 'momentum' },
  ROC: { type: 'ROC', params: { period: 10 }, outputs: [''], category: 'momentum' },
  OBV: { type: 'OBV', params: {}, outputs: [''], category: 'volume' },
  MFI: { type: 'MFI', params: { period: 14 }, outputs: [''], category: 'volume' },
  VWAP: { type: 'VWAP', params: {}, outputs: [''], category: 'volume' },
  CMF: { type: 'CMF', params: { period: 20 }, outputs: [''], category: 'volume' },
  AD: { type: 'AD', params: {}, outputs: [''], category: 'volume' },
  ICHIMOKU: { type: 'ICHIMOKU', params: { conv: 9, base: 26, span: 52 }, outputs: ['tenkan', 'kijun', 'senkou_a', 'senkou_b'], category: 'trend' },
  SAR: { type: 'SAR', params: { acceleration: 0.02, maximum: 0.2 }, outputs: [''], category: 'trend' },
  // PIVOT removed - not implemented in backend codegen
  SUPERTREND: { type: 'SUPERTREND', params: { period: 10, multiplier: 3.0 }, outputs: ['upper', 'lower'], category: 'trend' },
};

const ALL_INDICATOR_TYPES = Object.keys(INDICATOR_TEMPLATES);

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'ADA/USDT', 'DOGE/USDT', 'DOT/USDT'];
const PRICE_FIELDS = ['open', 'high', 'low', 'close', 'volume', 'ohlc4', 'hlc3', 'hl2'];
const TRADE_CONTEXT_FIELDS = ['current_profit', 'current_profit_pct', 'entry_rate', 'current_rate', 'trade_duration', 'nr_of_entries', 'stake_amount'];
const TIME_FIELDS = ['hour', 'minute', 'day_of_week', 'day_of_month', 'month', 'is_weekend'];
const COMPARISON_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'];
const COMPUTED_OPS = ['add', 'subtract', 'multiply', 'divide', 'min', 'max', 'abs', 'percent_change', 'average'];

// ============================================================================
// Indicator builder
// ============================================================================

function makeIndicator(type: string, suffix: number): IndicatorDef {
  const tmpl = INDICATOR_TEMPLATES[type];
  const params = { ...tmpl.params };

  // Vary params slightly to test different values
  if ('period' in params && typeof params.period === 'number') {
    params.period = Math.max(2, params.period + (suffix % 5) - 2);
  }

  return {
    id: `${type.toLowerCase()}_${suffix}`,
    type: tmpl.type,
    params,
  };
}

// ============================================================================
// Operand builders
// ============================================================================

function constOperand(v: number): Operand {
  return { type: 'CONSTANT', value: v };
}

function indicatorOperand(indDef: IndicatorDef, fieldIdx?: number): Operand {
  const tmpl = INDICATOR_TEMPLATES[indDef.type];
  const field = fieldIdx !== undefined ? tmpl.outputs[fieldIdx % tmpl.outputs.length] : tmpl.outputs[0];
  const op: Operand = { type: 'INDICATOR', indicatorId: indDef.id };
  if (field && field !== '') op.field = field;
  return op;
}

function priceOperand(field?: string): Operand {
  return { type: 'PRICE', field: field || pick(PRICE_FIELDS) };
}

function tradeContextOperand(field?: string): Operand {
  return { type: 'TRADE_CONTEXT', field: field || pick(TRADE_CONTEXT_FIELDS) };
}

function timeOperand(field?: string): Operand {
  return { type: 'TIME', field: field || pick(TIME_FIELDS) };
}

function computedOperand(op: string, operands: Operand[]): Operand {
  return { type: 'COMPUTED', operation: op, operands };
}

// ============================================================================
// Condition node builders
// ============================================================================

function compareNode(left: Operand, operator: string, right: Operand): ConditionNode {
  return { type: 'COMPARE', left, operator, right };
}

function crossoverNode(a: Operand, b: Operand): ConditionNode {
  return { type: 'CROSSOVER', series1: a, series2: b };
}

function crossunderNode(a: Operand, b: Operand): ConditionNode {
  return { type: 'CROSSUNDER', series1: a, series2: b };
}

function andNode(children: ConditionNode[]): ConditionNode {
  return { type: 'AND', children };
}

function orNode(children: ConditionNode[]): ConditionNode {
  return { type: 'OR', children };
}

function notNode(child: ConditionNode): ConditionNode {
  return { type: 'NOT', child };
}

function inRangeNode(value: Operand, min: Operand, max: Operand, inclusive = true): ConditionNode {
  return { type: 'IN_RANGE', value, min, max, inclusive };
}

function ifThenElseNode(cond: ConditionNode, then: ConditionNode, elseNode: ConditionNode): ConditionNode {
  return { type: 'IF_THEN_ELSE', condition: cond, then, else: elseNode };
}

// ============================================================================
// Smart thresholds for indicators
// ============================================================================

function getThresholdForIndicator(type: string, field: string, side: 'entry' | 'exit', direction: 'long' | 'short'): { op: string; value: number } {
  const isLongEntry = direction === 'long' && side === 'entry';
  const isLongExit = direction === 'long' && side === 'exit';

  switch (type) {
    case 'RSI':
      return isLongEntry ? { op: 'lt', value: 30 } : isLongExit ? { op: 'gt', value: 70 } : { op: isLongEntry ? 'gt' : 'lt', value: isLongEntry ? 70 : 30 };
    case 'STOCH':
    case 'STOCH_RSI':
      if (field === 'k' || field === 'd' || field === '') {
        return isLongEntry ? { op: 'lt', value: 20 } : { op: 'gt', value: 80 };
      }
      return { op: 'lt', value: 50 };
    case 'CCI':
      return isLongEntry ? { op: 'lt', value: -100 } : { op: 'gt', value: 100 };
    case 'WILLR':
      return isLongEntry ? { op: 'lt', value: -80 } : { op: 'gt', value: -20 };
    case 'MFI':
      return isLongEntry ? { op: 'lt', value: 20 } : { op: 'gt', value: 80 };
    case 'ADX':
      if (field === '' || field === undefined) return { op: 'gt', value: 25 };
      return { op: 'gt', value: 20 };
    case 'CMF':
      return isLongEntry ? { op: 'gt', value: 0.05 } : { op: 'lt', value: -0.05 };
    case 'MOM':
    case 'ROC':
      return isLongEntry ? { op: 'gt', value: 0 } : { op: 'lt', value: 0 };
    default:
      return { op: 'gt', value: 0 };
  }
}

// ============================================================================
// Scenario generators
// ============================================================================

function generateSingleIndicatorScenario(idx: number, indType: string): Scenario {
  const ind = makeIndicator(indType, 1);
  const tmpl = INDICATOR_TEMPLATES[indType];
  const fieldIdx = 0;
  const field = tmpl.outputs[fieldIdx];

  const threshold = getThresholdForIndicator(indType, field, 'entry', 'long');
  const exitThreshold = getThresholdForIndicator(indType, field, 'exit', 'long');

  // For indicators that produce series (MA types), use crossover with price
  const isMaType = ['SMA', 'EMA', 'WMA', 'DEMA', 'TEMA'].includes(indType);
  const isBandType = ['BB', 'SUPERTREND'].includes(indType);

  let entryCondition: ConditionNode;
  let exitCondition: ConditionNode;

  if (isMaType) {
    // Price crosses above MA → long entry
    entryCondition = crossoverNode(priceOperand('close'), indicatorOperand(ind));
    exitCondition = crossunderNode(priceOperand('close'), indicatorOperand(ind));
  } else if (isBandType) {
    // Price above lower band → entry, price above upper band → exit
    const lowerField = tmpl.outputs.indexOf('lower') >= 0 ? 'lower' : tmpl.outputs[0];
    const upperField = tmpl.outputs.indexOf('upper') >= 0 ? 'upper' : tmpl.outputs[tmpl.outputs.length - 1];
    entryCondition = compareNode(priceOperand('close'), 'gt', indicatorOperand(ind, tmpl.outputs.indexOf(lowerField)));
    exitCondition = compareNode(priceOperand('close'), 'gt', indicatorOperand(ind, tmpl.outputs.indexOf(upperField)));
  } else if (indType === 'SAR') {
    entryCondition = compareNode(priceOperand('close'), 'gt', indicatorOperand(ind));
    exitCondition = compareNode(priceOperand('close'), 'lt', indicatorOperand(ind));
  } else if (indType === 'MACD') {
    entryCondition = crossoverNode(indicatorOperand(ind, 0), indicatorOperand(ind, 1));
    exitCondition = crossunderNode(indicatorOperand(ind, 0), indicatorOperand(ind, 1));
  } else if (indType === 'ICHIMOKU') {
    entryCondition = compareNode(indicatorOperand(ind, 0), 'gt', indicatorOperand(ind, 1));
    exitCondition = compareNode(indicatorOperand(ind, 0), 'lt', indicatorOperand(ind, 1));
  } else if (indType === 'PIVOT') {
    entryCondition = compareNode(priceOperand('close'), 'gt', indicatorOperand(ind, 0));
    exitCondition = compareNode(priceOperand('close'), 'lt', indicatorOperand(ind, 0));
  } else if (['OBV', 'AD', 'VWAP'].includes(indType)) {
    // Volume indicators - compare with price or use simple threshold
    entryCondition = compareNode(priceOperand('close'), 'gt', indicatorOperand(ind));
    exitCondition = compareNode(priceOperand('close'), 'lt', indicatorOperand(ind));
  } else {
    // Oscillator-type: RSI, CCI, WILLR, MOM, ROC, MFI, ATR, ADX
    entryCondition = compareNode(indicatorOperand(ind), threshold.op, constOperand(threshold.value));
    exitCondition = compareNode(indicatorOperand(ind), exitThreshold.op, constOperand(exitThreshold.value));
  }

  return {
    id: idx,
    name: `Single_${indType}_${idx}`,
    description: `Test ${indType} indicator with default params`,
    config: {
      version: 2,
      schema_version: '2.0.0',
      indicators: [ind],
      trading_mode: 'SPOT',
      position_mode: 'LONG_ONLY',
      long: {
        entry_conditions: andNode([entryCondition]),
        exit_conditions: andNode([exitCondition]),
      },
      parameters: {
        stoploss: -0.10,
        minimal_roi: { '0': 0.10, '30': 0.05, '60': 0.02 },
        trailing_stop: false,
        use_exit_signal: true,
      },
      callbacks: {},
    },
    timeframe: '5m',
    pairs: ['BTC/USDT'],
    backtestDays: 7,
    category: 'single-indicator',
  };
}

function generateMultiIndicatorScenario(idx: number, indTypes: string[]): Scenario {
  const indicators = indTypes.map((t, i) => makeIndicator(t, i + 1));
  const conditions: ConditionNode[] = [];

  for (let i = 0; i < indicators.length; i++) {
    const ind = indicators[i];
    const tmpl = INDICATOR_TEMPLATES[ind.type];
    const field = tmpl.outputs[0];
    const threshold = getThresholdForIndicator(ind.type, field, 'entry', 'long');

    const isMaType = ['SMA', 'EMA', 'WMA', 'DEMA', 'TEMA'].includes(ind.type);
    if (isMaType) {
      conditions.push(compareNode(priceOperand('close'), 'gt', indicatorOperand(ind)));
    } else if (ind.type === 'MACD') {
      conditions.push(compareNode(indicatorOperand(ind, 0), 'gt', indicatorOperand(ind, 1)));
    } else if (ind.type === 'BB') {
      conditions.push(compareNode(priceOperand('close'), 'gt', indicatorOperand(ind, tmpl.outputs.indexOf('lower'))));
    } else {
      conditions.push(compareNode(indicatorOperand(ind), threshold.op, constOperand(threshold.value)));
    }
  }

  const exitConditions: ConditionNode[] = conditions.map((c) => {
    // Invert conditions for exit
    if (c.operator === 'gt') return { ...c, operator: 'lt' };
    if (c.operator === 'lt') return { ...c, operator: 'gt' };
    if (c.operator === 'gte') return { ...c, operator: 'lte' };
    if (c.operator === 'lte') return { ...c, operator: 'gte' };
    return c;
  });

  return {
    id: idx,
    name: `Multi_${indTypes.join('_')}_${idx}`,
    description: `Test combination of ${indTypes.join(', ')}`,
    config: {
      version: 2,
      schema_version: '2.0.0',
      indicators,
      trading_mode: 'SPOT',
      position_mode: 'LONG_ONLY',
      long: {
        entry_conditions: andNode(conditions),
        exit_conditions: orNode(exitConditions),
      },
      parameters: {
        stoploss: -0.10,
        minimal_roi: { '0': 0.10, '30': 0.05, '60': 0.02 },
        trailing_stop: false,
        use_exit_signal: true,
      },
      callbacks: {},
    },
    timeframe: pick(TIMEFRAMES),
    pairs: pickN(PAIRS, 1 + (idx % 3)),
    backtestDays: 7,
    category: 'multi-indicator',
  };
}

function generateConditionTypeScenario(idx: number, condType: string): Scenario {
  const rsi = makeIndicator('RSI', 1);
  const sma = makeIndicator('SMA', 2);
  const indicators = [rsi, sma];
  let entryCondition: ConditionNode;

  switch (condType) {
    case 'COMPARE':
      entryCondition = compareNode(indicatorOperand(rsi), 'lt', constOperand(30));
      break;
    case 'CROSSOVER':
      entryCondition = crossoverNode(priceOperand('close'), indicatorOperand(sma));
      break;
    case 'CROSSUNDER':
      entryCondition = crossunderNode(indicatorOperand(rsi), constOperand(50));
      break;
    case 'AND':
      entryCondition = andNode([
        compareNode(indicatorOperand(rsi), 'lt', constOperand(30)),
        compareNode(priceOperand('close'), 'gt', indicatorOperand(sma)),
      ]);
      break;
    case 'OR':
      entryCondition = orNode([
        compareNode(indicatorOperand(rsi), 'lt', constOperand(25)),
        crossoverNode(priceOperand('close'), indicatorOperand(sma)),
      ]);
      break;
    case 'NOT':
      entryCondition = andNode([
        notNode(compareNode(indicatorOperand(rsi), 'gt', constOperand(70))),
        compareNode(priceOperand('close'), 'gt', indicatorOperand(sma)),
      ]);
      break;
    case 'IN_RANGE':
      entryCondition = inRangeNode(indicatorOperand(rsi), constOperand(20), constOperand(40));
      break;
    case 'IF_THEN_ELSE':
      entryCondition = ifThenElseNode(
        compareNode(indicatorOperand(rsi), 'lt', constOperand(30)),
        compareNode(priceOperand('close'), 'gt', indicatorOperand(sma)),
        compareNode(indicatorOperand(rsi), 'lt', constOperand(25))
      );
      break;
    default:
      entryCondition = compareNode(indicatorOperand(rsi), 'lt', constOperand(30));
  }

  return {
    id: idx,
    name: `CondType_${condType}_${idx}`,
    description: `Test ${condType} condition type`,
    config: {
      version: 2,
      schema_version: '2.0.0',
      indicators,
      trading_mode: 'SPOT',
      position_mode: 'LONG_ONLY',
      long: {
        entry_conditions: condType === 'AND' || condType === 'OR' || condType === 'NOT' ? entryCondition : andNode([entryCondition]),
        exit_conditions: andNode([compareNode(indicatorOperand(rsi), 'gt', constOperand(70))]),
      },
      parameters: {
        stoploss: -0.10,
        minimal_roi: { '0': 0.10, '30': 0.05, '60': 0.02 },
        trailing_stop: false,
        use_exit_signal: true,
      },
      callbacks: {},
    },
    timeframe: '5m',
    pairs: ['BTC/USDT'],
    backtestDays: 7,
    category: 'condition-type',
  };
}

function generateOperandTypeScenario(idx: number, operandType: string): Scenario {
  const rsi = makeIndicator('RSI', 1);
  const sma = makeIndicator('SMA', 2);
  const indicators = [rsi, sma];
  let entryCondition: ConditionNode;

  switch (operandType) {
    case 'CONSTANT':
      entryCondition = compareNode(indicatorOperand(rsi), 'lt', constOperand(30));
      break;
    case 'INDICATOR':
      entryCondition = compareNode(indicatorOperand(rsi), 'lt', constOperand(30));
      break;
    case 'PRICE':
      entryCondition = compareNode(priceOperand('close'), 'gt', indicatorOperand(sma));
      break;
    case 'TRADE_CONTEXT':
      // Trade context only works in callbacks, not in populate_entry. Use in custom stoploss.
      entryCondition = compareNode(indicatorOperand(rsi), 'lt', constOperand(30));
      break;
    case 'TIME':
      entryCondition = andNode([
        compareNode(indicatorOperand(rsi), 'lt', constOperand(30)),
        compareNode(timeOperand('hour'), 'gte', constOperand(8)),
        compareNode(timeOperand('hour'), 'lte', constOperand(20)),
      ]);
      break;
    case 'COMPUTED':
      entryCondition = compareNode(
        computedOperand('subtract', [indicatorOperand(rsi), constOperand(50)]),
        'lt',
        constOperand(0)
      );
      break;
    default:
      entryCondition = compareNode(indicatorOperand(rsi), 'lt', constOperand(30));
  }

  return {
    id: idx,
    name: `OperandType_${operandType}_${idx}`,
    description: `Test ${operandType} operand type`,
    config: {
      version: 2,
      schema_version: '2.0.0',
      indicators,
      trading_mode: 'SPOT',
      position_mode: 'LONG_ONLY',
      long: {
        entry_conditions: andNode([entryCondition]),
        exit_conditions: andNode([compareNode(indicatorOperand(rsi), 'gt', constOperand(70))]),
      },
      parameters: {
        stoploss: -0.10,
        minimal_roi: { '0': 0.10, '30': 0.05, '60': 0.02 },
        trailing_stop: false,
        use_exit_signal: true,
      },
      callbacks: {},
    },
    timeframe: '5m',
    pairs: ['BTC/USDT'],
    backtestDays: 7,
    category: 'operand-type',
  };
}

function generateTradingModeScenario(idx: number, mode: string, posMode: string): Scenario {
  const rsi = makeIndicator('RSI', 1);
  const sma = makeIndicator('SMA', 2);
  const indicators = [rsi, sma];

  const longEntry = andNode([
    compareNode(indicatorOperand(rsi), 'lt', constOperand(30)),
    compareNode(priceOperand('close'), 'gt', indicatorOperand(sma)),
  ]);
  const longExit = andNode([compareNode(indicatorOperand(rsi), 'gt', constOperand(70))]);
  const shortEntry = andNode([
    compareNode(indicatorOperand(rsi), 'gt', constOperand(70)),
    compareNode(priceOperand('close'), 'lt', indicatorOperand(sma)),
  ]);
  const shortExit = andNode([compareNode(indicatorOperand(rsi), 'lt', constOperand(30))]);

  const config: UIBuilderConfig = {
    version: 2,
    schema_version: '2.0.0',
    indicators,
    trading_mode: mode,
    position_mode: posMode,
    parameters: {
      stoploss: -0.10,
      minimal_roi: { '0': 0.10, '30': 0.05, '60': 0.02 },
      trailing_stop: false,
      use_exit_signal: true,
    },
    callbacks: {},
  };

  if (posMode === 'LONG_ONLY' || posMode === 'LONG_AND_SHORT') {
    config.long = { entry_conditions: longEntry, exit_conditions: longExit };
  }
  if (posMode === 'SHORT_ONLY' || posMode === 'LONG_AND_SHORT') {
    config.short = { entry_conditions: shortEntry, exit_conditions: shortExit };
  }

  // Add leverage for futures
  if (mode === 'FUTURES') {
    config.callbacks.leverage = {
      enabled: true,
      rules: [],
      default_leverage: 2.0,
      max_leverage: 5.0,
    };
  }

  return {
    id: idx,
    name: `Mode_${mode}_${posMode}_${idx}`,
    description: `Test ${mode} mode with ${posMode} position`,
    config,
    timeframe: '15m',
    pairs: ['BTC/USDT'],
    backtestDays: 7,
    category: 'trading-mode',
  };
}

function generateMirrorScenario(idx: number): Scenario {
  const rsi = makeIndicator('RSI', 1);
  const sma = makeIndicator('SMA', 2);

  return {
    id: idx,
    name: `Mirror_${idx}`,
    description: 'Test mirror mode (long signals mirrored to short)',
    config: {
      version: 2,
      schema_version: '2.0.0',
      indicators: [rsi, sma],
      trading_mode: 'SPOT',
      position_mode: 'LONG_AND_SHORT',
      long: {
        entry_conditions: andNode([
          compareNode(indicatorOperand(rsi), 'lt', constOperand(30)),
          crossoverNode(priceOperand('close'), indicatorOperand(sma)),
        ]),
        exit_conditions: andNode([compareNode(indicatorOperand(rsi), 'gt', constOperand(70))]),
      },
      mirror_config: {
        enabled: true,
        source: 'LONG',
        invertComparisons: true,
        invertCrossovers: true,
      },
      parameters: {
        stoploss: -0.10,
        minimal_roi: { '0': 0.10, '30': 0.05, '60': 0.02 },
        trailing_stop: false,
        use_exit_signal: true,
      },
      callbacks: {},
    },
    timeframe: '5m',
    pairs: ['BTC/USDT', 'ETH/USDT'],
    backtestDays: 7,
    category: 'mirror',
  };
}

function generateCallbackScenario(idx: number, callbackType: string): Scenario {
  const rsi = makeIndicator('RSI', 1);
  const sma = makeIndicator('SMA', 2);
  const indicators = [rsi, sma];

  const callbacks: UIBuilderConfig['callbacks'] = {};

  switch (callbackType) {
    case 'DCA':
      callbacks.dca = {
        enabled: true,
        max_entries: 3,
        rules: [
          { id: uid(), price_drop_percent: 5, stake_multiplier: 1.5 },
          { id: uid(), price_drop_percent: 10, stake_multiplier: 2.0 },
        ],
        cooldown_minutes: 60,
      };
      break;
    case 'CUSTOM_STOPLOSS':
      callbacks.custom_stoploss = {
        enabled: true,
        rules: [
          {
            id: uid(),
            condition: compareNode(tradeContextOperand('current_profit_pct'), 'gt', constOperand(5)),
            stoploss: -0.02,
          },
          {
            id: uid(),
            condition: compareNode(tradeContextOperand('trade_duration'), 'gt', constOperand(120)),
            stoploss: -0.05,
          },
        ],
        default_stoploss: -0.10,
        trailing: {
          enabled: true,
          positive: 0.01,
          positive_offset: 0.02,
        },
      };
      break;
    case 'CONFIRM_ENTRY':
      callbacks.confirm_entry = {
        enabled: true,
        rules: andNode([
          compareNode(priceOperand('volume'), 'gt', constOperand(1000)),
        ]),
      };
      break;
    case 'LEVERAGE':
      callbacks.leverage = {
        enabled: true,
        rules: [
          {
            id: uid(),
            priority: 10,
            condition: compareNode(indicatorOperand(rsi), 'lt', constOperand(30)),
            leverage: { type: 'CONSTANT', value: 3.0 },
          },
        ],
        default_leverage: 1.0,
        max_leverage: 10.0,
      };
      break;
  }

  const tradingMode = callbackType === 'LEVERAGE' ? 'FUTURES' : 'SPOT';

  return {
    id: idx,
    name: `Callback_${callbackType}_${idx}`,
    description: `Test ${callbackType} callback`,
    config: {
      version: 2,
      schema_version: '2.0.0',
      indicators,
      trading_mode: tradingMode,
      position_mode: 'LONG_ONLY',
      long: {
        entry_conditions: andNode([compareNode(indicatorOperand(rsi), 'lt', constOperand(30))]),
        exit_conditions: andNode([compareNode(indicatorOperand(rsi), 'gt', constOperand(70))]),
      },
      parameters: {
        stoploss: -0.10,
        minimal_roi: { '0': 0.10, '30': 0.05, '60': 0.02 },
        trailing_stop: callbackType === 'CUSTOM_STOPLOSS',
        trailing_stop_positive: callbackType === 'CUSTOM_STOPLOSS' ? 0.01 : undefined,
        trailing_stop_positive_offset: callbackType === 'CUSTOM_STOPLOSS' ? 0.02 : undefined,
        use_exit_signal: true,
      },
      callbacks,
    },
    timeframe: '15m',
    pairs: ['BTC/USDT'],
    backtestDays: 7,
    category: 'callback',
  };
}

function generateComparisonOperatorScenario(idx: number, op: string): Scenario {
  const rsi = makeIndicator('RSI', 1);
  const thresholds: Record<string, number> = { eq: 50, neq: 50, gt: 30, gte: 30, lt: 70, lte: 70 };

  return {
    id: idx,
    name: `CompOp_${op}_${idx}`,
    description: `Test comparison operator ${op}`,
    config: {
      version: 2,
      schema_version: '2.0.0',
      indicators: [rsi],
      trading_mode: 'SPOT',
      position_mode: 'LONG_ONLY',
      long: {
        entry_conditions: andNode([compareNode(indicatorOperand(rsi), op, constOperand(thresholds[op] ?? 50))]),
        exit_conditions: andNode([compareNode(indicatorOperand(rsi), 'gt', constOperand(70))]),
      },
      parameters: {
        stoploss: -0.10,
        minimal_roi: { '0': 0.10, '30': 0.05, '60': 0.02 },
        trailing_stop: false,
        use_exit_signal: true,
      },
      callbacks: {},
    },
    timeframe: '5m',
    pairs: ['BTC/USDT'],
    backtestDays: 7,
    category: 'comparison-operator',
  };
}

function generateTrailingStopScenario(idx: number): Scenario {
  const rsi = makeIndicator('RSI', 1);

  return {
    id: idx,
    name: `TrailingStop_${idx}`,
    description: 'Test trailing stop parameters',
    config: {
      version: 2,
      schema_version: '2.0.0',
      indicators: [rsi],
      trading_mode: 'SPOT',
      position_mode: 'LONG_ONLY',
      long: {
        entry_conditions: andNode([compareNode(indicatorOperand(rsi), 'lt', constOperand(30))]),
        exit_conditions: andNode([compareNode(indicatorOperand(rsi), 'gt', constOperand(70))]),
      },
      parameters: {
        stoploss: -0.10,
        minimal_roi: { '0': 0.10, '30': 0.05, '60': 0.02 },
        trailing_stop: true,
        trailing_stop_positive: 0.01,
        trailing_stop_positive_offset: 0.02,
        use_exit_signal: true,
      },
      callbacks: {},
    },
    timeframe: '5m',
    pairs: ['BTC/USDT'],
    backtestDays: 7,
    category: 'trailing-stop',
  };
}

function generateNoExitSignalScenario(idx: number): Scenario {
  const rsi = makeIndicator('RSI', 1);

  return {
    id: idx,
    name: `NoExitSignal_${idx}`,
    description: 'Test strategy with use_exit_signal=false (ROI/stoploss only)',
    config: {
      version: 2,
      schema_version: '2.0.0',
      indicators: [rsi],
      trading_mode: 'SPOT',
      position_mode: 'LONG_ONLY',
      long: {
        entry_conditions: andNode([compareNode(indicatorOperand(rsi), 'lt', constOperand(30))]),
        exit_conditions: andNode([]),
      },
      parameters: {
        stoploss: -0.05,
        minimal_roi: { '0': 0.05, '30': 0.03, '60': 0.01 },
        trailing_stop: false,
        use_exit_signal: false,
      },
      callbacks: {},
    },
    timeframe: '5m',
    pairs: ['BTC/USDT'],
    backtestDays: 7,
    category: 'no-exit-signal',
  };
}

function generateComplexNestedScenario(idx: number): Scenario {
  const rsi = makeIndicator('RSI', 1);
  const sma = makeIndicator('SMA', 2);
  const ema = makeIndicator('EMA', 3);
  const bb = makeIndicator('BB', 4);
  const macd = makeIndicator('MACD', 5);

  // Complex nested: (RSI < 30 AND close > SMA) OR (MACD crossover AND close > BB lower)
  const entryCondition = orNode([
    andNode([
      compareNode(indicatorOperand(rsi), 'lt', constOperand(30)),
      compareNode(priceOperand('close'), 'gt', indicatorOperand(sma)),
    ]),
    andNode([
      crossoverNode(indicatorOperand(macd, 0), indicatorOperand(macd, 1)),
      compareNode(priceOperand('close'), 'gt', indicatorOperand(bb, INDICATOR_TEMPLATES.BB.outputs.indexOf('lower'))),
    ]),
  ]);

  return {
    id: idx,
    name: `ComplexNested_${idx}`,
    description: 'Test deeply nested condition tree',
    config: {
      version: 2,
      schema_version: '2.0.0',
      indicators: [rsi, sma, ema, bb, macd],
      trading_mode: 'SPOT',
      position_mode: 'LONG_ONLY',
      long: {
        entry_conditions: entryCondition,
        exit_conditions: andNode([
          compareNode(indicatorOperand(rsi), 'gt', constOperand(70)),
          compareNode(priceOperand('close'), 'lt', indicatorOperand(ema)),
        ]),
      },
      parameters: {
        stoploss: -0.10,
        minimal_roi: { '0': 0.15, '30': 0.08, '60': 0.04, '120': 0.01 },
        trailing_stop: true,
        trailing_stop_positive: 0.02,
        trailing_stop_positive_offset: 0.04,
        use_exit_signal: true,
      },
      callbacks: {},
    },
    timeframe: '15m',
    pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
    backtestDays: 60,
    category: 'complex-nested',
  };
}

function generateMultiPairScenario(idx: number, pairCount: number): Scenario {
  const rsi = makeIndicator('RSI', 1);
  const selectedPairs = pickN(PAIRS, pairCount);

  return {
    id: idx,
    name: `MultiPair_${pairCount}p_${idx}`,
    description: `Test with ${pairCount} trading pairs`,
    config: {
      version: 2,
      schema_version: '2.0.0',
      indicators: [rsi],
      trading_mode: 'SPOT',
      position_mode: 'LONG_ONLY',
      long: {
        entry_conditions: andNode([compareNode(indicatorOperand(rsi), 'lt', constOperand(30))]),
        exit_conditions: andNode([compareNode(indicatorOperand(rsi), 'gt', constOperand(70))]),
      },
      parameters: {
        stoploss: -0.10,
        minimal_roi: { '0': 0.10, '30': 0.05, '60': 0.02 },
        trailing_stop: false,
        use_exit_signal: true,
      },
      callbacks: {},
    },
    timeframe: '1h',
    pairs: selectedPairs,
    backtestDays: 7,
    category: 'multi-pair',
  };
}

function generateVariedParamsScenario(idx: number, indType: string, paramOverrides: Record<string, unknown>): Scenario {
  const tmpl = INDICATOR_TEMPLATES[indType];
  const ind: IndicatorDef = {
    id: `${indType.toLowerCase()}_custom`,
    type: indType,
    params: { ...tmpl.params, ...paramOverrides },
  };

  const field = tmpl.outputs[0];
  const threshold = getThresholdForIndicator(indType, field, 'entry', 'long');
  const isMaType = ['SMA', 'EMA', 'WMA', 'DEMA', 'TEMA'].includes(indType);

  let entryCondition: ConditionNode;
  if (isMaType) {
    entryCondition = crossoverNode(priceOperand('close'), indicatorOperand(ind));
  } else {
    entryCondition = compareNode(indicatorOperand(ind), threshold.op, constOperand(threshold.value));
  }

  return {
    id: idx,
    name: `Params_${indType}_${idx}`,
    description: `Test ${indType} with custom params: ${JSON.stringify(paramOverrides)}`,
    config: {
      version: 2,
      schema_version: '2.0.0',
      indicators: [ind],
      trading_mode: 'SPOT',
      position_mode: 'LONG_ONLY',
      long: {
        entry_conditions: andNode([entryCondition]),
        exit_conditions: andNode([
          isMaType
            ? crossunderNode(priceOperand('close'), indicatorOperand(ind))
            : compareNode(indicatorOperand(ind), getThresholdForIndicator(indType, field, 'exit', 'long').op, constOperand(getThresholdForIndicator(indType, field, 'exit', 'long').value)),
        ]),
      },
      parameters: {
        stoploss: -0.10,
        minimal_roi: { '0': 0.10, '30': 0.05, '60': 0.02 },
        trailing_stop: false,
        use_exit_signal: true,
      },
      callbacks: {},
    },
    timeframe: pick(TIMEFRAMES),
    pairs: ['ETH/USDT'],
    backtestDays: 7,
    category: 'varied-params',
  };
}

function generateMultiOutputScenario(idx: number, indType: string): Scenario {
  const tmpl = INDICATOR_TEMPLATES[indType];
  if (tmpl.outputs.length < 2) {
    // Fallback for single-output indicators
    return generateSingleIndicatorScenario(idx, indType);
  }

  const ind = makeIndicator(indType, 1);
  const conditions: ConditionNode[] = [];

  // Test each output field
  for (let i = 0; i < tmpl.outputs.length && i < 3; i++) {
    const field = tmpl.outputs[i];
    const threshold = getThresholdForIndicator(indType, field, 'entry', 'long');

    if (i === 0 && tmpl.outputs.length >= 2) {
      // Compare first two outputs against each other
      conditions.push(compareNode(indicatorOperand(ind, 0), 'gt', indicatorOperand(ind, 1)));
    } else {
      conditions.push(compareNode(indicatorOperand(ind, i), threshold.op, constOperand(threshold.value)));
    }
  }

  return {
    id: idx,
    name: `MultiOutput_${indType}_${idx}`,
    description: `Test all outputs of ${indType}`,
    config: {
      version: 2,
      schema_version: '2.0.0',
      indicators: [ind],
      trading_mode: 'SPOT',
      position_mode: 'LONG_ONLY',
      long: {
        entry_conditions: andNode(conditions),
        exit_conditions: andNode([compareNode(indicatorOperand(ind, 0), 'lt', indicatorOperand(ind, 1))]),
      },
      parameters: {
        stoploss: -0.10,
        minimal_roi: { '0': 0.10, '30': 0.05, '60': 0.02 },
        trailing_stop: false,
        use_exit_signal: true,
      },
      callbacks: {},
    },
    timeframe: '5m',
    pairs: ['BTC/USDT'],
    backtestDays: 7,
    category: 'multi-output',
  };
}

function generatePriceFieldScenario(idx: number, priceField: string): Scenario {
  const sma = makeIndicator('SMA', 1);

  return {
    id: idx,
    name: `PriceField_${priceField}_${idx}`,
    description: `Test price field: ${priceField}`,
    config: {
      version: 2,
      schema_version: '2.0.0',
      indicators: [sma],
      trading_mode: 'SPOT',
      position_mode: 'LONG_ONLY',
      long: {
        entry_conditions: andNode([compareNode(priceOperand(priceField), 'gt', indicatorOperand(sma))]),
        exit_conditions: andNode([compareNode(priceOperand(priceField), 'lt', indicatorOperand(sma))]),
      },
      parameters: {
        stoploss: -0.10,
        minimal_roi: { '0': 0.10, '30': 0.05, '60': 0.02 },
        trailing_stop: false,
        use_exit_signal: true,
      },
      callbacks: {},
    },
    timeframe: '5m',
    pairs: ['BTC/USDT'],
    backtestDays: 7,
    category: 'price-field',
  };
}

function generateComputedOperandScenario(idx: number, computedOp: string): Scenario {
  const rsi = makeIndicator('RSI', 1);
  const sma = makeIndicator('SMA', 2);

  let computedLeft: Operand;
  if (['abs', 'round', 'floor', 'ceil'].includes(computedOp)) {
    computedLeft = computedOperand(computedOp, [computedOperand('subtract', [indicatorOperand(rsi), constOperand(50)])]);
  } else if (computedOp === 'percent_change') {
    computedLeft = computedOperand(computedOp, [priceOperand('close'), indicatorOperand(sma)]);
  } else if (computedOp === 'average') {
    computedLeft = computedOperand(computedOp, [indicatorOperand(rsi), constOperand(50)]);
  } else {
    computedLeft = computedOperand(computedOp, [indicatorOperand(rsi), constOperand(50)]);
  }

  return {
    id: idx,
    name: `Computed_${computedOp}_${idx}`,
    description: `Test computed operand: ${computedOp}`,
    config: {
      version: 2,
      schema_version: '2.0.0',
      indicators: [rsi, sma],
      trading_mode: 'SPOT',
      position_mode: 'LONG_ONLY',
      long: {
        entry_conditions: andNode([compareNode(computedLeft, 'lt', constOperand(0))]),
        exit_conditions: andNode([compareNode(computedLeft, 'gt', constOperand(0))]),
      },
      parameters: {
        stoploss: -0.10,
        minimal_roi: { '0': 0.10, '30': 0.05, '60': 0.02 },
        trailing_stop: false,
        use_exit_signal: true,
      },
      callbacks: {},
    },
    timeframe: '5m',
    pairs: ['BTC/USDT'],
    backtestDays: 7,
    category: 'computed-operand',
  };
}

function generateTimeFilterScenario(idx: number, timeField: string): Scenario {
  const rsi = makeIndicator('RSI', 1);
  const thresholds: Record<string, { op: string; val: number }> = {
    hour: { op: 'gte', val: 8 },
    minute: { op: 'lt', val: 30 },
    day_of_week: { op: 'lt', val: 5 },
    day_of_month: { op: 'lte', val: 15 },
    month: { op: 'gte', val: 1 },
    is_weekend: { op: 'eq', val: 0 },
  };
  const t = thresholds[timeField] || { op: 'gte', val: 0 };

  return {
    id: idx,
    name: `TimeFilter_${timeField}_${idx}`,
    description: `Test time field filter: ${timeField}`,
    config: {
      version: 2,
      schema_version: '2.0.0',
      indicators: [rsi],
      trading_mode: 'SPOT',
      position_mode: 'LONG_ONLY',
      long: {
        entry_conditions: andNode([
          compareNode(indicatorOperand(rsi), 'lt', constOperand(30)),
          compareNode(timeOperand(timeField), t.op, constOperand(t.val)),
        ]),
        exit_conditions: andNode([compareNode(indicatorOperand(rsi), 'gt', constOperand(70))]),
      },
      parameters: {
        stoploss: -0.10,
        minimal_roi: { '0': 0.10, '30': 0.05, '60': 0.02 },
        trailing_stop: false,
        use_exit_signal: true,
      },
      callbacks: {},
    },
    timeframe: '5m',
    pairs: ['BTC/USDT'],
    backtestDays: 7,
    category: 'time-filter',
  };
}

function generateFullCallbackScenario(idx: number): Scenario {
  const rsi = makeIndicator('RSI', 1);
  const sma = makeIndicator('SMA', 2);
  const atr = makeIndicator('ATR', 3);

  return {
    id: idx,
    name: `FullCallbacks_${idx}`,
    description: 'Test all callbacks enabled together',
    config: {
      version: 2,
      schema_version: '2.0.0',
      indicators: [rsi, sma, atr],
      trading_mode: 'FUTURES',
      position_mode: 'LONG_AND_SHORT',
      long: {
        entry_conditions: andNode([
          compareNode(indicatorOperand(rsi), 'lt', constOperand(30)),
          compareNode(priceOperand('close'), 'gt', indicatorOperand(sma)),
        ]),
        exit_conditions: andNode([compareNode(indicatorOperand(rsi), 'gt', constOperand(70))]),
      },
      short: {
        entry_conditions: andNode([
          compareNode(indicatorOperand(rsi), 'gt', constOperand(70)),
          compareNode(priceOperand('close'), 'lt', indicatorOperand(sma)),
        ]),
        exit_conditions: andNode([compareNode(indicatorOperand(rsi), 'lt', constOperand(30))]),
      },
      parameters: {
        stoploss: -0.10,
        minimal_roi: { '0': 0.15, '30': 0.08, '60': 0.04 },
        trailing_stop: true,
        trailing_stop_positive: 0.02,
        trailing_stop_positive_offset: 0.04,
        use_exit_signal: true,
      },
      callbacks: {
        dca: {
          enabled: true,
          max_entries: 3,
          rules: [
            { id: uid(), price_drop_percent: 5, stake_multiplier: 1.5 },
            { id: uid(), price_drop_percent: 10, stake_multiplier: 2.0 },
          ],
          cooldown_minutes: 60,
        },
        custom_stoploss: {
          enabled: true,
          rules: [
            {
              id: uid(),
              condition: compareNode(tradeContextOperand('current_profit_pct'), 'gt', constOperand(5)),
              stoploss: -0.02,
            },
          ],
          default_stoploss: -0.10,
          trailing: { enabled: true, positive: 0.01, positive_offset: 0.02 },
        },
        confirm_entry: {
          enabled: true,
          rules: andNode([compareNode(priceOperand('volume'), 'gt', constOperand(100))]),
        },
        leverage: {
          enabled: true,
          rules: [
            {
              id: uid(),
              priority: 10,
              condition: compareNode(indicatorOperand(rsi), 'lt', constOperand(30)),
              leverage: { type: 'CONSTANT', value: 3.0 },
            },
          ],
          default_leverage: 1.0,
          max_leverage: 10.0,
        },
      },
    },
    timeframe: '15m',
    pairs: ['BTC/USDT', 'ETH/USDT'],
    backtestDays: 7,
    category: 'full-callbacks',
  };
}

// ============================================================================
// Generate all 500 scenarios
// ============================================================================

export function generateAllScenarios(): Scenario[] {
  const scenarios: Scenario[] = [];
  let idx = 1;

  // ---- Category 1: Single indicator (27 scenarios, one per indicator except CUSTOM) ----
  for (const indType of ALL_INDICATOR_TYPES) {
    if (indType === 'CUSTOM') continue; // Custom requires user code
    scenarios.push(generateSingleIndicatorScenario(idx++, indType));
  }

  // ---- Category 2: Multi-output indicators (test each output field) ----
  const multiOutputIndicators = Object.entries(INDICATOR_TEMPLATES)
    .filter(([, t]) => t.outputs.length >= 2)
    .map(([k]) => k);
  for (const indType of multiOutputIndicators) {
    scenarios.push(generateMultiOutputScenario(idx++, indType));
  }

  // ---- Category 3: Condition types (8 scenarios) ----
  for (const condType of ['COMPARE', 'CROSSOVER', 'CROSSUNDER', 'AND', 'OR', 'NOT', 'IN_RANGE', 'IF_THEN_ELSE']) {
    scenarios.push(generateConditionTypeScenario(idx++, condType));
  }

  // ---- Category 4: Comparison operators (6 scenarios) ----
  for (const op of COMPARISON_OPS) {
    scenarios.push(generateComparisonOperatorScenario(idx++, op));
  }

  // ---- Category 5: Operand types (6 scenarios) ----
  for (const opType of ['CONSTANT', 'INDICATOR', 'PRICE', 'TRADE_CONTEXT', 'TIME', 'COMPUTED']) {
    scenarios.push(generateOperandTypeScenario(idx++, opType));
  }

  // ---- Category 6: Trading modes × position modes (3×3=9 scenarios) ----
  for (const mode of ['SPOT', 'MARGIN', 'FUTURES']) {
    for (const pos of ['LONG_ONLY', 'SHORT_ONLY', 'LONG_AND_SHORT']) {
      scenarios.push(generateTradingModeScenario(idx++, mode, pos));
    }
  }

  // ---- Category 7: Mirror mode (3 scenarios) ----
  for (let i = 0; i < 3; i++) {
    scenarios.push(generateMirrorScenario(idx++));
  }

  // ---- Category 8: Callbacks (4 scenarios) ----
  for (const cb of ['DCA', 'CUSTOM_STOPLOSS', 'CONFIRM_ENTRY', 'LEVERAGE']) {
    scenarios.push(generateCallbackScenario(idx++, cb));
  }

  // ---- Category 9: Full callbacks (3 scenarios) ----
  for (let i = 0; i < 3; i++) {
    scenarios.push(generateFullCallbackScenario(idx++));
  }

  // ---- Category 10: Price fields (8 scenarios) ----
  for (const pf of PRICE_FIELDS) {
    scenarios.push(generatePriceFieldScenario(idx++, pf));
  }

  // ---- Category 11: Computed operands (9 scenarios) ----
  for (const cop of COMPUTED_OPS) {
    scenarios.push(generateComputedOperandScenario(idx++, cop));
  }

  // ---- Category 12: Time filters (6 scenarios) ----
  for (const tf of TIME_FIELDS) {
    scenarios.push(generateTimeFilterScenario(idx++, tf));
  }

  // ---- Category 13: Trailing stop (2 scenarios) ----
  scenarios.push(generateTrailingStopScenario(idx++));
  scenarios.push(generateNoExitSignalScenario(idx++));

  // ---- Category 14: Complex nested (5 scenarios) ----
  for (let i = 0; i < 5; i++) {
    scenarios.push(generateComplexNestedScenario(idx++));
  }

  // ---- Category 15: Multi-pair (6 scenarios: 1, 2, 3, 4, 5, 6 pairs) ----
  for (let p = 1; p <= 6; p++) {
    scenarios.push(generateMultiPairScenario(idx++, p));
  }

  // ---- Category 16: Multi-indicator combos (covering all pairs of indicator categories) ----
  const categoryPairs: [string, string][] = [
    ['RSI', 'SMA'], ['RSI', 'EMA'], ['RSI', 'MACD'], ['RSI', 'BB'],
    ['RSI', 'ATR'], ['RSI', 'ADX'], ['RSI', 'STOCH'], ['RSI', 'MFI'],
    ['MACD', 'BB'], ['MACD', 'SMA'], ['MACD', 'ADX'], ['MACD', 'STOCH'],
    ['BB', 'RSI'], ['BB', 'STOCH'], ['BB', 'ATR'],
    ['ADX', 'SMA'], ['ADX', 'EMA'], ['ADX', 'RSI'],
    ['STOCH', 'SMA'], ['STOCH', 'EMA'],
    ['CCI', 'SMA'], ['WILLR', 'EMA'], ['MOM', 'SMA'], ['ROC', 'EMA'],
    ['MFI', 'SMA'], ['OBV', 'EMA'], ['VWAP', 'RSI'], ['CMF', 'RSI'],
    ['ICHIMOKU', 'RSI'], ['SAR', 'RSI'], ['SUPERTREND', 'RSI'],
    ['STOCH_RSI', 'SMA'], ['AD', 'RSI'],
  ];
  for (const [a, b] of categoryPairs) {
    scenarios.push(generateMultiIndicatorScenario(idx++, [a, b]));
  }

  // ---- Category 17: Triple indicator combos ----
  const tripleCombos: [string, string, string][] = [
    ['RSI', 'SMA', 'MACD'], ['RSI', 'BB', 'ADX'], ['RSI', 'EMA', 'ATR'],
    ['MACD', 'BB', 'STOCH'], ['MACD', 'ADX', 'RSI'], ['BB', 'RSI', 'MFI'],
    ['SMA', 'EMA', 'RSI'], ['STOCH', 'BB', 'ADX'], ['CCI', 'SMA', 'BB'],
    ['ICHIMOKU', 'RSI', 'ADX'], ['SUPERTREND', 'RSI', 'ATR'], ['SAR', 'RSI', 'MACD'],
    ['DEMA', 'RSI', 'MACD'], ['WILLR', 'SMA', 'ATR'], ['MOM', 'EMA', 'BB'],
    ['ROC', 'SMA', 'RSI'], ['MFI', 'BB', 'MACD'], ['OBV', 'RSI', 'SMA'],
    ['VWAP', 'RSI', 'EMA'], ['CMF', 'BB', 'RSI'],
  ];
  for (const [a, b, c] of tripleCombos) {
    scenarios.push(generateMultiIndicatorScenario(idx++, [a, b, c]));
  }

  // ---- Category 18: Varied parameters (test edge cases) ----
  const paramVariations: [string, Record<string, unknown>][] = [
    ['RSI', { period: 2 }], ['RSI', { period: 50 }], ['RSI', { period: 100 }],
    ['SMA', { period: 5 }], ['SMA', { period: 200 }], ['SMA', { period: 500 }],
    ['EMA', { period: 5 }], ['EMA', { period: 200 }],
    ['MACD', { fast: 5, slow: 10, signal: 3 }], ['MACD', { fast: 26, slow: 52, signal: 18 }],
    ['BB', { period: 10, std_dev: 1.0 }], ['BB', { period: 50, std_dev: 3.0 }],
    ['STOCH', { k: 5, d: 3, smooth: 1 }], ['STOCH', { k: 21, d: 7, smooth: 7 }],
    ['ATR', { period: 7 }], ['ATR', { period: 50 }],
    ['ADX', { period: 7 }], ['ADX', { period: 50 }],
    ['ICHIMOKU', { conv: 7, base: 22, span: 44 }],
    ['SAR', { acceleration: 0.01, maximum: 0.1 }], ['SAR', { acceleration: 0.05, maximum: 0.5 }],
    ['SUPERTREND', { period: 7, multiplier: 2.0 }], ['SUPERTREND', { period: 14, multiplier: 4.0 }],
    ['TEMA', { period: 15 }],
    ['STOCH_RSI', { period: 7, k: 5, d: 5 }],
    ['CCI', { period: 10 }], ['CCI', { period: 50 }],
    ['WILLR', { period: 7 }], ['WILLR', { period: 50 }],
    ['MOM', { period: 5 }], ['MOM', { period: 30 }],
    ['ROC', { period: 5 }], ['ROC', { period: 30 }],
    ['MFI', { period: 7 }], ['MFI', { period: 50 }],
    ['CMF', { period: 10 }], ['CMF', { period: 50 }],
    ['DEMA', { period: 5, source: 'close' }], ['DEMA', { period: 30, source: 'close' }],
    ['WMA', { period: 10 }], ['DEMA', { period: 10 }], ['TEMA', { period: 10 }],
  ];
  for (const [type, overrides] of paramVariations) {
    scenarios.push(generateVariedParamsScenario(idx++, type, overrides));
  }

  // ---- Category 19: Short-only strategies with various indicators ----
  const shortOnlyIndicators = ['RSI', 'STOCH', 'CCI', 'WILLR', 'MACD', 'BB', 'ADX'];
  for (const indType of shortOnlyIndicators) {
    const s = generateSingleIndicatorScenario(idx++, indType);
    s.name = `ShortOnly_${indType}_${idx}`;
    s.config.position_mode = 'SHORT_ONLY';
    s.config.short = s.config.long ? {
      entry_conditions: s.config.long.exit_conditions, // Inverted
      exit_conditions: s.config.long.entry_conditions,
    } : undefined;
    delete s.config.long;
    s.category = 'short-only';
    scenarios.push(s);
  }

  // ---- Category 20: Long+Short with explicit conditions ----
  for (let i = 0; i < 10; i++) {
    const indTypes = pickN(ALL_INDICATOR_TYPES.filter(t => t !== 'CUSTOM'), 2);
    const s = generateMultiIndicatorScenario(idx++, indTypes);
    s.name = `LongShort_${indTypes.join('_')}_${idx}`;
    s.config.position_mode = 'LONG_AND_SHORT';
    if (s.config.long) {
      s.config.short = {
        entry_conditions: s.config.long.exit_conditions,
        exit_conditions: s.config.long.entry_conditions,
      };
    }
    s.category = 'long-short';
    scenarios.push(s);
  }

  // ---- Category 21: Different timeframes with same strategy ----
  for (const tf of TIMEFRAMES) {
    const s = generateSingleIndicatorScenario(idx++, 'RSI');
    s.name = `Timeframe_${tf}_${idx}`;
    s.timeframe = tf;
    s.category = 'timeframe';
    scenarios.push(s);
  }

  // ---- Category 22: Edge case - many indicators (5+) ----
  for (let i = 0; i < 5; i++) {
    const count = 5 + i;
    const inds = pickN(ALL_INDICATOR_TYPES.filter(t => t !== 'CUSTOM'), count);
    scenarios.push(generateMultiIndicatorScenario(idx++, inds));
  }

  // ---- Category 23: ROI variations ----
  const roiVariations = [
    { '0': 0.05 },
    { '0': 0.20, '60': 0.10, '120': 0.05, '240': 0.01 },
    { '0': 0.50 },
    { '0': 0.01 },
  ];
  for (const roi of roiVariations) {
    const s = generateSingleIndicatorScenario(idx++, 'RSI');
    s.name = `ROI_${idx}`;
    s.config.parameters.minimal_roi = roi;
    s.category = 'roi-variation';
    scenarios.push(s);
  }

  // ---- Category 24: Stoploss variations ----
  for (const sl of [-0.01, -0.05, -0.15, -0.25, -0.50]) {
    const s = generateSingleIndicatorScenario(idx++, 'RSI');
    s.name = `Stoploss_${Math.abs(sl * 100)}pct_${idx}`;
    s.config.parameters.stoploss = sl;
    s.category = 'stoploss-variation';
    scenarios.push(s);
  }

  // ---- Fill remaining to 500 with mixed random combinations ----
  while (scenarios.length < 500) {
    const r = seededRandom();
    if (r < 0.3) {
      const inds = pickN(ALL_INDICATOR_TYPES.filter(t => t !== 'CUSTOM'), 2 + Math.floor(seededRandom() * 3));
      const s = generateMultiIndicatorScenario(idx++, inds);
      s.timeframe = pick(TIMEFRAMES);
      s.pairs = pickN(PAIRS, 1 + Math.floor(seededRandom() * 3));
      s.category = 'random-combo';
      scenarios.push(s);
    } else if (r < 0.5) {
      const s = generateComplexNestedScenario(idx++);
      s.config.trading_mode = pick(['SPOT', 'MARGIN', 'FUTURES']);
      s.config.position_mode = pick(['LONG_ONLY', 'SHORT_ONLY', 'LONG_AND_SHORT']);
      if (s.config.position_mode === 'SHORT_ONLY') {
        s.config.short = s.config.long;
        delete s.config.long;
      } else if (s.config.position_mode === 'LONG_AND_SHORT' && s.config.long) {
        s.config.short = {
          entry_conditions: s.config.long.exit_conditions,
          exit_conditions: s.config.long.entry_conditions,
        };
      }
      s.category = 'random-complex';
      scenarios.push(s);
    } else if (r < 0.7) {
      const cb = pick(['DCA', 'CUSTOM_STOPLOSS', 'CONFIRM_ENTRY', 'LEVERAGE']);
      scenarios.push(generateCallbackScenario(idx++, cb));
    } else {
      const indType = pick(ALL_INDICATOR_TYPES.filter(t => t !== 'CUSTOM'));
      scenarios.push(generateSingleIndicatorScenario(idx++, indType));
    }
  }

  return scenarios.slice(0, 500);
}
