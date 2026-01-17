// Package strategy provides strategy domain logic
package strategy

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"

	"volaticloud/internal/strategy/codegen"
)

// PreviewResult contains the result of a strategy code preview generation.
type PreviewResult struct {
	// Success indicates whether code generation succeeded
	Success bool
	// Code is the generated Python strategy code (empty if Success is false)
	Code string
	// Error contains the error message if Success is false
	Error string
}

// classNameRegex validates PascalCase class names.
// Must start with uppercase letter, followed by alphanumeric characters.
var classNameRegex = regexp.MustCompile(`^[A-Z][a-zA-Z0-9]*$`)

// MaxClassNameLength is the maximum allowed length for a class name.
const MaxClassNameLength = 100

// ValidateClassName validates that a class name is safe for use in generated code.
// Class names must be PascalCase and not exceed MaxClassNameLength characters.
func ValidateClassName(name string) error {
	if len(name) == 0 {
		return fmt.Errorf("class name is required")
	}
	if len(name) > MaxClassNameLength {
		return fmt.Errorf("class name too long: %d characters (max %d)", len(name), MaxClassNameLength)
	}
	if !classNameRegex.MatchString(name) {
		return fmt.Errorf("invalid class name: must be PascalCase (start with uppercase letter, followed by alphanumeric characters)")
	}
	return nil
}

// PreviewStrategyCode generates Python strategy code from a UI builder configuration.
// This is the domain entry point that handles validation and delegates to the codegen package.
//
// Parameters:
//   - config: The UI builder configuration map containing indicators, conditions, etc.
//   - className: The Python class name for the generated strategy (must be PascalCase)
//
// Returns a PreviewResult with either the generated code or an error message.
// This function never returns an error - all errors are captured in PreviewResult.Error.
func PreviewStrategyCode(config map[string]interface{}, className string) *PreviewResult {
	// Validate class name for security (prevent code injection)
	if err := ValidateClassName(className); err != nil {
		return &PreviewResult{
			Success: false,
			Error:   err.Error(),
		}
	}

	// Validate config size (DoS protection)
	if err := codegen.ValidateConfigSize(config); err != nil {
		return &PreviewResult{
			Success: false,
			Error:   err.Error(),
		}
	}

	// Generate the code
	code, err := codegen.PreviewStrategyCode(config, className)
	if err != nil {
		return &PreviewResult{
			Success: false,
			Error:   err.Error(),
		}
	}

	return &PreviewResult{
		Success: true,
		Code:    code,
	}
}

// NameToClassName converts a strategy name to a valid Python PascalCase class name.
// Examples:
//   - "my strategy" -> "MyStrategy"
//   - "NewBuilderStrat" -> "NewBuilderStrat" (preserved)
//   - "test-strategy_123" -> "TestStrategy123"
func NameToClassName(name string) string {
	if name == "" {
		return "MyStrategy"
	}

	// Remove invalid characters (keep alphanumeric and spaces)
	var sanitized strings.Builder
	for _, r := range name {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == ' ' {
			sanitized.WriteRune(r)
		}
	}
	result := sanitized.String()
	if result == "" {
		return "MyStrategy"
	}

	// If no spaces, preserve original casing (just ensure first char is uppercase)
	if !strings.Contains(result, " ") {
		runes := []rune(result)
		runes[0] = unicode.ToUpper(runes[0])
		return string(runes)
	}

	// Convert space-separated words to PascalCase
	words := strings.Fields(result)
	var className strings.Builder
	for _, word := range words {
		if len(word) > 0 {
			runes := []rune(word)
			className.WriteRune(unicode.ToUpper(runes[0]))
			for _, r := range runes[1:] {
				className.WriteRune(unicode.ToLower(r))
			}
		}
	}

	finalName := className.String()
	if finalName == "" {
		return "MyStrategy"
	}
	return finalName
}

// GenerateCodeFromUIBuilder generates Python strategy code from UI builder config.
// This is used when saving a strategy with builderMode="ui" to ensure the code
// matches the UI builder configuration.
//
// Parameters:
//   - name: The strategy name (will be converted to PascalCase class name)
//   - config: The full strategy config containing ui_builder config
//
// Returns the generated code and any error encountered.
func GenerateCodeFromUIBuilder(name string, config map[string]interface{}) (string, error) {
	// Extract ui_builder config
	uiBuilder, ok := config["ui_builder"]
	if !ok {
		return "", fmt.Errorf("config missing ui_builder field for UI builder mode strategy")
	}

	// Convert strategy name to class name
	className := NameToClassName(name)

	// Validate class name
	if err := ValidateClassName(className); err != nil {
		return "", fmt.Errorf("invalid class name: %w", err)
	}

	// Validate config size
	if err := codegen.ValidateConfigSize(config); err != nil {
		return "", fmt.Errorf("config validation failed: %w", err)
	}

	// Build the config for code generation (needs the full config with ui_builder)
	fullConfig := map[string]interface{}{
		"ui_builder": uiBuilder,
	}

	// Add other fields that might be needed
	if timeframe, ok := config["timeframe"]; ok {
		fullConfig["timeframe"] = timeframe
	}
	if stakeCurrency, ok := config["stake_currency"]; ok {
		fullConfig["stake_currency"] = stakeCurrency
	}
	if stakeAmount, ok := config["stake_amount"]; ok {
		fullConfig["stake_amount"] = stakeAmount
	}

	// Generate the code
	code, err := codegen.PreviewStrategyCode(fullConfig, className)
	if err != nil {
		return "", fmt.Errorf("code generation failed: %w", err)
	}

	return code, nil
}
