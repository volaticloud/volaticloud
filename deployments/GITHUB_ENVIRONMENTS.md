# GitHub Environments for VolatiCloud Deployment

This document explains how GitHub Environments work with the deployment workflows.

## What are GitHub Environments?

GitHub Environments provide:
- **Environment-specific secrets**: Different secrets for dev/staging/prod
- **Protection rules**: Require manual approval before deployment
- **Deployment history**: Track all deployments to each environment
- **Branch restrictions**: Limit which branches can deploy

## Environment Setup

You've created a `prod` environment in GitHub. Here's how it integrates with the workflow.

### Current Environment: `prod`

**Location**: GitHub Repository → Settings → Environments → prod

**Features**:
- ✅ Environment-specific secrets (VKE_KUBECONFIG, KEYCLOAK_DB_*, etc.)
- ✅ Optional: Require reviewers before deployment
- ✅ Optional: Wait timer before deployment
- ✅ Optional: Restrict to specific branches (e.g., only `main`)

## How Secrets Work with Environments

### Environment Secrets (Recommended ✅)

When you set secrets in the `prod` environment:

**Path**: Repository → Settings → Environments → prod → Environment secrets

```
prod environment secrets:
├── VKE_KUBECONFIG
├── KEYCLOAK_DB_HOST
├── KEYCLOAK_DB_USERNAME
├── KEYCLOAK_DB_PASSWORD
├── KEYCLOAK_HOSTNAME
└── ANYTRADE_URL
```

**Benefits**:
- Secrets are only available to workflows using `environment: prod`
- Different values per environment (dev/staging/prod)
- Protected by environment rules

### Repository Secrets (Alternative)

Secrets can also be set at repository level:

**Path**: Repository → Settings → Secrets and variables → Actions → Repository secrets

**Difference**:
- Available to ALL workflows
- Cannot have different values per environment
- No protection rules

## Workflow Integration

The workflow uses the `prod` environment in two jobs:

```yaml
jobs:
  install-olm:
    environment: prod  # ← Uses prod environment secrets
    steps:
      - name: Configure kubectl
        run: |
          echo "${{ secrets.VKE_KUBECONFIG }}" | base64 -d > kubeconfig
          # VKE_KUBECONFIG comes from prod environment

  deploy-keycloak:
    environment: prod  # ← Uses prod environment secrets
    steps:
      - name: Create database secret
        run: |
          kubectl create secret generic keycloak-db-secret \
            --from-literal=username="${{ secrets.KEYCLOAK_DB_USERNAME }}" \
            --from-literal=password="${{ secrets.KEYCLOAK_DB_PASSWORD }}"
```

## Configuring Environment Secrets

### Option 1: Via GitHub UI

1. Go to: https://github.com/diazoxide/volaticloud/settings/environments
2. Click on **prod** environment
3. Scroll to **Environment secrets**
4. Click **Add secret**
5. Add each secret:
   - `VKE_KUBECONFIG`
   - `KEYCLOAK_DB_HOST`
   - `KEYCLOAK_DB_USERNAME`
   - `KEYCLOAK_DB_PASSWORD`
   - `KEYCLOAK_HOSTNAME`
   - `ANYTRADE_URL`

### Option 2: Via GitHub CLI

```bash
# Add secrets to prod environment
gh secret set VKE_KUBECONFIG --env prod < kubeconfig-base64.txt
gh secret set KEYCLOAK_DB_HOST --env prod -b"postgres.vultr.com:16751"
gh secret set KEYCLOAK_DB_USERNAME --env prod -b"keycloak"
gh secret set KEYCLOAK_DB_PASSWORD --env prod  # Prompts for password
gh secret set KEYCLOAK_HOSTNAME --env prod -b"auth.volaticloud.com"
gh secret set ANYTRADE_URL --env prod -b"https://volaticloud.com"

# Verify
gh secret list --env prod
```

## Environment Protection Rules

You can add protection rules to the `prod` environment:

### 1. Required Reviewers

**Setup**: Environments → prod → Required reviewers

- Add team members who must approve deployments
- Example: Require 1 approval from @your-team

**Effect**:
- Workflow pauses before deploying
- Sends notification to reviewers
- Deployment continues after approval

### 2. Wait Timer

**Setup**: Environments → prod → Wait timer

- Add delay (e.g., 5 minutes) before deployment
- Gives time to cancel if needed

### 3. Deployment Branches

**Setup**: Environments → prod → Deployment branches

Options:
- **All branches**: Any branch can deploy (current setting)
- **Protected branches only**: Only branches with protection rules
- **Selected branches**: Specific branches (e.g., only `main`)

**Recommended**: Restrict to `main` branch only for production

```
Deployment branches: Selected branches
Branch name pattern: main
```

## Deployment Workflow with Environment

### Without Protection Rules:

```
1. Push to main
   ↓
2. Validate manifests
   ↓
3. Install OLM (uses prod environment + secrets)
   ↓
4. Deploy Keycloak (uses prod environment + secrets)
   ↓
5. Success! ✅
```

### With Required Reviewers:

```
1. Push to main
   ↓
2. Validate manifests
   ↓
3. ⏸️  Waiting for approval (sends notification)
   ↓
4. Reviewer approves in GitHub UI
   ↓
5. Install OLM (uses prod environment + secrets)
   ↓
6. Deploy Keycloak (uses prod environment + secrets)
   ↓
7. Success! ✅
```

## Viewing Deployments

### Deployment History

**Path**: Repository → Deployments tab

Shows:
- All deployments to `prod` environment
- Commit SHA
- Timestamp
- Status (success/failure)
- Who triggered it

### Workflow Runs

**Path**: Repository → Actions → deploy-keycloak workflow

Shows:
- All workflow runs
- Environment used
- Approval status (if required)
- Logs

## Multi-Environment Setup (Optional Future)

You can create additional environments for different stages:

### Development Environment

**Name**: `dev`

**Secrets**:
- Different VKE cluster (dev cluster)
- Different database (dev database)
- Different hostnames (dev.volaticloud.com)

**Protection**: None (auto-deploy on every push)

### Staging Environment

**Name**: `staging`

**Secrets**:
- Staging VKE cluster
- Staging database
- Different hostnames (staging.volaticloud.com)

**Protection**: Optional 1 reviewer

### Production Environment

**Name**: `prod` (current)

**Secrets**:
- Production VKE cluster
- Production database
- Production hostnames (auth.volaticloud.com)

**Protection**: Required reviewers, wait timer, main branch only

### Workflow with Multiple Environments

```yaml
on:
  push:
    branches: [develop]  # Auto-deploy to dev
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [dev, staging, prod]

jobs:
  deploy:
    environment: ${{ inputs.environment || 'dev' }}
    steps:
      - name: Deploy
        run: echo "Deploying to ${{ inputs.environment || 'dev' }}"
```

## Best Practices

### 1. Use Environment-Specific Secrets ✅

**Good**:
```yaml
environment: prod
steps:
  - run: echo "${{ secrets.VKE_KUBECONFIG }}"  # From prod environment
```

**Bad**:
```yaml
# No environment specified
steps:
  - run: echo "${{ secrets.VKE_KUBECONFIG }}"  # From repository secrets
```

### 2. Protect Production

**Recommended settings for `prod`**:
- ✅ Required reviewers: At least 1
- ✅ Deployment branches: `main` only
- ✅ Wait timer: 2-5 minutes (optional)

### 3. Keep Dev/Staging Unprotected

**Dev environment**:
- ❌ No reviewers (auto-deploy)
- ❌ No wait timer
- ✅ All branches allowed

### 4. Use Descriptive Commit Messages

Deployments are tied to commits, so use clear messages:

```bash
# Good
git commit -m "feat(keycloak): add admin role to realm"

# Bad
git commit -m "update"
```

### 5. Monitor Deployment History

Regularly check deployment status:
```bash
# List recent deployments
gh api repos/diazoxide/volaticloud/deployments --jq '.[] | {environment: .environment, ref: .ref, created_at: .created_at}'
```

## Troubleshooting

### Issue: Workflow doesn't use environment secrets

**Symptom**: Workflow fails with "secret not found" even though secret exists

**Cause**: Secret is in repository secrets, not environment secrets

**Solution**:
1. Delete secret from repository secrets
2. Add secret to environment secrets (`prod`)
3. Re-run workflow

### Issue: Workflow stuck on "Waiting for approval"

**Symptom**: Workflow pauses at environment step

**Cause**: Required reviewers protection rule is enabled

**Solution**:
1. Go to Actions → Running workflow
2. Click "Review deployments"
3. Select environment and approve
4. Or remove protection rule if not needed

### Issue: Cannot deploy from feature branch

**Symptom**: Workflow skips environment jobs

**Cause**: Deployment branches restricted to `main` only

**Solution**:
1. Merge to `main` first
2. Or temporarily allow feature branches:
   - Settings → Environments → prod → Deployment branches → All branches

## Verification

Check that environment is working:

```bash
# List environments
gh api repos/diazoxide/volaticloud/environments --jq '.environments[].name'

# List secrets in prod environment
gh secret list --env prod

# View protection rules
gh api repos/diazoxide/volaticloud/environments/prod --jq '.protection_rules'
```

## Current Configuration Summary

✅ **Environment**: `prod` (created)
✅ **Secrets**: Set in environment (you mentioned already configured)
✅ **Workflow**: Updated to use `environment: prod`
✅ **Jobs**: Both `install-olm` and `deploy-keycloak` use prod environment

## Next Steps

1. **Verify secrets are in environment** (not repository):
   ```bash
   gh secret list --env prod
   ```

2. **Optionally add protection rules**:
   - Go to Settings → Environments → prod
   - Add required reviewers (recommended)
   - Restrict to main branch only (recommended)

3. **Test deployment**:
   ```bash
   git add .
   git commit -m "feat(k8s): deploy Keycloak with prod environment"
   git push origin feature/keycloak-openid-integration
   ```

4. **Monitor deployment**:
   ```bash
   gh run watch
   ```

## References

- [GitHub Environments Documentation](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [Environment Protection Rules](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment#environment-protection-rules)
- [Environment Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-an-environment)
