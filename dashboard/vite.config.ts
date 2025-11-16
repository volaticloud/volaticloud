import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        allowedHosts: true,
        proxy: {
            '/query': {
                target: 'http://localhost:8080',
                changeOrigin: true,
            }
        }
    }
})
