# FreqUI Deployment

FreqUI is the official web UI for Freqtrade trading bots.

## Production URL

- **URL:** https://frequi.volaticloud.com

## Architecture

- **Image:** Based on `freqtradeorg/frequi:latest`
- **Runtime:** nginx serving static files on port 80
- **Helm Chart:** `nixys/nxs-universal-chart`

## Features

- High availability (2 min replicas, up to 10 with HPA)
- TLS with Let's Encrypt certificates
- Pod anti-affinity for distribution across nodes
- Pod Disruption Budget for safe evictions
- Rolling updates with zero downtime

## Usage

FreqUI connects to Freqtrade bot instances. Users configure the bot API URL through the FreqUI interface:

1. Open https://frequi.volaticloud.com
2. Click "Login" and enter your bot's API URL
3. Authenticate with your bot's username/password

## CI/CD

### Build Pipeline

- **Workflow:** `.github/workflows/build-frequi.yml`
- **Triggers:** Push to `main` affecting `frequi/` directory
- **Output:** Docker image pushed to `ghcr.io/volaticloud/volaticloud-frequi`

### Deploy Pipeline

- **Workflow:** `.github/workflows/deploy-frequi.yml`
- **Triggers:** After successful build, or manual dispatch
- **Environment:** `prod`
- **Rollback:** Automatic on failure

## Manual Deployment

```bash
# Add Helm repo
helm repo add nixys https://registry.nixys.io/chartrepo/public
helm repo update

# Deploy
helm upgrade --install volaticloud-frequi nixys/nxs-universal-chart \
  --namespace volaticloud \
  -f deployments/frequi/values.yaml \
  --set deployments.volaticloud-frequi.containers[0].image=ghcr.io/volaticloud/volaticloud-frequi \
  --set deployments.volaticloud-frequi.containers[0].imageTag=<tag>
```

## Resources

- **CPU:** 50m request, 200m limit
- **Memory:** 64Mi request, 128Mi limit