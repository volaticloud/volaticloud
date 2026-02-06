---
name: adr
description: Architecture Decision Records management for VolatiCloud. Use when creating new ADRs, finding relevant architectural guidance, validating code against established patterns, or when architectural decisions need to be made. Triggers on phrases like "create ADR", "new architecture decision", "which ADR applies", "check against ADR", or when discussing significant architectural changes.
---

# ADR Management Skill

Manage Architecture Decision Records for VolatiCloud. ADRs document significant architectural decisions with context and consequences.

## Available Actions

### 1. Create New ADR

When user wants to create a new ADR:

1. Determine the next ADR number by reading `docs/adr/README.md`
2. Use the template from `docs/adr/README.md` (lines 43-127)
3. Create file at `docs/adr/NNNN-short-title.md` using kebab-case
4. Update the index table in `docs/adr/README.md`

**ADR must include:**
- Clear problem statement
- Multiple considered options with pros/cons
- Decision outcome with rationale
- Implementation details with file references (format: `path/to/file.go:123`)
- Validation steps

### 2. Find Relevant ADRs

When user asks about architectural guidance or which patterns to follow:

1. Read `docs/adr/README.md` for the index
2. Search ADR files matching the topic
3. Summarize relevant decisions and link to specific ADRs

**ADR Index (quick reference):**

| ADR | Topic | Key Pattern |
|-----|-------|-------------|
| 0001 | Context-Based DI | Use `context.Context` for request-scoped dependencies |
| 0002 | ENT + GraphQL | ENT ORM with GraphQL integration patterns |
| 0003 | Strategy Versioning | Immutable versions, one-to-one Backtest relationship |
| 0004 | Runtime Abstraction | Docker/K8s runtime abstraction layer |
| 0005 | GraphQL Codegen | Per-component code generation |
| 0006 | Bot Config Separation | Bot configuration layer separation |
| 0007 | K8s Deployment | Kubernetes deployment strategy |
| 0008 | Multi-Tenant Auth | UMA 2.0, hierarchical groups, public/private visibility |
| 0009 | GitHub Actions | CI/CD architecture |
| 0010 | Organization Invitations | User invitation system |
| 0011 | Strategy UI Builder | Visual strategy builder architecture |
| 0012 | Organization Alias | Dual identifier system (UUID + alias) |
| 0013 | Long/Short Signals | Signal support with mirror pattern |
| 0014 | Backtest Config | Backtest configuration layer separation |
| 0015 | Dialog to Drawer | UI pattern migration |
| 0016 | Responsive Panel Layout | Panel layout system |

### 3. Validate Code Against ADRs

When reviewing code or making changes, check compliance with:

**DDD Rules (from CLAUDE.md):**
- NO business logic in `internal/graph/` - resolvers only call domain functions
- NO domain packages import `internal/graph/`
- Each domain owns its logic

**Key Patterns to Verify:**

```go
// ADR-0001: Context-based DI
user := auth.MustGetUserContext(ctx)
client := GetEntClientFromContext(ctx)

// ADR-0003: Strategy versioning
strategy.WithBacktest()  // One-to-one relationship

// ADR-0008: Authorization
@hasScope(resource: "id", scope: "edit", resourceType: STRATEGY)
```

### 4. Suggest ADR Creation

Suggest creating an ADR when:
- A decision affects structure, patterns, or principles
- The decision is difficult or expensive to change later
- Team alignment is needed
- Future developers need to understand the reasoning

## Workflow Examples

**User: "I want to add a new caching layer"**
→ Check ADR-0001 (DI patterns), suggest creating new ADR for caching decision

**User: "How should I handle authorization?"**
→ Reference ADR-0008, explain UMA 2.0 patterns, scopes, and group hierarchy

**User: "Create an ADR for the new notification system"**
→ Follow creation workflow, use template, add to index

## References

- ADR Template: `docs/adr/README.md` (lines 43-127)
- ADR Directory: `docs/adr/`
- Project Guidelines: `.claude/CLAUDE.md`