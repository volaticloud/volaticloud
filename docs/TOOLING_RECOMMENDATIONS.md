# Professional Documentation Tooling Recommendations

**Date:** 2025-11-27
**Purpose:** Replace custom scripts with industry-standard, battle-tested tools

## Current State vs. Recommended Approach

### ❌ Current Issues

1. **Custom GraphQL docs generator** - 400+ lines of bash with jq parsing
2. **Custom quality assessment** - 450+ lines of bash metrics
3. **Manual maintenance** - Scripts break when requirements change
4. **No ecosystem support** - Can't leverage community plugins/themes
5. **Reinventing the wheel** - Duplicating work that mature tools already solve

### ✅ Recommended Professional Stack

## 1. GraphQL API Documentation

### **SpectaQL** (Industry Standard)

**Repository:** https://github.com/anvilco/spectaql
**Stars:** 1.1k+ | **Maintained:** Active (2025)
**License:** MIT

**What it does:**
- Auto-generates beautiful static documentation from GraphQL schema
- Supports introspection query (live endpoint) or SDL file
- Customizable themes and styling
- Built-in search functionality
- Mobile-responsive design
- Support for examples and descriptions

**Installation:**

```bash
npm install -g spectaql
```

**Usage:**

```yaml
# spectaql-config.yml
introspection:
  url: http://localhost:8080/query
  headers:
    Authorization: "Bearer ${TOKEN}"

servers:
  - url: http://localhost:8080/query
    description: Local Development
  - url: https://api.volaticloud.com/query
    description: Production

info:
  title: VolatiCloud API
  description: Complete GraphQL API documentation for VolatiCloud trading platform
  version: 1.0.0

theme:
  colors:
    primary: '#2196F3'
```

**Generate docs:**

```bash
spectaql spectaql-config.yml -t docs/api/graphql
```

**Benefits over custom script:**
- ✅ 2 lines vs 400 lines of custom code
- ✅ Professional, searchable UI
- ✅ Maintained by community (Anvil Co)
- ✅ Handles complex schemas automatically
- ✅ Mobile-responsive
- ✅ Customizable themes
- ✅ Built-in examples support

**Alternative:** **GraphQL Voyager** for interactive schema visualization

---

## 2. Markdown Quality & Linting

### **markdownlint** (Industry Standard)

**Repository:** https://github.com/DavidAnson/markdownlint
**Stars:** 5k+ | **Maintained:** Very Active
**License:** MIT

**What it does:**
- Enforces consistent Markdown style
- 50+ built-in rules (MD001-MD053)
- Fixes common formatting issues automatically
- CI/CD integration
- VSCode extension available

**Installation:**

```bash
npm install -g markdownlint-cli2
```

**Configuration (.markdownlint.json):**

```json
{
  "default": true,
  "MD013": {
    "line_length": 120,
    "code_blocks": false,
    "tables": false
  },
  "MD033": {
    "allowed_elements": ["details", "summary", "kbd"]
  },
  "MD041": false
}
```

**Usage:**

```bash
# Lint all markdown files
markdownlint-cli2 "**/*.md"

# Auto-fix issues
markdownlint-cli2 --fix "**/*.md"

# CI/CD integration
markdownlint-cli2 --config .markdownlint.json "docs/**/*.md"
```

**Benefits:**
- ✅ Industry-standard linter
- ✅ Auto-fix capability
- ✅ VSCode integration
- ✅ CI/CD ready
- ✅ Consistent formatting across team

---

### **markdown-link-check** (Link Integrity)

**Repository:** https://github.com/tcort/markdown-link-check
**Stars:** 800+ | **Maintained:** Active
**License:** ISC

**What it does:**
- Validates all links in markdown files
- Checks internal and external links
- Configurable timeout and retry logic
- CI/CD integration

**Installation:**

```bash
npm install -g markdown-link-check
```

**Usage:**

```bash
# Check all markdown files
find docs -name "*.md" -exec markdown-link-check {} \;

# CI/CD integration
markdown-link-check --config .markdown-link-check.json docs/**/*.md
```

**Configuration (.markdown-link-check.json):**

```json
{
  "ignorePatterns": [
    {
      "pattern": "^http://localhost"
    }
  ],
  "timeout": "5s",
  "retryOn429": true,
  "retryCount": 3,
  "aliveStatusCodes": [200, 206]
}
```

---

## 3. Documentation Site Generator

### **MkDocs with Material Theme** (Recommended for Go Projects)

**Repository:** https://github.com/squidfunk/mkdocs-material
**Stars:** 20k+ | **Maintained:** Very Active
**License:** MIT

**Why MkDocs for this project:**
- ✅ Python-based (matches Go ecosystem tools like Sphinx)
- ✅ Material theme is stunning and professional
- ✅ Built-in search
- ✅ Versioning support
- ✅ API documentation integration
- ✅ Fast builds
- ✅ Markdown-native
- ✅ GitHub Pages / Netlify / Vercel deployment

**Installation:**

```bash
pip install mkdocs-material
```

**Configuration (mkdocs.yml):**

```yaml
site_name: VolatiCloud Documentation
site_url: https://docs.volaticloud.com
site_description: Complete documentation for VolatiCloud trading platform

theme:
  name: material
  features:
    - navigation.tabs
    - navigation.sections
    - navigation.expand
    - search.suggest
    - search.highlight
    - content.code.copy
  palette:
    # Light mode
    - scheme: default
      primary: blue
      accent: indigo
      toggle:
        icon: material/brightness-7
        name: Switch to dark mode
    # Dark mode
    - scheme: slate
      primary: blue
      accent: indigo
      toggle:
        icon: material/brightness-4
        name: Switch to light mode

nav:
  - Home: index.md
  - Getting Started:
      - Quick Start: getting-started/quickstart.md
      - Installation: getting-started/installation.md
  - Architecture:
      - Overview: architecture/overview.md
      - ADRs: adr/README.md
  - Guides:
      - Patterns: patterns/README.md
      - Runbooks: runbooks/README.md
  - API Reference:
      - GraphQL: api/graphql/README.md
      - REST: api/rest/README.md

plugins:
  - search
  - tags
  - git-revision-date-localized

markdown_extensions:
  - pymdownx.highlight
  - pymdownx.superfences
  - pymdownx.tabbed
  - admonition
  - codehilite
  - toc:
      permalink: true
```

**Usage:**

```bash
# Local development
mkdocs serve

# Build static site
mkdocs build

# Deploy to GitHub Pages
mkdocs gh-deploy
```

**Benefits:**
- ✅ Professional, modern UI
- ✅ Built-in search
- ✅ Mobile-responsive
- ✅ Dark mode support
- ✅ Versioning built-in
- ✅ Fast builds
- ✅ Easy deployment
- ✅ Huge ecosystem of plugins

---

## 4. Documentation Testing & Quality

### **Vale** (Prose Linter)

**Repository:** https://github.com/errata-ai/vale
**Stars:** 4k+ | **Maintained:** Very Active
**License:** MIT

**What it does:**
- Grammar and style checking for technical docs
- Customizable style guides (Google, Microsoft, RedHat, etc.)
- CI/CD integration
- Supports Markdown, AsciiDoc, reStructuredText, HTML

**Installation:**

```bash
brew install vale  # macOS
# or
go install github.com/errata-ai/vale/v2/cmd/vale@latest
```

**Configuration (.vale.ini):**

```ini
StylesPath = .vale/styles
MinAlertLevel = suggestion

[*.md]
BasedOnStyles = Vale, Google
Vale.Terms = YES
```

**Usage:**

```bash
# Check all documentation
vale docs/

# CI/CD integration
vale --output=JSON docs/ > vale-results.json
```

**Benefits:**
- ✅ Catches grammar/style issues
- ✅ Enforces consistent terminology
- ✅ Multiple style guides available
- ✅ CI/CD ready

---

## Recommended Implementation Plan

### Phase 1: Replace GraphQL Docs Generator (1 hour)

**Actions:**
1. Install SpectaQL: `npm install -g spectaql`
2. Create `spectaql-config.yml`
3. Update Makefile:
   ```makefile
   docs-graphql:
       spectaql spectaql-config.yml -t docs/api/graphql
   ```
4. Delete `scripts/generate-graphql-docs.sh` (400 lines → 1 line)

**Effort:** Low | **Impact:** High

---

### Phase 2: Add Markdown Linting (2 hours)

**Actions:**
1. Install markdownlint-cli2
2. Create `.markdownlint.json` config
3. Install markdown-link-check
4. Update CI/CD workflow:
   ```yaml
   - name: Lint Markdown
     run: markdownlint-cli2 "docs/**/*.md"

   - name: Check Links
     run: markdown-link-check docs/**/*.md
   ```
5. Add VSCode settings for team:
   ```json
   {
     "markdownlint.config": ".markdownlint.json",
     "editor.formatOnSave": true
   }
   ```

**Effort:** Low | **Impact:** High

---

### Phase 3: Set Up MkDocs Site (4 hours)

**Actions:**
1. Install `mkdocs-material`
2. Create `mkdocs.yml` configuration
3. Reorganize docs/ structure for MkDocs
4. Build and test locally: `mkdocs serve`
5. Deploy to GitHub Pages or Vercel
6. Update README with docs site URL

**Effort:** Medium | **Impact:** Very High

---

### Phase 4: Add Vale for Prose Quality (2 hours)

**Actions:**
1. Install Vale
2. Download Google or Microsoft style guide
3. Create `.vale.ini`
4. Add to CI/CD
5. Train team on Vale warnings

**Effort:** Low | **Impact:** Medium

---

## Migration from Custom Scripts

### What to Keep
- ✅ Package doc.go coverage script (Go-specific, no standard tool)
- ✅ ENT/GraphQL diagram generators (project-specific)
- ✅ Custom verification logic for ADRs/patterns structure

### What to Replace

| Custom Script | Replace With | Lines Saved |
|---------------|--------------|-------------|
| `generate-graphql-docs.sh` | SpectaQL | 400 lines |
| Manual link checking | markdown-link-check | ~100 lines |
| Custom quality metrics | markdownlint + Vale | ~450 lines |
| Manual styling checks | markdownlint auto-fix | N/A |

**Total reduction:** ~950 lines of bash → ~20 lines of config

---

## Cost-Benefit Analysis

### Costs
- **Time:** ~9 hours initial setup
- **Learning:** Team needs to learn new tools (minimal - all well-documented)
- **Maintenance:** Tool updates via npm/pip (much easier than bash scripts)

### Benefits
- **Maintenance:** 95% reduction in custom code maintenance
- **Quality:** Professional, battle-tested tools
- **Team Velocity:** Faster onboarding (standard tools)
- **Community:** Access to plugins, themes, updates
- **CI/CD:** Better integration with GitHub Actions
- **Consistency:** Industry-standard formatting and style
- **Searchability:** Built-in search in MkDocs
- **Mobile:** Responsive documentation site
- **Versioning:** Built-in version management

**ROI:** Pays back in ~2 weeks through reduced maintenance

---

## Recommended Next Steps

1. **Immediate (Today):**
   - Install SpectaQL and replace GraphQL docs generation
   - Install markdownlint-cli2 and add to CI

2. **This Week:**
   - Set up MkDocs with Material theme
   - Deploy docs site to GitHub Pages

3. **This Month:**
   - Add Vale for prose quality
   - Train team on new tools
   - Document tooling in runbooks

4. **Ongoing:**
   - Monitor tool updates
   - Add new plugins as needed
   - Iterate on configuration

---

## Tool Comparison Table

| Feature | Custom Scripts | Industry Tools |
|---------|---------------|----------------|
| Maintenance | High (you maintain) | Low (community) |
| Features | Limited | Rich ecosystem |
| UI/UX | Basic | Professional |
| Testing | Manual | Built-in |
| CI/CD | Custom integration | Native support |
| Team Adoption | Learning curve | Standard knowledge |
| Mobile Support | None | Yes |
| Search | None | Built-in |
| Versioning | Manual | Automatic |
| Cost | Time investment | Free (OSS) |

---

## Conclusion

**Recommendation:** Migrate to industry-standard tools over the next 2 weeks.

**Rationale:**
1. **Less maintenance** - Community maintains tools
2. **Better quality** - Battle-tested by thousands of projects
3. **Faster development** - Leverage existing features
4. **Team efficiency** - Standard tools everyone knows
5. **Professional output** - Modern, searchable documentation sites

The custom scripts were a good starting point, but now it's time to leverage professional tools that do this better, with less maintenance overhead.
