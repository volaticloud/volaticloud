---
name: commit
description: Git commit workflow for VolatiCloud. Use when user says "commit", "prepare commit", "git commit", or wants to commit changes. Runs pre-commit checklist, creates professional commit messages following conventional commits format.
---

# Git Commit Skill

Create git commits following VolatiCloud standards with mandatory pre-commit checks.

## CRITICAL RULES

### NEVER Add Claude Advertising

**ABSOLUTELY FORBIDDEN in commit messages:**
- No "Co-Authored-By: Claude" lines
- No "Generated with Claude Code" footers
- No emojis or AI-related signatures
- No mentions of Claude, AI, or automation tools

**Commit messages must be:**
- Professional and descriptive
- Written as if by a human developer
- Following conventional commits format

## Commit Message Format

Use conventional commits format:

```
<type>(<scope>): <short description>

<optional body with details>
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring (no behavior change)
- `test` - Adding or updating tests
- `docs` - Documentation changes
- `chore` - Maintenance tasks
- `perf` - Performance improvements
- `style` - Code style/formatting (no logic change)

**Examples:**
```
feat(strategy): add RSI indicator support

fix(e2e): improve test reliability and add testids to components

refactor(bot): extract config validation to domain package

test(authz): add integration tests for UMA scopes
```

## Pre-Commit Checklist (MANDATORY)

Before creating any commit, run ALL these checks:

### 1. Dashboard Checks (if dashboard files changed)

```bash
cd dashboard && npm run lint
cd dashboard && npx tsc --noEmit
```

### 2. Backend Checks (if Go files changed)

```bash
go test ./...
go vet ./...
golangci-lint run ./...
```

### 3. All Checks Must Pass

- Do NOT commit if any check fails
- Fix issues first, then commit
- Report failures to user with specific errors

## Workflow

When user requests a commit:

1. **Check git status**
   ```bash
   git status
   git diff --staged
   git diff
   ```

2. **Determine what changed**
   - Dashboard files (`.tsx`, `.ts` in dashboard/)
   - Backend files (`.go` files)
   - Documentation (`.md` files)
   - Configuration files

3. **Run relevant pre-commit checks**
   - Skip dashboard checks if no dashboard files changed
   - Skip backend checks if no Go files changed
   - Always run if unsure

4. **Stage files appropriately**
   ```bash
   git add <specific-files>
   ```
   - Prefer specific files over `git add -A`
   - Never stage sensitive files (.env, credentials)

5. **Create commit with proper message**
   ```bash
   git commit -m "$(cat <<'EOF'
   type(scope): description

   Optional body
   EOF
   )"
   ```

6. **Verify commit was created**
   ```bash
   git log -1 --oneline
   git status
   ```

## What NOT To Do

- Never use `--no-verify` flag
- Never force push to main/master
- Never amend published commits without explicit request
- Never skip pre-commit checks
- Never add Claude/AI attribution to commits

## References

- Git Rules: `.claude/CLAUDE.md` (lines 6-19)
- Pre-commit checklist: `.claude/CLAUDE.md` (lines 12-19)
- Conventional Commits: https://www.conventionalcommits.org/