# Backend Deployment Runbook

## Overview

This runbook provides step-by-step procedures for deploying the VolatiCloud backend to Kubernetes using Helm and GitHub Actions.

## Prerequisites

- [x] VKE cluster running and accessible
- [x] `kubectl` configured with cluster credentials
- [x] Helm 3.x installed
- [x] GitHub repository access
- [x] Vultr managed PostgreSQL database provisioned
- [x] Keycloak instance deployed and configured

## Deployment Methods

### Method 1: Automated Deployment (GitHub Actions)

**Use Case**: Standard deployments, CI/CD pipeline

#### Steps

1. **Trigger Deployment**
   ```bash
   # Via GitHub CLI
   gh workflow run deploy-backend.yml

   # Or push to main branch (automatic trigger)
   git push origin main
   ```

2. **Monitor Deployment**
   ```bash
   # Watch workflow status
   gh run watch

   # View logs
   gh run view --log
   ```

3. **Verify Deployment**
   ```bash
   # Check pod status
   kubectl get pods -n volaticloud -l app=volaticloud-backend

   # Expected output:
   # NAME                                   READY   STATUS    RESTARTS   AGE
   # volaticloud-backend-5f7d8c9b6d-abc12   1/1     Running   0          2m
   # volaticloud-backend-5f7d8c9b6d-def34   1/1     Running   0          2m
   ```

4. **Verify Health**
   ```bash
   curl https://api.volaticloud.com/health
   # Expected: {"status":"ok"}
   ```

**Rollback**: GitHub Actions automatically rolls back on failure (using `--atomic` flag)

---

### Method 2: Manual Helm Deployment

**Use Case**: Emergency deployments, hotfixes, testing

#### Steps

1. **Set Up Environment**
   ```bash
   # Export required variables
   export NAMESPACE=volaticloud
   export RELEASE_NAME=volaticloud-backend
   export IMAGE_TAG=main-$(git rev-parse --short HEAD)
   ```

2. **Add Helm Repository**
   ```bash
   helm repo add nixys https://registry.nixys.io/chartrepo/public
   helm repo update
   ```

3. **Validate Configuration**
   ```bash
   # Dry-run to validate
   helm template $RELEASE_NAME nixys/nxs-universal-chart \
     -f deployments/backend/values.yaml \
     --set image.tag=$IMAGE_TAG \
     --namespace $NAMESPACE \
     --dry-run --debug
   ```

4. **Create Namespace (if needed)**
   ```bash
   kubectl create namespace $NAMESPACE
   ```

5. **Create Database Secret**
   ```bash
   kubectl create secret generic volaticloud-db-secret \
     --namespace=$NAMESPACE \
     --from-literal=host=postgres.volaticloud.com:5432 \
     --from-literal=database=volaticloud \
     --from-literal=username=volaticloud \
     --from-literal=password='<PASSWORD>' \
     --dry-run=client -o yaml | kubectl apply -f -
   ```

6. **Deploy with Helm**
   ```bash
   helm upgrade --install $RELEASE_NAME nixys/nxs-universal-chart \
     --namespace $NAMESPACE \
     --create-namespace \
     -f deployments/backend/values.yaml \
     --set image.tag=$IMAGE_TAG \
     --wait \
     --timeout 10m \
     --atomic
   ```

7. **Monitor Rollout**
   ```bash
   kubectl rollout status deployment/$RELEASE_NAME -n $NAMESPACE
   ```

8. **Verify Deployment**
   ```bash
   # Check all resources
   kubectl get all -n $NAMESPACE -l app=volaticloud-backend

   # Check logs
   kubectl logs -n $NAMESPACE -l app=volaticloud-backend --tail=50
   ```

---

## Database Migrations

**Important**: Migrations run automatically on server startup. No manual migration step needed.

### How It Works

1. Server starts
2. Database connection established
3. ENT auto-migration executes: `client.Schema.Create(ctx)`
4. HTTP server starts (waits for migration to complete)
5. Readiness probe succeeds
6. Traffic routes to pod

### Migration Behavior

- **Idempotent**: Safe to run multiple times
- **Automatic Retry**: Kubernetes automatically retries failed pods
- **Zero-Downtime**: Old pods continue serving traffic during migration
- **Rollback Safe**: Migration failures prevent pod from becoming ready

### Monitoring Migrations

```bash
# Watch pod logs during startup
kubectl logs -f -n volaticloud -l app=volaticloud-backend | grep -i migration

# Check for migration errors
kubectl logs -n volaticloud -l app=volaticloud-backend | grep -i "failed creating schema"
```

---

## Health Checks

### Liveness Probe
- **Endpoint**: `/health`
- **Initial Delay**: 10s
- **Period**: 10s
- **Failure Threshold**: 3

### Readiness Probe
- **Endpoint**: `/health`
- **Initial Delay**: 5s
- **Period**: 5s
- **Failure Threshold**: 3

### Manual Health Check
```bash
# Internal (from within cluster)
kubectl run -it --rm curl-test --image=curlimages/curl --restart=Never -- \
  curl http://volaticloud-backend:8080/health

# External (via ingress)
curl https://api.volaticloud.com/health
```

---

## Scaling

### Horizontal Pod Autoscaler (HPA)

**Configuration** (from `values.yaml`):
- Min replicas: 2
- Max replicas: 10
- CPU target: 70%
- Memory target: 80%

### Manual Scaling
```bash
# Scale to specific replica count
kubectl scale deployment volaticloud-backend -n volaticloud --replicas=5

# Verify scaling
kubectl get hpa -n volaticloud
```

### Disable Autoscaling (temporary)
```bash
kubectl delete hpa volaticloud-backend -n volaticloud
```

---

## Configuration Updates

### Update Environment Variables

1. **Edit values.yaml**
   ```yaml
   # deployments/backend/values.yaml
   deployment:
     env:
       - name: VOLATICLOUD_MONITOR_INTERVAL
         value: "60s"
   ```

2. **Apply Changes**
   ```bash
   helm upgrade volaticloud-backend nixys/nxs-universal-chart \
     -f deployments/backend/values.yaml \
     --namespace volaticloud
   ```

3. **Verify Rollout**
   ```bash
   kubectl rollout status deployment/volaticloud-backend -n volaticloud
   ```

### Update Database Credentials

1. **Update Secret**
   ```bash
   kubectl create secret generic volaticloud-db-secret \
     --namespace=volaticloud \
     --from-literal=password='<NEW_PASSWORD>' \
     --dry-run=client -o yaml | kubectl apply -f -
   ```

2. **Restart Pods** (to pick up new secret)
   ```bash
   kubectl rollout restart deployment/volaticloud-backend -n volaticloud
   ```

---

## Rollback Procedures

### Automatic Rollback

GitHub Actions and Helm (`--atomic` flag) automatically rollback on failure.

### Manual Rollback

#### List Releases
```bash
helm history volaticloud-backend -n volaticloud
```

#### Rollback to Previous Version
```bash
helm rollback volaticloud-backend -n volaticloud
```

#### Rollback to Specific Version
```bash
helm rollback volaticloud-backend <REVISION> -n volaticloud
```

#### Verify Rollback
```bash
kubectl get pods -n volaticloud -l app=volaticloud-backend
kubectl logs -n volaticloud -l app=volaticloud-backend --tail=50
```

---

## Troubleshooting

### Pods Not Starting

**Check pod status**:
```bash
kubectl get pods -n volaticloud -l app=volaticloud-backend
```

**Common issues**:

1. **ImagePullBackOff**
   ```bash
   # Check image exists
   kubectl describe pod <POD_NAME> -n volaticloud | grep -A 5 Events

   # Verify image tag
   helm get values volaticloud-backend -n volaticloud | grep tag
   ```

2. **CrashLoopBackOff**
   ```bash
   # Check logs
   kubectl logs <POD_NAME> -n volaticloud --previous

   # Common causes:
   # - Database connection failure
   # - Migration failure
   # - Missing Keycloak configuration
   ```

3. **Pending**
   ```bash
   # Check resource availability
   kubectl describe pod <POD_NAME> -n volaticloud | grep -A 10 Events

   # Check node resources
   kubectl top nodes
   ```

### Database Connection Issues

```bash
# Test database connectivity from pod
kubectl run -it --rm psql-test --image=postgres:14 --restart=Never -- \
  psql -h <DB_HOST> -U volaticloud -d volaticloud

# Check database secret
kubectl get secret volaticloud-db-secret -n volaticloud -o jsonpath='{.data}' | jq
```

### Ingress Not Working

```bash
# Check ingress status
kubectl get ingress -n volaticloud

# Check cert-manager certificate
kubectl get certificate -n volaticloud

# Check ingress-nginx logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --tail=50
```

---

## Monitoring

### View Logs
```bash
# Real-time logs
kubectl logs -f -n volaticloud -l app=volaticloud-backend

# Recent logs
kubectl logs -n volaticloud -l app=volaticloud-backend --tail=100

# Logs from specific pod
kubectl logs -n volaticloud <POD_NAME>
```

### Check Events
```bash
kubectl get events -n volaticloud --sort-by='.lastTimestamp' | head -20
```

### Resource Usage
```bash
# Pod resource usage
kubectl top pods -n volaticloud -l app=volaticloud-backend

# Node resource usage
kubectl top nodes
```

### HPA Status
```bash
kubectl get hpa -n volaticloud
kubectl describe hpa volaticloud-backend -n volaticloud
```

---

## Emergency Procedures

### Emergency Rollback

```bash
# Immediate rollback to previous version
helm rollback volaticloud-backend -n volaticloud --wait
```

### Scale Down (Emergency Stop)

```bash
# Scale to 0 replicas
kubectl scale deployment volaticloud-backend -n volaticloud --replicas=0

# Delete deployment (nuclear option)
kubectl delete deployment volaticloud-backend -n volaticloud
```

### Force Pod Restart

```bash
# Restart all pods
kubectl rollout restart deployment/volaticloud-backend -n volaticloud

# Delete specific pod (K8s will recreate)
kubectl delete pod <POD_NAME> -n volaticloud
```

---

## Post-Deployment Checklist

- [ ] Pods running (2+ replicas)
- [ ] Health endpoint responding
- [ ] GraphQL endpoint accessible
- [ ] Database migrations successful
- [ ] Logs clean (no errors)
- [ ] HPA active
- [ ] Ingress certificate valid
- [ ] Monitoring alerts configured

---

## Related Documentation

- [ADR-0007: Kubernetes Deployment Strategy](../adr/0007-kubernetes-deployment-strategy.md)
- [Deployment Guide](../../deployments/backend/README.md)
- [Troubleshooting Runbook](troubleshooting.md)
- [Recovery Runbook](recovery.md)

---

## Contacts

- **On-Call Engineer**: Check PagerDuty schedule
- **DevOps Team**: #devops Slack channel
- **Emergency**: Escalate to infrastructure team
