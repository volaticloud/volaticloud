package codegen

import (
	"fmt"
	"strings"
)

// IndicatorGenerator handles generation of indicator Python code
type IndicatorGenerator struct {
	imports map[string]bool
}

// NewIndicatorGenerator creates a new indicator generator
func NewIndicatorGenerator() *IndicatorGenerator {
	return &IndicatorGenerator{
		imports: make(map[string]bool),
	}
}

// GenerateIndicator generates Python code for a single indicator
// Returns the code to add to populate_indicators()
func (g *IndicatorGenerator) GenerateIndicator(ind IndicatorDefinition) (string, error) {
	switch ind.Type {
	case IndicatorRSI:
		return g.generateRSI(ind)
	case IndicatorSMA:
		return g.generateSMA(ind)
	case IndicatorEMA:
		return g.generateEMA(ind)
	case IndicatorWMA:
		return g.generateWMA(ind)
	case IndicatorDEMA:
		return g.generateDEMA(ind)
	case IndicatorTEMA:
		return g.generateTEMA(ind)
	case IndicatorMACD:
		return g.generateMACD(ind)
	case IndicatorBB:
		return g.generateBollingerBands(ind)
	case IndicatorSTOCH:
		return g.generateStochastic(ind)
	case IndicatorSTOCHRSI:
		return g.generateStochasticRSI(ind)
	case IndicatorATR:
		return g.generateATR(ind)
	case IndicatorADX:
		return g.generateADX(ind)
	case IndicatorCCI:
		return g.generateCCI(ind)
	case IndicatorWILLR:
		return g.generateWilliamsR(ind)
	case IndicatorMOM:
		return g.generateMomentum(ind)
	case IndicatorROC:
		return g.generateROC(ind)
	case IndicatorOBV:
		return g.generateOBV(ind)
	case IndicatorMFI:
		return g.generateMFI(ind)
	case IndicatorVWAP:
		return g.generateVWAP(ind)
	case IndicatorCMF:
		return g.generateCMF(ind)
	case IndicatorAD:
		return g.generateAD(ind)
	case IndicatorICHIMOKU:
		return g.generateIchimoku(ind)
	case IndicatorSAR:
		return g.generateSAR(ind)
	case IndicatorSUPERTREND:
		return g.generateSupertrend(ind)
	case IndicatorCUSTOM:
		return g.generateCustom(ind)
	default:
		return "", fmt.Errorf("unknown indicator type: %s", ind.Type)
	}
}

// GenerateAllIndicators generates Python code for all indicators
func (g *IndicatorGenerator) GenerateAllIndicators(indicators []IndicatorDefinition) (string, error) {
	var lines []string
	for _, ind := range indicators {
		code, err := g.GenerateIndicator(ind)
		if err != nil {
			return "", fmt.Errorf("failed to generate indicator %s: %w", ind.ID, err)
		}
		lines = append(lines, code)
	}
	return strings.Join(lines, "\n"), nil
}

// GetRequiredImports returns the imports needed for the generated indicators
func (g *IndicatorGenerator) GetRequiredImports() []string {
	imports := make([]string, 0, len(g.imports))
	for imp := range g.imports {
		imports = append(imports, imp)
	}
	return imports
}

// Helper to get int param with default
func (g *IndicatorGenerator) getIntParam(params map[string]interface{}, key string, defaultVal int) int {
	if v, ok := params[key]; ok {
		switch val := v.(type) {
		case int:
			return val
		case float64:
			return int(val)
		}
	}
	return defaultVal
}

// Helper to get float param with default
func (g *IndicatorGenerator) getFloatParam(params map[string]interface{}, key string, defaultVal float64) float64 {
	if v, ok := params[key]; ok {
		switch val := v.(type) {
		case float64:
			return val
		case int:
			return float64(val)
		}
	}
	return defaultVal
}

// Helper to get string param with default
func (g *IndicatorGenerator) getStringParam(params map[string]interface{}, key string, defaultVal string) string {
	if v, ok := params[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return defaultVal
}

// RSI - Relative Strength Index
func (g *IndicatorGenerator) generateRSI(ind IndicatorDefinition) (string, error) {
	g.imports["talib"] = true
	period := g.getIntParam(ind.Params, "period", 14)
	return fmt.Sprintf("dataframe['%s'] = ta.RSI(dataframe, timeperiod=%d)", ind.ID, period), nil
}

// SMA - Simple Moving Average
func (g *IndicatorGenerator) generateSMA(ind IndicatorDefinition) (string, error) {
	g.imports["talib"] = true
	period := g.getIntParam(ind.Params, "period", 20)
	source := g.getStringParam(ind.Params, "source", "close")
	return fmt.Sprintf("dataframe['%s'] = ta.SMA(dataframe['%s'], timeperiod=%d)", ind.ID, source, period), nil
}

// EMA - Exponential Moving Average
func (g *IndicatorGenerator) generateEMA(ind IndicatorDefinition) (string, error) {
	g.imports["talib"] = true
	period := g.getIntParam(ind.Params, "period", 20)
	source := g.getStringParam(ind.Params, "source", "close")
	return fmt.Sprintf("dataframe['%s'] = ta.EMA(dataframe['%s'], timeperiod=%d)", ind.ID, source, period), nil
}

// WMA - Weighted Moving Average
func (g *IndicatorGenerator) generateWMA(ind IndicatorDefinition) (string, error) {
	g.imports["talib"] = true
	period := g.getIntParam(ind.Params, "period", 20)
	source := g.getStringParam(ind.Params, "source", "close")
	return fmt.Sprintf("dataframe['%s'] = ta.WMA(dataframe['%s'], timeperiod=%d)", ind.ID, source, period), nil
}

// DEMA - Double Exponential Moving Average
func (g *IndicatorGenerator) generateDEMA(ind IndicatorDefinition) (string, error) {
	g.imports["talib"] = true
	period := g.getIntParam(ind.Params, "period", 20)
	source := g.getStringParam(ind.Params, "source", "close")
	return fmt.Sprintf("dataframe['%s'] = ta.DEMA(dataframe['%s'], timeperiod=%d)", ind.ID, source, period), nil
}

// TEMA - Triple Exponential Moving Average
func (g *IndicatorGenerator) generateTEMA(ind IndicatorDefinition) (string, error) {
	g.imports["talib"] = true
	period := g.getIntParam(ind.Params, "period", 20)
	source := g.getStringParam(ind.Params, "source", "close")
	return fmt.Sprintf("dataframe['%s'] = ta.TEMA(dataframe['%s'], timeperiod=%d)", ind.ID, source, period), nil
}

// MACD - Moving Average Convergence Divergence
func (g *IndicatorGenerator) generateMACD(ind IndicatorDefinition) (string, error) {
	g.imports["talib"] = true
	fast := g.getIntParam(ind.Params, "fast", 12)
	slow := g.getIntParam(ind.Params, "slow", 26)
	signal := g.getIntParam(ind.Params, "signal", 9)

	return fmt.Sprintf(`macd = ta.MACD(dataframe, fastperiod=%d, slowperiod=%d, signalperiod=%d)
dataframe['%s'] = macd['macd']
dataframe['%s_signal'] = macd['macdsignal']
dataframe['%s_histogram'] = macd['macdhist']`, fast, slow, signal, ind.ID, ind.ID, ind.ID), nil
}

// BB - Bollinger Bands
func (g *IndicatorGenerator) generateBollingerBands(ind IndicatorDefinition) (string, error) {
	g.imports["talib"] = true
	period := g.getIntParam(ind.Params, "period", 20)
	stdDev := g.getFloatParam(ind.Params, "std_dev", 2.0)

	return fmt.Sprintf(`bollinger = ta.BBANDS(dataframe, timeperiod=%d, nbdevup=%v, nbdevdn=%v, matype=0)
dataframe['%s_upper'] = bollinger['upperband']
dataframe['%s_middle'] = bollinger['middleband']
dataframe['%s_lower'] = bollinger['lowerband']
dataframe['%s_width'] = (bollinger['upperband'] - bollinger['lowerband']) / bollinger['middleband']`,
		period, stdDev, stdDev, ind.ID, ind.ID, ind.ID, ind.ID), nil
}

// STOCH - Stochastic
func (g *IndicatorGenerator) generateStochastic(ind IndicatorDefinition) (string, error) {
	g.imports["talib"] = true
	kPeriod := g.getIntParam(ind.Params, "k", 14)
	dPeriod := g.getIntParam(ind.Params, "d", 3)
	smooth := g.getIntParam(ind.Params, "smooth", 3)

	return fmt.Sprintf(`stoch = ta.STOCH(dataframe, fastk_period=%d, slowk_period=%d, slowk_matype=0, slowd_period=%d, slowd_matype=0)
dataframe['%s_k'] = stoch['slowk']
dataframe['%s_d'] = stoch['slowd']`, kPeriod, smooth, dPeriod, ind.ID, ind.ID), nil
}

// STOCH_RSI - Stochastic RSI
func (g *IndicatorGenerator) generateStochasticRSI(ind IndicatorDefinition) (string, error) {
	g.imports["talib"] = true
	period := g.getIntParam(ind.Params, "period", 14)
	kPeriod := g.getIntParam(ind.Params, "k", 3)
	dPeriod := g.getIntParam(ind.Params, "d", 3)

	return fmt.Sprintf(`stochrsi = ta.STOCHRSI(dataframe, timeperiod=%d, fastk_period=%d, fastd_period=%d, fastd_matype=0)
dataframe['%s_k'] = stochrsi['fastk']
dataframe['%s_d'] = stochrsi['fastd']`, period, kPeriod, dPeriod, ind.ID, ind.ID), nil
}

// ATR - Average True Range
func (g *IndicatorGenerator) generateATR(ind IndicatorDefinition) (string, error) {
	g.imports["talib"] = true
	period := g.getIntParam(ind.Params, "period", 14)
	return fmt.Sprintf("dataframe['%s'] = ta.ATR(dataframe, timeperiod=%d)", ind.ID, period), nil
}

// ADX - Average Directional Movement Index
func (g *IndicatorGenerator) generateADX(ind IndicatorDefinition) (string, error) {
	g.imports["talib"] = true
	period := g.getIntParam(ind.Params, "period", 14)

	return fmt.Sprintf(`dataframe['%s'] = ta.ADX(dataframe, timeperiod=%d)
dataframe['%s_plus_di'] = ta.PLUS_DI(dataframe, timeperiod=%d)
dataframe['%s_minus_di'] = ta.MINUS_DI(dataframe, timeperiod=%d)`,
		ind.ID, period, ind.ID, period, ind.ID, period), nil
}

// CCI - Commodity Channel Index
func (g *IndicatorGenerator) generateCCI(ind IndicatorDefinition) (string, error) {
	g.imports["talib"] = true
	period := g.getIntParam(ind.Params, "period", 20)
	return fmt.Sprintf("dataframe['%s'] = ta.CCI(dataframe, timeperiod=%d)", ind.ID, period), nil
}

// WILLR - Williams %R
func (g *IndicatorGenerator) generateWilliamsR(ind IndicatorDefinition) (string, error) {
	g.imports["talib"] = true
	period := g.getIntParam(ind.Params, "period", 14)
	return fmt.Sprintf("dataframe['%s'] = ta.WILLR(dataframe, timeperiod=%d)", ind.ID, period), nil
}

// MOM - Momentum
func (g *IndicatorGenerator) generateMomentum(ind IndicatorDefinition) (string, error) {
	g.imports["talib"] = true
	period := g.getIntParam(ind.Params, "period", 10)
	return fmt.Sprintf("dataframe['%s'] = ta.MOM(dataframe, timeperiod=%d)", ind.ID, period), nil
}

// ROC - Rate of Change
func (g *IndicatorGenerator) generateROC(ind IndicatorDefinition) (string, error) {
	g.imports["talib"] = true
	period := g.getIntParam(ind.Params, "period", 10)
	return fmt.Sprintf("dataframe['%s'] = ta.ROC(dataframe, timeperiod=%d)", ind.ID, period), nil
}

// OBV - On Balance Volume
func (g *IndicatorGenerator) generateOBV(ind IndicatorDefinition) (string, error) {
	g.imports["talib"] = true
	return fmt.Sprintf("dataframe['%s'] = ta.OBV(dataframe)", ind.ID), nil
}

// MFI - Money Flow Index
func (g *IndicatorGenerator) generateMFI(ind IndicatorDefinition) (string, error) {
	g.imports["talib"] = true
	period := g.getIntParam(ind.Params, "period", 14)
	return fmt.Sprintf("dataframe['%s'] = ta.MFI(dataframe, timeperiod=%d)", ind.ID, period), nil
}

// VWAP - Volume Weighted Average Price
func (g *IndicatorGenerator) generateVWAP(ind IndicatorDefinition) (string, error) {
	g.imports["qtpylib"] = true
	return fmt.Sprintf("dataframe['%s'] = qtpylib.rolling_vwap(dataframe)", ind.ID), nil
}

// CMF - Chaikin Money Flow
func (g *IndicatorGenerator) generateCMF(ind IndicatorDefinition) (string, error) {
	g.imports["ta_cmf"] = true
	period := g.getIntParam(ind.Params, "period", 20)
	return fmt.Sprintf(`# Chaikin Money Flow
mfv = ((dataframe['close'] - dataframe['low']) - (dataframe['high'] - dataframe['close'])) / (dataframe['high'] - dataframe['low']) * dataframe['volume']
dataframe['%s'] = mfv.rolling(%d).sum() / dataframe['volume'].rolling(%d).sum()`,
		ind.ID, period, period), nil
}

// AD - Accumulation/Distribution
func (g *IndicatorGenerator) generateAD(ind IndicatorDefinition) (string, error) {
	g.imports["talib"] = true
	return fmt.Sprintf("dataframe['%s'] = ta.AD(dataframe)", ind.ID), nil
}

// ICHIMOKU - Ichimoku Cloud
func (g *IndicatorGenerator) generateIchimoku(ind IndicatorDefinition) (string, error) {
	convPeriod := g.getIntParam(ind.Params, "conv", 9)
	basePeriod := g.getIntParam(ind.Params, "base", 26)
	spanPeriod := g.getIntParam(ind.Params, "span", 52)

	return fmt.Sprintf(`# Ichimoku Cloud
dataframe['%s_tenkan'] = (dataframe['high'].rolling(%d).max() + dataframe['low'].rolling(%d).min()) / 2
dataframe['%s_kijun'] = (dataframe['high'].rolling(%d).max() + dataframe['low'].rolling(%d).min()) / 2
dataframe['%s_senkou_a'] = ((dataframe['%s_tenkan'] + dataframe['%s_kijun']) / 2).shift(%d)
dataframe['%s_senkou_b'] = ((dataframe['high'].rolling(%d).max() + dataframe['low'].rolling(%d).min()) / 2).shift(%d)`,
		ind.ID, convPeriod, convPeriod,
		ind.ID, basePeriod, basePeriod,
		ind.ID, ind.ID, ind.ID, basePeriod,
		ind.ID, spanPeriod, spanPeriod, basePeriod), nil
}

// SAR - Parabolic SAR
func (g *IndicatorGenerator) generateSAR(ind IndicatorDefinition) (string, error) {
	g.imports["talib"] = true
	acceleration := g.getFloatParam(ind.Params, "acceleration", 0.02)
	maximum := g.getFloatParam(ind.Params, "maximum", 0.2)
	return fmt.Sprintf("dataframe['%s'] = ta.SAR(dataframe, acceleration=%v, maximum=%v)", ind.ID, acceleration, maximum), nil
}

// SUPERTREND
func (g *IndicatorGenerator) generateSupertrend(ind IndicatorDefinition) (string, error) {
	period := g.getIntParam(ind.Params, "period", 10)
	multiplier := g.getFloatParam(ind.Params, "multiplier", 3.0)

	return fmt.Sprintf(`# Supertrend
atr = ta.ATR(dataframe, timeperiod=%d)
hl2 = (dataframe['high'] + dataframe['low']) / 2
dataframe['%s_upper'] = hl2 + (%v * atr)
dataframe['%s_lower'] = hl2 - (%v * atr)`,
		period, ind.ID, multiplier, ind.ID, multiplier), nil
}

// CUSTOM - Custom indicator (user-defined Python code)
func (g *IndicatorGenerator) generateCustom(ind IndicatorDefinition) (string, error) {
	if ind.Plugin != nil && ind.Plugin.PythonCode != "" {
		// Add required imports
		for _, imp := range ind.Plugin.RequiredImports {
			g.imports[imp] = true
		}
		// Return the custom Python code as-is
		return ind.Plugin.PythonCode, nil
	}
	return fmt.Sprintf("# Custom indicator '%s' - no code provided", ind.ID), nil
}

// GetImportStatements returns Python import statements for the required libraries
func (g *IndicatorGenerator) GetImportStatements() string {
	var imports []string

	if g.imports["talib"] {
		imports = append(imports, "import talib.abstract as ta")
	}
	if g.imports["qtpylib"] {
		imports = append(imports, "from technical import qtpylib")
	}
	if g.imports["numpy"] {
		imports = append(imports, "import numpy as np")
	}
	if g.imports["pandas"] {
		imports = append(imports, "import pandas as pd")
	}

	return strings.Join(imports, "\n")
}
