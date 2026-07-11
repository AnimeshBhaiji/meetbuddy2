import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    watch: {
      // backend writes prefs/session JSON on every request — keep it out of
      // the frontend watcher so those writes can never trigger reloads
      ignored: ['**/backend/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    },
    allowedHosts: [
      '.ngrok-free.app',   // ✅ allow ALL ngrok subdomains
    ],
  },
})
