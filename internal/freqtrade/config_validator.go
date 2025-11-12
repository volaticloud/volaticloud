package freqtrade

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/xeipuuv/gojsonschema"
)

const FreqtradeSchemaURL = "https://schema.freqtrade.io/schema.json"

var (
	schemaLoader     gojsonschema.JSONLoader
	schemaLoaderOnce sync.Once
	schemaLoaderErr  error
)

// getSchemaLoader returns a cached schema loader for the Freqtrade JSON schema
func getSchemaLoader() (gojsonschema.JSONLoader, error) {
	schemaLoaderOnce.Do(func() {
		schemaLoader = gojsonschema.NewReferenceLoader(FreqtradeSchemaURL)

		// Pre-validate the schema is accessible
		_, err := schemaLoader.LoadJSON()
		if err != nil {
			schemaLoaderErr = fmt.Errorf("failed to load Freqtrade schema from %s: %w", FreqtradeSchemaURL, err)
			return
		}
	})

	return schemaLoader, schemaLoaderErr
}

// ValidateConfig validates that a config is a complete, valid Freqtrade configuration.
// This validates against the official Freqtrade JSON schema.
func ValidateConfig(config map[string]interface{}) error {
	if len(config) == 0 {
		return fmt.Errorf("freqtrade config is required. Config must be a complete Freqtrade configuration")
	}

	// Get the schema loader
	schemaLoader, err := getSchemaLoader()
	if err != nil {
		return err
	}

	// Convert config to JSON for validation
	configJSON, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	// Create document loader from config
	documentLoader := gojsonschema.NewBytesLoader(configJSON)

	// Validate against Freqtrade schema
	result, err := gojsonschema.Validate(schemaLoader, documentLoader)
	if err != nil {
		return fmt.Errorf("config schema validation failed: %w", err)
	}

	if !result.Valid() {
		// Build error message from validation errors
		var errMsg string
		for i, desc := range result.Errors() {
			if i > 0 {
				errMsg += "; "
			}
			errMsg += fmt.Sprintf("%s: %s", desc.Field(), desc.Description())
		}
		return fmt.Errorf("freqtrade config validation failed: %s", errMsg)
	}

	return nil
}
