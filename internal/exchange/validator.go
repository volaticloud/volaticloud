package exchange

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

// ValidateConfigWithSchema validates an exchange config against Freqtrade schema
// Exchange configs should contain the "exchange" object with name, key, secret, and optional settings
func ValidateConfigWithSchema(config map[string]interface{}) error {
	if config == nil {
		return fmt.Errorf("exchange config cannot be nil")
	}

	// Wrap config in a minimal Freqtrade config structure for validation
	// The Freqtrade schema expects exchange config to be under the "exchange" key
	wrappedConfig := map[string]interface{}{
		"exchange": config,
		// Add minimal required fields to satisfy schema validation
		"stake_currency": "USDT",
		"dry_run":        true,
	}

	// Check if config is already wrapped (has "exchange" key)
	if _, hasExchange := config["exchange"]; hasExchange {
		wrappedConfig = config
	}

	// Get the schema loader
	schemaLoader, err := getSchemaLoader()
	if err != nil {
		return err
	}

	// Convert config to JSON for validation
	configJSON, err := json.Marshal(wrappedConfig)
	if err != nil {
		return fmt.Errorf("failed to marshal exchange config: %w", err)
	}

	// Create document loader from config
	documentLoader := gojsonschema.NewBytesLoader(configJSON)

	// Validate
	result, err := gojsonschema.Validate(schemaLoader, documentLoader)
	if err != nil {
		return fmt.Errorf("exchange schema validation failed: %w", err)
	}

	if !result.Valid() {
		// Build error message from validation errors, filtering out errors from wrapper fields
		var errMsg string
		errorCount := 0
		for _, desc := range result.Errors() {
			field := desc.Field()
			// Only include errors related to exchange fields
			if field == "exchange" || (len(field) > 9 && field[:9] == "exchange.") {
				if errorCount > 0 {
					errMsg += "; "
				}
				errMsg += fmt.Sprintf("%s: %s", desc.Field(), desc.Description())
				errorCount++
			}
		}

		if errorCount > 0 {
			return fmt.Errorf("exchange config validation failed: %s", errMsg)
		}
	}

	return nil
}