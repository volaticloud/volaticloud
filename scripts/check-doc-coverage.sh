#!/bin/bash

# Documentation Coverage Checker
# Calculates coverage metrics for package documentation
# Usage: ./scripts/check-doc-coverage.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}Documentation Coverage Report${NC}"
echo -e "${BLUE}===========================================${NC}"
echo ""

# Count total packages (excluding vendor, testdata, etc.)
TOTAL=$(find internal/ -type d -mindepth 1 -maxdepth 1 | grep -v -E '(vendor|testdata|\.git)' | wc -l | tr -d ' ')

# Count documented packages (with doc.go)
DOCUMENTED=$(find internal/ -name 'doc.go' | wc -l | tr -d ' ')

# Calculate percentage
if [ "$TOTAL" -gt 0 ]; then
    PERCENTAGE=$((DOCUMENTED * 100 / TOTAL))
else
    PERCENTAGE=0
fi

# Package Documentation Coverage
echo -e "${BLUE}Package Documentation Coverage:${NC}"
echo -e "  Total packages: ${TOTAL}"
echo -e "  Documented packages: ${DOCUMENTED}"

if [ "$PERCENTAGE" -ge 80 ]; then
    echo -e "  Coverage: ${GREEN}${PERCENTAGE}%${NC} ✓ (Excellent)"
elif [ "$PERCENTAGE" -ge 60 ]; then
    echo -e "  Coverage: ${YELLOW}${PERCENTAGE}%${NC} ⚠ (Good, target 80%)"
else
    echo -e "  Coverage: ${RED}${PERCENTAGE}%${NC} ✗ (Needs improvement, target 60%)"
fi

echo ""

# List documented packages
echo -e "${BLUE}Documented Packages:${NC}"
find internal/ -name 'doc.go' | while read -r docfile; do
    package=$(dirname "$docfile" | sed 's|internal/||')
    lines=$(wc -l < "$docfile" | tr -d ' ')

    if [ "$lines" -ge 300 ]; then
        echo -e "  ${GREEN}✓${NC} $package (${lines} lines)"
    elif [ "$lines" -ge 100 ]; then
        echo -e "  ${YELLOW}⚠${NC} $package (${lines} lines - consider expanding)"
    else
        echo -e "  ${RED}✗${NC} $package (${lines} lines - too brief)"
    fi
done

echo ""

# List undocumented packages
echo -e "${BLUE}Undocumented Packages:${NC}"
UNDOCUMENTED=0
find internal/ -type d -mindepth 1 -maxdepth 1 | grep -v -E '(vendor|testdata|\.git)' | while read -r dir; do
    package=$(basename "$dir")

    if [ ! -f "$dir/doc.go" ]; then
        # Check if it's a simple package (few files, low LOC)
        file_count=$(find "$dir" -maxdepth 1 -name '*.go' -not -name '*_test.go' | wc -l | tr -d ' ')

        if [ "$file_count" -le 2 ]; then
            echo -e "  ${YELLOW}○${NC} $package (simple, ${file_count} files - may not need doc.go)"
        else
            echo -e "  ${RED}✗${NC} $package (${file_count} files - needs doc.go)"
            UNDOCUMENTED=$((UNDOCUMENTED + 1))
        fi
    fi
done

echo ""

# ADR Coverage
echo -e "${BLUE}ADR (Architecture Decision Records):${NC}"
ADR_COUNT=$(find docs/adr/ -name '[0-9][0-9][0-9][0-9]-*.md' 2>/dev/null | wc -l | tr -d ' ')
echo -e "  Total ADRs: ${ADR_COUNT}"
if [ "$ADR_COUNT" -ge 5 ]; then
    echo -e "  Status: ${GREEN}Good coverage${NC} ✓"
else
    echo -e "  Status: ${YELLOW}Consider documenting more decisions${NC} ⚠"
fi

echo ""

# Auto-Generated Documentation
echo -e "${BLUE}Auto-Generated Documentation:${NC}"

# ERD
if [ -f "docs/diagrams/erd.md" ]; then
    ERD_DATE=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" docs/diagrams/erd.md 2>/dev/null || stat -c "%y" docs/diagrams/erd.md 2>/dev/null | cut -d' ' -f1,2)
    echo -e "  ${GREEN}✓${NC} ERD (Entity Relationship Diagram) - Updated: $ERD_DATE"
else
    echo -e "  ${RED}✗${NC} ERD missing - Run: make docs-generate"
fi

# Dependencies
if [ -f "docs/diagrams/dependencies.md" ]; then
    DEPS_DATE=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" docs/diagrams/dependencies.md 2>/dev/null || stat -c "%y" docs/diagrams/dependencies.md 2>/dev/null | cut -d' ' -f1,2)
    echo -e "  ${GREEN}✓${NC} Dependency Graph - Updated: $DEPS_DATE"
else
    echo -e "  ${RED}✗${NC} Dependency Graph missing - Run: make docs-generate"
fi

# GraphQL API Docs
if [ -f "docs/api/graphql/schema.md" ]; then
    GQL_DATE=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" docs/api/graphql/schema.md 2>/dev/null || stat -c "%y" docs/api/graphql/schema.md 2>/dev/null | cut -d' ' -f1,2)
    echo -e "  ${GREEN}✓${NC} GraphQL API Documentation - Updated: $GQL_DATE"
else
    echo -e "  ${YELLOW}○${NC} GraphQL API Documentation not generated (requires running server)"
fi

echo ""

# Patterns and Runbooks
echo -e "${BLUE}Patterns and Runbooks:${NC}"

PATTERN_COUNT=$(find docs/patterns/ -name '*.md' -not -name 'README.md' 2>/dev/null | wc -l | tr -d ' ')
echo -e "  Patterns: ${PATTERN_COUNT}"

RUNBOOK_COUNT=$(find docs/runbooks/ -name '*.md' -not -name 'README.md' 2>/dev/null | wc -l | tr -d ' ')
echo -e "  Runbooks: ${RUNBOOK_COUNT}"

echo ""

# Summary and Recommendations
echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}Summary and Recommendations${NC}"
echo -e "${BLUE}===========================================${NC}"

if [ "$PERCENTAGE" -ge 80 ]; then
    echo -e "${GREEN}✓ Excellent documentation coverage!${NC}"
elif [ "$PERCENTAGE" -ge 60 ]; then
    echo -e "${YELLOW}⚠ Good coverage, aim for 80% to reach excellence${NC}"
else
    echo -e "${RED}✗ Documentation coverage needs improvement${NC}"
    echo -e "  ${YELLOW}Recommendations:${NC}"
    echo -e "  1. Add doc.go files to undocumented complex packages"
    echo -e "  2. Target: 60% short-term, 80% long-term"
fi

# Check if auto-generated docs are stale
if [ -f "docs/diagrams/erd.md" ]; then
    # Check if ERD is older than schema files
    NEWEST_SCHEMA=$(find internal/ent/schema/ -name '*.go' -not -name '*_test.go' -exec stat -f "%m %N" {} \; 2>/dev/null | sort -rn | head -1 | cut -d' ' -f1)
    ERD_MTIME=$(stat -f "%m" docs/diagrams/erd.md 2>/dev/null || echo "0")

    if [ -n "$NEWEST_SCHEMA" ] && [ "$NEWEST_SCHEMA" -gt "$ERD_MTIME" ]; then
        echo -e "${YELLOW}⚠ ERD may be stale - ENT schemas modified after last generation${NC}"
        echo -e "  ${YELLOW}Run: make docs-generate${NC}"
    fi
fi

echo ""

# Next Steps
echo -e "${BLUE}Next Steps:${NC}"
echo -e "  • Add missing doc.go files: ${RED}$(find internal/ -type d -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')${NC} → ${GREEN}${DOCUMENTED}${NC} / ${TOTAL}"
echo -e "  • Run: ${YELLOW}make docs-generate${NC} to update auto-generated docs"
echo -e "  • Run: ${YELLOW}make docs-verify${NC} to validate documentation"
echo -e "  • See: ${BLUE}docs/DOCUMENTATION_GUIDE.md${NC} for detailed guidelines"

echo ""
echo -e "${GREEN}Documentation coverage check complete!${NC}"
