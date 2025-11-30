# etcd Cluster Deployment

Production-ready etcd cluster for VolatiCloud distributed monitoring coordination.

## Overview

This deployment creates a 3-node etcd cluster using the Bitnami Helm chart in a dedicated `etcd-system` namespace.

**Key Features:**

- 3-node cluster for high availability
- Persistent storage (8Gi per node)
- Pod anti-affinity (spread across nodes)
- Pod Disruption Budget (minimum 2 available)
- Automated health checks
- Prometheus metrics integration
- Automatic compaction and snapshots

## Architecture

```
┌─────────────────────────────────────────┐
│         etcd-system namespace           │
├─────────────────────────────────────────┤
│                                         │
│  ┌────────┐  ┌────────┐  ┌────────┐   │
│  │ etcd-0 │  │ etcd-1 │  │ etcd-2 │   │
│  └───┬────┘  └───┬────┘  └───┬────┘   │
│      │           │           │         │
│  ┌───▼───────────▼───────────▼───┐    │
│  │   etcd-headless Service       │    │
│  │   (internal cluster comm)     │    │
│  └───────────────────────────────┘    │
│                                         │
│  ┌───────────────────────────────┐    │
│  │      etcd Service             │    │
│  │   (client connections)        │    │
│  │   ClusterIP: 2379             │    │
│  └───────────────────────────────┘    │
│                                         │
│  ┌───────────────────────────────┐    │
│  │   Persistent Volumes (3x 8Gi) │    │
│  └───────────────────────────────┘    │
└─────────────────────────────────────────┘
```

## Connection Information

### From Backend Pods (volaticloud namespace)

Configure backend to connect to etcd cluster:

```yaml
env:
  - name: VOLATICLOUD_ETCD_ENDPOINTS
    value: "etcd.etcd-system.svc.cluster.local:2379"
```

**Full DNS:**

- Client endpoint: `etcd.etcd-system.svc.cluster.local:2379`
- Headless service: `etcd-headless.etcd-system.svc.cluster.local:2379`
- Individual pods:
  - `etcd-0.etcd-headless.etcd-system.svc.cluster.local:2379`
  - `etcd-1.etcd-headless.etcd-system.svc.cluster.local:2379`
  - `etcd-2.etcd-headless.etcd-system.svc.cluster.local:2379`

## Deployment

### Automated (GitOps)

Push changes to `main` branch:

```bash
git add deployments/etcd/
git commit -m "feat: deploy etcd cluster"
git push origin main
```

GitHub Actions will automatically deploy to VKE.

### Manual Deployment

```bash
# Add Bitnami repo
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Deploy
helm upgrade --install etcd bitnami/etcd \
  --namespace etcd-system \
  --create-namespace \
  -f deployments/etcd/values.yaml \
  --wait \
  --timeout 10m
```

## Operations

### Check Cluster Health

```bash
# Get etcd pod
ETCD_POD=$(kubectl get pods -n etcd-system -l app.kubernetes.io/name=etcd -o jsonpath='{.items[0].metadata.name}')

# Check endpoint health
kubectl exec -n etcd-system $ETCD_POD -- etcdctl endpoint health \
  --cluster=true \
  --endpoints=etcd-0.etcd-headless.etcd-system.svc.cluster.local:2379,etcd-1.etcd-headless.etcd-system.svc.cluster.local:2379,etcd-2.etcd-headless.etcd-system.svc.cluster.local:2379

# Check member list
kubectl exec -n etcd-system $ETCD_POD -- etcdctl member list -w table

# Check cluster status
kubectl exec -n etcd-system $ETCD_POD -- etcdctl endpoint status \
  --cluster=true \
  --endpoints=etcd-0.etcd-headless.etcd-system.svc.cluster.local:2379,etcd-1.etcd-headless.etcd-system.svc.cluster.local:2379,etcd-2.etcd-headless.etcd-system.svc.cluster.local:2379 \
  -w table
```

### View Cluster Data

```bash
# List all keys
kubectl exec -n etcd-system $ETCD_POD -- etcdctl get "" --prefix --keys-only

# Get specific key
kubectl exec -n etcd-system $ETCD_POD -- etcdctl get /volaticloud/monitor/leader

# Watch for changes
kubectl exec -n etcd-system $ETCD_POD -- etcdctl watch /volaticloud/monitor/ --prefix
```

### Scaling

etcd requires careful scaling due to quorum requirements:

```bash
# Scale to 5 nodes (always use odd numbers)
kubectl scale statefulset etcd -n etcd-system --replicas=5

# Wait for new members to join
kubectl exec -n etcd-system etcd-0 -- etcdctl member list -w table
```

**Important:** Only scale to odd numbers (3, 5, 7) to maintain quorum.

### Backup and Restore

#### Create Snapshot

```bash
# Create snapshot
kubectl exec -n etcd-system etcd-0 -- etcdctl snapshot save /tmp/snapshot.db

# Copy snapshot locally
kubectl cp etcd-system/etcd-0:/tmp/snapshot.db ./etcd-snapshot-$(date +%Y%m%d-%H%M%S).db

# Verify snapshot
kubectl exec -n etcd-system etcd-0 -- etcdctl snapshot status /tmp/snapshot.db -w table
```

#### Restore from Snapshot

```bash
# Scale down to prevent writes
kubectl scale statefulset etcd -n etcd-system --replicas=0

# Upload snapshot
kubectl cp ./etcd-snapshot.db etcd-system/etcd-0:/tmp/snapshot.db

# Restore
kubectl exec -n etcd-system etcd-0 -- etcdctl snapshot restore /tmp/snapshot.db \
  --data-dir=/bitnami/etcd/data

# Scale back up
kubectl scale statefulset etcd -n etcd-system --replicas=3
```

### Rolling Updates

```bash
# Update values.yaml and apply
helm upgrade etcd bitnami/etcd \
  --namespace etcd-system \
  -f deployments/etcd/values.yaml \
  --wait

# Watch rollout
kubectl rollout status statefulset/etcd -n etcd-system
```

### Rollback

```bash
# View history
helm history etcd -n etcd-system

# Rollback to previous version
helm rollback etcd -n etcd-system

# Rollback to specific revision
helm rollback etcd 2 -n etcd-system
```

## Monitoring

### Metrics

Prometheus annotations are enabled. Metrics available at:

```
http://etcd.etcd-system.svc.cluster.local:2379/metrics
```

**Key Metrics:**

- `etcd_server_has_leader` - Leader election status
- `etcd_server_leader_changes_seen_total` - Leader changes
- `etcd_mvcc_db_total_size_in_bytes` - Database size
- `etcd_disk_backend_commit_duration_seconds` - Commit latency
- `etcd_network_peer_round_trip_time_seconds` - Network latency

### Logs

```bash
# View logs for all etcd pods
kubectl logs -n etcd-system -l app.kubernetes.io/name=etcd --tail=100 -f

# View logs for specific pod
kubectl logs -n etcd-system etcd-0 -f

# Get logs from crashed pod
kubectl logs -n etcd-system etcd-0 --previous
```

### Events

```bash
# Recent events
kubectl get events -n etcd-system --sort-by='.lastTimestamp'

# Watch events
kubectl get events -n etcd-system --watch
```

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl describe pod etcd-0 -n etcd-system

# Check PVC
kubectl get pvc -n etcd-system
kubectl describe pvc data-etcd-0 -n etcd-system

# Check for image pull issues
kubectl get pods -n etcd-system -o jsonpath='{.items[*].status.containerStatuses[*].state}'
```

### Split-Brain / No Leader

```bash
# Check leader status
kubectl exec -n etcd-system etcd-0 -- etcdctl endpoint status --cluster=true -w table

# If no leader, restart pods one by one
kubectl delete pod etcd-0 -n etcd-system
# Wait for pod to be ready before proceeding to next
kubectl delete pod etcd-1 -n etcd-system
kubectl delete pod etcd-2 -n etcd-system
```

### High Disk Usage

```bash
# Check database size
kubectl exec -n etcd-system etcd-0 -- etcdctl endpoint status -w table

# Compact old revisions
REV=$(kubectl exec -n etcd-system etcd-0 -- etcdctl endpoint status -w json | jq -r '.[0].Status.header.revision')
kubectl exec -n etcd-system etcd-0 -- etcdctl compact $REV

# Defragment
kubectl exec -n etcd-system etcd-0 -- etcdctl defrag
```

### Connection Refused from Backend

```bash
# Test connectivity from backend pod
BACKEND_POD=$(kubectl get pods -n volaticloud -l app=volaticloud-backend -o jsonpath='{.items[0].metadata.name}')

# Test DNS resolution
kubectl exec -n volaticloud $BACKEND_POD -- nslookup etcd.etcd-system.svc.cluster.local

# Test port connectivity
kubectl exec -n volaticloud $BACKEND_POD -- nc -zv etcd.etcd-system.svc.cluster.local 2379

# Check etcd service
kubectl get svc -n etcd-system etcd
```

## Security

### RBAC

Bitnami chart creates necessary ServiceAccounts and RoleBindings automatically.

### Network Policies

To restrict access to etcd (optional):

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: etcd-network-policy
  namespace: etcd-system
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: etcd
  policyTypes:
    - Ingress
  ingress:
    # Allow from volaticloud namespace
    - from:
        - namespaceSelector:
            matchLabels:
              name: volaticloud
      ports:
        - protocol: TCP
          port: 2379
    # Allow peer communication
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: etcd
      ports:
        - protocol: TCP
          port: 2380
```

## Configuration

### values.yaml Structure

See `values.yaml` for full configuration. Key sections:

- **image**: Custom registry and tag
- **replicaCount**: Number of etcd nodes (3)
- **persistence**: Storage configuration (8Gi per node)
- **resources**: CPU/memory limits
- **affinity**: Pod anti-affinity rules
- **pdb**: Disruption budget (min 2 available)
- **metrics**: Prometheus integration
- **disasterRecovery**: Automated snapshots

### Update Configuration

1. Edit `deployments/etcd/values.yaml`
2. Commit and push to trigger GitOps deployment
3. Or apply manually: `helm upgrade etcd bitnami/etcd -f deployments/etcd/values.yaml -n etcd-system`

## Integration with Backend

After etcd is deployed, update backend deployment to enable distributed monitoring:

```yaml
# deployments/backend/values.yaml
deployments:
  volaticloud-backend:
    containers:
      - name: volaticloud
        env:
          - name: VOLATICLOUD_ETCD_ENDPOINTS
            value: "etcd.etcd-system.svc.cluster.local:2379"
```

This enables leader election for bot monitoring across multiple backend instances.

## References

- [Bitnami etcd Chart](https://github.com/bitnami/charts/tree/main/bitnami/etcd)
- [etcd Documentation](https://etcd.io/docs/latest/)
- [etcd Operations Guide](https://etcd.io/docs/latest/op-guide/)
- [Kubernetes StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
