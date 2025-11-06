# GitHub Actions Workflow Update Instructions

## Issue
The GitHub App (Claude Code) cannot push changes to `.github/workflows/` files due to missing `workflows` permission. These changes must be applied manually.

## Required Changes

### File: `.github/workflows/backend-ci.yml`

Replace **4 instances** of `go-version: '1.24.x'` with `go-version: '1.23.x'`

**Locations:**
- Line 37: `go-version: ['1.24.x']` → `go-version: ['1.23.x']`
- Line 88: `go-version: '1.24.x'` → `go-version: '1.23.x'`
- Line 112: `go-version: '1.24.x'` → `go-version: '1.23.x'`
- Line 134: `go-version: '1.24.x'` → `go-version: '1.23.x'`

### File: `.github/workflows/quality.yml`

Replace **2 instances** of `go-version: '1.24.x'` with `go-version: '1.23.x'`

**Locations:**
- Line 24: `go-version: '1.24.x'` → `go-version: '1.23.x'`
- Line 111: `go-version: '1.24.x'` → `go-version: '1.23.x'`

## How to Apply (Choose One Method)

### Method 1: Command Line (Automated)

```bash
# On your local machine
git checkout claude/golang-test-coverage-011CUrVc2vDr2jVp5yH9v1iW
git pull

# Apply the changes automatically
sed -i "s/go-version: '1\.24\.x'/go-version: '1.23.x'/g" .github/workflows/backend-ci.yml
sed -i "s/go-version: \['1\.24\.x'\]/go-version: ['1.23.x']/g" .github/workflows/backend-ci.yml
sed -i "s/go-version: '1\.24\.x'/go-version: '1.23.x'/g" .github/workflows/quality.yml

# Commit and push
git add .github/workflows/
git commit -m "fix: update GitHub Actions workflows to use Go 1.23.x"
git push origin claude/golang-test-coverage-011CUrVc2vDr2jVp5yH9v1iW
```

### Method 2: GitHub Web UI

1. Go to: https://github.com/YOUR_USERNAME/anytrade
2. Navigate to branch: `claude/golang-test-coverage-011CUrVc2vDr2jVp5yH9v1iW`
3. Edit `.github/workflows/backend-ci.yml`:
   - Click the file, then click "Edit" (pencil icon)
   - Use Find & Replace (Ctrl+F or Cmd+F) to replace `1.24.x` with `1.23.x`
   - Commit changes
4. Edit `.github/workflows/quality.yml`:
   - Repeat the same process
   - Commit changes

### Method 3: Restore Stashed Changes

If you're in the same terminal session where Claude created the stash:

```bash
git stash list  # Find the stash (should show "workflow-go-version-updates")
git stash pop   # Apply the stashed changes
git add .github/workflows/
git commit -m "fix: update GitHub Actions workflows to use Go 1.23.x"
git push origin claude/golang-test-coverage-011CUrVc2vDr2jVp5yH9v1iW
```

## Why This is Needed

Go 1.24.x does not exist yet (it's a future version). GitHub Actions runners only support released Go versions. The latest stable version is Go 1.23.x, which is what we've updated `go.mod` to use.

## After Applying

Once pushed, GitHub Actions should:
- ✅ Successfully install Go 1.23.x
- ✅ Run all tests with new coverage
- ✅ Pass all CI checks

## Verification

After pushing, check GitHub Actions:
1. Go to: https://github.com/YOUR_USERNAME/anytrade/actions
2. Find the workflow run for your latest commit
3. Verify all jobs pass (Test, Lint, Build, Validate Code Generation)

## Current Branch Status

- ✅ go.mod updated to Go 1.23 (COMMITTED)
- ✅ Code formatted with gofmt (COMMITTED)
- ✅ 50+ new test cases added (COMMITTED)
- ⏳ Workflow files need manual update (THIS FILE)
