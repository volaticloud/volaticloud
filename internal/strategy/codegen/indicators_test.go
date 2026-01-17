package codegen

import (
	"strings"
	"testing"
)

func TestGenerateIndicator_RSI(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:     "rsi_1",
		Type:   IndicatorRSI,
		Params: map[string]interface{}{"period": 14},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	if !strings.Contains(result, "dataframe['rsi_1']") {
		t.Errorf("Expected indicator ID in output, got %q", result)
	}
	if !strings.Contains(result, "ta.RSI") {
		t.Errorf("Expected ta.RSI call, got %q", result)
	}
	if !strings.Contains(result, "timeperiod=14") {
		t.Errorf("Expected timeperiod=14, got %q", result)
	}
}

func TestGenerateIndicator_SMA(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:     "sma_20",
		Type:   IndicatorSMA,
		Params: map[string]interface{}{"period": 20, "source": "close"},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	if !strings.Contains(result, "dataframe['sma_20']") {
		t.Errorf("Expected indicator ID in output, got %q", result)
	}
	if !strings.Contains(result, "ta.SMA") {
		t.Errorf("Expected ta.SMA call, got %q", result)
	}
	if !strings.Contains(result, "dataframe['close']") {
		t.Errorf("Expected source close, got %q", result)
	}
	if !strings.Contains(result, "timeperiod=20") {
		t.Errorf("Expected timeperiod=20, got %q", result)
	}
}

func TestGenerateIndicator_EMA(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:     "ema_10",
		Type:   IndicatorEMA,
		Params: map[string]interface{}{"period": 10, "source": "high"},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	if !strings.Contains(result, "dataframe['ema_10']") {
		t.Errorf("Expected indicator ID in output, got %q", result)
	}
	if !strings.Contains(result, "ta.EMA") {
		t.Errorf("Expected ta.EMA call, got %q", result)
	}
	if !strings.Contains(result, "dataframe['high']") {
		t.Errorf("Expected source high, got %q", result)
	}
}

func TestGenerateIndicator_MACD(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:   "macd_1",
		Type: IndicatorMACD,
		Params: map[string]interface{}{
			"fast":   12,
			"slow":   26,
			"signal": 9,
		},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	// Check MACD generates all three outputs
	expectedParts := []string{
		"macd_1",
		"macd_1_signal",
		"macd_1_histogram",
		"ta.MACD",
		"fastperiod=12",
		"slowperiod=26",
		"signalperiod=9",
	}

	for _, part := range expectedParts {
		if !strings.Contains(result, part) {
			t.Errorf("Expected %q in MACD output, got %q", part, result)
		}
	}
}

func TestGenerateIndicator_BollingerBands(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:   "bb_1",
		Type: IndicatorBB,
		Params: map[string]interface{}{
			"period":  20,
			"std_dev": 2.0,
		},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	// Check BB generates all bands
	expectedParts := []string{
		"bb_1_upper",
		"bb_1_middle",
		"bb_1_lower",
		"bb_1_width",
		"ta.BBANDS",
		"timeperiod=20",
	}

	for _, part := range expectedParts {
		if !strings.Contains(result, part) {
			t.Errorf("Expected %q in BB output, got %q", part, result)
		}
	}
}

func TestGenerateIndicator_Stochastic(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:   "stoch_1",
		Type: IndicatorSTOCH,
		Params: map[string]interface{}{
			"k":      14,
			"d":      3,
			"smooth": 3,
		},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	expectedParts := []string{
		"stoch_1_k",
		"stoch_1_d",
		"ta.STOCH",
	}

	for _, part := range expectedParts {
		if !strings.Contains(result, part) {
			t.Errorf("Expected %q in Stochastic output, got %q", part, result)
		}
	}
}

func TestGenerateIndicator_ATR(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:     "atr_14",
		Type:   IndicatorATR,
		Params: map[string]interface{}{"period": 14},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	if !strings.Contains(result, "dataframe['atr_14']") {
		t.Errorf("Expected indicator ID in output, got %q", result)
	}
	if !strings.Contains(result, "ta.ATR") {
		t.Errorf("Expected ta.ATR call, got %q", result)
	}
}

func TestGenerateIndicator_ADX(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:     "adx_1",
		Type:   IndicatorADX,
		Params: map[string]interface{}{"period": 14},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	// ADX should include plus_di and minus_di
	expectedParts := []string{
		"adx_1",
		"adx_1_plus_di",
		"adx_1_minus_di",
		"ta.ADX",
		"ta.PLUS_DI",
		"ta.MINUS_DI",
	}

	for _, part := range expectedParts {
		if !strings.Contains(result, part) {
			t.Errorf("Expected %q in ADX output, got %q", part, result)
		}
	}
}

func TestGenerateIndicator_CCI(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:     "cci_1",
		Type:   IndicatorCCI,
		Params: map[string]interface{}{"period": 20},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	if !strings.Contains(result, "ta.CCI") {
		t.Errorf("Expected ta.CCI call, got %q", result)
	}
	if !strings.Contains(result, "timeperiod=20") {
		t.Errorf("Expected timeperiod=20, got %q", result)
	}
}

func TestGenerateIndicator_VWAP(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:     "vwap_1",
		Type:   IndicatorVWAP,
		Params: map[string]interface{}{},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	if !strings.Contains(result, "qtpylib.rolling_vwap") {
		t.Errorf("Expected qtpylib.rolling_vwap call, got %q", result)
	}

	// Check qtpylib import was tracked
	imports := g.GetRequiredImports()
	hasQtpylib := false
	for _, imp := range imports {
		if imp == "qtpylib" {
			hasQtpylib = true
			break
		}
	}
	if !hasQtpylib {
		t.Error("VWAP should require qtpylib import")
	}
}

func TestGenerateIndicator_Ichimoku(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:   "ichi_1",
		Type: IndicatorICHIMOKU,
		Params: map[string]interface{}{
			"conv": 9,
			"base": 26,
			"span": 52,
		},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	expectedParts := []string{
		"ichi_1_tenkan",
		"ichi_1_kijun",
		"ichi_1_senkou_a",
		"ichi_1_senkou_b",
	}

	for _, part := range expectedParts {
		if !strings.Contains(result, part) {
			t.Errorf("Expected %q in Ichimoku output, got %q", part, result)
		}
	}
}

func TestGenerateIndicator_SAR(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:   "sar_1",
		Type: IndicatorSAR,
		Params: map[string]interface{}{
			"acceleration": 0.02,
			"maximum":      0.2,
		},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	if !strings.Contains(result, "ta.SAR") {
		t.Errorf("Expected ta.SAR call, got %q", result)
	}
	if !strings.Contains(result, "acceleration=0.02") {
		t.Errorf("Expected acceleration param, got %q", result)
	}
	if !strings.Contains(result, "maximum=0.2") {
		t.Errorf("Expected maximum param, got %q", result)
	}
}

func TestGenerateIndicator_Supertrend(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:   "st_1",
		Type: IndicatorSUPERTREND,
		Params: map[string]interface{}{
			"period":     10,
			"multiplier": 3.0,
		},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	expectedParts := []string{
		"st_1_upper",
		"st_1_lower",
		"ta.ATR",
	}

	for _, part := range expectedParts {
		if !strings.Contains(result, part) {
			t.Errorf("Expected %q in Supertrend output, got %q", part, result)
		}
	}
}

func TestGenerateIndicator_Custom(t *testing.T) {
	tests := []struct {
		name     string
		ind      IndicatorDefinition
		expected string
	}{
		{
			name: "custom with code",
			ind: IndicatorDefinition{
				ID:   "custom_1",
				Type: IndicatorCUSTOM,
				Plugin: &IndicatorPlugin{
					Source:          "custom",
					PythonCode:      "        dataframe['custom_1'] = dataframe['close'].rolling(10).mean()",
					RequiredImports: []string{"pandas"},
				},
			},
			expected: "dataframe['custom_1'] = dataframe['close'].rolling(10).mean()",
		},
		{
			name: "custom without code",
			ind: IndicatorDefinition{
				ID:   "custom_2",
				Type: IndicatorCUSTOM,
			},
			expected: "# Custom indicator 'custom_2' - no code provided",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			g := NewIndicatorGenerator()

			result, err := g.GenerateIndicator(tt.ind)
			if err != nil {
				t.Fatalf("GenerateIndicator() error = %v", err)
			}

			if !strings.Contains(result, tt.expected) {
				t.Errorf("Expected %q in output, got %q", tt.expected, result)
			}
		})
	}
}

func TestGenerateAllIndicators(t *testing.T) {
	g := NewIndicatorGenerator()

	indicators := []IndicatorDefinition{
		{ID: "rsi_1", Type: IndicatorRSI, Params: map[string]interface{}{"period": 14}},
		{ID: "ema_20", Type: IndicatorEMA, Params: map[string]interface{}{"period": 20, "source": "close"}},
		{ID: "macd_1", Type: IndicatorMACD, Params: map[string]interface{}{"fast": 12, "slow": 26, "signal": 9}},
	}

	result, err := g.GenerateAllIndicators(indicators)
	if err != nil {
		t.Fatalf("GenerateAllIndicators() error = %v", err)
	}

	// Verify all indicators are in output
	for _, ind := range indicators {
		if !strings.Contains(result, ind.ID) {
			t.Errorf("Expected indicator %q in output", ind.ID)
		}
	}

	// Verify newlines separate indicators
	lines := strings.Split(result, "\n")
	if len(lines) < 3 {
		t.Errorf("Expected at least 3 lines of output for 3 indicators, got %d", len(lines))
	}
}

func TestGetImportStatements(t *testing.T) {
	g := NewIndicatorGenerator()

	// Generate indicators that require different imports
	indicators := []IndicatorDefinition{
		{ID: "rsi_1", Type: IndicatorRSI, Params: map[string]interface{}{"period": 14}}, // talib
		{ID: "vwap_1", Type: IndicatorVWAP, Params: map[string]interface{}{}},           // qtpylib
	}

	for _, ind := range indicators {
		_, err := g.GenerateIndicator(ind)
		if err != nil {
			t.Fatalf("GenerateIndicator() error = %v", err)
		}
	}

	imports := g.GetImportStatements()

	expectedImports := []string{
		"import talib.abstract as ta",
		"from technical import qtpylib",
	}

	for _, exp := range expectedImports {
		if !strings.Contains(imports, exp) {
			t.Errorf("Expected import %q in imports, got %q", exp, imports)
		}
	}
}

func TestGenerateIndicator_DefaultParams(t *testing.T) {
	g := NewIndicatorGenerator()

	// Test with empty params - should use defaults
	ind := IndicatorDefinition{
		ID:     "rsi_default",
		Type:   IndicatorRSI,
		Params: map[string]interface{}{},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	// RSI default period is 14
	if !strings.Contains(result, "timeperiod=14") {
		t.Errorf("Expected default timeperiod=14, got %q", result)
	}
}

func TestGenerateIndicator_UnknownType(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:     "unknown_1",
		Type:   "UNKNOWN_INDICATOR",
		Params: map[string]interface{}{},
	}

	_, err := g.GenerateIndicator(ind)
	if err == nil {
		t.Error("Expected error for unknown indicator type")
	}
	if !strings.Contains(err.Error(), "unknown indicator type") {
		t.Errorf("Expected 'unknown indicator type' error, got: %v", err)
	}
}

func TestHelperFunctions(t *testing.T) {
	g := NewIndicatorGenerator()

	t.Run("getIntParam with int", func(t *testing.T) {
		params := map[string]interface{}{"period": 20}
		result := g.getIntParam(params, "period", 14)
		if result != 20 {
			t.Errorf("Expected 20, got %d", result)
		}
	})

	t.Run("getIntParam with float64", func(t *testing.T) {
		params := map[string]interface{}{"period": 20.0}
		result := g.getIntParam(params, "period", 14)
		if result != 20 {
			t.Errorf("Expected 20, got %d", result)
		}
	})

	t.Run("getIntParam with default", func(t *testing.T) {
		params := map[string]interface{}{}
		result := g.getIntParam(params, "period", 14)
		if result != 14 {
			t.Errorf("Expected 14, got %d", result)
		}
	})

	t.Run("getFloatParam with float64", func(t *testing.T) {
		params := map[string]interface{}{"multiplier": 2.5}
		result := g.getFloatParam(params, "multiplier", 1.0)
		if result != 2.5 {
			t.Errorf("Expected 2.5, got %f", result)
		}
	})

	t.Run("getFloatParam with int", func(t *testing.T) {
		params := map[string]interface{}{"multiplier": 2}
		result := g.getFloatParam(params, "multiplier", 1.0)
		if result != 2.0 {
			t.Errorf("Expected 2.0, got %f", result)
		}
	})

	t.Run("getStringParam", func(t *testing.T) {
		params := map[string]interface{}{"source": "high"}
		result := g.getStringParam(params, "source", "close")
		if result != "high" {
			t.Errorf("Expected 'high', got %q", result)
		}
	})

	t.Run("getStringParam with default", func(t *testing.T) {
		params := map[string]interface{}{}
		result := g.getStringParam(params, "source", "close")
		if result != "close" {
			t.Errorf("Expected 'close', got %q", result)
		}
	})
}

func TestGenerateIndicator_CMF(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:     "cmf_1",
		Type:   IndicatorCMF,
		Params: map[string]interface{}{"period": 20},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	// CMF uses custom calculation, not talib
	if !strings.Contains(result, "cmf_1") {
		t.Errorf("Expected indicator ID in output, got %q", result)
	}
	if !strings.Contains(result, "rolling(20)") {
		t.Errorf("Expected rolling window, got %q", result)
	}
	if !strings.Contains(result, "Chaikin Money Flow") {
		t.Errorf("Expected CMF comment, got %q", result)
	}
}

func TestGenerateIndicator_OBV(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:     "obv_1",
		Type:   IndicatorOBV,
		Params: map[string]interface{}{},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	if !strings.Contains(result, "ta.OBV") {
		t.Errorf("Expected ta.OBV call, got %q", result)
	}
}

func TestGenerateIndicator_MFI(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:     "mfi_1",
		Type:   IndicatorMFI,
		Params: map[string]interface{}{"period": 14},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	if !strings.Contains(result, "ta.MFI") {
		t.Errorf("Expected ta.MFI call, got %q", result)
	}
	if !strings.Contains(result, "timeperiod=14") {
		t.Errorf("Expected timeperiod=14, got %q", result)
	}
}

func TestGenerateIndicator_WilliamsR(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:     "willr_1",
		Type:   IndicatorWILLR,
		Params: map[string]interface{}{"period": 14},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	if !strings.Contains(result, "ta.WILLR") {
		t.Errorf("Expected ta.WILLR call, got %q", result)
	}
}

func TestGenerateIndicator_Momentum(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:     "mom_1",
		Type:   IndicatorMOM,
		Params: map[string]interface{}{"period": 10},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	if !strings.Contains(result, "ta.MOM") {
		t.Errorf("Expected ta.MOM call, got %q", result)
	}
}

func TestGenerateIndicator_ROC(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:     "roc_1",
		Type:   IndicatorROC,
		Params: map[string]interface{}{"period": 10},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	if !strings.Contains(result, "ta.ROC") {
		t.Errorf("Expected ta.ROC call, got %q", result)
	}
}

func TestGenerateIndicator_StochasticRSI(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:   "stochrsi_1",
		Type: IndicatorSTOCHRSI,
		Params: map[string]interface{}{
			"period": 14,
			"k":      3,
			"d":      3,
		},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	expectedParts := []string{
		"stochrsi_1_k",
		"stochrsi_1_d",
		"ta.STOCHRSI",
	}

	for _, part := range expectedParts {
		if !strings.Contains(result, part) {
			t.Errorf("Expected %q in StochasticRSI output, got %q", part, result)
		}
	}
}

func TestGenerateIndicator_AD(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:     "ad_1",
		Type:   IndicatorAD,
		Params: map[string]interface{}{},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	if !strings.Contains(result, "ta.AD") {
		t.Errorf("Expected ta.AD call, got %q", result)
	}
}

func TestGenerateIndicator_WMA(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:     "wma_1",
		Type:   IndicatorWMA,
		Params: map[string]interface{}{"period": 20, "source": "close"},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	if !strings.Contains(result, "ta.WMA") {
		t.Errorf("Expected ta.WMA call, got %q", result)
	}
}

func TestGenerateIndicator_DEMA(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:     "dema_1",
		Type:   IndicatorDEMA,
		Params: map[string]interface{}{"period": 20, "source": "close"},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	if !strings.Contains(result, "ta.DEMA") {
		t.Errorf("Expected ta.DEMA call, got %q", result)
	}
}

func TestGenerateIndicator_TEMA(t *testing.T) {
	g := NewIndicatorGenerator()

	ind := IndicatorDefinition{
		ID:     "tema_1",
		Type:   IndicatorTEMA,
		Params: map[string]interface{}{"period": 20, "source": "close"},
	}

	result, err := g.GenerateIndicator(ind)
	if err != nil {
		t.Fatalf("GenerateIndicator() error = %v", err)
	}

	if !strings.Contains(result, "ta.TEMA") {
		t.Errorf("Expected ta.TEMA call, got %q", result)
	}
}
