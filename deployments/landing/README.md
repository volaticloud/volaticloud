# Landing Page Deployment

Kubernetes deployment configuration for the VolatiCloud landing page using Caddy.

## Features

- **Multi-stage Build**: Node.js for building + Caddy for serving
- **SPA Routing**: Proper handling for React Router
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, etc.
- **Auto-scaling**: HPA configured for 2-10 replicas based on CPU/memory
- **High Availability**: Pod anti-affinity and PDB for resilience

## URL

- Landing: https://volaticloud.com

## Local Development

```bash
cd landing
npm install
npm run dev
```

## Docker Build

```bash
cd landing
docker build -t volaticloud-landing .
docker run -p 8080:8080 volaticloud-landing
```
