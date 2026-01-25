# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for VolatiCloud. ADRs document significant architectural decisions made in the project.

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-context-based-dependency-injection.md) | Context-Based Dependency Injection | Accepted | 2025-01-15 |
| [0002](0002-ent-orm-with-graphql.md) | ENT ORM with GraphQL Integration | Accepted | 2025-01-15 |
| [0003](0003-strategy-immutable-versioning.md) | Strategy Immutable Versioning | Accepted | 2025-11-07 |
| [0004](0004-runtime-abstraction-layer.md) | Runtime Abstraction Layer | Accepted | 2025-01-15 |
| [0005](0005-per-component-graphql-codegen.md) | Per-Component GraphQL Code Generation | Accepted | 2025-01-15 |
| [0006](0006-bot-config-layer-separation.md) | Bot Configuration Layer Separation | Accepted | 2025-10-23 |
| [0007](0007-kubernetes-deployment-strategy.md) | Kubernetes Deployment Strategy | Accepted | 2025-11-14 |
| [0008](0008-multi-tenant-authorization.md) | Multi-Tenant Authorization with UMA 2.0 and Hierarchical Groups | Accepted | 2025-11-26 |
| [0009](0009-github-actions-architecture.md) | GitHub Actions CI/CD Architecture | Accepted | 2025-12-01 |
| [0010](0010-organization-invitation-system.md) | Organization User Invitation System | Accepted | 2026-01-14 |
| [0011](0011-strategy-ui-builder.md) | Strategy UI Builder Architecture | Accepted | 2026-01-16 |
| [0012](0012-organization-alias-system.md) | Organization Alias System | Accepted | 2026-01-19 |
| [0013](0013-long-short-signal-support.md) | Long/Short Signal Support with Mirror | Accepted | 2026-01-20 |
| [0014](0014-backtest-config-layer-separation.md) | Backtest Configuration Layer Separation | Accepted | 2026-01-22 |
| [0015](0015-dialog-to-drawer-ui-pattern.md) | Dialog to Drawer UI Pattern | Accepted | 2026-01-23 |
| [0016](0016-responsive-panel-layout-system.md) | Responsive Panel Layout System | Accepted | 2026-01-25 |
| [0017](0017-hybrid-testing-strategy.md) | Hybrid Testing Strategy with Testcontainers | Accepted | 2026-01-26 |

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences.

## When to create an ADR?

Create an ADR when you make a decision that:

- Affects the structure, patterns, or principles of the codebase
- Is difficult or expensive to change later
- Requires team alignment and consensus
- Needs to be communicated to future developers

## ADR Template

Use this template for new ADRs:

```markdown
# [NUMBER]. [Title]

Date: YYYY-MM-DD

## Status

[Proposed | Accepted | Deprecated | Superseded by ADR-XXXX]

## Context and Problem Statement

[Describe the context and problem statement that this decision addresses.
What forces are at play? What constraints exist?]

## Decision Drivers

- [Driver 1]
- [Driver 2]
- [Driver 3]

## Considered Options

### Option 1: [Name]

[Brief description]

**Pros:**
- Pro 1
- Pro 2

**Cons:**
- Con 1
- Con 2

### Option 2: [Name]

[Brief description]

**Pros:**
- Pro 1
- Pro 2

**Cons:**
- Con 1
- Con 2

## Decision Outcome

Chosen option: **[Chosen option]**, because [reason].

### Consequences

**Positive:**
- Benefit 1
- Benefit 2

**Negative:**
- Tradeoff 1
- Tradeoff 2

**Neutral:**
- Impact 1
- Impact 2

## Implementation

### Key Files
- `path/to/file.go:123` - Description
- `path/to/other/file.go` - Description

### Example
\```go
// Code example demonstrating the decision
\```

## Validation

How can we verify this decision is being followed?

## References

- [Link to related documentation]
- [Link to external resources]
- [Related ADRs]
```

## Creating a New ADR

1. Copy the template above
2. Number it sequentially (next available number)
3. Use kebab-case for the filename: `NNNN-short-title.md`
4. Fill in all sections
5. Update the index table above
6. Get team review before marking as "Accepted"

## Tools

### adr-tools (Optional)

You can use [adr-tools](https://github.com/npryce/adr-tools) for managing ADRs:

```bash
# Install
brew install adr-tools

# Create new ADR
adr new "Use Docker for local development"

# Supersede an ADR
adr new -s 9 "Use Kubernetes for production deployment"

# Generate table of contents
adr generate toc
```

### Manual Approach

Alternatively, copy the template manually and follow the numbering convention.

## Best Practices

1. **Keep it concise**: ADRs should be 1-3 pages, not novels
2. **Focus on "why"**: Document the reasoning, not just what was decided
3. **Include tradeoffs**: Show you considered alternatives
4. **Add examples**: Include code snippets showing the decision in action
5. **Link to code**: Reference specific files and line numbers
6. **Update status**: Mark ADRs as superseded when decisions change
7. **Date everything**: Record when decisions were made for historical context

## Reviewing ADRs

When reviewing an ADR:

- [ ] Problem statement is clear
- [ ] Multiple options were considered
- [ ] Decision is justified
- [ ] Consequences are acknowledged
- [ ] Implementation references are provided
- [ ] Status is appropriate

## References

- [Architecture Decision Records (MADR)](https://adr.github.io/madr/)
- [When Should I Write an ADR?](https://engineering.atspotify.com/2020/04/when-should-i-write-an-architecture-decision-record/)
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
