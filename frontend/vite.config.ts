/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const BACKEND_URL = process.env.SAS_BACKEND_URL ?? 'http://127.0.0.1:8747'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 4747,
    strictPort: true,
    // The browser only ever talks to the Vite dev server; /api is proxied to the local backend.
    proxy: {
      '/api': { target: BACKEND_URL, changeOrigin: false },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4747,
    proxy: {
      '/api': { target: BACKEND_URL, changeOrigin: false },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
