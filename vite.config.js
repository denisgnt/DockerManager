import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = parseInt(env.VITE_PORT || '3011')
  const backendPort = parseInt(env.VITE_BACKEND_PORT || '5005')

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0', // Слушать на всех интерфейсах (важно для Docker)
      port,
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/socket.io': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
          ws: true,
        }
      }
    }
  }
})
