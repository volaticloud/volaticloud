# Dashboard Deployment

Kubernetes deployment configuration for the VolatiCloud dashboard using Caddy.

## Features

- **Runtime Configuration**: Environment variables with `VOLATICLOUD__` prefix automatically map to `/config.json`
- **Multi-stage Build**: Node.js for building + Caddy for serving
- **SPA Routing**: Proper handling for React Router
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, etc.
- **Auto-scaling**: HPA configured for 2-10 replicas based on CPU/memory
- **High Availability**: Pod anti-affinity and PDB for resilience

## URL

- Production: https://console.volaticloud.com

## Environment Variables

Set in `deployments/dashboard/values.yaml`:

- `VOLATICLOUD__GRAPHQL_URL`: GraphQL API endpoint (default: https://api.volaticloud.com/query)

## Local Development

```bash
cd dashboard
npm install
npm run dev
```

The local config is read from `public/config.json`.
