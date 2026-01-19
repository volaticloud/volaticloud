# Documentation Guide

> **Meta-Documentation**: How to create, maintain, and verify documentation in the VolatiCloud project

**Last Updated:** 2025-11-26

---

## Table of Contents

- [Overview](#overview)
- [Documentation Structure](#documentation-structure)
- [Documentation Types](#documentation-types)
- [Creation Guidelines](#creation-guidelines)
- [Auto-Generated Documentation](#auto-generated-documentation)
- [Verification & Quality Control](#verification--quality-control)
- [Coverage Requirements](#coverage-requirements)
- [Contribution Workflow](#contribution-workflow)
- [Tools & Commands](#tools--commands)

---

## Overview

VolatiCloud uses a **multi-layered documentation strategy** optimized for both human developers and AI-assisted development (Claude Code):

**Philosophy:**

1. **Living Documentation** - Generated from code, always in sync
2. **Single Source of Truth** - Code is the source, docs are derived
3. **ADR-Driven** - Architectural decisions documented with context
4. **Package-Level Docs** - Comprehensive `doc.go` files for Go packages
5. **CI-Verified** - Automated validation ensures quality

**Target Audiences:**

- Human developers (general-purpose documentation)
- AI assistants (structured, comprehensive context)
- Operations teams (runbooks and troubleshooting)
- New contributors (patterns and examples)

---

## Documentation Structure

```
docs/
├── DOCUMENTATION_GUIDE.md      # This file - meta-documentation
├── adr/                         # Architecture Decision Records
│   ├── README.md               # ADR index and template
│   └── NNNN-title.md           # Individual ADRs
├── patterns/                    # Reusable code patterns
│   ├── README.md               # Pattern index
│   └── *.md                    # Pattern documents
├── runbooks/                    # Operational procedures
│   ├── README.md               # Runbook index
│   └── *.md                    # Runbook documents
├── diagrams/                    # Auto-generated diagrams
│   ├── erd.md                  # Entity Relationship Diagram (from ENT)
│   └── dependencies.md         # Go module dependency graph
└── api/                         # API documentation
    └── graphql/                # GraphQL API docs
        └── schema.md           # Auto-generated from introspection

internal/
├── {package}/doc.go            # Package-level documentation
├── ent/schema/                 # ENT schema files (source for ERD)
└── graph/schema.graphqls       # GraphQL schema (source for API docs)

scripts/
├── generate-erd.sh             # Generate ERD from ENT schemas
├── generate-deps.sh            # Generate dependency graph
├── generate-graphql-docs.sh    # Generate GraphQL API docs
└── verify-docs.sh              # Verify documentation quality

.claude/
└── CLAUDE.md                   # Claude Code reference (<250 lines)

.github/workflows/
└── quality.yml                 # CI job: documentation-validation
```

---

## Documentation Types

### 1. Architecture Decision Records (ADRs)

**Purpose:** Document significant architectural decisions with full context

**Location:** `docs/adr/NNNN-title.md`

**Template:** MADR (Markdown Any Decision Records)

**When to Create:**

- Choosing between technology alternatives (e.g., ENT vs GORM)
- Architectural pattern decisions (e.g., DDD, context-based DI)
- Deployment strategy changes (e.g., Kubernetes adoption)
- API design decisions (e.g., GraphQL schema structure)

**Format:**

```markdown
# ADR-NNNN: Title

**Status:** Accepted | Rejected | Superseded | Deprecated

**Date:** YYYY-MM-DD

**Deciders:** @username1, @username2

## Context and Problem Statement

What problem are we trying to solve? What constraints exist?

## Considered Options

1. Option A
2. Option B
3. Option C

## Decision Outcome

Chosen option: "Option B"

Justification: Why we chose this option...

### Consequences

**Positive:**
- Benefit 1
- Benefit 2

**Negative:**
- Trade-off 1
- Trade-off 2

## Implementation

How is this decision implemented in the codebase?

## Links

- Related ADRs
- External references
```

**Numbering:** Sequential (0001, 0002, 0003, ...)

**Index:** Always update `docs/adr/README.md` with new ADRs

### 2. Package Documentation (doc.go)

**Purpose:** Comprehensive package-level documentation for Go packages

**Location:** `internal/{package}/doc.go`

**Coverage Requirement:** All packages with complex logic (not simple utilities)

**When to Create:**

- New domain packages (`internal/bot/`, `internal/backtest/`)
- Infrastructure packages (`internal/monitor/`, `internal/runner/`)
- Integration packages (`internal/keycloak/`, `internal/graph/`)

**Format:**

```go
/*
Package {name} provides {one-line description}.

# Overview

High-level description of the package's purpose and responsibilities.

# Architecture

Mermaid diagram showing component relationships:

	```mermaid
	flowchart TD
	    A[Component A] --> B[Core]
	    B --> C[Component B]
	    B --> D[Component C]
	```

# Core Concepts

## Concept 1

Detailed explanation...

## Concept 2

Detailed explanation...

# Usage Examples

 // Example 1: Basic usage
 client := NewClient()
 result, err := client.DoSomething(ctx)

 // Example 2: Advanced usage
 opts := Options{...}
 result, err := client.DoSomethingWithOptions(ctx, opts)

# Implementation Details

## Component A

Detailed explanation of Component A...

## Component B

Detailed explanation of Component B...

# Testing

How to test this package:

 go test ./internal/{package}

# Related Packages

- internal/other - Brief description
- internal/another - Brief description

# See Also

- ADR-NNNN: Related architectural decision
- docs/patterns/xxx.md: Related pattern
*/
package {name}
```

**Coverage Target:** Aim for comprehensive docs (300-700 lines) for complex packages

### 3. Code Patterns

**Purpose:** Reusable code patterns and best practices

**Location:** `docs/patterns/{name}.md`

**When to Create:**

- Recurring implementation patterns
- Best practice examples
- Anti-pattern warnings

**Structure:**

1. **Problem** - What problem does this solve?
2. **Solution** - How to implement the pattern
3. **Code Examples** - Complete, runnable code
4. **Benefits** - Why use this pattern
5. **Trade-offs** - Downsides and alternatives
6. **Related Patterns** - Links to related patterns/ADRs

### 4. Runbooks

**Purpose:** Operational procedures and troubleshooting

**Location:** `docs/runbooks/{name}.md`

**When to Create:**

- Deployment procedures
- Troubleshooting guides
- Emergency recovery procedures
- Routine maintenance tasks

**Structure:**

1. **Prerequisites** - What's needed before starting
2. **Steps** - Step-by-step instructions
3. **Verification** - How to verify success
4. **Troubleshooting** - Common issues and fixes
5. **Rollback** - How to undo changes if needed

### 5. Auto-Generated Diagrams

**Purpose:** Visual representation of architecture and dependencies

**Location:** `docs/diagrams/`

**Generated Files:**

- `erd.md` - Entity Relationship Diagram (from ENT schemas)
- `dependencies.md` - Go module dependency graph
- `api/graphql/schema.md` - GraphQL API documentation (requires running server)

**Never Edit Manually:** These files are auto-generated

---

## Creation Guidelines

### ADRs

**Step 1: Create ADR File**

```bash
# Get next number
NEXT_NUM=$(printf "%04d" $(($(ls docs/adr/*.md 2>/dev/null | wc -l) + 1)))

# Create from template (copy from docs/adr/README.md)
cp docs/adr/README.md docs/adr/${NEXT_NUM}-your-title.md
```

**Step 2: Fill Template**

- Clear problem statement
- List all considered options
- Explain decision with rationale
- Document implementation details
- Link to related ADRs

**Step 3: Update Index**

```bash
# Edit docs/adr/README.md
# Add entry to the ADR table
```

**Step 4: Commit**

```bash
git add docs/adr/${NEXT_NUM}-*.md docs/adr/README.md
git commit -m "docs: add ADR-${NEXT_NUM} for [topic]"
```

### Package Documentation (doc.go)

**Step 1: Create doc.go**

```bash
touch internal/{package}/doc.go
```

**Step 2: Write Documentation**

- Start with package comment block (`/* ... */`)
- Include architecture diagram (Mermaid syntax - NOT ASCII art)
- Document core concepts
- Provide usage examples
- Explain implementation details
- Link to related packages/ADRs

**Step 3: Verify Format**

```bash
# Check with godoc
go doc internal/{package}

# Or generate HTML
godoc -http=:6060
# Visit http://localhost:6060/pkg/volaticloud/internal/{package}/
```

**Step 4: Verify with CI**

```bash
./scripts/verify-docs.sh
```

### Patterns

**Step 1: Create Pattern File**

```bash
touch docs/patterns/{pattern-name}.md
```

**Step 2: Fill Structure**

- Problem statement
- Solution with code examples
- Benefits and trade-offs
- Related patterns

**Step 3: Update Index**

```bash
# Edit docs/patterns/README.md
# Add entry to pattern list
```

### Runbooks

**Step 1: Create Runbook File**

```bash
touch docs/runbooks/{operation-name}.md
```

**Step 2: Document Procedure**

- Prerequisites
- Step-by-step instructions
- Verification steps
- Troubleshooting section
- Rollback procedure

**Step 3: Update Index**

```bash
# Edit docs/runbooks/README.md
# Add entry to runbook list
```

---

## Auto-Generated Documentation

### ERD (Entity Relationship Diagram)

**Source:** `internal/ent/schema/*.go` (ENT schema files)

**Generator:** `scripts/generate-erd.sh`

**Output:** `docs/diagrams/erd.md` (Mermaid diagram)

**Generate:**

```bash
make docs-generate
# Or directly:
./scripts/generate-erd.sh
```

**What's Generated:**

- All ENT entities with fields
- Relationships between entities (edges)
- Field types and constraints
- Mermaid ERD syntax

**When to Regenerate:**

- After modifying ENT schemas
- After adding/removing entities
- After changing relationships
- Before committing schema changes

### Dependency Graph

**Source:** `go.mod` and `go list -m all`

**Generator:** `scripts/generate-deps.sh`

**Output:** `docs/diagrams/dependencies.md` (Mermaid diagram)

**Generate:**

```bash
make docs-generate
# Or directly:
./scripts/generate-deps.sh
```

**What's Generated:**

- Direct dependencies
- Indirect (transitive) dependencies
- Dependency statistics
- Mermaid dependency graph
- Key dependencies section

**When to Regenerate:**

- After updating dependencies (`go get -u`)
- After adding new dependencies
- Before major version releases

### GraphQL API Documentation

**Source:** GraphQL introspection from running server

**Generator:** `scripts/generate-graphql-docs.sh`

**Output:** `docs/api/graphql/schema.md`

**Generate:**

```bash
# IMPORTANT: Server must be running first
./bin/volaticloud server &

# Then generate docs
./scripts/generate-graphql-docs.sh

# Or with custom URL
./scripts/generate-graphql-docs.sh http://localhost:8080/query
```

**What's Generated:**

- All queries with arguments and return types
- All mutations with arguments and return types
- All object types with fields
- All input types
- All enums
- All scalars
- Usage examples

**When to Regenerate:**

- After modifying GraphQL schema
- After adding new queries/mutations
- After changing types
- Before API documentation updates

---

## Verification & Quality Control

### Automated Verification

**Tool:** `scripts/verify-docs.sh`

**Checks Performed:**

1. ✅ ADR directory structure exists
2. ✅ ADR README exists
3. ✅ ADR numbering is sequential
4. ✅ ADR index in README is complete
5. ✅ Package documentation exists for key packages
6. ✅ File references in ADRs are valid
7. ✅ ADR cross-references are valid
8. ✅ CLAUDE.md exists and is lean
9. ✅ README files exist
10. ✅ doc.go comment format is correct
11. ✅ Common typos check

**Run Locally:**

```bash
./scripts/verify-docs.sh
```

**CI Integration:**

- Runs on all pull requests
- Posts results as PR comment
- Fails PR if errors found
- Warnings don't fail build

**Example Output:**

```
==========================================
Documentation Verification
==========================================

Checking ADR directory structure...
✓ ADR directory exists
✓ ADR README exists

Checking ADR numbering...
✓ ADR numbering is sequential (found 7 ADRs)

...

==========================================
Verification Summary
==========================================
Errors:   0
Warnings: 0

Documentation verification PASSED
```

### Manual Review Checklist

Before submitting documentation PR:

- [ ] ADR follows MADR template
- [ ] ADR index updated
- [ ] All code examples are valid
- [ ] All file references are correct
- [ ] All links work
- [ ] No typos or grammar issues
- [ ] Package doc.go is comprehensive
- [ ] Auto-generated docs regenerated
- [ ] `./scripts/verify-docs.sh` passes
- [ ] Documentation is general-purpose (not AI-specific)

---

## Coverage Requirements

### Required Documentation

**Must Have:**

- ✅ ADRs for all major architectural decisions
- ✅ `doc.go` for all domain packages (`internal/bot/`, `internal/backtest/`, etc.)
- ✅ `doc.go` for all infrastructure packages (`internal/monitor/`, `internal/runner/`)
- ✅ `doc.go` for all integration packages (`internal/graph/`, `internal/keycloak/`)
- ✅ Auto-generated ERD (always up-to-date)
- ✅ Auto-generated dependency graph
- ✅ CLAUDE.md reference guide (<250 lines)

**Should Have:**

- ⚠️ Patterns for common code patterns
- ⚠️ Runbooks for operational procedures
- ⚠️ GraphQL API documentation (generated)

**Nice to Have:**

- 💡 Patterns for advanced techniques
- 💡 Runbooks for rare procedures
- 💡 Troubleshooting guides

### Coverage Metrics

**ADR Coverage:**

- Target: All major decisions documented
- Metric: Count of ADRs vs architectural decisions
- Tool: Manual review during design phase

**Package Documentation Coverage:**

- Target: 100% of non-trivial packages
- Metric: Packages with `doc.go` vs total packages
- Tool: `find internal/ -type d -mindepth 1 -maxdepth 1 | wc -l` vs `find internal/ -name doc.go | wc -l`

**Check Coverage:**

```bash
# Count packages
TOTAL=$(find internal/ -type d -mindepth 1 -maxdepth 1 | wc -l)

# Count documented packages
DOCUMENTED=$(find internal/ -name doc.go | wc -l)

# Calculate percentage
echo "Package Documentation Coverage: $(($DOCUMENTED * 100 / $TOTAL))%"
```

**Current Coverage:**

- ADRs: 7 (context-DI, ENT+GraphQL, versioning, runtime, codegen, config, k8s)
- Package docs: 5/14 packages (35.7%)
  - ✅ monitor/doc.go
  - ✅ runner/doc.go
  - ✅ graph/doc.go
  - ✅ backtest/doc.go
  - ✅ keycloak/doc.go
  - ❌ bot/ (needs doc.go)
  - ❌ strategy/ (needs doc.go)
  - ❌ exchange/ (needs doc.go)
  - ❌ auth/ (needs doc.go)
  - ❌ authz/ (needs doc.go)
  - ❌ db/ (simple, may not need)
  - ❌ enum/ (simple, may not need)
  - ❌ freqtrade/ (generated, may not need)
  - ❌ utils/ (simple, may not need)

**Coverage Goals:**

- Short-term: 60% (8/14 packages)
- Long-term: 80% (11/14 packages)

---

## Contribution Workflow

### Adding New Features

**Step 1: Plan & Document**

1. Create ADR for significant architectural decisions
2. Update or create relevant patterns
3. Plan package documentation

**Step 2: Implement**

1. Write code
2. Add package `doc.go` if new package
3. Update existing `doc.go` if modifying package

**Step 3: Generate Docs**

```bash
# Regenerate auto-generated docs
make docs-generate

# If GraphQL schema changed
./bin/volaticloud server &
./scripts/generate-graphql-docs.sh
```

**Step 4: Verify**

```bash
./scripts/verify-docs.sh
```

**Step 5: Commit**

```bash
git add docs/ internal/*/doc.go
git commit -m "docs: add documentation for [feature]"
```

### Updating Existing Documentation

**ADRs:** Never modify accepted ADRs. If decision changes, create new ADR and mark old one as "Superseded by ADR-NNNN"

**Package Docs:** Update `doc.go` when package behavior changes significantly

**Patterns:** Update patterns when best practices evolve

**Runbooks:** Update runbooks when procedures change

---

## Tools & Commands

### Makefile Targets

```bash
# Generate all documentation
make docs-generate

# Verify documentation
make docs-verify

# Full workflow
make docs-generate && make docs-verify
```

### Scripts

**Generate ERD:**

```bash
./scripts/generate-erd.sh [output-file]
# Default: docs/diagrams/erd.md
```

**Generate Dependencies:**

```bash
./scripts/generate-deps.sh [output-file]
# Default: docs/diagrams/dependencies.md
```

**Generate GraphQL Docs:**

```bash
./scripts/generate-graphql-docs.sh [server-url] [output-file]
# Defaults: http://localhost:8080/query, docs/api/graphql/schema.md
# Requires server running!
```

**Verify Documentation:**

```bash
./scripts/verify-docs.sh
# Exit code 0: passed, 1: failed, 0 with warnings: passed with warnings
```

### Go Tools

**View Package Documentation:**

```bash
# Command line
go doc internal/{package}

# HTML server
godoc -http=:6060
# Visit http://localhost:6060/pkg/volaticloud/internal/{package}/
```

**Extract Package Summary:**

```bash
go list -f '{{.Doc}}' ./internal/{package}
```

---

## Best Practices

### Do's ✅

- ✅ **Write documentation while coding** - Don't defer to later
- ✅ **Use ADRs for decisions** - Document why, not just what
- ✅ **Regenerate auto-docs before committing** - Keep diagrams in sync
- ✅ **Run verification before PR** - Catch issues early
- ✅ **Write general-purpose docs** - Not AI-specific
- ✅ **Include code examples** - Runnable, tested examples
- ✅ **Link related docs** - Create navigation paths
- ✅ **Use Mermaid diagrams** - All diagrams must use Mermaid syntax (not ASCII art)
- ✅ **Update CLAUDE.md** - When adding critical notes

### Don'ts ❌

- ❌ **Don't manually edit auto-generated files** - They'll be overwritten
- ❌ **Don't modify accepted ADRs** - Create new superseding ADR instead
- ❌ **Don't duplicate information** - Link to single source of truth
- ❌ **Don't write AI-specific docs** - Keep docs general-purpose
- ❌ **Don't skip verification** - CI will catch it anyway
- ❌ **Don't use images or ASCII art** - Use Mermaid diagrams only
- ❌ **Don't write obsolete docs** - Remove or mark as deprecated

---

## FAQ

**Q: When should I create an ADR?**
A: When making a decision that affects architecture, has multiple viable options, or will impact future development.

**Q: Do I need a doc.go for every package?**
A: No. Focus on domain packages, infrastructure packages, and integrations. Simple utility packages may not need comprehensive docs.

**Q: How do I know if my documentation is good enough?**
A: Can a new developer understand the package without reading the code? Can Claude Code use it effectively? If yes, it's good enough.

**Q: What if auto-generated docs are out of sync?**
A: Run `make docs-generate`. CI will fail if they're out of sync.

**Q: Should I document internal implementation details?**
A: Yes, in `doc.go` files. Document why things work the way they do, not just what they do.

**Q: How often should I regenerate docs?**
A: Before every commit that changes schemas, dependencies, or GraphQL API.

**Q: Can I use images or ASCII art in documentation?**
A: No. Use Mermaid diagrams only. Images and ASCII art are harder to version control, review, and maintain. Mermaid diagrams are rendered consistently across platforms and can be easily updated.

**Q: What if I disagree with an ADR?**
A: Create a new ADR proposing the alternative, with full context and justification.

---

## References

- [MADR Template](https://adr.github.io/madr/) - ADR template we use
- [Go Doc Comments](https://go.dev/doc/comment) - Official Go documentation guide
- [Mermaid Syntax](https://mermaid.js.org/) - Diagram syntax
- [Conventional Commits](https://www.conventionalcommits.org/) - Commit message format

---

**For questions or improvements to this guide, create an issue or PR.**
