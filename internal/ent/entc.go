//go:build ignore

package main

import (
	"context"

	"entgo.io/contrib/entgql"
	"entgo.io/ent/entc"
	"entgo.io/ent/entc/gen"
	"go.uber.org/zap"

	"volaticloud/internal/logger"
)

func main() {
	// Initialize logger for code generation
	ctx, log := logger.PrepareLogger(context.Background())
	defer func() { _ = logger.Sync(ctx) }()

	ex, err := entgql.NewExtension(
		// Generate GraphQL schema
		entgql.WithSchemaGenerator(),
		entgql.WithSchemaPath("../graph/ent.graphql"),
		// Configure ID type
		entgql.WithConfigPath("../../gqlgen.yml"),
		// Enable where filters on queries
		entgql.WithWhereInputs(true),
	)
	if err != nil {
		log.Fatal("Failed to create entgql extension", zap.Error(err))
	}

	opts := []entc.Option{
		entc.Extensions(ex),
	}

	if err := entc.Generate("./schema", &gen.Config{}, opts...); err != nil {
		log.Fatal("Failed to generate ENT code", zap.Error(err))
	}
}
