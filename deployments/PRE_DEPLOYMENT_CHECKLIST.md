# Pre-Deployment Checklist for Keycloak on VKE

Use this checklist before pushing to trigger the deployment workflow.

---

## ✅ GitHub Environment Configuration

### 1. Environment Exists
- [ ] `prod` environment exists in GitHub
  - Verify: https://github.com/diazoxide/anytrade/settings/environments
  - Should see: **prod** in the list

### 2. Environment Secrets Set
- [ ] All 6 secrets are configured in the `prod` environment

Verify with:
```bash
gh secret list --env prod
```

Expected output:
```
VKE_KUBECONFIG          Updated YYYY-MM-DD
KEYCLOAK_DB_HOST        Updated YYYY-MM-DD
KEYCLOAK_DB_USERNAME    Updated YYYY-MM-DD
KEYCLOAK_DB_PASSWORD    Updated YYYY-MM-DD
KEYCLOAK_HOSTNAME       Updated YYYY-MM-DD
ANYTRADE_URL            Updated YYYY-MM-DD
```

### 3. Secret Values Are Correct
Verify each secret has the correct value:

**VKE_KUBECONFIG**:
- [ ] Base64-encoded kubeconfig
- [ ] Not expired
- [ ] Test: `echo "$VKE_KUBECONFIG" | base64 -d | grep "apiVersion"`

**KEYCLOAK_DB_HOST**:
- [ ] Format: `hostname:port`
- [ ] Example: `postgres-abc123.vultr.com:16751`
- [ ] No `http://` or `https://` prefix

**KEYCLOAK_DB_USERNAME**:
- [ ] Database username (e.g., `keycloak`)

**KEYCLOAK_DB_PASSWORD**:
- [ ] Correct password for database user

**KEYCLOAK_HOSTNAME**:
- [ ] Just the hostname (no `https://` or `/auth`)
- [ ] Example: `auth.volaticloud.com`
- [ ] NOT: `https://auth.volaticloud.com/auth`

**ANYTRADE_URL**:
- [ ] Full URL with protocol
- [ ] Example: `https://volaticloud.com`
- [ ] Includes `https://`

---

## ✅ VKE Cluster

### 1. Cluster is Running
```bash
export KUBECONFIG=/path/to/vke-kubeconfig.yaml
kubectl cluster-info
```

Expected output:
```
Kubernetes control plane is running at https://...
CoreDNS is running at https://...
```

### 2. Cluster is Accessible
```bash
kubectl get nodes
```

Expected output:
```
NAME                   STATUS   ROLES    AGE   VERSION
vke-abc123-node-1      Ready    <none>   Xd    v1.28.x
vke-abc123-node-2      Ready    <none>   Xd    v1.28.x
```

### 3. Sufficient Resources
```bash
kubectl top nodes
```

Check:
- [ ] CPU usage < 80%
- [ ] Memory usage < 80%
- [ ] At least 2 nodes available

---

## ✅ PostgreSQL Database

### 1. Database is Accessible
```bash
psql -h <KEYCLOAK_DB_HOST> -U <KEYCLOAK_DB_USERNAME> -d postgres
```

### 2. Keycloak Database Exists
```sql
\l  -- List databases
-- Should see 'keycloak' database
```

If not, create it:
```sql
CREATE DATABASE keycloak;
GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;
```

### 3. User Has Permissions
```sql
\c keycloak
-- Should connect successfully
```

---

## ✅ DNS Configuration (Optional for now, required for production)

### 1. DNS Records Configured
- [ ] `auth.volaticloud.com` (or your hostname) has an A record
- [ ] Points to VKE load balancer IP

Check:
```bash
dig auth.volaticloud.com
nslookup auth.volaticloud.com
```

**Note**: This can be configured after deployment, but required for HTTPS access.

---

## ✅ GitHub Repository

### 1. Workflow File Exists
- [ ] `.github/workflows/deploy-keycloak.yaml` exists
- [ ] Uses `environment: prod` (not `production`)

Verify:
```bash
grep "environment: prod" .github/workflows/deploy-keycloak.yaml
```

### 2. Deployment Files Exist
- [ ] `deployments/olm/install.sh`
- [ ] `deployments/olm/values.yaml`
- [ ] `deployments/keycloak/namespace.yaml`
- [ ] `deployments/keycloak/operator-subscription.yaml`
- [ ] `deployments/keycloak/keycloak-instance.yaml`
- [ ] `deployments/keycloak/keycloak-realm.yaml`
- [ ] `deployments/keycloak/keycloak-client.yaml`

Verify:
```bash
ls -la deployments/olm/
ls -la deployments/keycloak/
```

### 3. Files Are Staged for Commit
```bash
git status
```

Should see:
- [ ] `.github/workflows/deploy-keycloak.yaml`
- [ ] `deployments/olm/` files
- [ ] `deployments/keycloak/` files
- [ ] Documentation files

---

## ✅ GitHub Permissions

### 1. GitHub Actions Enabled
- [ ] Go to: Settings → Actions → General
- [ ] Actions permissions: Allow all actions

### 2. Workflow Permissions
- [ ] Go to: Settings → Actions → General → Workflow permissions
- [ ] Select: Read and write permissions ✅

### 3. Environment Protection Rules (Optional)
Review: https://github.com/diazoxide/anytrade/settings/environments/prod

Optional settings:
- [ ] Required reviewers: Add team members (recommended for production)
- [ ] Deployment branches: Restrict to `main` only (recommended)
- [ ] Wait timer: 2-5 minutes delay (optional)

---

## ✅ Pre-Flight Tests

### 1. Test Kubeconfig Locally
```bash
export KUBECONFIG=/path/to/vke-kubeconfig.yaml
kubectl get namespaces
kubectl get pods -A
```

### 2. Test Database Connection
```bash
PGPASSWORD="<password>" psql -h <host> -p <port> -U keycloak -d keycloak -c "SELECT version();"
```

### 3. Validate Manifests
```bash
kubectl apply --dry-run=client -f deployments/keycloak/
```

Expected:
```
namespace/keycloak created (dry run)
operatorgroup.operators.coreos.com/keycloak-operator-group created (dry run)
subscription.operators.coreos.com/keycloak-operator created (dry run)
keycloak.k8s.keycloak.org/anytrade-keycloak created (dry run)
keycloakrealmimport.k8s.keycloak.org/anytrade-realm created (dry run)
keycloakrealmimport.k8s.keycloak.org/anytrade-client created (dry run)
```

---

## ✅ Deployment Readiness

### Final Checks
- [ ] All GitHub secrets are in `prod` environment (not repository secrets)
- [ ] VKE cluster is accessible and healthy
- [ ] PostgreSQL database is accessible with correct credentials
- [ ] All deployment files are present and valid
- [ ] GitHub Actions is enabled with write permissions
- [ ] You're on the correct branch (`feature/keycloak-openid-integration` or `main`)

### Ready to Deploy? 🚀

If all checks pass, you're ready to deploy:

```bash
# Add all files
git add deployments/ .github/workflows/deploy-keycloak.yaml

# Commit
git commit -m "feat(k8s): deploy Keycloak via GitOps with prod environment"

# Push (this triggers deployment)
git push origin feature/keycloak-openid-integration

# Monitor deployment
gh run watch
```

---

## 📊 Post-Deployment Verification

After workflow completes (~10-15 minutes), verify:

### 1. OLM Installed
```bash
kubectl get pods -n olm
```

Expected: 3 pods running (olm-operator, catalog-operator, catalog)

### 2. Keycloak Operator Running
```bash
kubectl get csv -n keycloak
```

Expected: Keycloak operator in "Succeeded" phase

### 3. Keycloak Pods Running
```bash
kubectl get pods -n keycloak
```

Expected: 2 Keycloak pods in "Running" status

### 4. Keycloak Service Available
```bash
kubectl get svc -n keycloak
```

Expected: Keycloak service with ClusterIP or LoadBalancer

### 5. Access Admin Console
```bash
# Get admin credentials
kubectl get secret anytrade-keycloak-initial-admin \
  -n keycloak -o jsonpath='{.data.username}' | base64 -d

kubectl get secret anytrade-keycloak-initial-admin \
  -n keycloak -o jsonpath='{.data.password}' | base64 -d
```

Visit: `https://auth.volaticloud.com/auth/admin` (or your configured hostname)

### 6. Verify OIDC Configuration
```bash
curl https://auth.volaticloud.com/auth/realms/anytrade/.well-known/openid-configuration
```

Expected: JSON response with OIDC endpoints

---

## 🔥 Common Issues & Quick Fixes

### Issue: Secret not found
**Check**: Secrets in environment, not repository
```bash
gh secret list --env prod  # Should show all 6 secrets
```

### Issue: Kubeconfig unauthorized
**Check**: Kubeconfig not expired
```bash
# Re-download from Vultr and update
cat new-kubeconfig.yaml | base64 | gh secret set VKE_KUBECONFIG --env prod
```

### Issue: Database connection failed
**Check**: Host includes port
```bash
# Correct: postgres.vultr.com:16751
# Wrong: postgres.vultr.com
```

### Issue: OLM not installing
**Check**: Cluster has internet access and sufficient resources
```bash
kubectl get events -n olm --sort-by='.lastTimestamp'
```

---

## 📞 Support

If deployment fails:
1. Check GitHub Actions logs: https://github.com/diazoxide/anytrade/actions
2. Review this checklist
3. Check Kubernetes events: `kubectl get events -A --sort-by='.lastTimestamp'`
4. Review documentation: `deployments/README.md`

---

## ✅ Success Criteria

Deployment is successful when:
- ✅ GitHub Actions workflow completes without errors
- ✅ OLM pods running (3 pods in `olm` namespace)
- ✅ Keycloak operator CSV in "Succeeded" phase
- ✅ Keycloak pods running (2 pods in `keycloak` namespace)
- ✅ Keycloak admin console accessible
- ✅ OIDC configuration endpoint returns valid JSON
- ✅ Realm `anytrade` exists with 4 roles (admin, trader, viewer, user)
- ✅ OIDC clients configured (anytrade-dashboard, anytrade-api)

**Estimated Time**: 10-15 minutes from push to fully deployed

---

**Last Updated**: 2025-11-13
**Status**: Ready for deployment 🚀
