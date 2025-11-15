# GitHub Secrets Setup Guide

This guide will walk you through configuring GitHub Secrets for automated Keycloak deployment on VKE.

## Prerequisites

- Access to your Vultr account (VKE cluster and managed PostgreSQL)
- Admin access to the GitHub repository
- `kubectl` installed locally
- GitHub CLI (`gh`) installed (optional, but recommended)

---

## Step 1: Get VKE Kubeconfig

### Option A: Via Vultr Dashboard (Recommended)

1. Log in to [Vultr Cloud](https://my.vultr.com/)
2. Navigate to **Products → Kubernetes**
3. Click on your VKE cluster
4. Click **Download Configuration** button
5. Save the file as `vke-kubeconfig.yaml`

### Option B: Via Vultr API

```bash
# Get your API key from: https://my.vultr.com/settings/#settingsapi

export VULTR_API_KEY="your-api-key"

# List clusters
curl -X GET "https://api.vultr.com/v2/kubernetes/clusters" \
  -H "Authorization: Bearer $VULTR_API_KEY"

# Get cluster config (replace <cluster-id>)
curl -X GET "https://api.vultr.com/v2/kubernetes/clusters/<cluster-id>/config" \
  -H "Authorization: Bearer $VULTR_API_KEY" \
  > vke-kubeconfig.yaml
```

### Verify Kubeconfig Works

```bash
# Test connectivity
kubectl --kubeconfig=vke-kubeconfig.yaml cluster-info

# Expected output:
# Kubernetes control plane is running at https://...
# CoreDNS is running at https://...
```

---

## Step 2: Encode Kubeconfig for GitHub

GitHub Secrets need to be base64-encoded.

### On macOS/Linux:

```bash
cat vke-kubeconfig.yaml | base64 > vke-kubeconfig-base64.txt

# View the encoded content (for copy-paste)
cat vke-kubeconfig-base64.txt
```

### On Windows (PowerShell):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("vke-kubeconfig.yaml")) | Out-File -Encoding ASCII vke-kubeconfig-base64.txt

# View the encoded content
Get-Content vke-kubeconfig-base64.txt
```

**Important**: The output should be a single long line of base64 text. If it has line breaks, that's okay - GitHub will handle it.

---

## Step 3: Get PostgreSQL Connection Details

### Via Vultr Dashboard:

1. Navigate to **Products → Databases**
2. Click on your PostgreSQL instance
3. Note the connection details:
   - **Host**: e.g., `postgres-abc123.vultr.com`
   - **Port**: Usually `16751` or `5432`
   - **Database**: `keycloak` (create if doesn't exist)
   - **Username**: `keycloak` (or your custom user)
   - **Password**: Your database password

### Create Keycloak Database (if needed):

```bash
# Connect to your PostgreSQL
psql -h postgres-abc123.vultr.com -p 16751 -U vultradmin -d defaultdb

# Create database and user
CREATE DATABASE keycloak;
CREATE USER keycloak WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;

# Verify
\l  # List databases
\du # List users
```

---

## Step 4: Determine Hostnames

You need to decide on your public domain names:

1. **Keycloak Hostname**: Where Keycloak will be accessible
   - Example: `auth.volaticloud.com` or `keycloak.yourdomain.com`

2. **AnyTrade URL**: Where your application will be accessible
   - Example: `https://volaticloud.com` or `https://app.yourdomain.com`

**Note**: You'll need to configure DNS later to point these domains to your VKE load balancer.

---

## Step 5: Add Secrets to GitHub

### Option A: Via GitHub Web UI (Easiest)

1. Go to your repository on GitHub: https://github.com/diazoxide/anytrade
2. Click **Settings** (top navigation)
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**

Add each secret one by one:

#### Secret 1: VKE_KUBECONFIG

- **Name**: `VKE_KUBECONFIG`
- **Value**: Paste the entire contents of `vke-kubeconfig-base64.txt`
- Click **Add secret**

#### Secret 2: KEYCLOAK_DB_HOST

- **Name**: `KEYCLOAK_DB_HOST`
- **Value**: `postgres-abc123.vultr.com:16751` (your host:port)
- Click **Add secret**

#### Secret 3: KEYCLOAK_DB_USERNAME

- **Name**: `KEYCLOAK_DB_USERNAME`
- **Value**: `keycloak`
- Click **Add secret**

#### Secret 4: KEYCLOAK_DB_PASSWORD

- **Name**: `KEYCLOAK_DB_PASSWORD`
- **Value**: Your database password
- Click **Add secret**

#### Secret 5: KEYCLOAK_HOSTNAME

- **Name**: `KEYCLOAK_HOSTNAME`
- **Value**: `auth.volaticloud.com` (your chosen domain)
- Click **Add secret**

#### Secret 6: ANYTRADE_URL

- **Name**: `ANYTRADE_URL`
- **Value**: `https://volaticloud.com` (your application URL)
- Click **Add secret**

### Option B: Via GitHub CLI (Faster)

If you have [GitHub CLI](https://cli.github.com/) installed:

```bash
# Navigate to your repository
cd /Users/macbookpro/IdeaProjects/anytrade

# Add VKE_KUBECONFIG
gh secret set VKE_KUBECONFIG < vke-kubeconfig-base64.txt

# Add database credentials
gh secret set KEYCLOAK_DB_HOST -b"postgres-abc123.vultr.com:16751"
gh secret set KEYCLOAK_DB_USERNAME -b"keycloak"
gh secret set KEYCLOAK_DB_PASSWORD  # Will prompt for password

# Add hostnames
gh secret set KEYCLOAK_HOSTNAME -b"auth.volaticloud.com"
gh secret set ANYTRADE_URL -b"https://volaticloud.com"

# List all secrets to verify
gh secret list
```

---

## Step 6: Verify Secrets Are Set

### Via GitHub Web UI:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. You should see 6 secrets listed:
   - ✅ VKE_KUBECONFIG
   - ✅ KEYCLOAK_DB_HOST
   - ✅ KEYCLOAK_DB_USERNAME
   - ✅ KEYCLOAK_DB_PASSWORD
   - ✅ KEYCLOAK_HOSTNAME
   - ✅ ANYTRADE_URL

### Via GitHub CLI:

```bash
gh secret list
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

---

## Step 7: Test GitHub Actions Connection

Create a simple test workflow to verify the secrets work:

```bash
# Create test workflow
cat > .github/workflows/test-connection.yaml << 'EOF'
name: Test VKE Connection

on:
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Install kubectl
        uses: azure/setup-kubectl@v4

      - name: Test kubeconfig
        run: |
          echo "${{ secrets.VKE_KUBECONFIG }}" | base64 -d > kubeconfig
          export KUBECONFIG=./kubeconfig
          kubectl cluster-info
          kubectl get nodes

      - name: Test secrets
        run: |
          echo "DB Host: ${{ secrets.KEYCLOAK_DB_HOST }}"
          echo "DB Username: ${{ secrets.KEYCLOAK_DB_USERNAME }}"
          echo "Keycloak Hostname: ${{ secrets.KEYCLOAK_HOSTNAME }}"
          echo "AnyTrade URL: ${{ secrets.ANYTRADE_URL }}"
EOF

# Commit and push
git add .github/workflows/test-connection.yaml
git commit -m "test: add VKE connection test"
git push

# Run the test
gh workflow run test-connection.yaml

# Watch the output
gh run watch
```

If this succeeds, your secrets are correctly configured! ✅

---

## Troubleshooting

### Issue: "error: You must be logged in to the server (Unauthorized)"

**Cause**: Kubeconfig is not properly encoded or expired

**Solution**:
```bash
# Re-download kubeconfig from Vultr
# Re-encode it
cat vke-kubeconfig.yaml | base64 > vke-kubeconfig-base64.txt

# Update the secret
gh secret set VKE_KUBECONFIG < vke-kubeconfig-base64.txt
```

### Issue: "error: invalid argument"

**Cause**: Kubeconfig has line breaks or encoding issues

**Solution**:
```bash
# Encode without line breaks
cat vke-kubeconfig.yaml | base64 | tr -d '\n' > vke-kubeconfig-base64.txt

# Update secret
gh secret set VKE_KUBECONFIG < vke-kubeconfig-base64.txt
```

### Issue: Database connection fails

**Cause**: Wrong host, port, or credentials

**Solution**:
```bash
# Verify database connectivity from your local machine
psql -h $KEYCLOAK_DB_HOST -p 16751 -U keycloak -d keycloak

# If it works locally, check the secret values
gh secret list

# Update if needed
gh secret set KEYCLOAK_DB_PASSWORD
```

### Issue: Secret not found in workflow

**Cause**: Secret name mismatch (case-sensitive)

**Solution**:
- Verify secret names match exactly in workflow YAML
- Secrets are case-sensitive: `VKE_KUBECONFIG` ≠ `vke_kubeconfig`

---

## Security Best Practices

### ✅ Do's:

- ✅ Use base64 encoding for kubeconfig
- ✅ Use strong, unique passwords for database
- ✅ Rotate secrets periodically
- ✅ Limit GitHub Actions permissions to minimum needed
- ✅ Enable GitHub Actions approval for production deployments

### ❌ Don'ts:

- ❌ Never commit kubeconfig to git
- ❌ Never echo secrets in workflow logs (GitHub auto-masks them, but be careful)
- ❌ Don't share secrets via unsecured channels
- ❌ Don't use the same password across multiple services

---

## Next Steps

After secrets are configured:

1. ✅ Commit and push your Keycloak deployment files
2. ✅ The `deploy-keycloak.yaml` workflow will run automatically
3. ✅ Monitor the workflow in GitHub Actions
4. ✅ Verify Keycloak is deployed: `kubectl get pods -n keycloak`

---

## Quick Reference

### Update a Secret:

```bash
# Via GitHub CLI
gh secret set SECRET_NAME -b"new-value"

# Via GitHub Web UI
# Settings → Secrets and variables → Actions → Click secret → Update
```

### Delete a Secret:

```bash
# Via GitHub CLI
gh secret delete SECRET_NAME

# Via GitHub Web UI
# Settings → Secrets and variables → Actions → Click secret → Delete
```

### List All Secrets:

```bash
gh secret list
```

---

## Support

If you encounter issues:
1. Check troubleshooting section above
2. Verify all 6 secrets are set correctly
3. Run the test connection workflow
4. Check GitHub Actions logs for detailed error messages

For VKE-specific issues:
- [Vultr VKE Documentation](https://www.vultr.com/docs/vultr-kubernetes-engine/)
- [Vultr Support](https://my.vultr.com/support/)

For GitHub Actions issues:
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Encrypted Secrets Guide](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
