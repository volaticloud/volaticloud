package graph

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/xeipuuv/gojsonschema"
)

const freqtradeSchemaURL = "https://schema.freqtrade.io/schema.json"

var (
	schemaLoader     gojsonschema.JSONLoader
	schemaLoaderOnce sync.Once
	schemaLoaderErr  error
)

// getSchemaLoader returns a cached schema loader
func getSchemaLoader() (gojsonschema.JSONLoader, error) {
	schemaLoaderOnce.Do(func() {
		schemaLoader = gojsonschema.NewReferenceLoader(freqtradeSchemaURL)

		// Pre-validate the schema is accessible
		_, err := schemaLoader.LoadJSON()
		if err != nil {
			schemaLoaderErr = fmt.Errorf("failed to load Freqtrade schema from %s: %w", freqtradeSchemaURL, err)
			return
		}
	})

	return schemaLoader, schemaLoaderErr
}

// validateFreqtradeConfigWithSchema validates a config against the Freqtrade JSON schema
func validateFreqtradeConfigWithSchema(config map[string]interface{}) error {
	if config == nil {
		return fmt.Errorf("config cannot be nil")
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

	// Validate
	result, err := gojsonschema.Validate(schemaLoader, documentLoader)
	if err != nil {
		return fmt.Errorf("schema validation failed: %w", err)
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
		return fmt.Errorf("config validation failed: %s", errMsg)
	}

	return nil
}