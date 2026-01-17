package enum

import (
	"fmt"
	"io"
	"strconv"
)

// StrategyBuilderMode represents the strategy editing mode
type StrategyBuilderMode string

const (
	// StrategyBuilderModeUI indicates the strategy was created with the UI builder
	// and its code is generated from the ui_builder config
	StrategyBuilderModeUI StrategyBuilderMode = "ui"

	// StrategyBuilderModeCode indicates the strategy uses direct Python code editing
	// (either created manually or ejected from UI builder)
	StrategyBuilderModeCode StrategyBuilderMode = "code"
)

// Values returns all possible strategy builder mode values
func (StrategyBuilderMode) Values() []string {
	return []string{
		string(StrategyBuilderModeUI),
		string(StrategyBuilderModeCode),
	}
}

// MarshalGQL implements graphql.Marshaler for StrategyBuilderMode
func (s StrategyBuilderMode) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(string(s)))
}

// UnmarshalGQL implements graphql.Unmarshaler for StrategyBuilderMode
func (s *StrategyBuilderMode) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("strategy builder mode must be a string")
	}
	*s = StrategyBuilderMode(str)
	return nil
}
