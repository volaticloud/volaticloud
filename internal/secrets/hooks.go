package secrets

import (
	"context"
	"fmt"

	"entgo.io/ent"

	"volaticloud/internal/bot"
	entgen "volaticloud/internal/ent"
	"volaticloud/internal/exchange"
	"volaticloud/internal/runner"
)

// EncryptHook returns an ENT mutation hook that encrypts secret fields
// in the given JSON field before writing to the database.
// It should be registered AFTER validation hooks so validation sees plaintext.
func EncryptHook(fieldName string, paths []string) ent.Hook {
	return func(next ent.Mutator) ent.Mutator {
		return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
			if !Enabled() {
				return next.Mutate(ctx, m)
			}

			configValue, exists := m.Field(fieldName)
			if !exists {
				return next.Mutate(ctx, m)
			}

			config, ok := configValue.(map[string]interface{})
			if !ok || config == nil {
				return next.Mutate(ctx, m)
			}

			if err := EncryptFields(config, paths); err != nil {
				return nil, fmt.Errorf("secrets: encrypt %s: %w", fieldName, err)
			}

			// Set the encrypted config back on the mutation
			if err := m.SetField(fieldName, config); err != nil {
				return nil, fmt.Errorf("secrets: set %s: %w", fieldName, err)
			}

			return next.Mutate(ctx, m)
		})
	}
}

// RegisterDecryptInterceptors registers decrypt interceptors on the ENT client.
// Call this after creating the client and initializing encryption.
func RegisterDecryptInterceptors(client *entgen.Client) {
	client.Exchange.Intercept(
		ent.InterceptFunc(func(next ent.Querier) ent.Querier {
			return ent.QuerierFunc(func(ctx context.Context, q ent.Query) (ent.Value, error) {
				result, err := next.Query(ctx, q)
				if err != nil || !Enabled() {
					return result, err
				}
				return decryptExchangeResults(result)
			})
		}),
	)

	client.BotRunner.Intercept(
		ent.InterceptFunc(func(next ent.Querier) ent.Querier {
			return ent.QuerierFunc(func(ctx context.Context, q ent.Query) (ent.Value, error) {
				result, err := next.Query(ctx, q)
				if err != nil || !Enabled() {
					return result, err
				}
				return decryptRunnerResults(result)
			})
		}),
	)

	client.Bot.Intercept(
		ent.InterceptFunc(func(next ent.Querier) ent.Querier {
			return ent.QuerierFunc(func(ctx context.Context, q ent.Query) (ent.Value, error) {
				result, err := next.Query(ctx, q)
				if err != nil || !Enabled() {
					return result, err
				}
				return decryptBotResults(result)
			})
		}),
	)
}

func decryptExchangeResults(result ent.Value) (ent.Value, error) {
	switch v := result.(type) {
	case []*entgen.Exchange:
		for _, e := range v {
			if e.Config != nil {
				if err := DecryptFields(e.Config, exchange.SecretConfigPaths); err != nil {
					return nil, fmt.Errorf("secrets: decrypt exchange %s config: %w", e.ID, err)
				}
			}
		}
	case *entgen.Exchange:
		if v != nil && v.Config != nil {
			if err := DecryptFields(v.Config, exchange.SecretConfigPaths); err != nil {
				return nil, fmt.Errorf("secrets: decrypt exchange %s config: %w", v.ID, err)
			}
		}
	}
	return result, nil
}

func decryptRunnerResults(result ent.Value) (ent.Value, error) {
	switch v := result.(type) {
	case []*entgen.BotRunner:
		for _, r := range v {
			if err := decryptSingleRunner(r); err != nil {
				return nil, err
			}
		}
	case *entgen.BotRunner:
		if v != nil {
			if err := decryptSingleRunner(v); err != nil {
				return nil, err
			}
		}
	}
	return result, nil
}

func decryptSingleRunner(r *entgen.BotRunner) error {
	if r.Config != nil {
		if err := DecryptFields(r.Config, runner.SecretConfigPaths); err != nil {
			return fmt.Errorf("secrets: decrypt runner %s config: %w", r.ID, err)
		}
	}
	if r.S3Config != nil {
		if err := DecryptFields(r.S3Config, runner.SecretS3ConfigPaths); err != nil {
			return fmt.Errorf("secrets: decrypt runner %s s3_config: %w", r.ID, err)
		}
	}
	return nil
}

func decryptBotResults(result ent.Value) (ent.Value, error) {
	switch v := result.(type) {
	case []*entgen.Bot:
		for _, b := range v {
			if err := decryptSingleBot(b); err != nil {
				return nil, err
			}
		}
	case *entgen.Bot:
		if v != nil {
			if err := decryptSingleBot(v); err != nil {
				return nil, err
			}
		}
	}
	return result, nil
}

func decryptSingleBot(b *entgen.Bot) error {
	if b.SecureConfig != nil {
		if err := DecryptFields(b.SecureConfig, bot.SecretConfigPaths); err != nil {
			return fmt.Errorf("secrets: decrypt bot %s secure_config: %w", b.ID, err)
		}
	}
	return nil
}
