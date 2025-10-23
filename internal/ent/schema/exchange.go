package schema

import (
	"context"
	"fmt"
	"strings"
	"time"

	"anytrade/internal/enum"
	"entgo.io/contrib/entgql"
	"entgo.io/ent"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

// Exchange holds the schema definition for the Exchange entity.
type Exchange struct {
	ent.Schema
}

// Fields of the Exchange.
func (Exchange) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable(),
		field.Enum("name").
			GoType(enum.ExchangeType("")).
			Comment("Exchange name from ExchangeType enum"),
		field.Bool("test_mode").
			Default(false).
			Comment("Use testnet/sandbox"),
		field.JSON("config", map[string]interface{}{}).
			Optional().
			Annotations(
				entgql.Type("ExchangeConfigInput"),
				entgql.Skip(entgql.SkipType), // Skip in type output, but allow in mutations
			).
			Comment("Exchange-specific configuration including API credentials"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

// Edges of the Exchange.
func (Exchange) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("bots", Bot.Type).
			Annotations(entgql.RelayConnection()),
	}
}

// Annotations of the Exchange.
func (Exchange) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.QueryField(),
		entgql.Mutations(entgql.MutationCreate(), entgql.MutationUpdate()),
	}
}

// Hooks of the Exchange.
func (Exchange) Hooks() []ent.Hook {
	return []ent.Hook{
		validateExchangeConfig,
	}
}

// validateExchangeConfig validates that the config type matches the exchange name
func validateExchangeConfig(next ent.Mutator) ent.Mutator {
	return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
		// Get the field map
		fieldValue, exists := m.Field("config")
		if !exists {
			// No config being set, skip validation
			return next.Mutate(ctx, m)
		}

		config, ok := fieldValue.(map[string]interface{})
		if !ok || config == nil {
			// Config is nil or invalid format, skip validation
			return next.Mutate(ctx, m)
		}

		// Get the exchange name
		var exchangeName string
		if nameValue, exists := m.Field("name"); exists {
			if nameEnum, ok := nameValue.(enum.ExchangeType); ok {
				exchangeName = string(nameEnum)
			} else {
				return nil, fmt.Errorf("invalid exchange name type")
			}
		} else {
			// On update without name change, we can't validate without querying
			// Skip validation in this case - the mutation will use existing name
			return next.Mutate(ctx, m)
		}

		// Normalize exchange name (binanceus -> binanceus)
		normalizedName := strings.ToLower(exchangeName)

		// Validate that only one config is present and it matches the exchange name
		var foundKey string
		for key := range config {
			if foundKey != "" {
				return nil, fmt.Errorf("config must contain only one exchange configuration")
			}
			foundKey = key
		}

		if foundKey == "" {
			return nil, fmt.Errorf("config is empty")
		}

		if foundKey != normalizedName {
			return nil, fmt.Errorf("config type '%s' does not match exchange name '%s'", foundKey, normalizedName)
		}

		return next.Mutate(ctx, m)
	})
}
