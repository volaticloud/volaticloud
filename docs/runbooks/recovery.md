# Disaster Recovery Runbook

## Overview

This runbook provides procedures for recovering from catastrophic failures, data loss, or system-wide outages.

## Emergency Contacts

- **On-Call Engineer**: Check PagerDuty
- **Database Admin**: #database Slack channel
- **DevOps Lead**: Escalate via PagerDuty
- **CTO**: For business-critical incidents

---

## Database Recovery

### Scenario 1: Database Connection Lost

**Impact**: All API requests failing

#### Quick Recovery

```bash
# 1. Check database status (Vultr control panel)
# 2. Verify database is running
# 3. Check firewall rules allow VKE cluster

# 4. Test connectivity from cluster
kubectl run -it --rm psql-test --image=postgres:14 --restart=Never -- \
  psql -h <DB_HOST> -U volaticloud -d volaticloud -c "SELECT 1;"

# 5. If connectivity restored, pods will auto-recover
kubectl get pods -n volaticloud -w
```

#### Recovery Steps

1. **Verify Database Status**
   - Log into Vultr control panel
   - Check database cluster health
   - Verify no maintenance windows active

2. **Check Network Connectivity**

   ```bash
   # From within Kubernetes cluster
   kubectl run -it --rm netshoot --image=nicolaka/netshoot -- /bin/bash
   # Inside container:
   nslookup <DB_HOST>
   telnet <DB_HOST> 5432
   ```

3. **Verify Credentials**

   ```bash
   kubectl get secret volaticloud-db-secret -n volaticloud -o jsonpath='{.data}' | jq 'map_values(@base64d)'
   ```

4. **Restart Pods** (if needed)

   ```bash
   kubectl rollout restart deployment/volaticloud-backend -n volaticloud
   ```

**RTO**: 5-10 minutes
**RPO**: 0 (no data loss)

---

### Scenario 2: Database Corruption

**Impact**: Data integrity compromised

#### Assessment

```bash
# Connect to database
psql -h <DB_HOST> -U volaticloud -d volaticloud

# Check for corruption
SELECT * FROM pg_stat_database WHERE datname = 'volaticloud';

# Verify table integrity
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

#### Recovery Steps

1. **Stop All Write Operations**

   ```bash
   # Scale backend to 0
   kubectl scale deployment volaticloud-backend -n volaticloud --replicas=0
   ```

2. **Assess Damage**

   ```sql
   -- Check for missing tables
   SELECT tablename FROM pg_tables WHERE schemaname = 'public';

   -- Check row counts
   SELECT
     schemaname,
     relname,
     n_live_tup
   FROM pg_stat_user_tables
   ORDER BY n_live_tup DESC;
   ```

3. **Restore from Backup**

   ```bash
   # Via Vultr control panel:
   # 1. Navigate to database cluster
   # 2. Select "Backups" tab
   # 3. Choose most recent valid backup
   # 4. Click "Restore"
   # 5. Wait for restore to complete (15-30 minutes)
   ```

4. **Verify Restoration**

   ```bash
   # Test database connectivity
   psql -h <DB_HOST> -U volaticloud -d volaticloud -c "\dt"

   # Check data integrity
   psql -h <DB_HOST> -U volaticloud -d volaticloud -c "SELECT COUNT(*) FROM bots;"
   ```

5. **Restart Backend**

   ```bash
   kubectl scale deployment volaticloud-backend -n volaticloud --replicas=2
   kubectl rollout status deployment/volaticloud-backend -n volaticloud
   ```

**RTO**: 30-60 minutes
**RPO**: Depends on backup schedule (typically 24 hours max)

---

### Scenario 3: Complete Database Loss

**Impact**: Total system outage

#### Recovery Steps

1. **Create New Database Instance**

   ```bash
   # Via Vultr CLI or control panel
   # 1. Create new PostgreSQL cluster
   # 2. Note new hostname and credentials
   # 3. Update firewall rules for VKE cluster
   ```

2. **Update Kubernetes Secret**

   ```bash
   kubectl create secret generic volaticloud-db-secret \
     --namespace=volaticloud \
     --from-literal=host=<NEW_DB_HOST>:5432 \
     --from-literal=database=volaticloud \
     --from-literal=username=volaticloud \
     --from-literal=password='<NEW_PASSWORD>' \
     --dry-run=client -o yaml | kubectl apply -f -
   ```

3. **Deploy Backend** (migrations run automatically)

   ```bash
   kubectl rollout restart deployment/volaticloud-backend -n volaticloud
   ```

4. **Restore Data from Backup**

   ```bash
   # If backup available:
   pg_restore -h <NEW_DB_HOST> -U volaticloud -d volaticloud /path/to/backup.dump

   # Or restore from Vultr backup (if available)
   ```

5. **Verify System Health**

   ```bash
   curl https://console.volaticloud.com/gateway/v1/health
   kubectl logs -n volaticloud -l app=volaticloud-backend --tail=50
   ```

**RTO**: 1-2 hours
**RPO**: Up to 24 hours (last backup)

---

## Kubernetes Cluster Failure

### Scenario 1: Node Failure

**Impact**: Some pods unavailable

#### Recovery

Kubernetes automatically handles node failures:

1. **Verify Pod Rescheduling**

   ```bash
   kubectl get pods -n volaticloud -o wide
   # Pods should be rescheduled to healthy nodes automatically
   ```

2. **Monitor Events**

   ```bash
   kubectl get events -n volaticloud --sort-by='.lastTimestamp'
   ```

3. **Manual Intervention** (if needed)

   ```bash
   # Cordon failed node (if still in cluster)
   kubectl cordon <NODE_NAME>

   # Drain node
   kubectl drain <NODE_NAME> --ignore-daemonsets --delete-emptydir-data

   # Delete node (if unrecoverable)
   kubectl delete node <NODE_NAME>
   ```

**RTO**: 5-10 minutes (automatic)
**RPO**: 0 (no data loss)

---

### Scenario 2: Control Plane Failure

**Impact**: Cannot manage cluster, existing pods continue running

#### Recovery

1. **Contact Vultr Support**
   - VKE control plane is managed by Vultr
   - Open urgent support ticket
   - Provide cluster ID and error details

2. **Monitor Application**

   ```bash
   # Existing pods continue serving traffic
   curl https://console.volaticloud.com/gateway/v1/health

   # But cannot make changes until control plane restored
   ```

3. **Temporary Workaround**
   - Applications continue running
   - No deployments or scaling possible
   - Wait for Vultr to restore control plane

**RTO**: Depends on Vultr SLA (typically < 4 hours)
**RPO**: 0 (no data loss)

---

### Scenario 3: Complete Cluster Loss

**Impact**: Total system outage

#### Recovery Steps

1. **Create New VKE Cluster**

   ```bash
   # Via Vultr control panel:
   # 1. Create new Kubernetes cluster
   # 2. Same region as database
   # 3. Download kubeconfig
   ```

2. **Configure kubectl**

   ```bash
   export KUBECONFIG=/path/to/new-kubeconfig.yaml
   kubectl cluster-info
   ```

3. **Install Prerequisites**

   ```bash
   # Ingress-nginx
   helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
   helm install ingress-nginx ingress-nginx/ingress-nginx \
     --namespace ingress-nginx \
     --create-namespace

   # Cert-manager
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
   ```

4. **Deploy Backend**

   ```bash
   # Create namespace and secrets
   kubectl create namespace volaticloud

   # Create database secret
   kubectl create secret generic volaticloud-db-secret \
     --namespace=volaticloud \
     --from-literal=host=<DB_HOST>:5432 \
     --from-literal=database=volaticloud \
     --from-literal=username=volaticloud \
     --from-literal=password='<PASSWORD>'

   # Deploy with Helm
   helm upgrade --install volaticloud-backend nixys/nxs-universal-chart \
     --namespace volaticloud \
     -f deployments/backend/values.yaml \
     --wait
   ```

5. **Update DNS**

   ```bash
   # Get new ingress IP
   kubectl get svc -n ingress-nginx ingress-nginx-controller

   # Update DNS A record for console.volaticloud.com
   # to point to new LoadBalancer IP
   # Note: Backend is internal-only, no external DNS needed (see ADR-0019)
   ```

6. **Verify Deployment**

   ```bash
   kubectl get all -n volaticloud
   curl https://console.volaticloud.com/gateway/v1/health
   ```

**RTO**: 2-4 hours
**RPO**: 0 (database persisted separately)

---

## Keycloak Failure

### Scenario 1: Keycloak Unavailable

**Impact**: No authentication, API returns 401 errors

#### Quick Recovery

```bash
# Check Keycloak status
curl https://keycloak.volaticloud.com/auth/

# Check Keycloak pods (if self-hosted)
kubectl get pods -n keycloak
kubectl logs -n keycloak -l app=keycloak
```

#### Recovery Steps

1. **Restart Keycloak**

   ```bash
   # If containerized
   docker restart volaticloud-keycloak

   # If on Kubernetes
   kubectl rollout restart deployment/keycloak -n keycloak
   ```

2. **Verify Health**

   ```bash
   curl https://keycloak.volaticloud.com/auth/realms/volaticloud/.well-known/openid-configuration
   ```

3. **Test Authentication**

   ```bash
   # Get access token
   curl -X POST https://keycloak.volaticloud.com/auth/realms/volaticloud/protocol/openid-connect/token \
     -d "client_id=volaticloud-api" \
     -d "client_secret=<SECRET>" \
     -d "grant_type=client_credentials"
   ```

**RTO**: 5-10 minutes
**RPO**: 0 (user data in database)

---

### Scenario 2: Keycloak Data Loss

**Impact**: All users and permissions lost

#### Recovery Steps

1. **Restore Keycloak from Backup**

   ```bash
   # If using Keycloak database backup
   pg_restore -h <KC_DB_HOST> -U keycloak -d keycloak /path/to/keycloak-backup.dump
   ```

2. **Reconfigure Realm**

   ```bash
   # Import realm configuration
   /opt/keycloak/bin/kc.sh import --file /path/to/volaticloud-realm.json
   ```

3. **Re-register UMA Resources**

   ```bash
   # Backend will automatically re-register resources on next create/update
   # Or trigger manual sync via GraphQL mutation
   ```

**RTO**: 1-2 hours
**RPO**: Depends on backup schedule

---

## Data Recovery Scenarios

### Lost Bot Configurations

**Impact**: Bots cannot start

#### Recovery

1. **Check Database**

   ```sql
   SELECT id, name, status FROM bots;
   ```

2. **Restore from Backup** (if recent backup exists)

   ```bash
   # Restore specific table
   pg_restore -h <DB_HOST> -U volaticloud -d volaticloud -t bots /path/to/backup.dump
   ```

3. **Manual Recreation** (if no backup)
   - Users must recreate bot configurations
   - Document manual steps in user guide

---

### Lost Strategy Versions

**Impact**: Historical strategies unavailable

#### Recovery

1. **Check Git History** (if strategies committed)

   ```bash
   git log --all --grep="<STRATEGY_NAME>"
   ```

2. **Restore from Database Backup**

   ```bash
   pg_restore -h <DB_HOST> -U volaticloud -d volaticloud -t strategies /path/to/backup.dump
   ```

---

## System-Wide Outage

### Complete Platform Failure

**Impact**: Total system unavailable

#### Triage Checklist

- [ ] Database accessible?
- [ ] Kubernetes cluster healthy?
- [ ] Keycloak accessible?
- [ ] Network connectivity?
- [ ] DNS resolution working?
- [ ] TLS certificates valid?

#### Recovery Priority

1. **Database** - Critical (all data)
2. **Kubernetes** - Critical (application runtime)
3. **Keycloak** - High (authentication)
4. **Ingress** - High (external access)
5. **Monitoring** - Medium (observability)

#### Recovery Steps

Follow this order:

1. [Database Recovery](#database-recovery)
2. [Kubernetes Recovery](#kubernetes-cluster-failure)
3. [Keycloak Recovery](#keycloak-failure)
4. [Verify All Services](#post-recovery-verification)

---

## Post-Recovery Verification

### Health Check Checklist

```bash
# 1. Database connectivity
psql -h <DB_HOST> -U volaticloud -d volaticloud -c "SELECT COUNT(*) FROM bots;"

# 2. Backend pods running
kubectl get pods -n volaticloud -l app=volaticloud-backend

# 3. Health endpoint
curl https://console.volaticloud.com/gateway/v1/health

# 4. GraphQL endpoint
curl -X POST https://console.volaticloud.com/gateway/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'

# 5. Keycloak
curl https://keycloak.volaticloud.com/auth/realms/volaticloud

# 6. Check logs for errors
kubectl logs -n volaticloud -l app=volaticloud-backend --tail=100
```

### Functional Testing

```bash
# Test bot creation
# Test backtest execution
# Test strategy creation
# Test user authentication
```

---

## Backup Procedures

### Database Backups

**Automated** (Vultr managed):

- Daily automatic backups
- 7-day retention
- Point-in-time recovery available

**Manual Backup**:

```bash
pg_dump -h <DB_HOST> -U volaticloud -d volaticloud \
  -Fc -f "volaticloud-backup-$(date +%Y%m%d).dump"
```

### Configuration Backups

```bash
# Kubernetes resources
kubectl get all -n volaticloud -o yaml > k8s-backup.yaml

# Helm values
helm get values volaticloud-backend -n volaticloud > values-backup.yaml

# Secrets (encrypted!)
kubectl get secrets -n volaticloud -o yaml > secrets-backup.yaml
```

### Keycloak Backups

```bash
# Export realm
/opt/keycloak/bin/kc.sh export --realm volaticloud --file volaticloud-realm.json

# Backup Keycloak database
pg_dump -h <KC_DB_HOST> -U keycloak -d keycloak -Fc -f keycloak-backup.dump
```

---

## Incident Response

### Communication Plan

1. **Detect**: Monitoring alerts → PagerDuty
2. **Assess**: On-call engineer triages severity
3. **Communicate**:
   - Post in #incidents Slack channel
   - Update status page
   - Notify stakeholders
4. **Resolve**: Follow recovery runbook
5. **Post-Mortem**: Document incident and improvements

### Severity Levels

- **P0 (Critical)**: Complete system outage, data loss
- **P1 (High)**: Major functionality impaired, workaround exists
- **P2 (Medium)**: Minor functionality impaired
- **P3 (Low)**: No user impact

---

## Related Documentation

- [Deployment Runbook](deployment.md)
- [Troubleshooting Runbook](troubleshooting.md)
- [Monitoring Guide](../monitoring/)
- [Backup Strategy](../operations/backups.md)

---

## Post-Incident Review

After recovery:

1. Document timeline of events
2. Identify root cause
3. Update runbooks with lessons learned
4. Implement preventive measures
5. Schedule post-mortem meeting
6. Update disaster recovery plan
