import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The built app is served by the Node backend from frontend/dist. During
// development, `npm run frontend` starts Vite on 5173 and proxies the API to
// the backend on 5174 so both run side by side with hot reload.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: process.env.AUTOSHORTS_API || 'http://localhost:5174',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
  },
});
