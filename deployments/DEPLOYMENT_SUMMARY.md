# 🚀 AnyTrade Backend Deployment - 100% GitOps

## Overview

The backend deployment is now **100% automated with GitOps principles**:
- ✅ No manual commands required
- ✅ Migrations run automatically on server startup
- ✅ Environment-driven configuration
- ✅ Single binary, zero external dependencies
- ✅ Complete CI/CD automation

## Environment Variables (Production)

All configuration is done via environment variables:

| Variable | Description | Production Value |
|----------|-------------|------------------|
| `ANYTRADE_HOST` | Server bind address | `0.0.0.0` |
| `ANYTRADE_PORT` | Server port | `8080` |
| `ANYTRADE_DATABASE` | PostgreSQL connection string | `postgresql://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@$(POSTGRES_HOST):5432/$(POSTGRES_DB)?sslmode=require` |
| `ANYTRADE_MONITOR_INTERVAL` | Bot monitoring frequency | `30s` |
| `ANYTRADE_ETCD_ENDPOINTS` | Etcd endpoints (optional for distributed mode) | _(empty = single instance)_ |

### Database Credentials (From Kubernetes Secrets)

These are injected from the `anytrade-db-secret`:
- `POSTGRES_HOST` - PostgreSQL hostname:port
- `POSTGRES_DB` - Database name
- `POSTGRES_USER` - Database username
- `POSTGRES_PASSWORD` - Database password

## Automatic Migration Strategy

**How it works:**

1. **On Container Start** → Server binary runs automatically
2. **Before Accepting Connections** → Runs `client.Schema.Create(ctx)` (ENT auto-migration)
3. **After Migration** → Starts HTTP server and monitoring

**Code Reference:** `cmd/server/main.go:132-135`
```go
// Run auto migration
if err := client.Schema.Create(ctx); err != nil {
    return fmt.Errorf("failed creating schema resources: %w", err)
}
```

**Benefits:**
- ✅ Zero-downtime deployments (migrations complete before accepting traffic)
- ✅ No separate migration jobs needed
- ✅ Kubernetes readiness probes prevent traffic during migration
- ✅ Automatic rollback if migration fails (pod crashes)

## Changes Made

### 1. Simplified Binary (`cmd/server/main.go`)

**Before:**
```bash
./anytrade server  # Start server
./anytrade migrate # Run migrations (separate command)
```

**After:**
```bash
./anytrade  # Starts server with automatic migrations
```

**Changes:**
- ❌ Removed `migrate` subcommand
- ❌ Removed `runMigrate()` function
- ✅ Server command is now the default action
- ✅ Migrations run automatically on startup

### 2. Simplified Dockerfile

**Before:**
```dockerfile
ENTRYPOINT ["/app/anytrade"]
CMD ["server"]
```

**After:**
```dockerfile
ENTRYPOINT ["/app/anytrade"]  # No CMD needed
```

### 3. Cleaned Helm Values (`deployments/backend/values.yaml`)

**Removed:**
- ❌ `extraDeploy` section with migration Job
- ❌ Pre-install Helm hooks
- ❌ Migration container configuration

**Result:** Simpler, cleaner Helm chart focused on the application

## GitOps Deployment Flow

```
1. Push to GitHub (main branch)
   ↓
2. GitHub Actions: Build Docker Image
   - Build multi-stage image
   - Push to ghcr.io/diazoxide/anytrade:latest
   ↓
3. GitHub Actions: Deploy to Kubernetes
   - Create namespace
   - Create database secret from GitHub secrets
   - Deploy with Helm
   ↓
4. Kubernetes Rolling Update
   - Start new pod with new image
   - Container starts → Binary runs
   - Auto-migrate database
   - Readiness probe checks /health
   - Traffic routes to new pod
   - Old pod terminates
   ↓
5. Success ✓ (or automatic rollback on failure)
```

## Developer Experience

### Local Development

```bash
# Set environment variables
export ANYTRADE_DATABASE="sqlite://./data/anytrade.db"

# Run server (migrations happen automatically)
./bin/anytrade
```

### Production Deployment

```bash
# 1. Set GitHub secrets (one-time)
gh secret set POSTGRES_HOST --env prod
gh secret set POSTGRES_DB --env prod
gh secret set POSTGRES_USER --env prod
gh secret set POSTGRES_PASSWORD --env prod
gh secret set VKE_KUBECONFIG --env prod

# 2. Deploy
git push origin main

# 3. Monitor
gh run watch
kubectl get pods -n anytrade -w
```

## Zero-Downtime Deployment Details

**How Kubernetes ensures zero-downtime:**

1. **Readiness Probe:** Prevents traffic until migration completes
   ```yaml
   readinessProbe:
     httpGet:
       path: /health
       port: 8080
     initialDelaySeconds: 5
     periodSeconds: 5
   ```

2. **Rolling Update Strategy:**
   ```yaml
   strategy:
     type: RollingUpdate
     rollingUpdate:
       maxSurge: 1          # One extra pod during update
       maxUnavailable: 0    # Always maintain capacity
   ```

3. **Timeline:**
   - t=0s: New pod starts
   - t=1-3s: Database migration runs
   - t=3s: Server starts
   - t=5s: First readiness probe
   - t=5s: Pod marked Ready
   - t=6s: Traffic routes to new pod
   - t=10s: Old pod terminates

**Result:** No requests are dropped during deployment!

## Migration Safety

**What happens if migration fails?**

1. Pod crashes (exit code != 0)
2. Kubernetes marks pod as NotReady
3. No traffic is routed to failed pod
4. Kubernetes retries (RestartPolicy: Always)
5. After 3 failures, deployment rolls back (Helm --atomic flag)
6. Old pods continue serving traffic

**Migration Best Practices:**

- ✅ Migrations are idempotent (ENT Schema.Create is safe to run multiple times)
- ✅ Additive changes only (add columns, add tables)
- ❌ Avoid breaking changes (never drop columns in production)
- ✅ Test migrations locally before deploying

## Troubleshooting

### Pod CrashLoopBackOff

```bash
# View logs
kubectl logs -n anytrade <pod-name>

# Common causes:
# 1. Database connection failed
# 2. Migration error
# 3. Invalid environment variables
```

### Migration Stuck

```bash
# Check if database is accessible
kubectl run -it --rm psql-test --image=postgres:14 --restart=Never -- \
  psql -h <host> -U anytrade -d anytrade

# Check pod events
kubectl describe pod <pod-name> -n anytrade
```

### Database Credentials Wrong

```bash
# Verify secret exists
kubectl get secret anytrade-db-secret -n anytrade

# Update secret
kubectl create secret generic anytrade-db-secret \
  --from-literal=host="..." \
  --from-literal=database="..." \
  --from-literal=username="..." \
  --from-literal=password="..." \
  --namespace=anytrade \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart pods to pick up new secret
kubectl rollout restart deployment/anytrade-backend -n anytrade
```

## Production Checklist

Before first deployment:

- [ ] PostgreSQL database created
- [ ] GitHub secrets configured in `prod` environment
- [ ] Domain DNS configured (api.anytrade.com → VKE LoadBalancer)
- [ ] VKE kubeconfig not expired
- [ ] Ingress Nginx installed
- [ ] Cert-manager installed with Let's Encrypt ClusterIssuer

After deployment:

- [ ] Pods running: `kubectl get pods -n anytrade`
- [ ] Ingress configured: `kubectl get ingress -n anytrade`
- [ ] Certificate issued: `kubectl get certificate -n anytrade`
- [ ] Health endpoint: `curl https://api.anytrade.com/health`
- [ ] GraphQL playground: `https://api.anytrade.com/`

## Monitoring

```bash
# Watch deployment
kubectl get pods -n anytrade -w

# View logs
kubectl logs -n anytrade -l app=anytrade-backend -f

# Check HPA
kubectl get hpa -n anytrade

# View events
kubectl get events -n anytrade --sort-by='.lastTimestamp'

# Check resource usage
kubectl top pods -n anytrade
```

## Rollback

```bash
# Automatic rollback (if deployment fails)
# Helm --atomic flag ensures automatic rollback

# Manual rollback
helm rollback anytrade-backend -n anytrade

# Rollback to specific revision
helm history anytrade-backend -n anytrade
helm rollback anytrade-backend <revision> -n anytrade
```

## Summary

**What makes this 100% GitOps:**

1. ✅ **No manual commands** - Everything automated via Git push
2. ✅ **Environment-driven** - All config via environment variables
3. ✅ **Self-contained** - Binary handles its own migrations
4. ✅ **Declarative** - Kubernetes manifests define desired state
5. ✅ **Auditable** - All changes tracked in Git
6. ✅ **Reproducible** - Same result every time
7. ✅ **Rollback-able** - Easy to revert to previous state

**Developer Experience:**

- Push code → Automatic build → Automatic deploy → Zero-downtime update
- No SSH, no manual migration commands, no database scripts
- Just Git and GitHub Actions 🎉