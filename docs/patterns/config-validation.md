# Config Validation Pattern

## Problem

How do you validate complex configuration objects (bot configs, exchange configs) against:
- Official external schemas (Freqtrade JSON schema)
- Custom business rules
- Required vs optional fields
- Type safety across JSON boundaries

## Solution

Use a layered validation approach combining JSON Schema validation for external compatibility and custom Go validators for business logic. Validate early (at resolver/hook level) before database persistence.

## Implementation

### 1. JSON Schema Validation (External Compatibility)

#### Fetch and Cache Schema

```go
// internal/graph/schema_validator.go
package graph

import (
    "sync"
    "github.com/xeipuuv/gojsonschema"
)

var (
    freqtradeSchema     *gojsonschema.Schema
    freqtradeSchemaOnce sync.Once
)

func getFreqtradeSchema() (*gojsonschema.Schema, error) {
    var err error

    freqtradeSchemaOnce.Do(func() {
        // Fetch official Freqtrade schema
        schemaLoader := gojsonschema.NewReferenceLoader(
            "https://schema.freqtrade.io/schema.json")

        freqtradeSchema, err = gojsonschema.NewSchema(schemaLoader)
    })

    return freqtradeSchema, err
}
```

#### Validate Against Schema

```go
func validateFreqtradeConfigWithSchema(config map[string]interface{}) error {
    schema, err := getFreqtradeSchema()
    if err != nil {
        return fmt.Errorf("loading Freqtrade schema: %w", err)
    }

    // Convert config to JSON document
    documentLoader := gojsonschema.NewGoLoader(config)

    // Validate
    result, err := schema.Validate(documentLoader)
    if err != nil {
        return fmt.Errorf("validating config: %w", err)
    }

    if !result.Valid() {
        var errors []string
        for _, err := range result.Errors() {
            errors = append(errors, err.String())
        }
        return fmt.Errorf("config validation failed: %s",
            strings.Join(errors, "; "))
    }

    return nil
}
```

### 2. Custom Business Logic Validation

```go
// internal/bot/config.go
package bot

import "fmt"

// ValidateConfig validates bot-specific business rules
func ValidateConfig(config map[string]interface{}) error {
    // Required fields
    if _, ok := config["stake_currency"]; !ok {
        return fmt.Errorf("missing required field: stake_currency")
    }

    if _, ok := config["stake_amount"]; !ok {
        return fmt.Errorf("missing required field: stake_amount")
    }

    // Type validation
    stakeCurrency, ok := config["stake_currency"].(string)
    if !ok {
        return fmt.Errorf("stake_currency must be a string")
    }

    if stakeCurrency == "" {
        return fmt.Errorf("stake_currency cannot be empty")
    }

    // Numeric validation
    stakeAmount, ok := config["stake_amount"].(float64)
    if !ok {
        return fmt.Errorf("stake_amount must be a number")
    }

    if stakeAmount <= 0 {
        return fmt.Errorf("stake_amount must be positive")
    }

    // Nested object validation
    if err := validatePricing("entry_pricing", config); err != nil {
        return err
    }

    if err := validatePricing("exit_pricing", config); err != nil {
        return err
    }

    return nil
}

func validatePricing(key string, config map[string]interface{}) error {
    pricing, ok := config[key].(map[string]interface{})
    if !ok {
        return fmt.Errorf("%s must be an object", key)
    }

    requiredFields := []string{"price_side", "use_order_book", "order_book_top"}
    for _, field := range requiredFields {
        if _, ok := pricing[field]; !ok {
            return fmt.Errorf("%s.%s is required", key, field)
        }
    }

    return nil
}
```

### 3. Exchange Config Validation with Filtering

```go
// internal/exchange/validator.go
package exchange

import (
    "fmt"
    "volaticloud/internal/graph"
)

// ValidateConfigWithSchema validates exchange config against Freqtrade schema
func ValidateConfigWithSchema(config map[string]interface{}) error {
    // Wrap partial config in minimal Freqtrade structure
    wrappedConfig := map[string]interface{}{
        "exchange":       config,
        "stake_currency": "USDT",  // Minimal required field
        "stake_amount":   100,     // Minimal required field
    }

    // Validate using full schema
    schema, err := graph.GetFreqtradeSchema()
    if err != nil {
        return err
    }

    result, err := schema.Validate(gojsonschema.NewGoLoader(wrappedConfig))
    if err != nil {
        return err
    }

    if !result.Valid() {
        // Filter to only exchange-related errors
        var exchangeErrors []string
        for _, err := range result.Errors() {
            if strings.HasPrefix(err.Field(), "exchange.") {
                exchangeErrors = append(exchangeErrors, err.String())
            }
        }

        if len(exchangeErrors) > 0 {
            return fmt.Errorf("exchange config validation failed: %s",
                strings.Join(exchangeErrors, "; "))
        }
    }

    return nil
}
```

### 4. ENT Hook Validation

```go
// internal/ent/schema/exchange_hooks.go
package schema

import (
    "context"
    "volaticloud/internal/exchange"
    "volaticloud/internal/ent"
    "volaticloud/internal/ent/hook"
)

func (Exchange) Hooks() []ent.Hook {
    return []ent.Hook{
        // Validate on create
        hook.On(func(next ent.Mutator) ent.Mutator {
            return hook.ExchangeFunc(func(ctx context.Context,
                m *ent.ExchangeMutation) (ent.Value, error) {

                // Get config from mutation
                if config, ok := m.Config(); ok {
                    if err := exchange.ValidateConfigWithSchema(config); err != nil {
                        return nil, fmt.Errorf("validation failed: %w", err)
                    }
                }

                return next.Mutate(ctx, m)
            })
        }, ent.OpCreate|ent.OpUpdateOne),
    }
}
```

### 5. Resolver-Level Validation

```go
// internal/graph/schema.resolvers.go
func (r *mutationResolver) UpdateBot(ctx context.Context,
    id uuid.UUID, input ent.UpdateBotInput) (*ent.Bot, error) {

    // Validate before database operation
    if input.Config != nil {
        // Business logic validation
        if err := bot.ValidateConfig(input.Config); err != nil {
            return nil, fmt.Errorf("config validation: %w", err)
        }

        // Schema validation
        if err := validateFreqtradeConfigWithSchema(input.Config); err != nil {
            return nil, fmt.Errorf("schema validation: %w", err)
        }
    }

    // Proceed with update
    return r.client.Bot.UpdateOneID(id).
        SetInput(input).
        Save(ctx)
}
```

## Benefits

1. **Early Failure**: Catch errors before database persistence
2. **Clear Messages**: JSON schema provides descriptive error messages
3. **External Compatibility**: Automatic validation against official schemas
4. **Type Safety**: Go validators provide compile-time safety
5. **Separation of Concerns**: JSON schema for format, Go for business logic
6. **Caching**: Schema fetched once and cached

## Trade-offs

### Pros
- Comprehensive validation coverage
- Clear separation between format and business logic
- Automatic schema updates (fetched from URL)
- GraphQL errors automatically formatted

### Cons
- External dependency on schema URL
- JSON schema validation adds overhead
- Multiple validation layers (complexity)
- Schema changes could break existing configs

## Common Patterns

### Table-Driven Tests

```go
// internal/bot/config_test.go
func TestValidateConfig(t *testing.T) {
    tests := []struct {
        name    string
        config  map[string]interface{}
        wantErr bool
        errMsg  string
    }{
        {
            name: "valid config",
            config: map[string]interface{}{
                "stake_currency": "USDT",
                "stake_amount":   100.0,
                "entry_pricing": map[string]interface{}{
                    "price_side":     "same",
                    "use_order_book": false,
                    "order_book_top": 1,
                },
                "exit_pricing": map[string]interface{}{
                    "price_side":     "same",
                    "use_order_book": false,
                    "order_book_top": 1,
                },
            },
            wantErr: false,
        },
        {
            name: "missing stake_currency",
            config: map[string]interface{}{
                "stake_amount": 100.0,
            },
            wantErr: true,
            errMsg:  "stake_currency",
        },
        {
            name: "negative stake_amount",
            config: map[string]interface{}{
                "stake_currency": "USDT",
                "stake_amount":   -10.0,
            },
            wantErr: true,
            errMsg:  "positive",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := bot.ValidateConfig(tt.config)
            if tt.wantErr {
                assert.Error(t, err)
                if tt.errMsg != "" {
                    assert.Contains(t, err.Error(), tt.errMsg)
                }
            } else {
                assert.NoError(t, err)
            }
        })
    }
}
```

### Layered Validation

```go
func validateBotInput(input CreateBotInput) error {
    // Layer 1: Business rules
    if err := bot.ValidateConfig(input.Config); err != nil {
        return err
    }

    // Layer 2: External schema
    if err := validateFreqtradeConfigWithSchema(input.Config); err != nil {
        return err
    }

    // Layer 3: Cross-field validation
    if input.Mode == enum.BotModeLive {
        if _, ok := input.Config["dry_run"]; ok {
            if input.Config["dry_run"].(bool) {
                return fmt.Errorf("live mode cannot have dry_run enabled")
            }
        }
    }

    return nil
}
```

### Partial Validation (Updates)

```go
func validatePartialConfig(existing, updates map[string]interface{}) error {
    // Merge existing with updates
    merged := make(map[string]interface{})
    for k, v := range existing {
        merged[k] = v
    }
    for k, v := range updates {
        merged[k] = v
    }

    // Validate merged config
    return bot.ValidateConfig(merged)
}
```

## Testing

### Regression Tests

```go
func TestConfigMutation_NoPanic(t *testing.T) {
    // Regression test: ensure validation doesn't mutate input
    config := map[string]interface{}{
        "stake_currency": "USDT",
        "stake_amount":   100.0,
    }

    original := make(map[string]interface{})
    for k, v := range config {
        original[k] = v
    }

    _ = bot.ValidateConfig(config)

    // Config should be unchanged
    assert.Equal(t, original, config)
}
```

### Schema Validation Tests

```go
func TestFreqtradeSchemaValidation(t *testing.T) {
    // Test against real Freqtrade schema
    config := map[string]interface{}{
        "stake_currency": "USDT",
        "stake_amount":   100,
        "exchange": map[string]interface{}{
            "name": "binance",
            "key":  "test",
            "secret": "test",
        },
    }

    err := validateFreqtradeConfigWithSchema(config)
    assert.NoError(t, err)
}
```

## Related Patterns

- [ENT ORM Integration](ent-orm-integration.md) - Validation hooks
- [Transaction Management](transactions.md) - Rollback on validation failure
- [Resolver Testing](resolver-testing.md) - Testing validation logic

## References

- JSON Schema Specification: https://json-schema.org/
- Freqtrade Schema: https://schema.freqtrade.io/schema.json
- `internal/graph/schema_validator.go` - JSON schema validation
- `internal/bot/config.go` - Business logic validation
- `internal/exchange/validator.go` - Exchange-specific validation
- `internal/ent/schema/exchange_hooks.go` - Validation hooks
- `internal/bot/config_test.go` - Validation tests (100% coverage)
