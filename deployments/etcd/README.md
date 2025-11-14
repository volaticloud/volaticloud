# etcd Cluster Deployment

Production-ready etcd cluster for AnyTrade distributed monitoring.

## Overview

This deployment creates a 3-node etcd cluster using the Bitnami Helm chart with:

- **High Availability**: 3 replicas with pod anti-affinity
- **Persistence**: 8Gi persistent storage per node
- **Metrics**: Prometheus-compatible metrics endpoint
- **Pod Disruption Budget**: Ensures minimum 2 nodes available during updates

## Architecture

```
┌─────────────────────────────────────────────┐
│         AnyTrade Backend (N replicas)        │
│                                             │
│  Each instance connects to etcd cluster     │
│  for distributed coordination               │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│           etcd Cluster (3 nodes)            │
│                                             │
│  etcd-0  ◄──────┬──────► etcd-1            │
│    │            │            │              │
│    └────────────┴────────────┴─► etcd-2    │
│                                             │
│  Service: etcd.anytrade.svc.cluster.local  │
│  Port: 2379 (client), 2380 (peer)          │
└─────────────────────────────────────────────┘
```

## Deployment

### Automatic via GitHub Actions

Push changes to `main` branch:
```bash
git add deployments/etcd/
git commit -m "deploy: etcd cluster"
git push
```

### Manual via kubectl + Helm

1. **Add Bitnami repository:**
   ```bash
   helm repo add bitnami https://charts.bitnami.com/bitnami
   helm repo update
   ```

2. **Deploy etcd cluster:**
   ```bash
   helm upgrade --install etcd bitnami/etcd \
     --namespace anytrade \
     --create-namespace \
     -f deployments/etcd/values.yaml \
     --wait
   ```

3. **Verify deployment:**
   ```bash
   kubectl get pods -n anytrade -l app.kubernetes.io/name=etcd
   kubectl exec -n anytrade etcd-0 -- etcdctl \
     --endpoints=http://etcd.anytrade.svc.cluster.local:2379 \
     endpoint health
   ```

## Connecting Backend to etcd

Once etcd is deployed, update the backend deployment to enable distributed mode:

**Update `deployments/backend/values.yaml`:**
```yaml
env:
  - name: ANYTRADE_HOST
    value: "0.0.0.0"
  - name: ANYTRADE_PORT
    value: "8080"
  - name: ANYTRADE_MONITOR_INTERVAL
    value: "30s"
  - name: ANYTRADE_ETCD_ENDPOINTS
    value: "etcd-0.etcd-headless.anytrade.svc.cluster.local:2379,etcd-1.etcd-headless.anytrade.svc.cluster.local:2379,etcd-2.etcd-headless.anytrade.svc.cluster.local:2379"
```

## Monitoring

### Check Cluster Health

```bash
# Health check
kubectl exec -n anytrade etcd-0 -- etcdctl \
  --endpoints=http://etcd.anytrade.svc.cluster.local:2379 \
  endpoint health

# Cluster status
kubectl exec -n anytrade etcd-0 -- etcdctl \
  --endpoints=http://etcd.anytrade.svc.cluster.local:2379 \
  endpoint status --cluster -w table

# Member list
kubectl exec -n anytrade etcd-0 -- etcdctl \
  --endpoints=http://etcd.anytrade.svc.cluster.local:2379 \
  member list -w table
```

### View Metrics

```bash
# Port-forward to access metrics
kubectl port-forward -n anytrade svc/etcd 2379:2379

# Access metrics at http://localhost:2379/metrics
curl http://localhost:2379/metrics
```

## Maintenance

### Scaling the Cluster

⚠️ **Important**: etcd requires an odd number of nodes (3, 5, 7, etc.)

```bash
# Update replicaCount in values.yaml
# Then apply:
helm upgrade etcd bitnami/etcd \
  --namespace anytrade \
  -f deployments/etcd/values.yaml
```

### Backup and Restore

**Create Snapshot:**
```bash
kubectl exec -n anytrade etcd-0 -- etcdctl \
  --endpoints=http://etcd.anytrade.svc.cluster.local:2379 \
  snapshot save /tmp/etcd-backup.db

kubectl cp anytrade/etcd-0:/tmp/etcd-backup.db ./etcd-backup-$(date +%Y%m%d).db
```

**Restore from Snapshot:**
```bash
# Upload snapshot to pod
kubectl cp ./etcd-backup.db anytrade/etcd-0:/tmp/etcd-restore.db

# Restore
kubectl exec -n anytrade etcd-0 -- etcdctl \
  snapshot restore /tmp/etcd-restore.db \
  --data-dir=/bitnami/etcd/data-new

# Restart etcd StatefulSet
kubectl rollout restart statefulset/etcd -n anytrade
```

### Uninstall

Via GitHub Actions:
```bash
gh workflow run deploy-etcd.yml -f action=uninstall
```

Via Helm:
```bash
helm uninstall etcd -n anytrade
```

## Configuration Reference

Key values in `values.yaml`:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of etcd nodes | `3` |
| `persistence.size` | Storage per node | `8Gi` |
| `resources.limits.cpu` | CPU limit per pod | `500m` |
| `resources.limits.memory` | Memory limit per pod | `512Mi` |
| `autoCompactionRetention` | Auto-compaction interval | `1h` |
| `metrics.enabled` | Enable Prometheus metrics | `true` |

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl describe pod -n anytrade -l app.kubernetes.io/name=etcd

# Check persistent volume claims
kubectl get pvc -n anytrade

# Check storage class
kubectl get sc
```

### Cluster Health Issues

```bash
# Check logs
kubectl logs -n anytrade etcd-0 --tail=100

# Check events
kubectl get events -n anytrade --sort-by='.lastTimestamp' | grep etcd

# Verify network connectivity between pods
kubectl exec -n anytrade etcd-0 -- ping etcd-1.etcd-headless.anytrade.svc.cluster.local
```

### Performance Issues

```bash
# Check disk I/O
kubectl exec -n anytrade etcd-0 -- df -h /bitnami/etcd/data

# Check compaction status
kubectl exec -n anytrade etcd-0 -- etcdctl \
  --endpoints=http://localhost:2379 \
  endpoint status -w table
```

## Resources

- [Bitnami etcd Helm Chart](https://github.com/bitnami/charts/tree/main/bitnami/etcd)
- [etcd Official Documentation](https://etcd.io/docs/)
- [etcd Operations Guide](https://etcd.io/docs/v3.5/op-guide/)