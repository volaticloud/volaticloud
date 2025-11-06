#!/bin/bash
set -e

echo "Applying workflow fixes for Go version compatibility..."

cd "$(git rev-parse --show-toplevel)"

# Check if we're on the right branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "claude/golang-test-coverage-011CUrVc2vDr2jVp5yH9v1iW" ]; then
    echo "Error: Please checkout branch claude/golang-test-coverage-011CUrVc2vDr2jVp5yH9v1iW first"
    echo "Run: git checkout claude/golang-test-coverage-011CUrVc2vDr2jVp5yH9v1iW"
    exit 1
fi

# Apply the patch
if [ -f "workflow-fixes.patch" ]; then
    echo "Applying patch from workflow-fixes.patch..."
    git apply workflow-fixes.patch
elif git stash list | grep -q "workflow-go-version-updates"; then
    echo "Applying changes from stash..."
    git stash pop
else
    echo "No patch file or stash found. Applying changes manually..."
    sed -i "s/go-version: '1\.24\.x'/go-version: '1.23.x'/g" .github/workflows/backend-ci.yml
    sed -i "s/go-version: \['1\.24\.x'\]/go-version: ['1.23.x']/g" .github/workflows/backend-ci.yml
    sed -i "s/go-version: '1\.24\.x'/go-version: '1.23.x'/g" .github/workflows/quality.yml
fi

# Show what changed
echo ""
echo "Changes made:"
git diff .github/workflows/

# Commit the changes
echo ""
read -p "Commit these changes? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add .github/workflows/backend-ci.yml .github/workflows/quality.yml
    git commit -m "fix: update GitHub Actions workflows to use Go 1.23.x

Update all workflow files to use Go 1.23.x instead of 1.24.x for
compatibility with GitHub Actions runners.

Changes:
- backend-ci.yml: Update 4 instances of go-version to 1.23.x
- quality.yml: Update 2 instances of go-version to 1.23.x

This fixes CI failures caused by requesting non-existent Go 1.24.x."
    
    echo ""
    echo "Changes committed. Now push with:"
    echo "  git push origin claude/golang-test-coverage-011CUrVc2vDr2jVp5yH9v1iW"
else
    echo "Changes not committed. Run 'git restore .github/workflows/' to undo."
fi
