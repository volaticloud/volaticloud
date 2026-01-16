/*
Package strategy provides strategy management and code generation for trading strategies.

# Overview

The strategy package handles strategy lifecycle, versioning, and code generation for
the VolatiCloud trading platform. Strategies can be edited in two modes:

  - UI Mode: Visual builder that generates Python code from a condition tree
  - Code Mode: Direct Python code editing

See ADR-0003 (Strategy Immutable Versioning) and ADR-0011 (Strategy UI Builder) for
architectural decisions.

# Strategy Modes

Strategies support two editing modes controlled by the `builder_mode` field:

	builder_mode = "ui"   → Visual builder with code generation
	builder_mode = "code" → Direct code editing (default for legacy)

## UI Mode

In UI mode, the strategy configuration contains a `ui_builder` object:

	{
	  "stake_currency": "USDT",
	  "timeframe": "5m",
	  "ui_builder": {
	    "version": 1,
	    "indicators": [...],
	    "entry_conditions": {...},
	    "exit_conditions": {...},
	    "parameters": {...},
	    "callbacks": {...}
	  }
	}

The UI builder config is converted to Python code server-side. Users can preview
generated code and "eject" to code mode for advanced editing.

## Code Mode

In code mode, the strategy contains raw Python code in the `code` field.
Code mode supports advanced features not available in UI mode.

## Ejection (UI → Code)

Ejection converts a UI mode strategy to code mode:

	1. Generate final Python code from UI builder config
	2. Store code in strategy
	3. Set builder_mode = "code"
	4. Clear ui_builder config (optional, can retain for reference)

Ejection is ONE-WAY. Once ejected, the strategy cannot return to UI mode
because manual code changes cannot be reverse-parsed into UI builder config.

# Strategy Versioning

Per ADR-0003, strategies use immutable versioning:

  - Each save creates a new strategy version
  - Versions are immutable after creation
  - Backtests reference specific versions
  - Active bots always use the latest version

# Package Structure

	strategy/
	├── doc.go           - This documentation
	└── codegen/         - Code generation from UI builder config
	    ├── doc.go       - Codegen package documentation
	    ├── types.go     - Condition tree types (synced with GraphQL schema)
	    ├── generator.go - Condition → Python code generator
	    └── indicators.go - Indicator templates

# Code Generation

The codegen subpackage converts UI builder configurations to Python strategy code.
See internal/strategy/codegen/doc.go for detailed documentation.

Key functions:

	// Preview generated code (used by previewStrategyCode mutation)
	code, err := codegen.PreviewStrategyCode(config, "MyStrategy")

	// Generate individual conditions
	gen := codegen.NewGenerator()
	gen.SetIndicators(indicators)
	code, err := gen.GenerateCondition(conditionNode)

	// Generate indicator code
	code, err := codegen.GenerateIndicator(indicator)

# Type Synchronization

Types are defined in the GraphQL schema (single source of truth) and generated
for both Go and TypeScript:

	GraphQL Schema (internal/graph/schema.graphqls)
	    ↓ make generate
	Go Types (internal/graph/model/models_gen.go)
	    ↓ type aliases
	Codegen Types (internal/strategy/codegen/types.go)

	GraphQL Schema (internal/graph/schema.graphqls)
	    ↓ npm run codegen (dashboard)
	TypeScript Types (dashboard/src/generated/types.ts)
	    ↓ re-export
	Builder Types (dashboard/src/components/StrategyBuilder/types.ts)

To add a new enum or type:

	1. Add to internal/graph/schema.graphqls
	2. Run `make generate` (generates Go types)
	3. Run `cd dashboard && npm run codegen` (generates TypeScript types)
	4. Update type aliases in codegen/types.go if needed
	5. Update re-exports in StrategyBuilder/types.ts if needed

# Security

  - Code generation is server-side (no user-provided Python executed)
  - Config size limited to 1MB to prevent DoS
  - previewStrategyCode mutation requires authentication
  - Generated code uses safe pandas/numpy patterns

# Related

	internal/graph/schema.graphqls       - GraphQL schema (type definitions)
	internal/graph/schema.resolvers.go   - previewStrategyCode mutation
	dashboard/src/components/StrategyBuilder/ - UI Builder components
	docs/adr/0003-strategy-immutable-versioning.md - Versioning ADR
	docs/adr/0011-strategy-ui-builder.md - UI Builder ADR
*/
package strategy