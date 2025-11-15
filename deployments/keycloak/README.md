# Keycloak Deployment for AnyTrade

This directory contains all Kubernetes manifests for deploying Keycloak via the Keycloak Operator on VKE (Vultr Kubernetes Engine).

## Overview

Keycloak provides authentication and authorization for the AnyTrade platform using OpenID Connect (OIDC) and OAuth 2.0.

**Components**:
- **Keycloak Operator**: Manages Keycloak instances via OLM
- **Keycloak Instance**: 2-replica high-availability setup
- **Managed PostgreSQL**: Uses VKE managed database (not deployed here)
- **Realm**: `anytrade` realm with roles and client configurations
- **OIDC Clients**:
  - `anytrade-dashboard`: Public client for React SPA
  - `anytrade-api`: Bearer-only client for GraphQL API

## Prerequisites

1. **OLM Installed**: Operator Lifecycle Manager must be installed (see `deployments/olm/`)
2. **Managed PostgreSQL**: Database must be provisioned on Vultr
3. **GitHub Secrets Configured**:
   - `VKE_KUBECONFIG`: Base64-encoded kubeconfig for VKE cluster
   - `KEYCLOAK_DB_HOST`: PostgreSQL hostname and port (e.g., `postgres.vultr.internal:5432`)
   - `KEYCLOAK_DB_USERNAME`: Database username (e.g., `keycloak`)
   - `KEYCLOAK_DB_PASSWORD`: Database password
   - `KEYCLOAK_HOSTNAME`: Public hostname for Keycloak (e.g., `auth.volaticloud.com`)
   - `ANYTRADE_URL`: AnyTrade application URL (e.g., `https://volaticloud.com`)

## Files

```
deployments/keycloak/
├── namespace.yaml                    # Keycloak namespace
├── operator-subscription.yaml        # OLM subscription for Keycloak operator
├── keycloak-instance.yaml           # Keycloak CR (2 replicas, managed DB)
├── keycloak-realm.yaml              # AnyTrade realm configuration
├── keycloak-client.yaml             # OIDC clients (dashboard + API)
└── README.md                        # This file
```

## Deployment

### Automatic (GitOps - Recommended)

Keycloak is automatically deployed when you commit changes to this directory:

```bash
# Make changes to Keycloak configuration
git add deployments/keycloak/
git commit -m "feat: update Keycloak configuration"
git push origin main

# GitHub Actions automatically deploys
```

The workflow `.github/workflows/deploy-keycloak.yaml` will:
1. Validate all manifests
2. Install OLM (if not present)
3. Create namespace and secrets
4. Install Keycloak operator
5. Deploy Keycloak instance
6. Configure realm and clients

### Manual Deployment

If you need to deploy manually:

```bash
# Configure kubectl
export KUBECONFIG=/path/to/your/kubeconfig

# 1. Install OLM (if not already installed)
cd deployments/olm
./install.sh

# 2. Create namespace
kubectl apply -f deployments/keycloak/namespace.yaml

# 3. Create database secret
kubectl create secret generic keycloak-db-secret \
  --from-literal=username=keycloak \
  --from-literal=password=YOUR_PASSWORD \
  --namespace=keycloak

# 4. Install Keycloak operator
kubectl apply -f deployments/keycloak/operator-subscription.yaml

# Wait for operator to be ready
kubectl wait --for=condition=Ready pod \
  -l control-plane=controller-manager \
  -n keycloak --timeout=300s

# 5. Deploy Keycloak instance (substitute environment variables)
export KEYCLOAK_DB_HOST="postgres.vultr.internal:5432"
export KEYCLOAK_HOSTNAME="auth.volaticloud.com"
envsubst < deployments/keycloak/keycloak-instance.yaml | kubectl apply -f -

# Wait for Keycloak to be ready
kubectl wait --for=condition=Ready keycloak/anytrade-keycloak \
  -n keycloak --timeout=600s

# 6. Configure realm
kubectl apply -f deployments/keycloak/keycloak-realm.yaml

# 7. Configure OIDC clients (substitute environment variables)
export ANYTRADE_URL="https://volaticloud.com"
envsubst < deployments/keycloak/keycloak-client.yaml | kubectl apply -f -
```

## Configuration

### Database Connection

Keycloak uses a managed PostgreSQL database on Vultr. Configuration is in `keycloak-instance.yaml`:

```yaml
db:
  vendor: postgres
  host: ${KEYCLOAK_DB_HOST}  # From GitHub Secret
  database: keycloak
  port: 5432
  usernameSecret:
    name: keycloak-db-secret
    key: username
  passwordSecret:
    name: keycloak-db-secret
    key: password
```

**Important**: Ensure the database `keycloak` exists before deploying:

```sql
CREATE DATABASE keycloak;
GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;
```

### Realm Configuration

The `anytrade` realm includes:

**Roles**:
- `admin`: Full access to all operations
- `trader`: Manage bots, strategies, and backtests
- `viewer`: Read-only access
- `user`: Standard user (default role)

**Security Settings**:
- Brute force protection enabled
- Email login enabled
- Remember me enabled
- Token lifespan: 5 minutes (access), 30 minutes (SSO idle)

### OIDC Clients

#### anytrade-dashboard (Public Client)
- **Type**: Public (for React SPA)
- **Protocol**: OpenID Connect
- **Flow**: Authorization Code with PKCE
- **Redirect URIs**: `${ANYTRADE_URL}/*`, `http://localhost:5173/*`
- **Scopes**: profile, email, roles

#### anytrade-api (Bearer-Only Client)
- **Type**: Bearer-only (for GraphQL API)
- **Protocol**: OpenID Connect
- **Purpose**: Token validation only
- **Scopes**: profile, email, roles

## Verification

### Check Deployment Status

```bash
# Check all Keycloak resources
kubectl get all -n keycloak

# Check Keycloak CR status
kubectl get keycloak -n keycloak

# Check operator status
kubectl get csv -n keycloak

# Check logs
kubectl logs -n keycloak deployment/keycloak-operator
kubectl logs -n keycloak -l app=keycloak
```

### Access Keycloak

1. **Admin Console**:
   ```
   https://${KEYCLOAK_HOSTNAME}/auth/admin
   ```

2. **Realm OIDC Configuration**:
   ```
   https://${KEYCLOAK_HOSTNAME}/auth/realms/anytrade/.well-known/openid-configuration
   ```

3. **Get admin credentials**:
   ```bash
   kubectl get secret anytrade-keycloak-initial-admin \
     -n keycloak -o jsonpath='{.data.username}' | base64 -d
   kubectl get secret anytrade-keycloak-initial-admin \
     -n keycloak -o jsonpath='{.data.password}' | base64 -d
   ```

## Troubleshooting

### Operator Not Installing

```bash
# Check subscription status
kubectl describe subscription keycloak-operator -n keycloak

# Check install plan
kubectl get installplan -n keycloak

# Check catalog source
kubectl get catalogsource -n olm
```

### Keycloak Instance Not Starting

```bash
# Check Keycloak CR status
kubectl describe keycloak anytrade-keycloak -n keycloak

# Check pod logs
kubectl logs -n keycloak -l app=keycloak --tail=100

# Check database connectivity
kubectl exec -it -n keycloak <pod-name> -- bash
psql -h ${KEYCLOAK_DB_HOST} -U keycloak -d keycloak
```

### Database Connection Issues

Common issues:
1. **Wrong hostname**: Verify `KEYCLOAK_DB_HOST` includes port
2. **Database doesn't exist**: Create `keycloak` database manually
3. **Credentials invalid**: Check `keycloak-db-secret`
4. **Firewall**: Ensure VKE cluster can reach managed PostgreSQL

### Realm/Client Not Importing

```bash
# Check KeycloakRealmImport status
kubectl get keycloakrealmimport -n keycloak
kubectl describe keycloakrealmimport anytrade-realm -n keycloak

# Force re-import
kubectl delete keycloakrealmimport anytrade-realm -n keycloak
kubectl apply -f deployments/keycloak/keycloak-realm.yaml
```

## Updating Configuration

### Update Realm Settings

1. Edit `keycloak-realm.yaml`
2. Commit and push (triggers automatic deployment)
3. Or apply manually: `kubectl apply -f keycloak-realm.yaml`

### Update Client Configuration

1. Edit `keycloak-client.yaml`
2. Commit and push (triggers automatic deployment)
3. Or apply manually:
   ```bash
   export ANYTRADE_URL="https://volaticloud.com"
   envsubst < keycloak-client.yaml | kubectl apply -f -
   ```

### Scale Keycloak Instances

```bash
# Edit keycloak-instance.yaml
spec:
  instances: 3  # Change from 2 to 3

# Apply
kubectl apply -f deployments/keycloak/keycloak-instance.yaml
```

## Backup and Recovery

### Backup Realm Configuration

```bash
# Export realm via Keycloak admin CLI
kubectl exec -it -n keycloak <keycloak-pod> -- bash
/opt/keycloak/bin/kc.sh export --realm anytrade --file /tmp/anytrade-realm.json
kubectl cp keycloak/<pod-name>:/tmp/anytrade-realm.json ./anytrade-realm-backup.json
```

### Restore from Backup

```bash
# Import realm
kubectl cp ./anytrade-realm-backup.json keycloak/<pod-name>:/tmp/realm.json
kubectl exec -it -n keycloak <pod-name> -- \
  /opt/keycloak/bin/kc.sh import --file /tmp/realm.json
```

### Database Backup

Use Vultr's managed PostgreSQL backup features:
- Automated daily backups
- Point-in-time recovery
- Manual snapshots

## Security Best Practices

1. **TLS/HTTPS**: Always use HTTPS for Keycloak (configure ingress with TLS)
2. **Strong passwords**: Use strong passwords for database and admin users
3. **Secrets management**: Never commit secrets to git
4. **Regular updates**: Keep Keycloak operator and instance updated
5. **Audit logs**: Enable Keycloak audit logging for security monitoring
6. **Network policies**: Restrict network access to Keycloak pods

## Monitoring

### Health Checks

```bash
# Check Keycloak health endpoint
curl https://${KEYCLOAK_HOSTNAME}/auth/health

# Check readiness
curl https://${KEYCLOAK_HOSTNAME}/auth/health/ready

# Check liveness
curl https://${KEYCLOAK_HOSTNAME}/auth/health/live
```

### Metrics (Future)

Keycloak exposes Prometheus metrics:
- Endpoint: `/auth/metrics`
- Configure ServiceMonitor for Prometheus scraping

## References

- [Keycloak Operator Documentation](https://www.keycloak.org/operator/installation)
- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [OLM Documentation](https://olm.operatorframework.io/)
- [OIDC Specification](https://openid.net/specs/openid-connect-core-1_0.html)

## Support

For issues:
1. Check logs: `kubectl logs -n keycloak -l app=keycloak`
2. Check status: `kubectl describe keycloak anytrade-keycloak -n keycloak`
3. Review troubleshooting section above
4. Open GitHub issue with logs and error details
