# Ingress & TLS Setup (GitOps)

This guide explains the GitOps setup for nginx ingress controller, cert-manager, and automatic TLS certificates.

## Overview

All infrastructure is deployed via GitHub Actions workflows:
- Nginx Ingress Controller (creates Vultr Load Balancer)
- cert-manager (automatic Let's Encrypt TLS certificates)
- Updated Keycloak Ingress with TLS

## Required GitHub Secrets

Add one new secret to the `prod` environment:

```bash
# Set Let's Encrypt email for certificate notifications
gh secret set LETSENCRYPT_EMAIL --env prod --body "your-email@example.com"
```

**Existing secrets** (already configured):
- `VKE_KUBECONFIG` - Kubernetes cluster access
- `KEYCLOAK_HOSTNAME` - Domain for Keycloak (e.g., auth.volaticloud.com)

## Deployment Files

```
deployments/
├── ingress-nginx/
│   └── values.yaml           # Nginx ingress configuration
├── cert-manager/
│   ├── values.yaml           # cert-manager configuration
│   └── cluster-issuer.yaml   # Let's Encrypt issuers (prod & staging)
└── keycloak/
    └── keycloak-ingress.yaml # Updated ingress with TLS

.github/workflows/
└── deploy-ingress.yaml       # Deployment workflow
```

## How It Works

### Workflow Triggers

The workflow runs automatically on:
- Push to `main` or `feature/keycloak-openid-integration` branches
- Changes to any file in:
  - `deployments/ingress-nginx/**`
  - `deployments/cert-manager/**`
  - `deployments/keycloak/keycloak-ingress.yaml`
  - `.github/workflows/deploy-ingress.yaml`

### Workflow Jobs

1. **validate** - Validates YAML syntax of all manifests
2. **deploy-ingress** - Installs/upgrades nginx ingress controller
3. **deploy-cert-manager** - Installs/upgrades cert-manager
4. **update-keycloak-ingress** - Updates Keycloak ingress with TLS

### Smart Installation

The workflow checks if components are already installed:
- If not installed → Install fresh
- If already installed → Upgrade with new configuration

This means you can safely run the workflow multiple times.

## Deployment Steps

### 1. Set the Required Secret

```bash
# Replace with your actual email
gh secret set LETSENCRYPT_EMAIL --env prod --body "your-email@example.com"

# Verify all secrets are set
gh secret list --env prod
# Should show:
#   VKE_KUBECONFIG
#   KEYCLOAK_HOSTNAME
#   LETSENCRYPT_EMAIL
#   (plus other Keycloak secrets)
```

### 2. Commit and Push

```bash
# Add all new files
git add deployments/ingress-nginx/ \
        deployments/cert-manager/ \
        deployments/keycloak/keycloak-ingress.yaml \
        .github/workflows/deploy-ingress.yaml \
        deployments/INGRESS_TLS_SETUP.md

# Commit
git commit -m "feat(k8s): add GitOps deployment for ingress controller and TLS"

# Push (this triggers the workflow)
git push origin feature/keycloak-openid-integration
```

### 3. Monitor Deployment

```bash
# Watch the workflow
gh run watch

# Or view in browser
# https://github.com/volaticloud/volaticloud/actions
```

**Expected duration:** 5-8 minutes
- Validate: 10 seconds
- Deploy nginx ingress: 2-3 minutes (Vultr provisions load balancer)
- Deploy cert-manager: 1 minute
- Update ingress: 1-2 minutes (certificate issuance)

### 4. Get Load Balancer IP

After deployment completes:

```bash
# Get the load balancer IP
kubectl get svc -n ingress-nginx ingress-nginx-controller

# Example output:
# NAME                          TYPE           EXTERNAL-IP      PORT(S)
# ingress-nginx-controller      LoadBalancer   149.28.xxx.xxx   80:30080/TCP,443:30443/TCP
```

Save the EXTERNAL-IP for DNS configuration.

### 5. Configure DNS

Add an A record in your DNS provider:

**Using Cloudflare:**
1. Go to DNS → Records
2. Add A record:
   - Type: `A`
   - Name: `auth` (for auth.volaticloud.com)
   - IPv4 address: `<LOAD_BALANCER_IP>`
   - Proxy status: DNS only (orange cloud OFF)
   - TTL: Auto

**Using Other DNS Providers:**
- Add A record pointing `auth.volaticloud.com` to load balancer IP
- Disable proxy/CDN initially (enable after TLS works)

### 6. Wait for DNS Propagation

```bash
# Check DNS propagation (5-10 minutes)
dig auth.volaticloud.com +short
# Should return: <LOAD_BALANCER_IP>

# Or use online tool
# https://www.whatsmydns.net/#A/auth.volaticloud.com
```

### 7. Verify TLS Certificate

```bash
# Check certificate status
kubectl get certificate -n keycloak

# Should show:
# NAME                 READY   SECRET               AGE
# keycloak-tls-cert    True    keycloak-tls-cert    2m

# If not ready, check details
kubectl describe certificate keycloak-tls-cert -n keycloak

# Check challenges (should be none if successful)
kubectl get challenges -n keycloak
```

**Certificate issuance happens automatically** after DNS is configured:
1. cert-manager creates a temporary HTTP endpoint
2. Let's Encrypt validates domain ownership via HTTP-01 challenge
3. Certificate is issued and stored in Kubernetes secret
4. Ingress automatically uses the certificate

### 8. Test Access

```bash
# Test HTTP (should redirect to HTTPS)
curl -I http://auth.volaticloud.com/auth

# Test HTTPS (should work with valid certificate)
curl -I https://auth.volaticloud.com/auth

# Check certificate details
openssl s_client -connect auth.volaticloud.com:443 -servername auth.volaticloud.com < /dev/null 2>/dev/null | openssl x509 -noout -text | grep -A2 "Issuer:"
# Should show: CN = R11, O = Let's Encrypt
```

**Access in browser:** `https://auth.volaticloud.com/auth`

## Configuration Details

### Nginx Ingress Values

**File:** `deployments/ingress-nginx/values.yaml`

Key settings:
- Creates Vultr Load Balancer with `service.type: LoadBalancer`
- Vultr-specific annotations for protocol and proxy
- Resource limits: 100m/128Mi requests, 200m/256Mi limits
- Default ingress class: `nginx`
- Security headers and SSL configuration

### cert-manager Values

**File:** `deployments/cert-manager/values.yaml`

Key settings:
- Installs CRDs automatically
- Resource limits for controller, webhook, and cainjector
- Lightweight configuration suitable for production

### ClusterIssuer

**File:** `deployments/cert-manager/cluster-issuer.yaml`

Creates two issuers:
- `letsencrypt-prod` - Production certificates (use in production)
- `letsencrypt-staging` - Staging certificates (use for testing to avoid rate limits)

### Keycloak Ingress

**File:** `deployments/keycloak/keycloak-ingress.yaml`

Key settings:
- Uses `ingressClassName: nginx`
- cert-manager annotation for automatic TLS
- TLS configuration with secret `keycloak-tls-cert`
- Force HTTPS redirect
- Increased timeouts for admin operations

## Workflow Configuration

### Manual Triggers

You can manually trigger the workflow with options:

```bash
# Trigger workflow
gh workflow run deploy-ingress.yaml

# Skip components if already installed
gh workflow run deploy-ingress.yaml \
  -f skip-ingress=true \
  -f skip-cert-manager=true
```

### Idempotent Deployments

The workflow is designed to be run multiple times safely:
- Checks if components exist before installing
- Upgrades existing installations with new config
- No downtime for running services

## Troubleshooting

### Load Balancer Not Created

```bash
# Check ingress controller logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# Check service status
kubectl describe svc -n ingress-nginx ingress-nginx-controller

# Verify Vultr annotations
kubectl get svc -n ingress-nginx ingress-nginx-controller -o yaml | grep vultr
```

### Certificate Not Issuing

```bash
# Check certificate status
kubectl describe certificate keycloak-tls-cert -n keycloak

# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager

# Check challenges
kubectl get challenges -n keycloak
kubectl describe challenge <challenge-name> -n keycloak

# Common issues:
# - DNS not propagated yet (wait 10 minutes)
# - Load balancer not ready
# - Let's Encrypt rate limit (use staging issuer)
```

### DNS Not Resolving

```bash
# Check DNS configuration
dig auth.volaticloud.com +short

# Check from different DNS servers
dig @8.8.8.8 auth.volaticloud.com +short  # Google DNS
dig @1.1.1.1 auth.volaticloud.com +short  # Cloudflare DNS

# If wrong IP, update DNS record and wait 5-10 minutes
```

### Ingress Has No Address

```bash
# Check ingress status
kubectl get ingress -n keycloak volaticloud-keycloak-ingress

# Check ingress class
kubectl get ingressclass

# Verify ingress has correct class
kubectl get ingress -n keycloak volaticloud-keycloak-ingress -o yaml | grep ingressClassName
# Should show: ingressClassName: nginx
```

### cert-manager Webhook Errors

```bash
# Check webhook is running
kubectl get pods -n cert-manager

# Check webhook service
kubectl get svc -n cert-manager cert-manager-webhook

# If issues, restart cert-manager
kubectl rollout restart deployment -n cert-manager cert-manager
```

## Updating Configuration

### Change Nginx Ingress Settings

1. Edit `deployments/ingress-nginx/values.yaml`
2. Commit and push
3. Workflow automatically upgrades the installation

### Change cert-manager Settings

1. Edit `deployments/cert-manager/values.yaml`
2. Commit and push
3. Workflow automatically upgrades the installation

### Change Let's Encrypt Email

```bash
# Update the secret
gh secret set LETSENCRYPT_EMAIL --env prod --body "new-email@example.com"

# Re-run workflow or make a change to trigger it
git commit --allow-empty -m "chore: update Let's Encrypt email"
git push
```

### Switch to Staging Issuer (for Testing)

Edit `deployments/keycloak/keycloak-ingress.yaml`:

```yaml
metadata:
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-staging"  # Changed from letsencrypt-prod
```

Commit and push. cert-manager will issue a new staging certificate.

## Security Considerations

1. **Email Privacy**: The email in LETSENCRYPT_EMAIL is submitted to Let's Encrypt and may be publicly visible in certificate transparency logs
2. **Rate Limits**: Let's Encrypt has rate limits (50 certificates per domain per week). Use staging issuer for testing.
3. **Certificate Renewal**: cert-manager automatically renews certificates 30 days before expiry
4. **Load Balancer Costs**: Vultr charges for load balancers (~$10/month)
5. **DNS Changes**: Always test with staging issuer before using production issuer

## Monitoring

### Check Ingress Controller Health

```bash
# Pod status
kubectl get pods -n ingress-nginx

# Service status
kubectl get svc -n ingress-nginx

# Ingress class
kubectl get ingressclass

# All ingresses
kubectl get ingress -A
```

### Check cert-manager Health

```bash
# Pod status
kubectl get pods -n cert-manager

# ClusterIssuers
kubectl get clusterissuer

# Certificates
kubectl get certificate -A

# Certificate requests
kubectl get certificaterequest -A

# Challenges
kubectl get challenges -A
```

### Check Certificate Expiry

```bash
# Get certificate details
kubectl get certificate -n keycloak keycloak-tls-cert -o yaml

# Check expiry date
kubectl get secret keycloak-tls-cert -n keycloak -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | \
  openssl x509 -noout -enddate
```

## Cost Estimation

**Vultr VKE Resources:**
- Load Balancer: ~$10/month
- Ingress Controller: ~$5/month (CPU/memory)
- cert-manager: ~$2/month (CPU/memory)
- **Total Additional Cost: ~$17/month**

**Let's Encrypt:** Free (open source)

## Next Steps

After successful deployment:

1. ✅ Keycloak accessible at `https://auth.volaticloud.com/auth`
2. ✅ Automatic HTTPS with valid certificate
3. ✅ Certificate auto-renewal configured

**For production readiness:**
1. Enable Cloudflare proxy (orange cloud) for DDoS protection
2. Set up monitoring and alerts for certificate expiry
3. Configure backup for cert-manager secrets
4. Set up Prometheus metrics for ingress controller
5. Review and adjust resource limits based on usage

---

**Last Updated:** 2025-11-13
**Workflow:** `.github/workflows/deploy-ingress.yaml`
