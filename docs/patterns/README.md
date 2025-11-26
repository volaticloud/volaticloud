# Code Patterns

This directory contains reusable code patterns and best practices for VolatiCloud development.

## Available Patterns

### Architecture Patterns

- [ENT ORM Integration](ent-orm-integration.md) - Database ORM with GraphQL integration
- [GraphQL Code Generation](graphql-codegen.md) - Schema-first GraphQL with gqlgen
- [Dependency Injection](dependency-injection.md) - Context-based DI pattern

### Domain Patterns

- [Strategy Versioning](strategy-versioning.md) - Immutable strategy version management
- [Config Validation](config-validation.md) - JSON schema validation patterns
- [Transaction Management](transactions.md) - Database transaction patterns

### Testing Patterns

- [Resolver Testing](resolver-testing.md) - GraphQL resolver test patterns
- [Mock Generation](mocking.md) - Creating mocks for testing

## Using These Patterns

Each pattern document follows this structure:

1. **Problem** - What problem does this pattern solve?
2. **Solution** - How does the pattern solve it?
3. **Implementation** - Code examples and walkthrough
4. **Benefits** - Why use this pattern?
5. **Trade-offs** - What are the downsides?
6. **Related Patterns** - Links to related patterns

## Contributing

When adding new patterns:

1. Follow the template structure
2. Include complete code examples
3. Document trade-offs and alternatives
4. Link to related ADRs
5. Add entry to this README
