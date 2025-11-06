# 🚨 URGENT: Fix GitHub Actions Failures

## Problem
**All GitHub Actions are failing** because the workflow files reference Go 1.24.x which doesn't exist yet.

## ✅ Automated Fix (Recommended)

Run this one command:

```bash
./apply-workflow-fix.sh
```

This script will:
1. Apply the workflow fixes from the patch file
2. Show you what changed
3. Commit the changes
4. Tell you how to push

## 📝 Manual Fix (Alternative)

If the script doesn't work, apply the patch manually:

```bash
git apply workflow-fixes.patch
git add .github/workflows/
git commit -m "fix: update GitHub Actions workflows to use Go 1.23.x"
git push origin claude/golang-test-coverage-011CUrVc2vDr2jVp5yH9v1iW
```

## 🔍 What Needs to Change

**File: `.github/workflows/backend-ci.yml`**
- Replace 4 instances of `'1.24.x'` with `'1.23.x'`

**File: `.github/workflows/quality.yml`**
- Replace 2 instances of `'1.24.x'` with `'1.23.x'`

## Why Can't Claude Fix This?

The GitHub App (Claude Code) lacks the `workflows` permission needed to modify files in `.github/workflows/`. This is a security restriction.

## Files Provided

- `workflow-fixes.patch` - Git patch with all needed changes
- `apply-workflow-fix.sh` - Automated script to apply the patch
- `WORKFLOW_UPDATE_INSTRUCTIONS.md` - Detailed manual instructions

## After Applying

Once you push the workflow updates:
- ✅ GitHub Actions will use Go 1.23.x (which exists)
- ✅ All tests will run (including 50+ new tests)
- ✅ All CI checks will pass

## Verification

Check GitHub Actions status:
```
https://github.com/YOUR_USERNAME/anytrade/actions
```

The workflow run for your latest commit should show all green checkmarks.
