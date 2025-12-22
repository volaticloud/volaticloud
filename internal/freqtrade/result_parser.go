package freqtrade

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

// JSON markers used in stdout to delimit JSON content
const (
	MarkerResultJSONStart = "===BACKTEST_RESULT_JSON_START==="
	MarkerFullResultStart = "===BACKTEST_FULL_RESULT_START==="
	MarkerFullResultEnd   = "===BACKTEST_FULL_RESULT_END==="
)

// ParsedBacktestResult contains the parsed backtest result data
type ParsedBacktestResult struct {
	// RawResult is the full backtest result JSON as map
	RawResult map[string]interface{}
	// LastResult contains .last_result.json content (filename reference)
	LastResult map[string]interface{}
	// Error message if parsing failed
	Error string
}

// ParseResultFromJSON parses a raw JSON byte slice into a map
// This is the core parsing function used by both Docker and Kubernetes
func ParseResultFromJSON(data []byte) (map[string]interface{}, error) {
	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}
	return result, nil
}

// ParseResultFromLogs extracts backtest result JSON from container logs
// This is used by Kubernetes where results are output to stdout with markers
func ParseResultFromLogs(logs string) (*ParsedBacktestResult, error) {
	result := &ParsedBacktestResult{}

	// Extract .last_result.json content (between start marker and next marker or full result)
	lastResultJSON := extractBetweenMarkers(logs, MarkerResultJSONStart, MarkerFullResultStart)
	if lastResultJSON == "" {
		// Try without full result marker (backtest may have failed before generating full result)
		lastResultJSON = extractAfterMarker(logs, MarkerResultJSONStart)
	}

	if lastResultJSON != "" {
		lastResultJSON = strings.TrimSpace(lastResultJSON)
		var lastResult map[string]interface{}
		if err := json.Unmarshal([]byte(lastResultJSON), &lastResult); err != nil {
			result.Error = fmt.Sprintf("failed to parse .last_result.json: %v", err)
		} else {
			result.LastResult = lastResult
		}
	}

	// Extract full result JSON (between full result markers)
	fullResultJSON := extractBetweenMarkers(logs, MarkerFullResultStart, MarkerFullResultEnd)
	if fullResultJSON != "" {
		fullResultJSON = strings.TrimSpace(fullResultJSON)
		var fullResult map[string]interface{}
		if err := json.Unmarshal([]byte(fullResultJSON), &fullResult); err != nil {
			if result.Error == "" {
				result.Error = fmt.Sprintf("failed to parse full result JSON: %v", err)
			}
		} else {
			result.RawResult = fullResult
		}
	}

	// If we have last_result but no full result, use last_result as raw result
	if result.RawResult == nil && result.LastResult != nil {
		result.RawResult = result.LastResult
	}

	if result.RawResult == nil && result.LastResult == nil {
		return nil, fmt.Errorf("no backtest result JSON found in logs")
	}

	return result, nil
}

// extractBetweenMarkers extracts content between start and end markers
func extractBetweenMarkers(text, startMarker, endMarker string) string {
	startIdx := strings.Index(text, startMarker)
	if startIdx == -1 {
		return ""
	}
	startIdx += len(startMarker)

	endIdx := strings.Index(text[startIdx:], endMarker)
	if endIdx == -1 {
		return ""
	}

	return text[startIdx : startIdx+endIdx]
}

// extractAfterMarker extracts content after a marker until end of string or next line starting with ===
func extractAfterMarker(text, marker string) string {
	startIdx := strings.Index(text, marker)
	if startIdx == -1 {
		return ""
	}
	startIdx += len(marker)

	remaining := text[startIdx:]
	// Find next marker or end
	nextMarkerIdx := strings.Index(remaining, "\n===")
	if nextMarkerIdx == -1 {
		return remaining
	}
	return remaining[:nextMarkerIdx]
}

// GetLatestBacktestFilename extracts the latest backtest filename from .last_result.json
func GetLatestBacktestFilename(lastResult map[string]interface{}) (string, error) {
	latestBacktest, ok := lastResult["latest_backtest"].(string)
	if !ok || latestBacktest == "" {
		return "", fmt.Errorf("no latest_backtest field found in .last_result.json")
	}
	return latestBacktest, nil
}

// ExtractJSONFilenameFromZip converts a zip filename to its contained JSON filename
// e.g., "backtest-result-2024-01-01_00-00-00.zip" -> "backtest-result-2024-01-01_00-00-00.json"
func ExtractJSONFilenameFromZip(zipFilename string) string {
	return strings.Replace(zipFilename, ".zip", ".json", 1)
}

// ValidateBacktestResult performs basic validation on a parsed backtest result
func ValidateBacktestResult(result map[string]interface{}) error {
	// Check for required fields
	if _, ok := result["strategy"]; !ok {
		return fmt.Errorf("missing 'strategy' field in backtest result")
	}
	return nil
}

// ExtractStrategyResults extracts strategy-specific results from the full backtest result
// Returns the strategy name and its result data
func ExtractStrategyResults(result map[string]interface{}) (string, map[string]interface{}, error) {
	strategyMap, ok := result["strategy"].(map[string]interface{})
	if !ok || len(strategyMap) == 0 {
		return "", nil, fmt.Errorf("no strategy data in result")
	}

	// Get first (and usually only) strategy
	for name, data := range strategyMap {
		strategyData, ok := data.(map[string]interface{})
		if !ok {
			return "", nil, fmt.Errorf("invalid strategy data format")
		}
		return name, strategyData, nil
	}

	return "", nil, fmt.Errorf("no strategy found in result")
}

// ParseTradesFromResult extracts trade data from backtest result
func ParseTradesFromResult(result map[string]interface{}) ([]map[string]interface{}, error) {
	strategyName, strategyData, err := ExtractStrategyResults(result)
	if err != nil {
		return nil, err
	}

	tradesKey := fmt.Sprintf("trades_%s", strategyName)
	trades, ok := result[tradesKey].([]interface{})
	if !ok {
		// Try from strategy data
		trades, ok = strategyData["trades"].([]interface{})
		if !ok {
			return nil, nil // No trades found, not an error
		}
	}

	var parsedTrades []map[string]interface{}
	for _, t := range trades {
		if trade, ok := t.(map[string]interface{}); ok {
			parsedTrades = append(parsedTrades, trade)
		}
	}

	return parsedTrades, nil
}

// ExtractBacktestMetrics extracts common metrics from backtest result into a flat structure
func ExtractBacktestMetrics(result map[string]interface{}) map[string]interface{} {
	_, strategyData, err := ExtractStrategyResults(result)
	if err != nil {
		return nil
	}

	metrics := make(map[string]interface{})

	// Copy relevant metrics
	metricKeys := []string{
		"total_trades", "wins", "losses", "draws",
		"profit_total", "profit_total_abs", "profit_mean", "profit_mean_pct",
		"winrate", "win_rate",
		"max_drawdown", "max_drawdown_abs", "max_drawdown_account",
		"profit_factor", "expectancy", "expectancy_ratio",
		"sharpe", "sortino", "calmar",
		"avg_stake_amount", "total_volume",
		"backtest_start", "backtest_end", "backtest_days",
		"stake_currency", "starting_balance", "final_balance",
		"trades_per_day", "holding_avg", "holding_avg_s",
	}

	for _, key := range metricKeys {
		if val, ok := strategyData[key]; ok {
			metrics[key] = val
		}
	}

	return metrics
}

// ContainsBacktestMarkers checks if logs contain backtest result markers
func ContainsBacktestMarkers(logs string) bool {
	return strings.Contains(logs, MarkerResultJSONStart) ||
		strings.Contains(logs, MarkerFullResultStart)
}

// ExtractFreqtradeVersion attempts to extract freqtrade version from logs
func ExtractFreqtradeVersion(logs string) string {
	// Pattern: "freqtrade 2024.11.2" or similar
	re := regexp.MustCompile(`freqtrade\s+(\d+\.\d+\.?\d*)`)
	matches := re.FindStringSubmatch(logs)
	if len(matches) >= 2 {
		return matches[1]
	}
	return ""
}

// CleanLogs removes JSON markers and their content from logs, returning only clean freqtrade output
// This is used to store human-readable logs in the database without the JSON parsing artifacts
func CleanLogs(logs string) string {
	result := logs

	// Remove the .last_result.json section (from start marker to full result start or end of content)
	if idx := strings.Index(result, MarkerResultJSONStart); idx != -1 {
		endIdx := strings.Index(result[idx:], MarkerFullResultStart)
		if endIdx != -1 {
			// Remove from marker to just before full result marker
			result = result[:idx] + result[idx+endIdx:]
		} else {
			// No full result marker, remove everything from this marker onwards
			// But first check if there's content after the JSON
			afterMarker := result[idx+len(MarkerResultJSONStart):]
			// Find end of JSON (next line that doesn't look like JSON)
			lines := strings.Split(afterMarker, "\n")
			cleanLines := []string{}
			jsonEnded := false
			for _, line := range lines {
				trimmed := strings.TrimSpace(line)
				if !jsonEnded {
					// Skip until we find a line that's not part of JSON
					if trimmed == "" || trimmed[0] == '{' || trimmed[0] == '}' || trimmed[0] == '"' {
						continue
					}
					jsonEnded = true
				}
				if jsonEnded {
					cleanLines = append(cleanLines, line)
				}
			}
			result = result[:idx] + strings.Join(cleanLines, "\n")
		}
	}

	// Remove the full result JSON section (between start and end markers)
	for {
		startIdx := strings.Index(result, MarkerFullResultStart)
		if startIdx == -1 {
			break
		}
		endIdx := strings.Index(result[startIdx:], MarkerFullResultEnd)
		if endIdx == -1 {
			// No end marker, remove from start marker to end
			result = result[:startIdx]
			break
		}
		// Remove the entire section including end marker
		result = result[:startIdx] + result[startIdx+endIdx+len(MarkerFullResultEnd):]
	}

	// Clean up any leftover empty lines at the end
	result = strings.TrimRight(result, "\n\r\t ")

	return result
}
