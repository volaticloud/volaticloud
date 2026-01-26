# Dashboard Deployment

Kubernetes deployment configuration for the VolatiCloud dashboard using Caddy.

## Features

- **Runtime Configuration**: Environment variables with `VOLATICLOUD__` prefix automatically map to `/config.json`
- **Multi-stage Build**: Node.js for building + Caddy for serving
- **Bundled FreqUI**: FreqUI (Freqtrade's web UI) is built and served at `/frequi/`
- **SPA Routing**: Proper handling for React Router (both dashboard and FreqUI)
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, etc.
- **Gateway Proxy**: Routes `/gateway/*` to the backend service
- **Auto-scaling**: HPA configured for 2-10 replicas based on CPU/memory
- **High Availability**: Pod anti-affinity and PDB for resilience

## URLs

- Dashboard: https://console.volaticloud.com
- FreqUI: https://console.volaticloud.com/frequi/
- Gateway: https://console.volaticloud.com/gateway/

## Environment Variables

Set in `deployments/dashboard/values.yaml`:

- `VOLATICLOUD__GATEWAY_URL`: Gateway API base URL (always `/gateway/v1` - backend is internal-only, see ADR-0019)

## Local Development

```bash
cd dashboard
npm install
npm run dev
```

The local config is read from `public/config.json`.
