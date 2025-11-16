# Public Access Setup for Keycloak on VKE

This guide walks you through setting up public domain access to Keycloak.

## Current Status

- ✅ Keycloak deployed with 2 instances
- ✅ Internal ClusterIP service created
- ✅ Ingress resource created
- ⚠️  **Ingress controller NOT installed** (needed for public access)
- ⚠️  **DNS records NOT configured**
- ⚠️  **TLS certificates NOT configured**

## Architecture Overview

```
Internet → DNS (auth.volaticloud.com) → VKE Load Balancer → Nginx Ingress Controller → Keycloak Service → Keycloak Pods
```

---

## Step 1: Install Nginx Ingress Controller

The ingress controller provisions a Vultr Load Balancer and routes traffic to services.

### Option A: Using Helm (Recommended)

```bash
# Add nginx ingress helm repo
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install nginx ingress controller
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/vultr-loadbalancer-protocol"="tcp" \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/vultr-loadbalancer-proxy-protocol"="v2"

# Wait for load balancer to be provisioned (takes 2-3 minutes)
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=300s
```

### Option B: Using Kubectl (Alternative)

```bash
# Deploy nginx ingress controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.4/deploy/static/provider/cloud/deploy.yaml

# Wait for load balancer
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=300s
```

---

## Step 2: Get Load Balancer IP Address

After installation, Vultr will provision a Load Balancer with a public IP.

```bash
# Check load balancer service
kubectl get svc -n ingress-nginx

# Get the external IP (EXTERNAL-IP column)
# Example output:
# NAME                                 TYPE           CLUSTER-IP       EXTERNAL-IP       PORT(S)
# ingress-nginx-controller             LoadBalancer   10.110.xxx.xxx   149.28.xxx.xxx    80:30080/TCP,443:30443/TCP
```

**Save this IP address** - you'll need it for DNS configuration.

You can also get it with:
```bash
export LOAD_BALANCER_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "Load Balancer IP: $LOAD_BALANCER_IP"
```

---

## Step 3: Configure DNS Records

Point your domain to the load balancer IP address.

### Using Cloudflare (Example)

1. Log in to Cloudflare dashboard
2. Select your domain (`volaticloud.com`)
3. Go to **DNS** > **Records**
4. Add an **A record**:
   - **Type**: A
   - **Name**: `auth` (for auth.volaticloud.com)
   - **IPv4 address**: `<LOAD_BALANCER_IP>`
   - **Proxy status**: ⚠️ **DNS only** (orange cloud OFF)
   - **TTL**: Auto

**Important**: Disable Cloudflare proxy (orange cloud) initially. You can enable it later after TLS is working.

### Using Other DNS Providers

The process is similar for any DNS provider:
- Add an **A record** pointing `auth.volaticloud.com` to your load balancer IP
- Wait 5-10 minutes for DNS propagation

### Verify DNS Propagation

```bash
# Check if DNS is resolving
dig auth.volaticloud.com +short
# Should return: <LOAD_BALANCER_IP>

# Or use nslookup
nslookup auth.volaticloud.com
```

---

## Step 4: Update Keycloak Ingress with IngressClass

The Keycloak operator created an ingress without specifying the ingress class. Let's update it:

```bash
# Check current ingress
kubectl get ingress -n keycloak volaticloud-keycloak-ingress -o yaml

# Patch the ingress to use nginx class
kubectl patch ingress volaticloud-keycloak-ingress -n keycloak \
  --type=json \
  -p='[{"op": "add", "path": "/spec/ingressClassName", "value": "nginx"}]'

# Verify the change
kubectl get ingress -n keycloak volaticloud-keycloak-ingress
# Should now show ADDRESS with the load balancer IP
```

---

## Step 5: Test HTTP Access

Once DNS propagates and ingress is configured:

```bash
# Test HTTP access (should work)
curl http://auth.volaticloud.com/auth

# Should return HTML or redirect response from Keycloak
```

You can also visit in browser: `http://auth.volaticloud.com/auth`

---

## Step 6: Install cert-manager for Automatic TLS

cert-manager automatically provisions and renews SSL certificates from Let's Encrypt.

### Install cert-manager

```bash
# Add cert-manager helm repo
helm repo add jetstack https://charts.jetstack.io
helm repo update

# Install cert-manager with CRDs
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true

# Verify installation
kubectl get pods -n cert-manager
# Should see 3 pods running: cert-manager, cert-manager-cainjector, cert-manager-webhook
```

### Create Let's Encrypt ClusterIssuer

Create a ClusterIssuer for Let's Encrypt:

```bash
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    # Let's Encrypt production server
    server: https://acme-v02.api.letsencrypt.org/directory
    # Email for certificate expiry notifications
    email: your-email@example.com  # CHANGE THIS
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

**Important**: Replace `your-email@example.com` with your actual email.

### Create Staging Issuer (Optional, for Testing)

For testing, use Let's Encrypt staging to avoid rate limits:

```bash
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: your-email@example.com  # CHANGE THIS
    privateKeySecretRef:
      name: letsencrypt-staging-key
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

---

## Step 7: Enable TLS on Keycloak Ingress

Update the ingress to request a TLS certificate:

```bash
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: volaticloud-keycloak-ingress
  namespace: keycloak
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/backend-protocol: "HTTP"
    nginx.ingress.kubernetes.io/proxy-buffer-size: "128k"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - auth.volaticloud.com
    secretName: keycloak-tls-cert  # cert-manager will create this secret
  rules:
  - host: auth.volaticloud.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: volaticloud-keycloak-service
            port:
              number: 8080
EOF
```

### Monitor Certificate Issuance

```bash
# Watch certificate request
kubectl get certificate -n keycloak
kubectl describe certificate keycloak-tls-cert -n keycloak

# Check certificate challenge (should complete in 1-2 minutes)
kubectl get challengerequests -n keycloak
kubectl get orders -n keycloak

# Once ready, check the certificate
kubectl get certificate -n keycloak keycloak-tls-cert
# Should show: READY = True
```

---

## Step 8: Verify HTTPS Access

Once certificate is issued:

```bash
# Test HTTPS (should work with valid certificate)
curl https://auth.volaticloud.com/auth

# Check certificate details
openssl s_client -connect auth.volaticloud.com:443 -servername auth.volaticloud.com < /dev/null 2>/dev/null | openssl x509 -noout -text | grep -A2 "Subject:"
```

Visit in browser: `https://auth.volaticloud.com/auth`

---

## Step 9: Access Keycloak Admin Console

### Get Admin Credentials

```bash
# Get admin username
kubectl get secret volaticloud-keycloak-initial-admin \
  -n keycloak -o jsonpath='{.data.username}' | base64 -d && echo

# Get admin password
kubectl get secret volaticloud-keycloak-initial-admin \
  -n keycloak -o jsonpath='{.data.password}' | base64 -d && echo
```

### Login to Admin Console

1. Visit: `https://auth.volaticloud.com/auth/admin`
2. Login with admin credentials from above
3. Verify realm `volaticloud` exists
4. Check clients: `volaticloud-dashboard` and `volaticloud-api`

---

## Troubleshooting

### Issue: Ingress has no ADDRESS

```bash
# Check ingress controller is running
kubectl get pods -n ingress-nginx

# Check load balancer service
kubectl get svc -n ingress-nginx

# Check ingress has ingressClassName
kubectl get ingress -n keycloak volaticloud-keycloak-ingress -o yaml | grep ingressClassName
```

**Fix**: Ensure nginx ingress controller is installed and ingress has `ingressClassName: nginx`

### Issue: DNS not resolving

```bash
# Check DNS propagation
dig auth.volaticloud.com +short

# If empty, wait 5-10 minutes for propagation
# If wrong IP, update DNS record
```

### Issue: Certificate not issuing

```bash
# Check cert-manager logs
kubectl logs -n cert-manager deploy/cert-manager

# Check certificate status
kubectl describe certificate keycloak-tls-cert -n keycloak

# Check challenges
kubectl get challenges -n keycloak
kubectl describe challenge <challenge-name> -n keycloak

# Common issues:
# - DNS not propagated yet (wait 10 minutes)
# - Ingress not configured correctly
# - Let's Encrypt rate limit (use staging issuer for testing)
```

### Issue: Cloudflare SSL Error

If using Cloudflare proxy (orange cloud):
1. Set SSL/TLS mode to **Full (strict)**
2. Or disable proxy temporarily to test
3. Install Cloudflare Origin Certificate instead of Let's Encrypt

### Issue: Keycloak shows "Invalid hostname"

Update Keycloak instance hostname configuration:

```bash
# Check current hostname
kubectl get keycloak volaticloud-keycloak -n keycloak -o yaml | grep hostname

# Should match your domain (auth.volaticloud.com)
# If not, update KEYCLOAK_HOSTNAME secret and redeploy
```

---

## Complete Setup Summary

After completing all steps:

- ✅ Nginx Ingress Controller installed
- ✅ Vultr Load Balancer provisioned
- ✅ DNS A record pointing to load balancer IP
- ✅ cert-manager installed
- ✅ Let's Encrypt ClusterIssuer configured
- ✅ TLS certificate issued and installed
- ✅ Keycloak accessible at `https://auth.volaticloud.com/auth`
- ✅ Admin console at `https://auth.volaticloud.com/auth/admin`

---

## Quick Command Reference

```bash
# Check everything is running
kubectl get pods -n keycloak
kubectl get pods -n ingress-nginx
kubectl get pods -n cert-manager

# Check load balancer IP
kubectl get svc -n ingress-nginx ingress-nginx-controller

# Check ingress status
kubectl get ingress -n keycloak

# Check certificate status
kubectl get certificate -n keycloak

# Get admin credentials
kubectl get secret volaticloud-keycloak-initial-admin -n keycloak \
  -o jsonpath='{.data.username}' | base64 -d && echo
kubectl get secret volaticloud-keycloak-initial-admin -n keycloak \
  -o jsonpath='{.data.password}' | base64 -d && echo

# Test access
curl -I https://auth.volaticloud.com/auth
```

---

## Security Recommendations

1. **Change admin password** immediately after first login
2. **Enable MFA** for admin account
3. **Restrict admin console access** via network policies or IP whitelist
4. **Enable audit logging** in Keycloak
5. **Regular backups** of Keycloak database
6. **Monitor certificate expiry** (cert-manager auto-renews, but monitor anyway)
7. **Use strong realm settings** (password policies, session timeouts)

---

## Next Steps

After public access is working:

1. Configure OIDC clients for your applications
2. Set up user registration and email verification
3. Configure identity providers (Google, GitHub, etc.)
4. Set up proper backup and disaster recovery
5. Configure monitoring and alerting

---

**Last Updated**: 2025-11-13
