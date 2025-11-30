#!/bin/bash
# Documentation Quality Assessment Script
# Generates metrics and quality scores for project documentation

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
DOCS_DIR="${PROJECT_ROOT}/docs"
INTERNAL_DIR="${PROJECT_ROOT}/internal"
OUTPUT_FILE="${PROJECT_ROOT}/docs/quality-report.md"

# Scoring thresholds
MIN_ADR_COUNT=8
MIN_PATTERN_COUNT=8
MIN_RUNBOOK_COUNT=3
MIN_PACKAGE_DOC_COVERAGE=80
MIN_BROKEN_LINK_SCORE=95
MIN_FRESHNESS_SCORE=85

echo "==================================="
echo "Documentation Quality Assessment"
echo "==================================="
echo ""

# 1. COVERAGE METRICS
echo -e "${BLUE}1. Documentation Coverage${NC}"
echo "-----------------------------------"

# Count documentation files
TOTAL_MD_FILES=$(find "${DOCS_DIR}" -type f -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
ADR_COUNT=$(find "${DOCS_DIR}/adr" -type f -name "*.md" 2>/dev/null | grep -v README.md | wc -l | tr -d ' ')
PATTERN_COUNT=$(find "${DOCS_DIR}/patterns" -type f -name "*.md" 2>/dev/null | grep -v README.md | wc -l | tr -d ' ')
RUNBOOK_COUNT=$(find "${DOCS_DIR}/runbooks" -type f -name "*.md" 2>/dev/null | grep -v README.md | wc -l | tr -d ' ')

echo "Total documentation files: ${TOTAL_MD_FILES}"
echo "  - ADRs: ${ADR_COUNT} (target: ${MIN_ADR_COUNT}+)"
echo "  - Patterns: ${PATTERN_COUNT} (target: ${MIN_PATTERN_COUNT}+)"
echo "  - Runbooks: ${RUNBOOK_COUNT} (target: ${MIN_RUNBOOK_COUNT}+)"

# Package documentation coverage
TOTAL_PACKAGES=$(find "${INTERNAL_DIR}" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
DOCUMENTED_PACKAGES=$(find "${INTERNAL_DIR}" -maxdepth 2 -name "doc.go" | wc -l | tr -d ' ')
PACKAGE_DOC_COVERAGE=$((DOCUMENTED_PACKAGES * 100 / TOTAL_PACKAGES))

echo "Package doc.go coverage: ${DOCUMENTED_PACKAGES}/${TOTAL_PACKAGES} (${PACKAGE_DOC_COVERAGE}%, target: ${MIN_PACKAGE_DOC_COVERAGE}%+)"

# 2. CONTENT QUALITY
echo ""
echo -e "${BLUE}2. Content Quality${NC}"
echo "-----------------------------------"

# Total lines of documentation
TOTAL_DOC_LINES=$(find "${DOCS_DIR}" -type f -name "*.md" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')
TOTAL_PACKAGE_DOC_LINES=$(find "${INTERNAL_DIR}" -type f -name "doc.go" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
TOTAL_LINES=$((TOTAL_DOC_LINES + TOTAL_PACKAGE_DOC_LINES))

echo "Total documentation lines: ${TOTAL_LINES}"
echo "  - Markdown docs: ${TOTAL_DOC_LINES}"
echo "  - Package docs: ${TOTAL_PACKAGE_DOC_LINES}"

# Average document length
AVG_DOC_LENGTH=$((TOTAL_DOC_LINES / TOTAL_MD_FILES))
echo "Average document length: ${AVG_DOC_LENGTH} lines"

# Code examples in documentation
CODE_BLOCK_COUNT=$(find "${DOCS_DIR}" -type f -name "*.md" -exec grep -c '```' {} + 2>/dev/null | awk '{s+=$1} END {print s}' || echo "0")
DOCS_WITH_CODE=$(find "${DOCS_DIR}" -type f -name "*.md" -exec grep -l '```' {} + 2>/dev/null | wc -l | tr -d ' ')
CODE_COVERAGE=$((DOCS_WITH_CODE * 100 / TOTAL_MD_FILES))

echo "Code examples: ${CODE_BLOCK_COUNT} blocks in ${DOCS_WITH_CODE} files (${CODE_COVERAGE}% coverage)"

# 3. LINK INTEGRITY
echo ""
echo -e "${BLUE}3. Link Integrity${NC}"
echo "-----------------------------------"

# Internal links
INTERNAL_LINKS=$(find "${DOCS_DIR}" -type f -name "*.md" -exec grep -oh '\[.*\]([^)]*\.md[^)]*)' {} + 2>/dev/null | wc -l | tr -d ' ')
echo "Internal links found: ${INTERNAL_LINKS}"

# Check for broken internal links
BROKEN_LINKS=0
while IFS= read -r file; do
    if [ -f "$file" ]; then
        while IFS= read -r link; do
            # Extract path from markdown link [text](path)
            link_path=$(echo "$link" | sed -n 's/.*(\([^)]*\)).*/\1/p')

            # Skip external links (http/https)
            if [[ "$link_path" =~ ^https?:// ]]; then
                continue
            fi

            # Resolve relative path
            dir=$(dirname "$file")
            target="${dir}/${link_path}"

            # Check if target exists
            if [ ! -f "$target" ] && [ ! -d "$target" ]; then
                ((BROKEN_LINKS++))
            fi
        done < <(grep -oh '\[.*\]([^)]*)' "$file" 2>/dev/null || true)
    fi
done < <(find "${DOCS_DIR}" -type f -name "*.md")

if [ "${INTERNAL_LINKS}" -gt 0 ]; then
    WORKING_LINKS=$((INTERNAL_LINKS - BROKEN_LINKS))
    LINK_SCORE=$((WORKING_LINKS * 100 / INTERNAL_LINKS))
else
    LINK_SCORE=100
fi

if [ "${BROKEN_LINKS}" -eq 0 ]; then
    echo -e "${GREEN}✓ No broken links detected${NC}"
    echo "Link integrity score: ${LINK_SCORE}% (target: ${MIN_BROKEN_LINK_SCORE}%+)"
else
    echo -e "${YELLOW}⚠ Broken links: ${BROKEN_LINKS}${NC}"
    echo "Link integrity score: ${LINK_SCORE}% (target: ${MIN_BROKEN_LINK_SCORE}%+)"
fi

# 4. FRESHNESS
echo ""
echo -e "${BLUE}4. Documentation Freshness${NC}"
echo "-----------------------------------"

# Find stale documentation (not modified in 90+ days)
STALE_DOCS=$(find "${DOCS_DIR}" -type f -name "*.md" -mtime +90 2>/dev/null | wc -l | tr -d ' ')
FRESH_DOCS=$((TOTAL_MD_FILES - STALE_DOCS))
FRESHNESS_SCORE=$((FRESH_DOCS * 100 / TOTAL_MD_FILES))

echo "Fresh docs (< 90 days old): ${FRESH_DOCS}/${TOTAL_MD_FILES} (${FRESHNESS_SCORE}%, target: ${MIN_FRESHNESS_SCORE}%+)"

if [ "${STALE_DOCS}" -gt 0 ]; then
    echo -e "${YELLOW}⚠ Stale docs detected: ${STALE_DOCS}${NC}"
    echo "Consider reviewing:"
    find "${DOCS_DIR}" -type f -name "*.md" -mtime +90 2>/dev/null | head -5 | while read -r stale_file; do
        last_modified=$(stat -f "%Sm" -t "%Y-%m-%d" "$stale_file" 2>/dev/null || stat -c "%y" "$stale_file" 2>/dev/null | cut -d' ' -f1)
        echo "  - $(basename "$stale_file") (last modified: ${last_modified})"
    done
fi

# 5. STRUCTURE & ORGANIZATION
echo ""
echo -e "${BLUE}5. Structure & Organization${NC}"
echo "-----------------------------------"

# Check required directories
REQUIRED_DIRS=("adr" "patterns" "runbooks" "api" "diagrams")
MISSING_DIRS=()

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "${DOCS_DIR}/${dir}" ]; then
        MISSING_DIRS+=("$dir")
    fi
done

if [ ${#MISSING_DIRS[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ All required directories present${NC}"
else
    echo -e "${YELLOW}⚠ Missing directories: ${MISSING_DIRS[*]}${NC}"
fi

# Check for index files
INDEX_FILES=("README.md" "adr/README.md" "patterns/README.md" "runbooks/README.md")
MISSING_INDICES=()

for index in "${INDEX_FILES[@]}"; do
    if [ ! -f "${DOCS_DIR}/${index}" ]; then
        MISSING_INDICES+=("$index")
    fi
done

if [ ${#MISSING_INDICES[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ All index files present${NC}"
else
    echo -e "${YELLOW}⚠ Missing index files: ${MISSING_INDICES[*]}${NC}"
fi

# 6. OVERALL QUALITY SCORE
echo ""
echo -e "${BLUE}6. Overall Quality Score${NC}"
echo "-----------------------------------"

# Calculate component scores
COVERAGE_SCORE=0
[ "${ADR_COUNT}" -ge "${MIN_ADR_COUNT}" ] && ((COVERAGE_SCORE+=25))
[ "${PATTERN_COUNT}" -ge "${MIN_PATTERN_COUNT}" ] && ((COVERAGE_SCORE+=25))
[ "${RUNBOOK_COUNT}" -ge "${MIN_RUNBOOK_COUNT}" ] && ((COVERAGE_SCORE+=25))
[ "${PACKAGE_DOC_COVERAGE}" -ge "${MIN_PACKAGE_DOC_COVERAGE}" ] && ((COVERAGE_SCORE+=25))

QUALITY_SCORE=0
[ "${CODE_COVERAGE}" -ge 70 ] && ((QUALITY_SCORE+=50))
[ "${AVG_DOC_LENGTH}" -ge 100 ] && ((QUALITY_SCORE+=50))

INTEGRITY_SCORE="${LINK_SCORE}"
FRESHNESS_FINAL="${FRESHNESS_SCORE}"

# Overall score (weighted average)
OVERALL_SCORE=$(( (COVERAGE_SCORE * 30 + QUALITY_SCORE * 20 + INTEGRITY_SCORE * 25 + FRESHNESS_FINAL * 25) / 100 ))

echo "Component Scores:"
echo "  - Coverage: ${COVERAGE_SCORE}/100"
echo "  - Quality: ${QUALITY_SCORE}/100"
echo "  - Integrity: ${INTEGRITY_SCORE}/100"
echo "  - Freshness: ${FRESHNESS_FINAL}/100"
echo ""
echo -e "${BLUE}Overall Score: ${OVERALL_SCORE}/100${NC}"

# Grade assignment
GRADE=""
if [ "${OVERALL_SCORE}" -ge 90 ]; then
    GRADE="${GREEN}A (Excellent)${NC}"
elif [ "${OVERALL_SCORE}" -ge 80 ]; then
    GRADE="${GREEN}B (Good)${NC}"
elif [ "${OVERALL_SCORE}" -ge 70 ]; then
    GRADE="${YELLOW}C (Needs Improvement)${NC}"
elif [ "${OVERALL_SCORE}" -ge 60 ]; then
    GRADE="${YELLOW}D (Poor)${NC}"
else
    GRADE="${RED}F (Critical Issues)${NC}"
fi

echo -e "Grade: ${GRADE}"

# 7. RECOMMENDATIONS
echo ""
echo -e "${BLUE}7. Recommendations${NC}"
echo "-----------------------------------"

if [ "${ADR_COUNT}" -lt "${MIN_ADR_COUNT}" ]; then
    echo -e "${YELLOW}• Add more Architecture Decision Records (current: ${ADR_COUNT}, target: ${MIN_ADR_COUNT}+)${NC}"
fi

if [ "${PATTERN_COUNT}" -lt "${MIN_PATTERN_COUNT}" ]; then
    echo -e "${YELLOW}• Document more code patterns (current: ${PATTERN_COUNT}, target: ${MIN_PATTERN_COUNT}+)${NC}"
fi

if [ "${RUNBOOK_COUNT}" -lt "${MIN_RUNBOOK_COUNT}" ]; then
    echo -e "${YELLOW}• Add operational runbooks (current: ${RUNBOOK_COUNT}, target: ${MIN_RUNBOOK_COUNT}+)${NC}"
fi

if [ "${PACKAGE_DOC_COVERAGE}" -lt "${MIN_PACKAGE_DOC_COVERAGE}" ]; then
    echo -e "${YELLOW}• Improve package documentation coverage (current: ${PACKAGE_DOC_COVERAGE}%, target: ${MIN_PACKAGE_DOC_COVERAGE}%+)${NC}"
fi

if [ "${BROKEN_LINKS}" -gt 0 ]; then
    echo -e "${YELLOW}• Fix ${BROKEN_LINKS} broken internal links${NC}"
fi

if [ "${STALE_DOCS}" -gt 5 ]; then
    echo -e "${YELLOW}• Review and update ${STALE_DOCS} stale documents${NC}"
fi

if [ "${CODE_COVERAGE}" -lt 70 ]; then
    echo -e "${YELLOW}• Add more code examples to documentation (current: ${CODE_COVERAGE}%, target: 70%+)${NC}"
fi

if [ "${OVERALL_SCORE}" -ge 80 ]; then
    echo -e "${GREEN}✓ Documentation quality is good! Keep it up!${NC}"
fi

# 8. GENERATE REPORT FILE
echo ""
echo "Generating detailed report: ${OUTPUT_FILE}"

cat > "${OUTPUT_FILE}" <<EOF
# Documentation Quality Report

**Generated:** $(date '+%Y-%m-%d %H:%M:%S')
**Overall Score:** ${OVERALL_SCORE}/100
**Grade:** $(echo -e "${GRADE}" | sed 's/\x1b\[[0-9;]*m//g')

## Summary

This report provides a comprehensive assessment of the project's documentation quality across multiple dimensions.

## Metrics

### 1. Coverage Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total Documentation Files | ${TOTAL_MD_FILES} | - | ℹ️ |
| ADRs | ${ADR_COUNT} | ${MIN_ADR_COUNT}+ | $([ "${ADR_COUNT}" -ge "${MIN_ADR_COUNT}" ] && echo "✅" || echo "⚠️") |
| Patterns | ${PATTERN_COUNT} | ${MIN_PATTERN_COUNT}+ | $([ "${PATTERN_COUNT}" -ge "${MIN_PATTERN_COUNT}" ] && echo "✅" || echo "⚠️") |
| Runbooks | ${RUNBOOK_COUNT} | ${MIN_RUNBOOK_COUNT}+ | $([ "${RUNBOOK_COUNT}" -ge "${MIN_RUNBOOK_COUNT}" ] && echo "✅" || echo "⚠️") |
| Package Doc Coverage | ${PACKAGE_DOC_COVERAGE}% | ${MIN_PACKAGE_DOC_COVERAGE}%+ | $([ "${PACKAGE_DOC_COVERAGE}" -ge "${MIN_PACKAGE_DOC_COVERAGE}" ] && echo "✅" || echo "⚠️") |

### 2. Content Quality

| Metric | Value |
|--------|-------|
| Total Lines | ${TOTAL_LINES} |
| Average Document Length | ${AVG_DOC_LENGTH} lines |
| Code Blocks | ${CODE_BLOCK_COUNT} |
| Documents with Code Examples | ${DOCS_WITH_CODE}/${TOTAL_MD_FILES} (${CODE_COVERAGE}%) |

### 3. Link Integrity

| Metric | Value | Status |
|--------|-------|--------|
| Internal Links | ${INTERNAL_LINKS} | ℹ️ |
| Broken Links | ${BROKEN_LINKS} | $([ "${BROKEN_LINKS}" -eq 0 ] && echo "✅" || echo "⚠️") |
| Link Integrity Score | ${LINK_SCORE}% | $([ "${LINK_SCORE}" -ge "${MIN_BROKEN_LINK_SCORE}" ] && echo "✅" || echo "⚠️") |

### 4. Freshness

| Metric | Value | Status |
|--------|-------|--------|
| Fresh Documents | ${FRESH_DOCS}/${TOTAL_MD_FILES} | ℹ️ |
| Stale Documents (90+ days) | ${STALE_DOCS} | $([ "${STALE_DOCS}" -eq 0 ] && echo "✅" || echo "⚠️") |
| Freshness Score | ${FRESHNESS_SCORE}% | $([ "${FRESHNESS_SCORE}" -ge "${MIN_FRESHNESS_SCORE}" ] && echo "✅" || echo "⚠️") |

## Component Scores

| Component | Score | Weight |
|-----------|-------|--------|
| Coverage | ${COVERAGE_SCORE}/100 | 30% |
| Quality | ${QUALITY_SCORE}/100 | 20% |
| Integrity | ${INTEGRITY_SCORE}/100 | 25% |
| Freshness | ${FRESHNESS_FINAL}/100 | 25% |

## Recommendations

EOF

if [ "${ADR_COUNT}" -lt "${MIN_ADR_COUNT}" ]; then
    echo "- 📝 Add more Architecture Decision Records (current: ${ADR_COUNT}, target: ${MIN_ADR_COUNT}+)" >> "${OUTPUT_FILE}"
fi

if [ "${PATTERN_COUNT}" -lt "${MIN_PATTERN_COUNT}" ]; then
    echo "- 📝 Document more code patterns (current: ${PATTERN_COUNT}, target: ${MIN_PATTERN_COUNT}+)" >> "${OUTPUT_FILE}"
fi

if [ "${RUNBOOK_COUNT}" -lt "${MIN_RUNBOOK_COUNT}" ]; then
    echo "- 📝 Add operational runbooks (current: ${RUNBOOK_COUNT}, target: ${MIN_RUNBOOK_COUNT}+)" >> "${OUTPUT_FILE}"
fi

if [ "${PACKAGE_DOC_COVERAGE}" -lt "${MIN_PACKAGE_DOC_COVERAGE}" ]; then
    echo "- 📦 Improve package documentation coverage (current: ${PACKAGE_DOC_COVERAGE}%, target: ${MIN_PACKAGE_DOC_COVERAGE}%+)" >> "${OUTPUT_FILE}"
fi

if [ "${BROKEN_LINKS}" -gt 0 ]; then
    echo "- 🔗 Fix ${BROKEN_LINKS} broken internal links" >> "${OUTPUT_FILE}"
fi

if [ "${STALE_DOCS}" -gt 5 ]; then
    echo "- 🔄 Review and update ${STALE_DOCS} stale documents" >> "${OUTPUT_FILE}"
fi

if [ "${CODE_COVERAGE}" -lt 70 ]; then
    echo "- 💻 Add more code examples to documentation (current: ${CODE_COVERAGE}%, target: 70%+)" >> "${OUTPUT_FILE}"
fi

if [ "${OVERALL_SCORE}" -ge 80 ]; then
    echo "- ✅ Documentation quality is good! Keep it up!" >> "${OUTPUT_FILE}"
fi

cat >> "${OUTPUT_FILE}" <<EOF

## How to Improve

### Quick Wins

1. **Fix Broken Links**: Run \`make docs-verify\` to identify and fix broken links
2. **Add Code Examples**: Include practical code snippets in documentation
3. **Create Missing doc.go Files**: Document all packages in \`internal/\`

### Long-term Improvements

1. **Regular Reviews**: Schedule quarterly documentation reviews
2. **Automated Checks**: Add documentation quality checks to CI/CD
3. **User Feedback**: Collect feedback from documentation users
4. **Keep It Fresh**: Update documentation with every code change

## Trends

Run this assessment regularly to track documentation quality over time:

\`\`\`bash
./scripts/assess-docs-quality.sh
\`\`\`

Consider tracking these metrics in your project dashboard or CI/CD system.
EOF

echo -e "${GREEN}✓ Report generated successfully${NC}"
echo ""
echo "==================================="
echo "Assessment Complete"
echo "==================================="
