# 0021. Landing Page Architecture

Date: 2026-01-30

## Status

Accepted

## Context and Problem Statement

VolatiCloud needs a public-facing marketing landing page to communicate the product value proposition, feature set, and pricing. The dashboard application is a protected SPA behind authentication (Keycloak), making it unsuitable for public marketing content, SEO, and social sharing.

We need to decide how to build and deploy this landing page alongside the existing dashboard and backend infrastructure.

## Decision Drivers

- **SEO**: The landing page must be fully crawlable by search engines with proper meta tags, Open Graph, and Twitter Cards
- **Independent deploys**: Marketing content changes should not require redeploying the dashboard or backend
- **Performance**: Static content should load as fast as possible with minimal JavaScript
- **Infrastructure consistency**: Reuse existing Kubernetes deployment patterns and CI/CD workflows
- **Development velocity**: Use familiar tools and patterns from the dashboard codebase

## Considered Options

### Option 1: Separate React App (Chosen)

A standalone React 19 + TypeScript + Tailwind CSS v4 application in `landing/`, deployed independently.

**Pros:**

- Full independence from dashboard release cycle
- Familiar tech stack for the team (same as dashboard minus GraphQL/auth)
- Can reuse CI/CD patterns (reusable `_ci-node.yml` workflow)
- CSS-only visual components — no external image dependencies
- Vite for fast builds

**Cons:**

- Separate deployment infrastructure (Kubernetes, Caddy)
- Cannot share UI components with dashboard (different Tailwind versions possible)

### Option 2: Static Site Generator (Hugo, Astro)

Use a dedicated SSG for optimal static performance.

**Pros:**

- Better static performance (zero or minimal JS)
- Built-in SEO tooling

**Cons:**

- New technology stack to learn and maintain
- Cannot leverage existing React/TypeScript expertise
- Different CI/CD pipeline needed

### Option 3: Dashboard Routes

Add public routes within the existing dashboard SPA.

**Pros:**

- Shared component library
- Single deployment

**Cons:**

- Dashboard bundle size increases for all users
- SEO limitations with client-side rendering
- Couples marketing deploys to dashboard releases
- Auth middleware complexity for public vs. protected routes

## Decision

**Option 1: Separate React App.**

The landing page is a standalone application in `landing/` with its own build pipeline, Dockerfile, and Kubernetes deployment. It shares the reusable `_ci-node.yml` CI workflow with the dashboard but is otherwise fully independent.

## Architecture

```
landing/
├── src/
│   ├── components/
│   │   ├── layout/          # Navbar, Footer
│   │   ├── sections/        # Page sections (Hero, Features, Pricing, etc.)
│   │   └── ui/              # Reusable presentational components
│   ├── data/content.ts      # Centralized content data
│   ├── config.ts            # Runtime configuration (VITE_CONSOLE_URL)
│   └── pages/HomePage.tsx   # Page composition
├── Dockerfile               # Multi-stage: Node 22 build → Caddy static serve
├── Caddyfile                # Static file server with security headers & CSP
└── vite.config.ts           # Vite + React + Tailwind CSS v4
```

### Deployment

- **Container**: Multi-stage Docker build (Node 22 → Caddy alpine)
- **Kubernetes**: Nixys Universal Chart with HPA, PDB, pod anti-affinity
- **Security**: Read-only root filesystem, no privilege escalation, CSP headers
- **Domain**: `volaticloud.com` (separate from `console.volaticloud.com`)

### CI/CD

Reuses `.github/workflows/_ci-node.yml` with landing-specific parameters:

- Node 22
- `working-directory: landing`
- ESLint, TypeScript check, Vitest tests with coverage, production build

## Consequences

### Positive

- Marketing content ships independently of the dashboard
- Full SEO support with server-rendered HTML, meta tags, Open Graph
- Fast page loads — static assets served by Caddy with caching headers
- Security hardened with CSP, X-Frame-Options, read-only filesystem

### Negative

- Additional Kubernetes deployment to maintain
- UI components cannot be shared directly with dashboard
- Separate Tailwind configuration

### Neutral

- Console URL configured via `VITE_CONSOLE_URL` environment variable (defaults to production)
- Tests colocated with components following dashboard convention
