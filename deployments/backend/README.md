# AnyTrade Backend Deployment

This directory contains Kubernetes deployment configuration for the AnyTrade backend using the [Nixys Universal Chart](https://github.com/nixys/nxs-universal-chart).

## Overview

The backend is deployed as a Kubernetes Deployment with:
- **Horizontal Pod Autoscaling** (2-10 replicas based on CPU/memory)
- **Health checks** (liveness & readiness probes)
- **Database migrations** (pre-install/pre-upgrade hook)
- **TLS/HTTPS** (cert-manager integration)
- **Rolling updates** (zero-downtime deployments)
- **Pod Disruption Budget** (high availability)

## Architecture

```
┌─────────────────┐
│   Ingress       │  https://api.volaticloud.com
│   (TLS)         │  (cert-manager + Let's Encrypt)
└────────┬────────┘
         │
┌────────▼────────┐
│   Service       │  ClusterIP:8080
└────────┬────────┘
         │
    ┌────▼─────┬──────────┬──────────┐
    │  Pod 1   │  Pod 2   │  Pod N   │  (2-10 replicas via HPA)
    └──────────┴──────────┴──────────┘
         │
┌────────▼────────┐
│  PostgreSQL     │  Managed Database (Vultr)
│  (External)     │
└─────────────────┘
```

## Prerequisites

### 1. GitHub Container Registry (GHCR)

Docker images are automatically built and pushed to GHCR:
- **Registry**: `ghcr.io/diazoxide/anytrade`
- **Tags**: `latest`, `main-<sha>`, version tags
- **Auth**: GitHub Actions uses `GITHUB_TOKEN` (automatic)

To pull images manually:
```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
docker pull ghcr.io/diazoxide/anytrade:latest
```

### 2. VKE Cluster

Ensure your VKE cluster has:
- ✅ Ingress Nginx Controller installed
- ✅ Cert-manager installed
- ✅ ClusterIssuer `letsencrypt-prod` configured
- ✅ Sufficient resources (2+ nodes, 2 vCPU, 4GB RAM each)

### 3. PostgreSQL Database

Create a managed PostgreSQL database on Vultr:
- **Database**: `anytrade`
- **User**: `anytrade`
- **Version**: PostgreSQL 14+
- **SSL Mode**: Required

### 4. GitHub Secrets (Environment: prod)

Configure these secrets in the `prod` environment:

| Secret Name | Description | Example |
|------------|-------------|---------|
| `VKE_KUBECONFIG` | Base64-encoded kubeconfig | `cat kubeconfig.yaml \| base64` |
| `ANYTRADE_DATABASE` | Full PostgreSQL connection string | `postgresql://user:pass@host:port/db?sslmode=require` |

**Note:** The secret name `ANYTRADE_DATABASE` matches the environment variable used in `cmd/server/main.go:52`.

Set secrets:
```bash
gh secret set VKE_KUBECONFIG --env prod
# When prompted, enter: postgresql://anytrade:your-password@postgres-abc.vultr.com:16751/anytrade?sslmode=require
gh secret set ANYTRADE_DATABASE --env prod
```

## Configuration

### Helm Values (`values.yaml`)

Key configuration sections:

**Image:**
```yaml
image:
  repository: ghcr.io/diazoxide/anytrade
  tag: latest  # Override via --set image.tag=<sha>
  pullPolicy: Always
```

**Replicas & Autoscaling:**
```yaml
replicaCount: 2

hpa:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
```

**Resources:**
```yaml
resources:
  limits:
    cpu: 1000m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi
```

**Ingress:**
```yaml
ingress:
  - name: main
    ingressClassName: nginx
    annotations:
      cert-manager.io/cluster-issuer: letsencrypt-prod
    hosts:
      - host: api.volaticloud.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: anytrade-api-tls
        hosts:
          - api.volaticloud.com
```

**Database Migration (extraDeploy):**
```yaml
extraDeploy:
  - |
    apiVersion: batch/v1
    kind: Job
    metadata:
      name: anytrade-backend-migrate
      annotations:
        "helm.sh/hook": pre-upgrade,pre-install
        "helm.sh/hook-weight": "-5"
    # ... runs `anytrade migrate` before deployment
```

## Deployment Workflow

### Automatic Deployment

1. **Push to main branch** with changes to `deployments/backend/**`
2. GitHub Actions automatically:
   - Validates Helm values
   - Runs database migrations (pre-install hook)
   - Deploys backend with Helm
   - Verifies deployment health
   - Runs post-deployment tests
   - Rolls back on failure (atomic)

### Manual Deployment

Trigger manual deployment:
```bash
# Deploy latest image
gh workflow run deploy-backend.yml

# Deploy specific image tag
gh workflow run deploy-backend.yml -f image_tag=main-abc1234
```

### Local Testing

Test Helm rendering locally:
```bash
# Add Nixys Helm repository
helm repo add nixys https://registry.nixys.io/chartrepo/public
helm repo update

# Validate values
helm template anytrade-backend nixys/nxs-universal-chart \
  -f deployments/backend/values.yaml \
  --dry-run --debug

# Lint chart
helm lint nixys/nxs-universal-chart \
  -f deployments/backend/values.yaml
```

## Database Migrations

Migrations run automatically as a Kubernetes Job before each deployment:

**Migration Job Behavior:**
- **Hook**: `pre-upgrade`, `pre-install`
- **Command**: `/app/anytrade migrate`
- **Backoff**: 3 retries
- **Cleanup**: Job deleted after 5 minutes (TTL)
- **Failure**: Deployment fails if migration fails

**Manual Migration:**
```bash
# Run migration manually
kubectl run -it --rm migrate --image=ghcr.io/diazoxide/anytrade:latest \
  --restart=Never \
  --env="ANYTRADE_DATABASE=postgresql://..." \
  -- /app/anytrade migrate
```

## Deployment Commands

### Deploy

```bash
# Deploy to production
helm upgrade --install anytrade-backend nixys/nxs-universal-chart \
  --namespace anytrade \
  --create-namespace \
  -f deployments/backend/values.yaml \
  --set image.tag=latest \
  --wait \
  --timeout 10m \
  --atomic
```

### Rollback

```bash
# Rollback to previous version
helm rollback anytrade-backend -n anytrade

# Rollback to specific revision
helm rollback anytrade-backend 3 -n anytrade
```

### Verify

```bash
# Check deployment status
kubectl get deployments -n anytrade
kubectl get pods -n anytrade -l app=anytrade-backend

# Check service
kubectl get svc -n anytrade

# Check ingress
kubectl get ingress -n anytrade

# View logs
kubectl logs -n anytrade -l app=anytrade-backend --tail=100 -f

# Check HPA
kubectl get hpa -n anytrade
```

## Monitoring

### Health Checks

- **Endpoint**: `/health`
- **Liveness Probe**: Every 10s (fail after 3 consecutive failures)
- **Readiness Probe**: Every 5s (fail after 3 consecutive failures)

### Prometheus Metrics

Pods are annotated for Prometheus scraping:
```yaml
podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "8080"
  prometheus.io/path: /metrics
```

### View Events

```bash
# Recent events
kubectl get events -n anytrade --sort-by='.lastTimestamp'

# Watch events
kubectl get events -n anytrade --watch
```

## Troubleshooting

### Deployment Fails

**Check pod status:**
```bash
kubectl get pods -n anytrade
kubectl describe pod <pod-name> -n anytrade
```

**Check logs:**
```bash
kubectl logs <pod-name> -n anytrade
kubectl logs <pod-name> -n anytrade --previous  # Previous container
```

**Check events:**
```bash
kubectl get events -n anytrade --sort-by='.lastTimestamp'
```

### Migration Job Fails

**View migration logs:**
```bash
kubectl get jobs -n anytrade
kubectl logs job/anytrade-backend-migrate -n anytrade
```

**Debug migration:**
```bash
kubectl describe job anytrade-backend-migrate -n anytrade
```

### Database Connection Issues

**Test database connectivity:**
```bash
kubectl run -it --rm psql-test --image=postgres:14 --restart=Never -- \
  psql -h <POSTGRES_HOST> -U anytrade -d anytrade
```

**Check secret:**
```bash
kubectl get secret anytrade-secrets -n anytrade -o yaml
```

### Ingress/TLS Issues

**Check ingress:**
```bash
kubectl describe ingress -n anytrade
```

**Check certificate:**
```bash
kubectl get certificate -n anytrade
kubectl describe certificate anytrade-api-tls -n anytrade
```

**Check cert-manager logs:**
```bash
kubectl logs -n cert-manager -l app=cert-manager
```

## Scaling

### Manual Scaling

```bash
# Scale to 5 replicas
kubectl scale deployment anytrade-backend -n anytrade --replicas=5
```

### Update HPA

Edit `values.yaml` and redeploy:
```yaml
hpa:
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 60
```

## Security

### Security Context

Pods run as non-root user (UID 1000):
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  readOnlyRootFilesystem: false
  capabilities:
    drop:
      - ALL
```

### Network Policies

(Coming soon - restrict traffic to backend pods)

### Secrets Management

Database credentials stored in Kubernetes Secrets:
- Created by GitHub Actions during deployment
- Referenced via environment variables
- Not committed to git

## CI/CD Pipeline

### Build Pipeline (`.github/workflows/docker-build.yml`)

**Triggers:** Push to main (Go code changes)
**Steps:**
1. Build multi-arch Docker image (amd64, arm64)
2. Push to GHCR
3. Tag: `latest`, `main-<sha>`, version tags

### Deploy Pipeline (`.github/workflows/deploy-backend.yml`)

**Triggers:** Push to main (deployment config changes)
**Steps:**
1. Validate Helm values
2. Create namespace & secrets
3. Run database migrations (Helm hook)
4. Deploy with Helm (atomic)
5. Verify deployment
6. Run post-deployment tests
7. Rollback on failure

## Best Practices

1. **Always use image tags**: Never rely on `latest` in production
2. **Test migrations locally**: Use `make migrate` before pushing
3. **Monitor logs**: Check logs after each deployment
4. **Use atomic deployments**: `--atomic` flag ensures rollback on failure
5. **Version your changes**: Tag releases for easy rollback
6. **Review HPA metrics**: Adjust thresholds based on actual usage

## References

- [Nixys Universal Chart Documentation](https://github.com/nixys/nxs-universal-chart)
- [Helm Documentation](https://helm.sh/docs/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [VKE Documentation](https://www.vultr.com/docs/vultr-kubernetes-engine/)

## Support

For deployment issues:
1. Check this README
2. Review GitHub Actions logs
3. Check Kubernetes events and logs
4. Open GitHub issue with details