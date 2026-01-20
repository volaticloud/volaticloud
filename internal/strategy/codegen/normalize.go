package codegen

// NormalizeUIBuilderConfig converts v1 (flat) format to v2 (nested) format
// for backwards compatibility. If the config is already v2, it returns it unchanged.
//
// Migration rules:
// - v1 configs have entry_conditions/exit_conditions at the top level
// - v2 configs have long/short SignalConfig with nested entry/exit conditions
// - Default position_mode is LONG_ONLY for backwards compatibility
func NormalizeUIBuilderConfig(config *UIBuilderConfig) *UIBuilderConfig {
	if config == nil {
		return nil
	}

	// Check if already v2 format (has Long or Short signal config)
	if config.Long != nil || config.Short != nil {
		// Already v2, ensure position_mode is set
		if config.PositionMode == "" {
			config.PositionMode = PositionModeLongOnly
		}
		return config
	}

	// Check if v1 format has conditions to migrate
	hasV1Conditions := config.EntryConditions.raw != nil || config.ExitConditions.raw != nil

	if !hasV1Conditions {
		// No conditions at all - return with defaults
		if config.PositionMode == "" {
			config.PositionMode = PositionModeLongOnly
		}
		return config
	}

	// Migrate v1 → v2
	config.Version = 2
	config.PositionMode = PositionModeLongOnly
	config.Long = &SignalConfig{
		EntryConditions: config.EntryConditions,
		ExitConditions:  config.ExitConditions,
	}

	// Clear deprecated fields (they're now in Long)
	config.EntryConditions = ConditionNode{}
	config.ExitConditions = ConditionNode{}

	return config
}

// IsV2Config returns true if the config is in v2 format (has nested signal config)
func IsV2Config(config *UIBuilderConfig) bool {
	if config == nil {
		return false
	}
	return config.Long != nil || config.Short != nil
}

// GetEffectiveLongEntry returns the entry conditions for long positions,
// handling both v1 and v2 config formats
func GetEffectiveLongEntry(config *UIBuilderConfig) *ConditionNode {
	if config == nil {
		return nil
	}

	// Normalize first
	config = NormalizeUIBuilderConfig(config)

	if config.Long != nil {
		return &config.Long.EntryConditions
	}
	return nil
}

// GetEffectiveLongExit returns the exit conditions for long positions,
// handling both v1 and v2 config formats
func GetEffectiveLongExit(config *UIBuilderConfig) *ConditionNode {
	if config == nil {
		return nil
	}

	// Normalize first
	config = NormalizeUIBuilderConfig(config)

	if config.Long != nil {
		return &config.Long.ExitConditions
	}
	return nil
}

// GetEffectiveShortEntry returns the entry conditions for short positions
func GetEffectiveShortEntry(config *UIBuilderConfig) *ConditionNode {
	if config == nil {
		return nil
	}

	// Normalize first
	config = NormalizeUIBuilderConfig(config)

	if config.Short != nil {
		return &config.Short.EntryConditions
	}
	return nil
}

// GetEffectiveShortExit returns the exit conditions for short positions
func GetEffectiveShortExit(config *UIBuilderConfig) *ConditionNode {
	if config == nil {
		return nil
	}

	// Normalize first
	config = NormalizeUIBuilderConfig(config)

	if config.Short != nil {
		return &config.Short.ExitConditions
	}
	return nil
}

// ShouldGenerateLongSignals returns true if the position mode includes long signals
func ShouldGenerateLongSignals(config *UIBuilderConfig) bool {
	if config == nil {
		return true // Default to long-only
	}

	switch config.PositionMode {
	case PositionModeLongOnly, PositionModeLongAndShort:
		return true
	case PositionModeShortOnly:
		return false
	default:
		return true // Default to long-only
	}
}

// ShouldGenerateShortSignals returns true if the position mode includes short signals
func ShouldGenerateShortSignals(config *UIBuilderConfig) bool {
	if config == nil {
		return false // Default to long-only (no shorts)
	}

	switch config.PositionMode {
	case PositionModeShortOnly, PositionModeLongAndShort:
		return true
	case PositionModeLongOnly:
		return false
	default:
		return false // Default to long-only (no shorts)
	}
}
