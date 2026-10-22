import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = (env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // Proxy all /api calls to the Express backend in development.
        // This avoids CORS issues and makes cookie-based auth work seamlessly.
        '/api': {
          target: apiBase,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
