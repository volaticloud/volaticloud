#!/bin/bash
# Quick fix script for GitHub Actions workflow files
# This applies the Go version update that Claude cannot push due to permissions

set -e

echo "==================================================================="
echo "  FIXING GITHUB ACTIONS WORKFLOWS - GO VERSION UPDATE"
echo "==================================================================="
echo ""

cd "$(git rev-parse --show-toplevel)"

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "claude/golang-test-coverage-011CUrVc2vDr2jVp5yH9v1iW" ]; then
    echo ""
    echo "⚠️  WARNING: You're not on the correct branch!"
    echo "Expected: claude/golang-test-coverage-011CUrVc2vDr2jVp5yH9v1iW"
    echo "Current:  $CURRENT_BRANCH"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "Applying workflow fixes..."
echo ""

# Update backend-ci.yml
sed -i "s/go-version: '1\.24\.x'/go-version: '1.23.x'/g" .github/workflows/backend-ci.yml
sed -i "s/go-version: \['1\.24\.x'\]/go-version: ['1.23.x']/g" .github/workflows/backend-ci.yml

# Update quality.yml
sed -i "s/go-version: '1\.24\.x'/go-version: '1.23.x'/g" .github/workflows/quality.yml

echo "✅ Workflow files updated!"
echo ""
echo "Changes made:"
echo "  - .github/workflows/backend-ci.yml (4 changes)"
echo "  - .github/workflows/quality.yml (2 changes)"
echo ""

# Show diff
git diff .github/workflows/ | head -40

echo ""
echo "==================================================================="
read -p "Commit and push these changes? (y/n) " -n 1 -r
echo
echo "==================================================================="

if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add .github/workflows/backend-ci.yml .github/workflows/quality.yml

    git commit -m "fix: update GitHub Actions workflows to use Go 1.23.x

Update all workflow files to use Go 1.23.x instead of 1.24.x for
compatibility with GitHub Actions runners.

Changes:
- backend-ci.yml: Update 4 instances of go-version to 1.23.x
- quality.yml: Update 2 instances of go-version to 1.23.x

This fixes CI failures caused by GitHub Actions attempting to install
non-existent Go 1.24.x."

    echo ""
    echo "✅ Changes committed!"
    echo ""
    echo "Now pushing to remote..."
    echo ""

    git push origin "$CURRENT_BRANCH"

    if [ $? -eq 0 ]; then
        echo ""
        echo "==================================================================="
        echo "  ✅ SUCCESS! Workflow files updated and pushed!"
        echo "==================================================================="
        echo ""
        echo "GitHub Actions should now pass. Check:"
        echo "  https://github.com/YOUR_USERNAME/anytrade/actions"
        echo ""
    else
        echo ""
        echo "❌ Push failed! You may need to push manually:"
        echo "  git push origin $CURRENT_BRANCH"
        echo ""
    fi
else
    echo ""
    echo "Changes not committed. To undo changes:"
    echo "  git restore .github/workflows/"
    echo ""
fi
