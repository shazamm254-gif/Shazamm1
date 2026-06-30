import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The frontend only ever talks to the backend. During dev, Vite proxies every
// /api/* request to the Express server (PORT from .env, default 8787) so the
// browser never needs a key and there are no CORS headaches.
const BACKEND_PORT = process.env.PORT || 8787

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // listen on 0.0.0.0 so it works inside Termux / on a phone
    proxy: {
      '/api': {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
      },
    },
  },
})
