# Quick Start: Deploy Keycloak on VKE

**Goal**: Get Keycloak running on your VKE cluster via GitOps in ~15 minutes.

---

## Prerequisites Checklist

- [ ] VKE cluster running on Vultr
- [ ] Managed PostgreSQL database on Vultr
- [ ] Domain name configured (e.g., `auth.volaticloud.com`)
- [ ] Admin access to GitHub repository
- [ ] `kubectl` installed locally
- [ ] GitHub CLI (`gh`) installed (optional)

---

## Step 1: Get Your Kubeconfig (2 minutes)

**Via Vultr Dashboard**:
1. Go to https://my.vultr.com/
2. Click **Products** → **Kubernetes**
3. Click your cluster
4. Click **Download Configuration**
5. Save as `vke-kubeconfig.yaml`

**Test it works**:
```bash
kubectl --kubeconfig=vke-kubeconfig.yaml get nodes
```

---

## Step 2: Configure GitHub Secrets (5 minutes)

### Option A: Automated Script (Recommended)

```bash
cd /Users/macbookpro/IdeaProjects/anytrade
chmod +x scripts/setup-github-secrets.sh
./scripts/setup-github-secrets.sh
```

The script will prompt you for:
- Path to kubeconfig file
- PostgreSQL host, port, username, password
- Keycloak hostname
- AnyTrade URL

### Option B: Manual Setup

Follow the detailed guide: [`GITHUB_SECRETS_SETUP.md`](./GITHUB_SECRETS_SETUP.md)

**Required secrets**:
- `VKE_KUBECONFIG` - Base64-encoded kubeconfig
- `KEYCLOAK_DB_HOST` - PostgreSQL host:port
- `KEYCLOAK_DB_USERNAME` - Database username
- `KEYCLOAK_DB_PASSWORD` - Database password
- `KEYCLOAK_HOSTNAME` - Keycloak domain (e.g., `auth.volaticloud.com`)
- `ANYTRADE_URL` - Application URL (e.g., `https://volaticloud.com`)

**Verify secrets**:
```bash
gh secret list
```

---

## Step 3: Create Keycloak Database (2 minutes)

```bash
# Connect to your PostgreSQL
psql -h postgres-abc123.vultr.com -p 16751 -U vultradmin -d defaultdb

# Create database and user
CREATE DATABASE keycloak;
CREATE USER keycloak WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;

# Exit
\q
```

---

## Step 4: Deploy via GitOps (1 minute)

```bash
# Add deployment files
git add deployments/ .github/workflows/deploy-keycloak.yaml

# Commit
git commit -m "feat(k8s): deploy Keycloak via GitOps"

# Push to trigger deployment
git push origin feature/keycloak-openid-integration
```

**That's it!** GitHub Actions will automatically:
1. Validate manifests
2. Install OLM
3. Deploy Keycloak operator
4. Create Keycloak instance
5. Configure realm and OIDC clients

---

## Step 5: Monitor Deployment (10 minutes)

### Watch GitHub Actions:

```bash
# Watch the workflow run
gh run watch

# Or view in browser
open https://github.com/diazoxide/anytrade/actions
```

### Check Kubernetes:

```bash
export KUBECONFIG=vke-kubeconfig.yaml

# Check OLM
kubectl get pods -n olm

# Check Keycloak operator
kubectl get csv -n keycloak

# Check Keycloak pods
kubectl get pods -n keycloak

# Watch Keycloak startup
kubectl logs -n keycloak -l app=keycloak -f
```

---

## Step 6: Access Keycloak (2 minutes)

### Get admin credentials:

```bash
kubectl get secret anytrade-keycloak-initial-admin \
  -n keycloak -o jsonpath='{.data.username}' | base64 -d
echo ""

kubectl get secret anytrade-keycloak-initial-admin \
  -n keycloak -o jsonpath='{.data.password}' | base64 -d
echo ""
```

### Access admin console:

```
https://auth.volaticloud.com/auth/admin
```

### Verify OIDC configuration:

```
https://auth.volaticloud.com/auth/realms/anytrade/.well-known/openid-configuration
```

---

## Troubleshooting

### Workflow fails with "Unauthorized"

**Issue**: Kubeconfig is invalid or expired

**Fix**:
```bash
# Re-download from Vultr and update secret
cat vke-kubeconfig.yaml | base64 | gh secret set VKE_KUBECONFIG
```

### Keycloak pods not starting

**Issue**: Database connection failed

**Fix**:
```bash
# Check database secret
kubectl get secret keycloak-db-secret -n keycloak -o yaml

# Test database connectivity
kubectl run -it --rm psql-test --image=postgres:14 --restart=Never -- \
  psql -h postgres-abc123.vultr.com -p 16751 -U keycloak -d keycloak
```

### Operator not installing

**Issue**: OLM or catalog source issue

**Fix**:
```bash
# Check OLM
kubectl get pods -n olm
kubectl get catalogsource -n olm

# Reinstall OLM
kubectl delete namespace olm
cd deployments/olm
./install.sh
```

---

## Next Steps

After Keycloak is deployed:

1. **Create users**: Access admin console → Users → Add user
2. **Assign roles**: User details → Role mapping → Assign roles (admin/trader/viewer)
3. **Test OIDC**: Try login flow from a test client
4. **Configure DNS**: Point `auth.volaticloud.com` to VKE load balancer
5. **Setup TLS**: Configure ingress with cert-manager (optional)
6. **Deploy AnyTrade app**: Move to Phase 2 (application Helm chart)

---

## Useful Commands

```bash
# Restart Keycloak
kubectl rollout restart statefulset/anytrade-keycloak -n keycloak

# View logs
kubectl logs -n keycloak -l app=keycloak --tail=100 -f

# Get Keycloak status
kubectl get keycloak -n keycloak

# Delete and redeploy (clean slate)
kubectl delete namespace keycloak
git commit --allow-empty -m "redeploy: trigger Keycloak deployment"
git push
```

---

## Success Checklist

- [ ] All 6 GitHub secrets configured
- [ ] Keycloak database created in PostgreSQL
- [ ] GitHub Actions workflow completed successfully
- [ ] OLM pods running in `olm` namespace
- [ ] Keycloak operator running in `keycloak` namespace
- [ ] Keycloak pods (2 replicas) running
- [ ] Can access admin console
- [ ] OIDC configuration endpoint returns valid JSON
- [ ] Realm `anytrade` exists with roles
- [ ] OIDC clients `anytrade-dashboard` and `anytrade-api` configured

---

## Time Estimate

- ✅ Setup GitHub Secrets: **5 minutes**
- ✅ Create database: **2 minutes**
- ✅ Git commit & push: **1 minute**
- ⏳ GitHub Actions deployment: **10-15 minutes**
- ✅ Verify & access: **2 minutes**

**Total: ~20-25 minutes** from zero to running Keycloak!

---

## Support

Need help?
- **Detailed guide**: See [`GITHUB_SECRETS_SETUP.md`](./GITHUB_SECRETS_SETUP.md)
- **Keycloak docs**: See [`keycloak/README.md`](./keycloak/README.md)
- **Full plan**: See [`../.claude/KUBERNETES_PLAN.md`](../.claude/KUBERNETES_PLAN.md)
