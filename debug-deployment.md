# Debug Backend Deployment Timeout

## Issue
Deployment timed out after 10 minutes. Pods never became ready.

## Commands to Debug

### 1. Check if pods exist
```bash
kubectl get pods -n anytrade
```

### 2. Describe the pod to see events
```bash
kubectl describe pod -n anytrade -l app=anytrade-backend
```

### 3. Check pod logs
```bash
kubectl logs -n anytrade -l app=anytrade-backend --tail=100
```

### 4. Check if image was pulled successfully
```bash
kubectl get pods -n anytrade -o jsonpath='{.items[*].status.containerStatuses[*].state}'
```

### 5. Test deployment without health checks
Temporarily remove health checks to see if app starts:

```bash
# Delete the failed release first
helm delete anytrade-backend -n anytrade || true

# Deploy without --wait to see what happens
helm upgrade --install anytrade-backend nixys/nxs-universal-chart \
  --namespace anytrade \
  --create-namespace \
  -f deployments/backend/values.yaml \
  --set deployments.anytrade-backend.containers[0].image=ghcr.io/diazoxide/anytrade:fd747f98470e5c32e6a36aeeaa4844cb117a4f89 \
  --timeout 1m
```

### 6. Check secrets
```bash
kubectl get secret anytrade-secrets -n anytrade -o yaml
```

### 7. Test Docker image locally
```bash
docker pull ghcr.io/diazoxide/anytrade:fd747f98470e5c32e6a36aeeaa4844cb117a4f89
docker run --rm ghcr.io/diazoxide/anytrade:fd747f98470e5c32e6a36aeeaa4844cb117a4f89 --help
```

## Likely Issues

### Issue 1: Missing ANYTRADE_ETCD_ENDPOINTS
The application expects `ANYTRADE_ETCD_ENDPOINTS` but it's not in values.yaml.

**Fix:** Add to values.yaml:
```yaml
env:
  - name: ANYTRADE_ETCD_ENDPOINTS
    value: ""  # Empty for single instance deployment
```

### Issue 2: Database Connection
Check if the database connection string is correct and accessible from the cluster.

### Issue 3: Health Check Too Aggressive
The readiness probe starts after only 5 seconds - may need more time for DB migration.

**Fix:** Increase `initialDelaySeconds`:
```yaml
readinessProbe:
  initialDelaySeconds: 30  # Was 5
  periodSeconds: 10  # Was 5
```

## Recommended Fix

Update values.yaml with:
1. Add ANYTRADE_ETCD_ENDPOINTS env var (empty string)
2. Increase readiness probe initial delay to 30s
3. Remove livenessProbe temporarily for debugging