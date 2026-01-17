// Package strategy provides strategy domain logic
package strategy

import (
	"fmt"
	"regexp"

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