import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        allowedHosts: true,
        proxy: {
            // Proxy all gateway routes to backend (GraphQL, health, bot proxy)
            '/gateway': {
                target: 'http://localhost:8080',
                changeOrigin: true,
            },
            // Proxy FreqUI to same origin (fixes cross-origin iframe access)
            // FreqUI is built with base path /frequi/ so no rewrite needed
            // In production, FreqUI is bundled with dashboard (see Dockerfile)
            // For local dev, run FreqUI separately: cd frequi && pnpm dev --port 8181 --base /frequi/
            // Or use the Docker image: docker build -t dashboard ./dashboard && docker run -p 8080:8080 dashboard
            '/frequi': {
                target: 'http://localhost:8181',
                changeOrigin: true,
            }
        }
    }
})
