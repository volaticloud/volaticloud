# 0007. Kubernetes Deployment Strategy

Date: 2025-11-14

## Status

Accepted

## Context and Problem Statement

VolatiCloud backend needs production deployment on Kubernetes with:

- **High availability**: Multiple replicas with auto-scaling
- **Zero-downtime deployments**: Rolling updates without service interruption
- **Health monitoring**: Liveness and readiness probes
- **Auto-scaling**: Scale based on CPU/memory load
- **TLS/HTTPS**: Secure external access with automatic cert management
- **Database migrations**: Automatic schema updates on deployment

**The Problem:** How do we deploy a Go+GraphQL backend to Kubernetes with production-grade reliability, auto-scaling, and GitOps automation?

## Decision Drivers

- **Production-ready**: High availability, health checks, auto-scaling
- **GitOps-friendly**: Declarative configuration, version-controlled
- **Zero-downtime**: Rolling updates with health checks
- **Infrastructure as code**: Helm charts, not manual kubectl commands
- **Avoid vendor lock-in**: Use generic Kubernetes primitives
- **Auto-migrations**: Database schema updates automated
- **Cost efficiency**: Scale to zero when idle, scale up under load

## Considered Options

### Option 1: Manual kubectl Deployments

Write Kubernetes YAML manifests, deploy with `kubectl apply`.

**Pros:**

- Full control over YAML
- No dependencies on Helm

**Cons:**

- **Not GitOps-friendly** - hard to version and diff
- **Manual updates** - requires running kubectl for every change
- No templating (must duplicate YAML for staging/prod)
- No rollback mechanism
- No release management

### Option 2: Custom Helm Chart

Write a custom Helm chart from scratch for VolatiCloud.

**Pros:**

- Tailored to exact needs
- Full control

**Cons:**

- **Reinventing the wheel** - deployment, service, ingress, HPA, PDB all need writing
- **Maintenance burden** - must keep chart updated with K8s best practices
- **No community support** - bugs are our problem
- Time-consuming initial development

### Option 3: Nixys Universal Chart

Use production-ready universal Helm chart (Nixys) with values override.

**Pros:**

- **Battle-tested** - used in production by many teams
- **Feature-complete** - Deployment, Service, Ingress, HPA, PDB, Probes all included
- **Best practices** - follows Kubernetes patterns
- **Zero maintenance** - chart updates separate from app code
- **Fast implementation** - just provide values.yaml
- **Generic** - works with any containerized app
- **Multiple ingress support** - Works with nginx-ingress, traefik, etc.

**Cons:**

- Less control than custom chart (acceptable trade-off)
- Must understand chart's values structure

## Decision Outcome

Chosen option: **Nixys Universal Chart**, because it:

1. **Production-ready out of the box** - HPA, PDB, probes, affinity all configured
2. **Zero custom chart maintenance** - leverage community-maintained chart
3. **Fast time-to-production** - deploy in minutes with values.yaml
4. **GitOps-friendly** - values.yaml in version control
5. **Best practices enforced** - chart follows K8s deployment patterns

### Consequences

**Positive:**

- Production deployment in days, not weeks
- Automatic rollbacks on failed deployments (`--atomic` flag)
- Community-maintained chart (security updates, K8s compatibility)
- Standard Helm workflows (install, upgrade, rollback)
- Easy to replicate for other services

**Negative:**

- Must learn Nixys chart value structure (one-time investment)
- Less flexibility than custom chart (but extensible via `extraDeploy`)

**Neutral:**

- Database migrations run automatically on server startup (no separate job needed)
- Chart updates independent of app deployments

## Implementation

### Architecture

**Deployment Stack:**

```
GitHub Container Registry (GHCR)
    ↓ Docker Image
Helm Chart (Nixys Universal)
    ↓ Deploy to
VKE Cluster (Vultr Kubernetes Engine)
    ├─ Deployment (2-10 replicas via HPA)
    ├─ Service (ClusterIP)
    ├─ Ingress (Nginx + Let's Encrypt)
    ├─ HPA (Horizontal Pod Autoscaler)
    ├─ PDB (Pod Disruption Budget)
    └─ Secrets (Database credentials)
```

**CI/CD Pipeline:**

```
Push to main → GitHub Actions
    ↓
Build Docker image (multi-stage, Alpine)
    ↓
Push to GHCR (ghcr.io/volaticloud/volaticloud:main-<sha>)
    ↓
Deploy via Helm (atomic rollback on failure)
    ↓
Migrations run automatically (ENT auto-migration on startup)
    ↓
Health checks pass → Traffic routes to new pods
```

### Key Files

**Helm Values:**

- `deployments/backend/values.yaml` - Complete deployment configuration
  - Image: `ghcr.io/volaticloud/volaticloud:main-abc1234`
  - Replicas: 2 (min via HPA)
  - Resources: 250m CPU / 256Mi RAM requests, 1000m / 512Mi limits
  - Probes: Liveness (10s interval), Readiness (5s interval)
  - Ingress: TLS with Let's Encrypt, nginx-ingress
  - HPA: 2-10 replicas based on CPU 70% / Memory 80%
  - PDB: Min 1 replica available during disruptions
  - Affinity: Spread pods across nodes

**GitHub Workflows:**

- `.github/workflows/docker-build.yml` - Build and push Docker images
- `.github/workflows/deploy-backend.yml` - Deploy to Kubernetes with Helm
  - Validates Helm values
  - Creates namespace and secrets
  - Deploys with `--atomic` (auto-rollback on failure)
  - Verifies deployment health
  - Runs post-deployment tests

**Dockerfile:**

- Multi-stage build: Go 1.24 (build) + Alpine 3.x (runtime)
- Non-root user (UID 1000)
- Health check: `wget http://localhost:8080/health`
- Size: ~30MB compressed

### Example Configuration

**Helm Values (deployments/backend/values.yaml):**

```yaml
image:
  repository: ghcr.io/volaticloud/volaticloud
  tag: main-abc1234
  pullPolicy: IfNotPresent

replicaCount: 2  # Minimum replicas (HPA will scale up)

resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 512Mi

service:
  type: ClusterIP
  port: 8080

# NOTE: Backend ingress has been removed - backend is now internal-only.
# See ADR-0019 for the updated architecture where all traffic flows
# through the dashboard's Caddy reverse proxy.
# The configuration below is kept for historical reference.
#
# ingress:
#   enabled: true
#   ingressClassName: nginx
#   hosts:
#     - host: api.volaticloud.com
#       paths:
#         - path: /
#           pathType: Prefix
#   tls:
#     - secretName: volaticloud-tls
#       hosts:
#         - api.volaticloud.com

livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

podDisruptionBudget:
  enabled: true
  minAvailable: 1  # Always keep min 1 replica during disruptions

affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
              - key: app
                operator: In
                values:
                  - volaticloud-backend
          topologyKey: kubernetes.io/hostname

env:
  - name: VOLATICLOUD_HOST
    value: "0.0.0.0"
  - name: VOLATICLOUD_PORT
    value: "8080"
  - name: VOLATICLOUD_DATABASE
    valueFrom:
      secretKeyRef:
        name: volaticloud-db-secret
        key: dsn
  - name: VOLATICLOUD_KEYCLOAK_URL
    value: "https://keycloak.volaticloud.com"
  # ... more env vars
```

### Database Migrations

**Auto-Migration on Startup:**
Migrations run automatically when the server starts, eliminating the need for separate migration jobs.

**Implementation** (`cmd/server/main.go:132-135`):

```go
// Run auto migration before starting server
if err := client.Schema.Create(ctx); err != nil {
    return fmt.Errorf("failed creating schema resources: %w", err)
}
```

**Deployment Flow:**

1. New pod starts → Binary runs
2. Database connection established
3. ENT auto-migration executes (`client.Schema.Create`)
4. HTTP server starts
5. Readiness probe succeeds
6. Traffic routes to pod

**Benefits:**

- ✅ 100% GitOps - no separate migration jobs
- ✅ Zero-downtime - readiness probe prevents traffic during migration
- ✅ Automatic rollback - pod fails if migration fails
- ✅ Idempotent - safe to run multiple times

### Deployment Commands

**Deploy to Kubernetes:**

```bash
# Add Nixys Helm repo
helm repo add nixys https://registry.nixys.io/chartrepo/public
helm repo update

# Deploy (via GitHub Actions or manual)
helm upgrade --install volaticloud-backend nixys/nxs-universal-chart \
  --namespace volaticloud \
  --create-namespace \
  -f deployments/backend/values.yaml \
  --set image.tag=main-abc1234 \
  --wait --timeout 10m --atomic  # Auto-rollback on failure
```

**Verify Deployment:**

```bash
# Check pods
kubectl get pods -n volaticloud -l app=volaticloud-backend

# View logs
kubectl logs -n volaticloud -l app=volaticloud-backend --tail=100 -f

# Test health endpoint (via dashboard reverse proxy)
curl https://console.volaticloud.com/gateway/v1/health

# Check HPA status
kubectl get hpa -n volaticloud
```

**Rollback:**

```bash
# Automatic rollback on failure (--atomic flag)
# Or manual rollback to previous release
helm rollback volaticloud-backend -n volaticloud
```

## Validation

### How to Verify This Decision

1. **High availability**: 2+ pods running at all times
2. **Auto-scaling**: HPA scales up under load, down when idle
3. **Zero-downtime**: Rolling updates complete without 5xx errors
4. **Health checks**: Liveness kills unhealthy pods, readiness delays traffic
5. **Automatic migrations**: Schema changes deployed without manual intervention

### Automated Tests

**Pre-Deployment Validation:**

```bash
# Validate Helm values
helm template volaticloud-backend nixys/nxs-universal-chart \
  -f deployments/backend/values.yaml \
  --dry-run --debug | kubectl apply --dry-run=client -f -

# Lint chart
helm lint nixys/nxs-universal-chart -f deployments/backend/values.yaml
```

**Post-Deployment Tests:**

```bash
# Verify deployment
kubectl rollout status deployment/volaticloud-backend -n volaticloud

# Test health endpoint (via dashboard reverse proxy)
curl -f https://console.volaticloud.com/gateway/v1/health || exit 1

# Verify HPA
kubectl get hpa volaticloud-backend -n volaticloud | grep -q "2/10" || exit 1

# Verify PDB
kubectl get pdb volaticloud-backend -n volaticloud | grep -q "1" || exit 1
```

### Success Metrics

- ✅ 99.9% uptime (SLO)
- ✅ < 1s p99 latency
- ✅ Zero failed deployments (atomic rollback)
- ✅ Auto-scaling responds within 30s
- ✅ Database migrations succeed on first pod startup

## References

- [Nixys Universal Chart](https://github.com/nixys/nxs-universal-chart)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [Helm Best Practices](https://helm.sh/docs/chart_best_practices/)
- [Zero-Downtime Deployments](https://kubernetes.io/docs/tutorials/kubernetes-basics/update/update-intro/)
- Implementation: `deployments/backend/values.yaml`
- CI/CD: `.github/workflows/deploy-backend.yml`
- Documentation: `deployments/backend/README.md`
