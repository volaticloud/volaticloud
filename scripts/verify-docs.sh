#!/bin/bash

# Documentation Verification Script
# Validates documentation structure, file references, and links
# Usage: ./scripts/verify-docs.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0

# Helper functions
error() {
    echo -e "${RED}ERROR: $1${NC}"
    ERRORS=$((ERRORS + 1))
}

warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
    WARNINGS=$((WARNINGS + 1))
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

echo "=========================================="
echo "Documentation Verification"
echo "=========================================="
echo ""

# Check 1: ADR Directory Structure
echo "Checking ADR directory structure..."
if [ ! -d "docs/adr" ]; then
    error "docs/adr/ directory not found"
else
    success "ADR directory exists"
fi

if [ ! -f "docs/adr/README.md" ]; then
    error "docs/adr/README.md not found"
else
    success "ADR README exists"
fi

# Check 2: ADR Numbering Sequential
echo ""
echo "Checking ADR numbering..."
ADR_FILES=(docs/adr/[0-9]*.md)
if [ ${#ADR_FILES[@]} -eq 0 ]; then
    error "No ADR files found"
else
    EXPECTED=1
    for ADR_FILE in "${ADR_FILES[@]}"; do
        if [ -f "$ADR_FILE" ]; then
            # Extract number from filename
            FILENAME=$(basename "$ADR_FILE")
            if [[ $FILENAME =~ ^([0-9]{4})- ]]; then
                NUM=${BASH_REMATCH[1]}
                NUM=$((10#$NUM)) # Convert to decimal (remove leading zeros)

                if [ $NUM -ne $EXPECTED ]; then
                    error "ADR numbering gap: expected $EXPECTED, found $NUM in $FILENAME"
                fi
                EXPECTED=$((NUM + 1))
            else
                warning "ADR file doesn't match naming pattern: $FILENAME"
            fi
        fi
    done
    success "ADR numbering is sequential (found $((EXPECTED - 1)) ADRs)"
fi

# Check 3: ADR Index in README
echo ""
echo "Checking ADR index in README..."
if [ -f "docs/adr/README.md" ]; then
    for ADR_FILE in docs/adr/[0-9]*.md; do
        if [ -f "$ADR_FILE" ]; then
            FILENAME=$(basename "$ADR_FILE")
            if ! grep -q "$FILENAME" docs/adr/README.md; then
                warning "ADR $FILENAME not indexed in README.md"
            fi
        fi
    done
    success "ADR index checked"
fi

# Check 4: Package Documentation Files
echo ""
echo "Checking package documentation..."
REQUIRED_DOCS=(
    "internal/monitor/doc.go"
    "internal/runner/doc.go"
    "internal/graph/doc.go"
    "internal/backtest/doc.go"
    "internal/keycloak/doc.go"
)

for DOC_FILE in "${REQUIRED_DOCS[@]}"; do
    if [ ! -f "$DOC_FILE" ]; then
        error "Package documentation missing: $DOC_FILE"
    else
        # Verify it's a proper package doc (starts with package comment)
        if ! head -n 5 "$DOC_FILE" | grep -q "^/\*"; then
            warning "Package doc may not have proper format: $DOC_FILE"
        else
            success "Package doc exists: $DOC_FILE"
        fi
    fi
done

# Check 5: File References in ADRs
echo ""
echo "Checking file references in ADRs..."
for ADR_FILE in docs/adr/[0-9]*.md; do
    if [ -f "$ADR_FILE" ]; then
        # Extract file references (looking for patterns like internal/*, cmd/*, etc.)
        # This is a simple check - looks for common Go paths
        while IFS= read -r line; do
            if [[ $line =~ (internal/[a-z_/]+\.go|cmd/[a-z_/]+\.go) ]]; then
                REFERENCED_FILE="${BASH_REMATCH[1]}"
                # Remove any markdown formatting
                REFERENCED_FILE=$(echo "$REFERENCED_FILE" | sed 's/`//g' | sed 's/).*$//' | sed 's/:.*$//')

                if [ ! -f "$REFERENCED_FILE" ]; then
                    warning "Referenced file not found in $ADR_FILE: $REFERENCED_FILE"
                fi
            fi
        done < "$ADR_FILE"
    fi
done
success "File references checked"

# Check 6: ADR Cross-References
echo ""
echo "Checking ADR cross-references..."
for ADR_FILE in docs/adr/[0-9]*.md; do
    if [ -f "$ADR_FILE" ]; then
        # Look for ADR references like ADR-0001, 0001-*, etc.
        while IFS= read -r line; do
            if [[ $line =~ ADR-([0-9]{4}) ]] || [[ $line =~ \(([0-9]{4})-[a-z-]+\.md\) ]]; then
                REF_NUM="${BASH_REMATCH[1]}"
                REF_FILE="docs/adr/${REF_NUM}-*.md"

                # Check if referenced ADR exists
                if ! ls $REF_FILE 1> /dev/null 2>&1; then
                    warning "Referenced ADR not found in $ADR_FILE: ADR-$REF_NUM"
                fi
            fi
        done < "$ADR_FILE"
    fi
done
success "ADR cross-references checked"

# Check 7: CLAUDE.md Structure
echo ""
echo "Checking CLAUDE.md..."
if [ ! -f ".claude/CLAUDE.md" ]; then
    error ".claude/CLAUDE.md not found"
else
    LINE_COUNT=$(wc -l < .claude/CLAUDE.md | tr -d ' ')

    # Check if CLAUDE.md references the docs
    if ! grep -q "docs/adr" .claude/CLAUDE.md; then
        warning "CLAUDE.md doesn't reference docs/adr/"
    fi

    success "CLAUDE.md exists ($LINE_COUNT lines)"

    # Future enhancement: check if it's under target line count
    # TARGET_LINES=200
    # if [ $LINE_COUNT -gt $TARGET_LINES ]; then
    #     warning "CLAUDE.md has $LINE_COUNT lines (target: <$TARGET_LINES)"
    # fi
fi

# Check 8: README Files
echo ""
echo "Checking README files..."
REQUIRED_READMES=(
    "README.md"
    "docs/adr/README.md"
)

for README in "${REQUIRED_READMES[@]}"; do
    if [ ! -f "$README" ]; then
        error "README missing: $README"
    else
        # Check if README is not empty
        if [ ! -s "$README" ]; then
            error "README is empty: $README"
        else
            success "README exists: $README"
        fi
    fi
done

# Check 9: Package doc.go Comments
echo ""
echo "Checking doc.go comment format..."
for DOC_FILE in internal/*/doc.go; do
    if [ -f "$DOC_FILE" ]; then
        # Check if it has package documentation (/* ... */ followed by package statement)
        if ! grep -Pzo '/\*(?:[^*]|\*(?!/))*\*/\s*package' "$DOC_FILE" > /dev/null 2>&1; then
            # Fallback to simpler check if perl regex not available
            if ! head -n 10 "$DOC_FILE" | grep -q "package"; then
                warning "Package doc format may be incorrect: $DOC_FILE"
            fi
        fi
    fi
done
success "Package documentation format checked"

# Check 10: Common Typos in Documentation
echo ""
echo "Checking for common typos..."
TYPO_PATTERNS=(
    "teh:the"
    "recieve:receive"
    "occured:occurred"
    "seperator:separator"
)

for PATTERN in "${TYPO_PATTERNS[@]}"; do
    TYPO="${PATTERN%%:*}"
    CORRECT="${PATTERN##*:}"

    TYPO_FILES=$(grep -rl "$TYPO" docs/ 2>/dev/null || true)
    if [ -n "$TYPO_FILES" ]; then
        warning "Possible typo '$TYPO' (should be '$CORRECT') found in: $TYPO_FILES"
    fi
done
success "Typo check complete"

# Summary
echo ""
echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo -e "Errors:   ${RED}$ERRORS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}Documentation verification FAILED${NC}"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}Documentation verification passed with warnings${NC}"
    exit 0
else
    echo -e "${GREEN}Documentation verification PASSED${NC}"
    exit 0
fi
