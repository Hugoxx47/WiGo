import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true
    },
    proxy: {
      '/orthanc': {
        target: 'http://p6_orthanc:8042', 
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/orthanc/, '')
      }
    },
  },
})