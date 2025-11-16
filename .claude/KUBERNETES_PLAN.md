# VolatiCloud Kubernetes Deployment Plan

**Target Platform**: Vultr Kubernetes Engine (VKE)
**Container Registry**: GitHub Container Registry (ghcr.io)
**Deployment Model**: GitOps (Git as Single Source of Truth)
**Deployment Tool**: Helm + GitHub Actions
**Auth Provider**: Keycloak (via OLM operator)
**Created**: 2025-11-13
**Status**: Planning

---

## Executive Summary

This plan outlines the complete implementation of **GitOps-based Kubernetes deployment** for VolatiCloud, where:
- **Git is the single source of truth** - All infrastructure and application configuration lives in git
- **Deployments are automatic** - Every commit triggers appropriate deployment workflows
- **Everything is reproducible** - Complete cluster state can be recreated from git repository
- **No manual kubectl commands** - All operations go through GitHub Actions
- **Full audit trail** - Git history provides complete deployment audit log

### Key Features
- OLM (Operator Lifecycle Manager) installation via automated scripts
- Keycloak operator deployment for authentication
- Smart GitHub Actions workflows with path-based triggers
- Full authentication integration (Dashboard + GraphQL API)
- Zero-downtime deployments with automatic rollback

---

## GitOps Principles

### Core Tenets

1. **Declarative Configuration**
   - All Kubernetes resources defined as YAML manifests in git
   - Helm charts with values files for environment-specific configs
   - No imperative kubectl commands in production

2. **Git as Source of Truth**
   - Current cluster state = Latest commit on main branch
   - Rollback = Git revert + automatic redeployment
   - Feature branches for testing changes before production

3. **Automated Synchronization**
   - GitHub Actions watch for file changes
   - Smart path-based triggers deploy only what changed
   - Automatic validation before applying changes

4. **Continuous Reconciliation**
   - Workflows verify deployed state matches git
   - Drift detection and automatic correction
   - Health checks after every deployment

### Benefits

✅ **Reproducibility** - Destroy and recreate cluster from git anytime
✅ **Auditability** - Every change tracked with commit history
✅ **Collaboration** - Pull requests for infrastructure changes
✅ **Rollback** - Instant rollback via git revert
✅ **Disaster Recovery** - Git repository is the backup
✅ **Security** - No cluster credentials on developer machines

---

## Repository Structure (Git Layout)

```
volaticloud/
├── .github/
│   └── workflows/
│       ├── docker-build.yml           # Build & push containers on code changes
│       ├── deploy-infrastructure.yml  # Deploy OLM, cert-manager, ingress
│       ├── deploy-keycloak.yml       # Deploy Keycloak operator & instance
│       ├── deploy-app.yml            # Deploy VolatiCloud application
│       ├── validate-manifests.yml    # Lint & validate on PR
│       └── bootstrap.yml             # One-time cluster bootstrap
│
├── deployments/
│   ├── infrastructure/               # Base cluster infrastructure
│   │   ├── olm/
│   │   │   ├── install.sh           # OLM installation script
│   │   │   ├── values.yaml          # OLM configuration
│   │   │   └── README.md
│   │   ├── cert-manager/            # TLS certificate management
│   │   │   ├── cert-manager.yaml    # cert-manager installation
│   │   │   └── cluster-issuer.yaml  # Let's Encrypt issuer
│   │   └── ingress-nginx/           # Ingress controller
│   │       └── values.yaml
│   │
│   ├── keycloak/                     # Authentication infrastructure
│   │   ├── namespace.yaml
│   │   ├── operator-subscription.yaml
│   │   ├── postgres-secret.yaml     # (template, actual secret from env)
│   │   ├── keycloak-instance.yaml
│   │   ├── keycloak-realm.yaml
│   │   ├── keycloak-client.yaml
│   │   └── README.md
│   │
│   ├── helm/                         # Application Helm charts
│   │   └── volaticloud/
│   │       ├── Chart.yaml
│   │       ├── values.yaml          # Default values
│   │       ├── values-dev.yaml
│   │       ├── values-staging.yaml
│   │       ├── values-prod.yaml
│   │       └── templates/
│   │           ├── deployment.yaml
│   │           ├── service.yaml
│   │           ├── configmap.yaml
│   │           ├── secret.yaml
│   │           ├── ingress.yaml
│   │           └── ...
│   │
│   ├── bootstrap.sh                  # Complete cluster bootstrap script
│   ├── README.md                     # Deployment documentation
│   └── TROUBLESHOOTING.md
│
├── scripts/
│   ├── validate-manifests.sh         # Validation script for CI
│   └── smoke-test.sh                 # Post-deployment smoke tests
│
├── Dockerfile                        # Application container
├── .dockerignore
├── docker-compose.yml                # Local development
└── ...
```

### Version Control Strategy

**Branches**:
- `main` → Production deployments (auto-deploy with approval)
- `develop` → Development environment (auto-deploy)
- `feature/*` → Feature branches (manual deploy for testing)

**Tags**:
- `v1.0.0` → Application releases
- `infra-v1.0.0` → Infrastructure releases

**Commits**:
- Conventional commits for automatic changelog
- Signed commits for security audit

---

## Bootstrap Procedure (From Zero to Running)

This procedure shows how to deploy **everything** from scratch using only the git repository.

### Prerequisites

1. **VKE Cluster** - Created via Vultr dashboard or API
2. **GitHub Secrets** - Configure once:
   ```
   VKE_KUBECONFIG          - Base64-encoded kubeconfig
   GHCR_TOKEN              - GitHub token for image pulls
   DB_PASSWORD             - PostgreSQL password for Keycloak
   ADMIN_EMAIL             - Admin user email
   ```

### Step 1: Bootstrap Infrastructure (One-Time)

**Trigger**: Manual workflow dispatch
**File**: `.github/workflows/bootstrap.yml`

```bash
# Manually trigger bootstrap workflow
gh workflow run bootstrap.yml
```

**What it does**:
1. Install OLM on cluster
2. Install cert-manager for TLS
3. Install ingress-nginx controller
4. Create namespaces
5. Configure DNS (update values with actual domain)

### Step 2: Deploy Keycloak (Automatic on Commit)

**Trigger**: Commit to `deployments/keycloak/**`

```bash
# Commit Keycloak configuration
git add deployments/keycloak/
git commit -m "feat(keycloak): configure realm and client"
git push origin main

# GitHub Actions automatically:
# 1. Validates manifests
# 2. Applies operator subscription
# 3. Waits for operator ready
# 4. Creates Keycloak instance
# 5. Configures realm
# 6. Creates OIDC client
# 7. Runs health checks
```

### Step 3: Deploy Application (Automatic on Commit)

**Trigger**: Commit to Go code or Helm chart

```bash
# Make application changes
git add internal/ cmd/ deployments/helm/
git commit -m "feat: add bot management feature"
git push origin main

# GitHub Actions automatically:
# 1. Runs tests
# 2. Builds Docker image
# 3. Pushes to ghcr.io
# 4. Updates Helm chart
# 5. Deploys to cluster
# 6. Waits for rollout
# 7. Runs smoke tests
```

### Step 4: Verify Deployment

**Automatic**: GitHub Actions output
**Manual verification**:
```bash
# Check workflow status
gh run list --workflow=deploy-app.yml

# View logs
gh run view --log
```

### Complete Bootstrap Script

**File**: `deployments/bootstrap.sh`

```bash
#!/bin/bash
# Complete cluster bootstrap from git repository
# Usage: ./deployments/bootstrap.sh <environment>

set -euo pipefail

ENVIRONMENT=${1:-dev}

echo "🚀 Bootstrapping VolatiCloud on VKE (Environment: $ENVIRONMENT)"

# This script is for local testing only
# In production, use GitHub Actions workflows

echo "✅ Use GitHub Actions for automated deployments"
echo "   Trigger: gh workflow run bootstrap.yml"
```

---

## Architecture Overview (GitOps Flow)

```
                    ┌─────────────────────────────────┐
                    │   Developer / Operations Team   │
                    │  git commit → git push          │
                    └────────────┬────────────────────┘
                                 │
                                 ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃              GitHub Repository (Source of Truth)          ┃
┃  ┌────────────┐  ┌────────────┐  ┌──────────────────┐   ┃
┃  │ Code       │  │ Frontend   │  │ Infrastructure   │   ┃
┃  │ internal/  │  │ dashboard/ │  │ deployments/     │   ┃
┃  │ cmd/       │  │            │  │ ├── helm/        │   ┃
┃  │ Dockerfile │  │            │  │ ├── keycloak/    │   ┃
┃  │            │  │            │  │ └── infra/       │   ┃
┃  └────────────┘  └────────────┘  └──────────────────┘   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                          │
                          ▼
         ┌────────────────────────────────────┐
         │   Smart Path-Based Triggers        │
         ├────────────────────────────────────┤
         │ internal/** → Build & Deploy App   │
         │ helm/**     → Deploy Helm Charts   │
         │ keycloak/** → Deploy Keycloak      │
         │ infra/**    → Deploy Infrastructure│
         └────────────┬───────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              GitHub Actions (Automation Layer)               │
│                                                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐    │
│  │ docker-      │ │ deploy-      │ │ deploy-          │    │
│  │ build.yml    │ │ app.yml      │ │ keycloak.yml     │    │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────────┘    │
│         │                │                 │                 │
│         ▼                ▼                 ▼                 │
│   Build Image      Deploy Helm      Apply Manifests         │
│   Push to ghcr.io  Wait & Test      Wait & Verify           │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               Vultr Kubernetes Engine (VKE)                  │
│                    (Desired State)                           │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Infrastructure Layer (deployments/infrastructure/) │     │
│  │  ├─► OLM (Operator Lifecycle Manager)             │     │
│  │  ├─► cert-manager (TLS automation)                │     │
│  │  └─► ingress-nginx (Traffic routing)              │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Auth Layer (deployments/keycloak/)                 │     │
│  │  ├─► Keycloak Operator (via OLM)                   │     │
│  │  ├─► Keycloak Instance (2 replicas)                │     │
│  │  └─► PostgreSQL (for Keycloak)                     │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Application Layer (deployments/helm/volaticloud/)     │     │
│  │  ├─► VolatiCloud Backend (Go GraphQL API)             │     │
│  │  ├─► Service (ClusterIP)                           │     │
│  │  ├─► Ingress (HTTPS with Let's Encrypt)            │     │
│  │  ├─► ConfigMap (app configuration)                 │     │
│  │  ├─► Secret (credentials)                          │     │
│  │  └─► Optional: PostgreSQL + etcd StatefulSets      │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Runtime Layer (dynamic)                             │     │
│  │  └─► Freqtrade Bot Pods (created by VolatiCloud)      │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │  Health Checks  │
                 │  Smoke Tests    │
                 │  Notifications  │
                 └─────────────────┘
```

### Key GitOps Characteristics

1. **Single Workflow per Component**
   - Infrastructure changes → `deploy-infrastructure.yml`
   - Keycloak changes → `deploy-keycloak.yml`
   - App changes → `docker-build.yml` + `deploy-app.yml`

2. **Automatic Trigger Detection**
   ```yaml
   on:
     push:
       paths:
         - 'deployments/keycloak/**'  # Only deploy when Keycloak config changes
   ```

3. **Idempotent Operations**
   - Can rerun workflows safely
   - `kubectl apply` vs `kubectl create`
   - Helm `upgrade --install`

4. **Rollback via Git**
   ```bash
   git revert HEAD          # Revert last commit
   git push origin main     # Triggers automatic rollback deployment
   ```

---

## Smart Deployment Triggers (Path-Based Automation)

### Trigger Matrix

This table shows which workflows run based on file changes:

| Files Changed | Workflow(s) Triggered | Actions Taken |
|--------------|----------------------|---------------|
| `internal/**`, `cmd/**`, `*.go` | `docker-build.yml` → `deploy-app.yml` | 1. Run tests<br>2. Build container<br>3. Push to ghcr.io<br>4. Deploy to cluster |
| `dashboard/**`, `*.tsx`, `*.ts` | `frontend-ci.yml` | 1. Lint & type check<br>2. Build static assets<br>3. Update container (future) |
| `deployments/helm/volaticloud/**` | `deploy-app.yml` | 1. Helm lint<br>2. Upgrade release<br>3. Wait for rollout |
| `deployments/keycloak/**` | `deploy-keycloak.yml` | 1. Validate manifests<br>2. Apply changes<br>3. Wait for ready |
| `deployments/infrastructure/**` | `deploy-infrastructure.yml` | 1. Apply infrastructure<br>2. Verify health |
| `Dockerfile`, `.dockerignore` | `docker-build.yml` → `deploy-app.yml` | 1. Rebuild image<br>2. Redeploy app |
| `.github/workflows/**` | No auto-deploy | Requires manual trigger for safety |

### Conditional Execution Logic

**Example: `deploy-app.yml`**

```yaml
name: Deploy Application

on:
  push:
    branches: [main]
    paths:
      - 'internal/**'
      - 'cmd/**'
      - 'go.mod'
      - 'go.sum'
      - 'Dockerfile'
      - 'deployments/helm/volaticloud/**'

jobs:
  # Job 1: Determine what changed
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      code-changed: ${{ steps.filter.outputs.code }}
      helm-changed: ${{ steps.filter.outputs.helm }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v2
        id: filter
        with:
          filters: |
            code:
              - 'internal/**'
              - 'cmd/**'
              - '*.go'
              - 'Dockerfile'
            helm:
              - 'deployments/helm/volaticloud/**'

  # Job 2: Build container (only if code changed)
  build:
    needs: detect-changes
    if: needs.detect-changes.outputs.code-changed == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Build and push Docker image
        # ... build steps

  # Job 3: Deploy (runs if code OR helm changed)
  deploy:
    needs: [detect-changes, build]
    if: always() && !failure() && !cancelled()
    runs-on: ubuntu-latest
    steps:
      - name: Deploy Helm chart
        # ... deploy steps
```

### Benefits of Smart Triggers

1. **Efficiency**
   - Only build containers when code changes
   - Only deploy when necessary
   - Parallel workflow execution

2. **Safety**
   - Validate before deploy
   - Prevent accidental deployments
   - Manual approval for critical paths

3. **Visibility**
   - GitHub Actions UI shows what changed
   - Deployment logs tied to commits
   - Easy to trace issues

4. **Cost Optimization**
   - Fewer unnecessary builds
   - Reduced compute time
   - Lower GitHub Actions minutes usage

---

## Phase 1: Containerization (Foundation)

### Objectives
- Create production-ready Docker image for VolatiCloud
- Set up automated container builds
- Publish to GitHub Container Registry

### Deliverables

#### 1.1 Dockerfile (`/Dockerfile`)
```dockerfile
# Multi-stage build
FROM golang:1.24-alpine AS builder
# Build stage

FROM alpine:latest
# Runtime stage with minimal dependencies
```

**Requirements**:
- Multi-stage build (minimize image size)
- Alpine Linux base (security + size)
- Health check endpoint
- Non-root user
- Proper signal handling

#### 1.2 .dockerignore (`/.dockerignore`)
Exclude development files, tests, documentation

#### 1.3 Makefile Updates
```makefile
docker-build:
	docker build -t volaticloud:latest .

docker-push:
	docker push ghcr.io/diazoxide/volaticloud:latest
```

#### 1.4 GitHub Action: `.github/workflows/docker-build.yml`

**Triggers**:
- Push to `main` branch
- Changes to: `internal/**`, `cmd/**`, `go.mod`, `go.sum`, `Dockerfile`
- Manual trigger (workflow_dispatch)

**Jobs**:
1. Run tests (reuse backend-ci.yml)
2. Build multi-arch image (amd64, arm64)
3. Tag with git SHA + semantic version
4. Push to ghcr.io/diazoxide/volaticloud
5. Create GitHub release on tag push

**Outputs**:
- Image: `ghcr.io/diazoxide/volaticloud:latest`
- Image: `ghcr.io/diazoxide/volaticloud:v1.0.0`
- Image: `ghcr.io/diazoxide/volaticloud:sha-abc123`

---

## Phase 2: Helm Chart Foundation

### Objectives
- Create reusable Helm chart for VolatiCloud
- Support multiple environments (dev/staging/prod)
- Configure VKE-specific optimizations

### Directory Structure
```
deployments/helm/volaticloud/
├── Chart.yaml
├── values.yaml                 # Default values (VKE-optimized)
├── values-dev.yaml             # Development overrides
├── values-prod.yaml            # Production overrides
├── charts/                     # Dependency charts (if using local deps)
├── templates/
│   ├── _helpers.tpl            # Template helpers
│   ├── deployment.yaml         # Main application deployment
│   ├── service.yaml            # Service for GraphQL API
│   ├── configmap.yaml          # Application configuration
│   ├── secret.yaml             # Sensitive credentials
│   ├── ingress.yaml            # External access configuration
│   ├── serviceaccount.yaml     # RBAC service account
│   ├── hpa.yaml                # Horizontal Pod Autoscaler (optional)
│   └── NOTES.txt               # Post-install instructions
└── README.md
```

### Key Configuration (`values.yaml`)

```yaml
replicaCount: 2

image:
  repository: ghcr.io/diazoxide/volaticloud
  pullPolicy: IfNotPresent
  tag: ""  # Defaults to Chart.appVersion

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

# Database configuration
database:
  type: sqlite  # or postgres
  postgres:
    host: ""
    port: 5432
    database: volaticloud
    # Credentials from secret

# etcd configuration (optional for distributed setups)
etcd:
  enabled: false
  endpoints: []

# Keycloak integration
keycloak:
  enabled: true
  url: ""  # Keycloak server URL
  realm: volaticloud
  clientId: volaticloud-dashboard

# Ingress configuration
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: volaticloud.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: volaticloud-tls
      hosts:
        - volaticloud.example.com
```

### Helm Dependencies

**Option A**: Include PostgreSQL/etcd as subchart dependencies
```yaml
# Chart.yaml
dependencies:
  - name: postgresql
    version: 12.x.x
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
```

**Option B**: Reference external services (recommended for production)
- Use managed PostgreSQL on Vultr
- Use managed etcd or Redis for coordination

---

## Phase 3: OLM Installation

### Objectives
- Install OLM on VKE cluster
- Prepare operator management infrastructure
- Document OLM lifecycle

### Deliverables

#### 3.1 OLM Installation Script (`deployments/olm/install.sh`)
```bash
#!/bin/bash
# Install OLM if not present
# Uses operator-sdk or official OLM releases
```

#### 3.2 OLM Configuration (`deployments/olm/values.yaml`)
```yaml
olm:
  version: v0.28.0  # Pin OLM version
  namespace: olm
  catalogSources:
    - operatorhubio  # Public operator catalog
```

#### 3.3 GitHub Action: `.github/workflows/olm-setup.yml`

**Trigger**: Manual (workflow_dispatch)

**Jobs**:
1. Check if OLM is installed (`kubectl get csv -n olm`)
2. Install OLM if missing
3. Verify OLM health
4. Install OperatorHub catalog source

**Use Case**: One-time setup or disaster recovery

#### 3.4 Documentation (`deployments/olm/README.md`)
- What is OLM and why we use it
- Installation instructions
- Troubleshooting common issues
- How to verify OLM is working

---

## Phase 4: Keycloak Operator Deployment

### Objectives
- Deploy Keycloak operator via OLM
- Create Keycloak instance with PostgreSQL backend
- Configure VolatiCloud realm with OIDC client

### Directory Structure
```
deployments/keycloak/
├── values.yaml                          # Configuration values
├── operator-subscription.yaml           # OLM subscription for Keycloak operator
├── keycloak-instance.yaml              # Keycloak CR (server instance)
├── keycloak-realm.yaml                 # Realm configuration
├── keycloak-client.yaml                # OIDC client for VolatiCloud
└── README.md
```

### Keycloak Operator Subscription (`operator-subscription.yaml`)
```yaml
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: keycloak-operator
  namespace: keycloak
spec:
  channel: stable
  name: keycloak-operator
  source: operatorhubio-catalog
  sourceNamespace: olm
```

### Keycloak Instance (`keycloak-instance.yaml`)
```yaml
apiVersion: k8s.keycloak.org/v2alpha1
kind: Keycloak
metadata:
  name: volaticloud-keycloak
  namespace: keycloak
spec:
  instances: 2  # High availability
  db:
    vendor: postgres
    host: postgres.keycloak.svc.cluster.local
    database: keycloak
    usernameSecret:
      name: keycloak-db-secret
      key: username
    passwordSecret:
      name: keycloak-db-secret
      key: password
  http:
    tlsSecret: keycloak-tls
  hostname:
    hostname: auth.volaticloud.example.com
  ingress:
    enabled: true
```

### Keycloak Realm Configuration (`keycloak-realm.yaml`)

**Realm**: `volaticloud`

**OIDC Client**:
- Client ID: `volaticloud-dashboard`
- Client Protocol: `openid-connect`
- Access Type: `public` (for React SPA)
- Valid Redirect URIs:
  - `https://volaticloud.example.com/*`
  - `http://localhost:5173/*` (development)
- Web Origins: `+` (allow same origin)

**Roles**:
- `admin` - Full access to all operations
- `trader` - Manage bots, view backtests
- `viewer` - Read-only access

**Default Users** (dev only):
- admin@volaticloud.com (admin role)
- trader@volaticloud.com (trader role)
- viewer@volaticloud.com (viewer role)

### GitHub Action: `.github/workflows/deploy-keycloak.yml`

**Triggers**:
- Changes to `deployments/keycloak/**`
- Manual trigger (workflow_dispatch)

**Jobs**:
1. Apply operator subscription
2. Wait for operator ready
3. Apply Keycloak instance CR
4. Wait for Keycloak ready
5. Apply realm configuration
6. Apply client configuration
7. Verify OIDC endpoints

---

## Phase 5: Authentication Integration

### Objectives
- Integrate Keycloak with Go backend (JWT validation)
- Integrate Keycloak with React frontend (OIDC login)
- Implement role-based access control (RBAC)

### Backend Integration (Go)

#### 5.1 Dependencies
```bash
go get github.com/coreos/go-oidc/v3/oidc
go get github.com/golang-jwt/jwt/v5
```

#### 5.2 JWT Middleware (`internal/auth/middleware.go`)
```go
package auth

import (
    "context"
    "net/http"
    "github.com/coreos/go-oidc/v3/oidc"
)

// Middleware validates JWT tokens from Keycloak
func JWTMiddleware(next http.Handler) http.Handler {
    // Token validation logic
}

// Context keys for user info
type contextKey string
const UserContextKey = contextKey("user")
```

#### 5.3 GraphQL Auth Directives (`internal/graph/schema.graphqls`)
```graphql
directive @auth(requires: Role = USER) on FIELD_DEFINITION

enum Role {
  ADMIN
  TRADER
  VIEWER
  USER
}

type Mutation {
  startBot(id: ID!): Bot! @auth(requires: ADMIN)
  stopBot(id: ID!): Bot! @auth(requires: ADMIN)
  createStrategy(input: CreateStrategyInput!): Strategy! @auth(requires: TRADER)
}
```

#### 5.4 Authorization Checks
- Extract user from context in resolvers
- Check roles before sensitive operations
- Return proper error codes (401/403)

### Frontend Integration (React)

#### 5.1 Dependencies
```bash
cd dashboard
npm install react-oidc-context oidc-client-ts
```

#### 5.2 Auth Provider (`dashboard/src/AuthProvider.tsx`)
```typescript
import { AuthProvider } from "react-oidc-context";

const oidcConfig = {
  authority: process.env.VITE_KEYCLOAK_URL,
  client_id: "volaticloud-dashboard",
  redirect_uri: window.location.origin,
  scope: "openid profile email",
};

export function AuthWrapper({ children }) {
  return (
    <AuthProvider {...oidcConfig}>
      {children}
    </AuthProvider>
  );
}
```

#### 5.3 Protected Routes
```typescript
function ProtectedRoute({ children, requiredRole }) {
  const auth = useAuth();

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (requiredRole && !hasRole(auth.user, requiredRole)) {
    return <Forbidden />;
  }

  return children;
}
```

#### 5.4 Apollo Client Integration
```typescript
// Add JWT token to GraphQL requests
const authLink = setContext((_, { headers }) => {
  const token = auth.user?.access_token;
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  };
});
```

#### 5.5 Login/Logout Flow
- Login button → `auth.signinRedirect()`
- Logout button → `auth.signoutRedirect()`
- Automatic token refresh
- Handle expired tokens gracefully

### Helm Chart Updates

Add Keycloak environment variables:
```yaml
# values.yaml
env:
  - name: KEYCLOAK_URL
    value: "https://auth.volaticloud.example.com"
  - name: KEYCLOAK_REALM
    value: "volaticloud"
  - name: KEYCLOAK_CLIENT_ID
    value: "volaticloud-dashboard"
```

---

## Phase 6: GitHub Actions Automation (GitOps Implementation)

### Objectives
- Implement complete GitOps workflows with smart triggers
- Automate entire deployment pipeline from commit to production
- Zero manual kubectl/helm commands required
- Full deployment visibility and audit trail

---

### Workflow 1: Bootstrap Infrastructure (`.github/workflows/bootstrap.yml`)

**Purpose**: One-time cluster setup - installs foundational infrastructure

**Trigger**: Manual only (workflow_dispatch)

**Complete Workflow**:

```yaml
name: Bootstrap Infrastructure

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options: [dev, staging, prod]

jobs:
  bootstrap:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure kubectl
        run: |
          echo "${{ secrets.VKE_KUBECONFIG }}" | base64 -d > kubeconfig
          export KUBECONFIG=./kubeconfig
          kubectl cluster-info

      - name: Install OLM
        run: |
          cd deployments/infrastructure/olm
          ./install.sh
          kubectl wait --for=condition=Ready -n olm pod -l app=olm-operator --timeout=300s

      - name: Install cert-manager
        run: |
          kubectl apply -f deployments/infrastructure/cert-manager/
          kubectl wait --for=condition=Ready -n cert-manager pod -l app=cert-manager --timeout=300s

      - name: Install ingress-nginx
        run: |
          helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
          helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
            --namespace ingress-nginx --create-namespace \
            -f deployments/infrastructure/ingress-nginx/values.yaml

      - name: Create namespaces
        run: |
          kubectl apply -f deployments/infrastructure/namespaces.yaml

      - name: Verify bootstrap
        run: |
          kubectl get csv -n olm
          kubectl get pods -n cert-manager
          kubectl get pods -n ingress-nginx
```

---

### Workflow 2: Deploy Infrastructure (`.github/workflows/deploy-infrastructure.yml`)

**Purpose**: Update infrastructure components (triggered by infrastructure changes)

**Trigger**: Automatic on infrastructure file changes

```yaml
name: Deploy Infrastructure

on:
  push:
    branches: [main]
    paths:
      - 'deployments/infrastructure/**'
  pull_request:
    paths:
      - 'deployments/infrastructure/**'
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate manifests
        run: |
          scripts/validate-manifests.sh deployments/infrastructure/

  deploy:
    needs: validate
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Configure kubectl
        run: |
          echo "${{ secrets.VKE_KUBECONFIG }}" | base64 -d > kubeconfig
          export KUBECONFIG=./kubeconfig

      - name: Apply infrastructure changes
        run: |
          kubectl apply -f deployments/infrastructure/ --recursive

      - name: Verify health
        run: |
          kubectl get pods -A | grep -E 'olm|cert-manager|ingress'
```

---

### Workflow 3: Deploy Keycloak (`.github/workflows/deploy-keycloak.yml`)

**Purpose**: Deploy/update Keycloak infrastructure (automatic on keycloak file changes)

**Trigger**: Automatic on keycloak configuration changes

```yaml
name: Deploy Keycloak

on:
  push:
    branches: [main]
    paths:
      - 'deployments/keycloak/**'
  pull_request:
    paths:
      - 'deployments/keycloak/**'
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate Keycloak manifests
        run: |
          kubectl apply --dry-run=client -f deployments/keycloak/

  deploy:
    needs: validate
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production

    steps:
      - uses: actions/checkout@v4

      - name: Configure kubectl
        run: |
          echo "${{ secrets.VKE_KUBECONFIG }}" | base64 -d > kubeconfig
          export KUBECONFIG=./kubeconfig

      - name: Apply Keycloak namespace
        run: |
          kubectl apply -f deployments/keycloak/namespace.yaml

      - name: Create database secret
        run: |
          kubectl create secret generic keycloak-db-secret \
            --from-literal=username=keycloak \
            --from-literal=password=${{ secrets.DB_PASSWORD }} \
            --namespace=keycloak \
            --dry-run=client -o yaml | kubectl apply -f -

      - name: Apply Keycloak operator subscription
        run: |
          kubectl apply -f deployments/keycloak/operator-subscription.yaml
          # Wait for operator to be ready
          kubectl wait --for=condition=Ready -n operators pod -l app=keycloak-operator --timeout=300s

      - name: Apply Keycloak instance
        run: |
          kubectl apply -f deployments/keycloak/keycloak-instance.yaml
          # Wait for Keycloak to be ready
          kubectl wait --for=condition=Ready -n keycloak keycloak/volaticloud-keycloak --timeout=600s

      - name: Apply realm configuration
        run: |
          kubectl apply -f deployments/keycloak/keycloak-realm.yaml
          kubectl apply -f deployments/keycloak/keycloak-client.yaml

      - name: Verify OIDC endpoints
        run: |
          KEYCLOAK_URL=$(kubectl get keycloak volaticloud-keycloak -n keycloak -o jsonpath='{.status.url}')
          curl -f "$KEYCLOAK_URL/realms/volaticloud/.well-known/openid-configuration"

      - name: Create deployment
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.repos.createDeployment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              ref: context.sha,
              environment: 'keycloak-production',
              description: 'Keycloak deployment'
            });
```

---

### Workflow 4: Build & Push Container (`.github/workflows/docker-build.yml`)

**Purpose**: Build application container on code changes

**Trigger**: Automatic on Go code changes

```yaml
name: Build Docker Image

on:
  push:
    branches: [main, develop]
    paths:
      - 'internal/**'
      - 'cmd/**'
      - 'go.mod'
      - 'go.sum'
      - 'Dockerfile'
  pull_request:
    paths:
      - 'internal/**'
      - 'cmd/**'
      - 'Dockerfile'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.24'
      - name: Run tests
        run: make test

  build-and-push:
    needs: test
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      image-digest: ${{ steps.build.outputs.digest }}

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix=sha-
            type=semver,pattern={{version}}
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64

      - name: Scan image for vulnerabilities
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:sha-${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'
```

---

### Workflow 5: Deploy Application (`.github/workflows/deploy-app.yml`)

**Purpose**: Deploy application to Kubernetes (triggered by code or Helm changes)

**Trigger**: Automatic after docker-build or on Helm chart changes

```yaml
name: Deploy Application

on:
  workflow_run:
    workflows: ["Build Docker Image"]
    types: [completed]
    branches: [main]
  push:
    branches: [main]
    paths:
      - 'deployments/helm/volaticloud/**'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy'
        required: true
        type: choice
        options: [dev, staging, prod]
      image-tag:
        description: 'Image tag to deploy (default: latest)'
        required: false

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      code-changed: ${{ steps.filter.outputs.code }}
      helm-changed: ${{ steps.filter.outputs.helm }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            code:
              - 'internal/**'
              - 'cmd/**'
              - 'Dockerfile'
            helm:
              - 'deployments/helm/volaticloud/**'

  lint-helm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Lint Helm chart
        run: |
          helm lint deployments/helm/volaticloud
          helm template volaticloud deployments/helm/volaticloud --debug --dry-run

  deploy-dev:
    needs: [detect-changes, lint-helm]
    if: |
      github.event_name == 'push' &&
      github.ref == 'refs/heads/main' &&
      (needs.detect-changes.outputs.code-changed == 'true' ||
       needs.detect-changes.outputs.helm-changed == 'true')
    runs-on: ubuntu-latest
    environment: dev

    steps:
      - uses: actions/checkout@v4

      - name: Configure kubectl
        run: |
          echo "${{ secrets.VKE_KUBECONFIG }}" | base64 -d > kubeconfig
          export KUBECONFIG=./kubeconfig
          kubectl cluster-info

      - name: Deploy with Helm
        run: |
          IMAGE_TAG="${{ inputs.image-tag || format('sha-{0}', github.sha) }}"

          helm upgrade --install volaticloud deployments/helm/volaticloud \
            --namespace volaticloud --create-namespace \
            --values deployments/helm/volaticloud/values-dev.yaml \
            --set image.tag="$IMAGE_TAG" \
            --set image.pullPolicy=Always \
            --wait --timeout=5m

      - name: Wait for rollout
        run: |
          kubectl rollout status deployment/volaticloud -n volaticloud --timeout=5m

      - name: Run smoke tests
        run: |
          export KUBECONFIG=./kubeconfig
          scripts/smoke-test.sh

      - name: Get deployment info
        run: |
          kubectl get pods -n volaticloud
          kubectl get svc -n volaticloud
          kubectl get ingress -n volaticloud

      - name: Create deployment
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.repos.createDeployment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              ref: context.sha,
              environment: 'dev',
              description: 'Deployed to development'
            });

  deploy-prod:
    needs: [detect-changes, lint-helm]
    if: github.event.inputs.environment == 'prod'
    runs-on: ubuntu-latest
    environment: production  # Requires manual approval

    steps:
      - uses: actions/checkout@v4

      - name: Configure kubectl
        run: |
          echo "${{ secrets.VKE_KUBECONFIG_PROD }}" | base64 -d > kubeconfig
          export KUBECONFIG=./kubeconfig

      - name: Deploy with Helm
        run: |
          IMAGE_TAG="${{ inputs.image-tag || 'latest' }}"

          helm upgrade --install volaticloud deployments/helm/volaticloud \
            --namespace volaticloud --create-namespace \
            --values deployments/helm/volaticloud/values-prod.yaml \
            --set image.tag="$IMAGE_TAG" \
            --wait --timeout=10m

      - name: Run production smoke tests
        run: |
          export KUBECONFIG=./kubeconfig
          scripts/smoke-test.sh --production
```

---

### Workflow 6: Validate Manifests (`.github/workflows/validate-manifests.yml`)

**Purpose**: Validate all Kubernetes manifests on pull requests

**Trigger**: Automatic on PRs with deployment changes

```yaml
name: Validate Manifests

on:
  pull_request:
    paths:
      - 'deployments/**'
      - '.github/workflows/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Validate Helm charts
        run: |
          helm lint deployments/helm/volaticloud
          helm template volaticloud deployments/helm/volaticloud --debug

      - name: Validate Kubernetes manifests
        run: |
          kubectl apply --dry-run=client -f deployments/keycloak/
          kubectl apply --dry-run=client -f deployments/infrastructure/

      - name: Run kubesec scan
        run: |
          docker run --rm -v $(pwd):/work kubesec/kubesec:latest scan deployments/**/*.yaml

      - name: Check for secrets
        run: |
          ! grep -r "password:" deployments/ | grep -v "passwordSecret"
          ! grep -r "token:" deployments/ | grep -v "# example"
```

---

### Required GitHub Secrets

Configure these secrets in GitHub repository settings:

**Cluster Access**:
- `VKE_KUBECONFIG` - Base64-encoded kubeconfig for dev/staging
- `VKE_KUBECONFIG_PROD` - Base64-encoded kubeconfig for production

**Container Registry**:
- `GITHUB_TOKEN` - Automatically provided (for ghcr.io)

**Keycloak**:
- `DB_PASSWORD` - PostgreSQL password for Keycloak database
- `ADMIN_EMAIL` - Admin user email

**Optional**:
- `SLACK_WEBHOOK` - Slack notifications
- `VULTR_API_KEY` - Dynamic kubeconfig generation

---

### Deployment Environments

**GitHub Environments Configuration**:

1. **dev**
   - No approval required
   - Auto-deploy on main branch
   - Can be triggered manually

2. **staging**
   - Optional approval required
   - Manual trigger only
   - Used for testing before production

3. **production**
   - **Required approvals**: 1+ reviewers
   - Manual trigger only
   - Protected environment
   - Deployment protection rules enabled

---

### GitOps Workflow Summary

```
Developer makes change → Commits to feature branch → Opens PR
                                                        ↓
                                          Validate manifests workflow runs
                                          Lint checks, dry-run tests
                                                        ↓
                                          PR approved & merged to main
                                                        ↓
                          Smart triggers detect changed files
                                                        ↓
                ┌──────────────────┬────────────────────┴─────────────┐
                ↓                  ↓                                   ↓
        Code changed         Helm changed                    Keycloak changed
                ↓                  ↓                                   ↓
        Build container      Deploy Helm chart             Apply Keycloak manifests
        Push to ghcr.io      Wait for rollout              Wait for operator ready
                ↓                  ↓                                   ↓
        Deploy to dev        Run smoke tests               Verify endpoints
                ↓                  ↓                                   ↓
        Success!             Create GitHub Deployment      Create GitHub Deployment
```

---

## Phase 7: Documentation & Validation

### Documentation Files

#### 7.1 Update `.claude/CLAUDE.md`
Add sections:
- Kubernetes deployment overview
- OLM operator management
- Keycloak authentication flow
- GitHub Actions workflow guide
- Troubleshooting common issues

#### 7.2 Create `deployments/README.md`
**Contents**:
- Quick start guide for local development
- VKE production deployment guide
- Prerequisites and dependencies
- Configuration options
- Monitoring and observability
- Backup and disaster recovery
- Cost optimization tips

#### 7.3 Create `deployments/TROUBLESHOOTING.md`
Common issues and solutions:
- OLM installation failures
- Keycloak operator issues
- Authentication problems
- Database connection errors
- Container networking issues
- Resource constraints

### Testing & Validation

#### 7.1 Helm Chart Linting
```yaml
# Add to .github/workflows/quality.yml
- name: Lint Helm Chart
  run: |
    helm lint deployments/helm/volaticloud
    helm template deployments/helm/volaticloud --debug
```

#### 7.2 Dry-Run Tests
```bash
# Test deployment without applying
helm install volaticloud deployments/helm/volaticloud --dry-run --debug
kubectl apply -f deployments/keycloak/ --dry-run=client
```

#### 7.3 Integration Tests
- Test OIDC login flow
- Verify JWT token validation
- Check role-based access control
- Test bot operations with auth

#### 7.4 Security Scanning
- Container image scanning (Trivy)
- Kubernetes manifest scanning (Kubesec)
- Dependency vulnerability scanning
- Secret detection (git-secrets)

---

## Implementation Timeline

### Week 1: Foundation
- [ ] Phase 1: Containerization (2 days)
- [ ] Phase 2: Helm Chart (3 days)

### Week 2: Operators
- [ ] Phase 3: OLM Setup (1 day)
- [ ] Phase 4: Keycloak Operator (3 days)

### Week 3: Integration
- [ ] Phase 5: Authentication Integration (5 days)
  - Backend: 2 days
  - Frontend: 2 days
  - Testing: 1 day

### Week 4: Automation & Polish
- [ ] Phase 6: GitHub Actions (3 days)
- [ ] Phase 7: Documentation (2 days)

**Total Estimated Time**: 4 weeks (20 working days)

---

## Success Criteria

### Phase 1
- ✅ Docker image builds successfully
- ✅ Image pushed to ghcr.io
- ✅ Health check responds correctly
- ✅ Image size < 100MB

### Phase 2
- ✅ Helm chart installs without errors
- ✅ All pods running and healthy
- ✅ GraphQL API accessible
- ✅ Values files for all environments

### Phase 3
- ✅ OLM installed and running
- ✅ Can install operators via OLM
- ✅ Catalog sources available

### Phase 4
- ✅ Keycloak operator deployed
- ✅ Keycloak instance running
- ✅ Realm configured correctly
- ✅ OIDC endpoints accessible

### Phase 5
- ✅ Login redirects to Keycloak
- ✅ JWT tokens validated correctly
- ✅ Role-based access enforced
- ✅ Protected GraphQL operations work

### Phase 6
- ✅ Deployments triggered automatically
- ✅ Container builds on code changes
- ✅ Keycloak updates on config changes
- ✅ Deployment notifications working

### Phase 7
- ✅ Complete documentation available
- ✅ Helm chart lint passes
- ✅ Integration tests pass
- ✅ Security scans clean

---

## Risk Management

### High Risk Items

**1. Kubernetes Runtime Implementation**
- **Risk**: `internal/runner/kubernetes.go` is currently a stub
- **Impact**: Bots won't run in Kubernetes
- **Mitigation**: May need to keep Docker runtime initially, implement K8s runtime separately

**2. Database Migration**
- **Risk**: SQLite to PostgreSQL migration complexity
- **Impact**: Data loss or downtime
- **Mitigation**: Backup strategy, migration scripts, testing

**3. Keycloak Single Point of Failure**
- **Risk**: Authentication down = entire system unusable
- **Impact**: High availability critical
- **Mitigation**: Run 2+ Keycloak replicas, PostgreSQL HA

### Medium Risk Items

**1. OLM Complexity**
- **Risk**: OLM adds operational overhead
- **Mitigation**: Document thoroughly, have rollback plan

**2. Token Expiration Handling**
- **Risk**: Poor UX if token refresh fails
- **Mitigation**: Implement automatic refresh, clear error messages

**3. VKE-Specific Issues**
- **Risk**: Vultr-specific limitations or bugs
- **Mitigation**: Test early, have Vultr support contact

---

## Cost Estimation (Vultr VKE)

### Development Environment
- **Cluster**: 2 nodes × $12/month = $24/month
- **Load Balancer**: $10/month
- **Block Storage**: 20GB × $0.10/GB = $2/month
- **Total**: ~$36/month

### Production Environment
- **Cluster**: 4 nodes × $24/month = $96/month
- **Load Balancer**: $10/month
- **Managed PostgreSQL**: $15/month
- **Block Storage**: 100GB × $0.10/GB = $10/month
- **Snapshots**: $5/month
- **Total**: ~$136/month

### Cost Optimization
- Use node autoscaling
- Implement pod resource limits
- Use spot instances for dev (if available)
- Schedule down dev environment overnight

---

## Security Considerations

### Container Security
- [ ] Run as non-root user
- [ ] Use distroless/alpine base images
- [ ] Scan images for vulnerabilities
- [ ] Sign container images
- [ ] Implement image pull secrets

### Kubernetes Security
- [ ] Enable RBAC
- [ ] Use NetworkPolicies
- [ ] Implement PodSecurityPolicies/Standards
- [ ] Encrypt etcd at rest
- [ ] Enable audit logging

### Application Security
- [ ] Validate JWT signatures
- [ ] Implement rate limiting
- [ ] Sanitize user inputs
- [ ] Use HTTPS everywhere
- [ ] Rotate credentials regularly

### Secrets Management
- [ ] Use Kubernetes Secrets
- [ ] Consider external secrets operator
- [ ] Never commit secrets to git
- [ ] Encrypt secrets at rest
- [ ] Audit secret access

---

## Monitoring & Observability

### Metrics (Future Phase)
- Prometheus for metrics collection
- Grafana for visualization
- Key metrics: API latency, error rate, bot count

### Logging (Future Phase)
- Centralized logging (Loki or ELK)
- Structured logging in JSON
- Log aggregation from all pods

### Alerting (Future Phase)
- Alertmanager for alerts
- Slack/PagerDuty integration
- Alerts: Pod crashes, API errors, high latency

### Tracing (Future Phase)
- OpenTelemetry for distributed tracing
- Jaeger for trace visualization
- Trace GraphQL operations

---

## Rollback Procedures

### Application Rollback
```bash
# Rollback to previous Helm release
helm rollback volaticloud

# Rollback to specific revision
helm rollback volaticloud 5
```

### Keycloak Rollback
```bash
# Delete Keycloak instance
kubectl delete keycloak volaticloud-keycloak -n keycloak

# Restore from backup
kubectl apply -f keycloak-backup.yaml
```

### Database Rollback
- Restore from snapshot
- Apply database migration rollback scripts
- Verify data integrity

---

## Next Steps

1. **Review this plan** - Get feedback, adjust as needed
2. **Set up VKE cluster** - If not already created
3. **Configure GitHub secrets** - Add VKE kubeconfig
4. **Begin Phase 1** - Containerization
5. **Iterate and improve** - Adjust plan based on learnings

---

## References

- [OLM Documentation](https://olm.operatorframework.io/)
- [Keycloak Operator](https://www.keycloak.org/operator/installation)
- [Helm Documentation](https://helm.sh/docs/)
- [Vultr Kubernetes Engine](https://www.vultr.com/docs/vultr-kubernetes-engine/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [react-oidc-context](https://github.com/authts/react-oidc-context)

---

**Document Status**: Initial Draft
**Last Updated**: 2025-11-13
**Next Review**: After Phase 1 completion
