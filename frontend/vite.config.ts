import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Le tunnel magique :
      '/orthanc': {
        target: 'http://p6_orthanc:8042', 
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/orthanc/, ''),
        secure: false,
      },
    },
    watch: {
      usePolling: true
    }
  },
})