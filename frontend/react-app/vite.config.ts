import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Keep JS route code-splitting (small initial bundle) but bundle ALL CSS into
    // one always-loaded stylesheet. With per-chunk CSS, a page that uses a shared
    // class (e.g. .qms-table) defined in another page's CSS renders unstyled on a
    // direct reload, because only that page's CSS chunk loads. One CSS file avoids
    // it entirely; total CSS is small (~15 kB gzip).
    cssCodeSplit: false,
  },
  server: {
    port: 3000,
    // Proxy API calls to the FastAPI backend so the browser stays same-origin
    // in dev (no CORS preflight). Frontend code uses a relative baseURL of
    // `/api/v1` — see src/api/client.ts and .env.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
